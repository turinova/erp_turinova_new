import { extractImagesFromProductExtend, fetchProductImages } from '@/lib/shoprenter-image-service'
import { getShopRenterRateLimiter } from '@/lib/shoprenter-rate-limiter'
import { isTransientSupabaseClientError, retryTransientAsync, retryWithBackoff } from '@/lib/retry-with-backoff'
import {
  extractShopNameFromUrl,
  constructProductUrl,
  extractUrlAlias,
  extractParentProductId,
  fetchAttributeDescription,
} from '@/lib/shoprenter-product-sync-helpers'


/**
 * Ensure a unit exists in the units table, create it if it doesn't
 * @param supabase Supabase client
 * @param measurementUnit The measurement unit shortform (e.g., "db", "kg", "Test")
 * @returns The unit ID if found or created, null if measurementUnit is empty
 */
async function ensureUnitExists(supabase: any, measurementUnit: string | null | undefined): Promise<string | null> {
  if (!measurementUnit || !measurementUnit.trim()) {
    return null
  }

  const trimmedUnit = measurementUnit.trim()

  // Check if unit already exists by shortform
  const { data: existingUnit } = await supabase
    .from('units')
    .select('id')
    .eq('shortform', trimmedUnit)
    .is('deleted_at', null)
    .maybeSingle()

  if (existingUnit) {
    return existingUnit.id
  }

  // Unit doesn't exist, create it
  // Use the shortform as the name if it's a simple unit, otherwise capitalize first letter
  const unitName = trimmedUnit.length > 0 
    ? trimmedUnit.charAt(0).toUpperCase() + trimmedUnit.slice(1).toLowerCase()
    : trimmedUnit

  const { data: newUnit, error } = await supabase
    .from('units')
    .insert({
      name: unitName,
      shortform: trimmedUnit
    })
    .select('id')
    .single()

  if (error) {
    console.error(`[SYNC] Failed to create unit "${trimmedUnit}":`, error)
    // Don't throw - just log and return null, we'll still save the measurement_unit in the description
    return null
  }

  console.log(`[SYNC] Auto-created unit: "${unitName}" (${trimmedUnit})`)
  return newUnit.id
}

/**
 * Ensure a manufacturer exists in the manufacturers table, create it if it doesn't
 * @param supabase Supabase client
 * @param manufacturerName The manufacturer/brand name (e.g., "Samsung", "Apple")
 * @returns The manufacturer ID if found or created, null if manufacturerName is empty
 */
export async function ensureManufacturerExists(supabase: any, manufacturerName: string | null | undefined): Promise<string | null> {
  if (!manufacturerName || !manufacturerName.trim()) {
    return null
  }

  const trimmedName = manufacturerName.trim()

  // Check if manufacturer already exists by name
  const { data: existingManufacturer } = await supabase
    .from('manufacturers')
    .select('id')
    .eq('name', trimmedName)
    .is('deleted_at', null)
    .maybeSingle()

  if (existingManufacturer) {
    return existingManufacturer.id
  }

  // Manufacturer doesn't exist, create it
  const { data: newManufacturer, error } = await supabase
    .from('manufacturers')
    .insert({
      name: trimmedName
    })
    .select('id')
    .single()

  if (error) {
    console.error(`[SYNC] Failed to create manufacturer "${trimmedName}":`, error)
    // Don't throw - just log and return null, we'll still save the brand in the product
    return null
  }

  console.log(`[SYNC] Auto-created manufacturer: "${trimmedName}"`)
  return newManufacturer.id
}

/**
 * Ensure a weight unit exists in the weight_units table, create it if it doesn't
 * @param supabase Supabase client
 * @param weightUnitName The weight unit name (e.g., "Kilogramm", "Gramm")
 * @param weightUnitShortform The weight unit shortform (e.g., "kg", "g")
 * @param shoprenterWeightClassId Optional ShopRenter weightClass ID for mapping
 * @returns The weight unit ID if found or created, null if weightUnitName is empty
 */
async function ensureWeightUnitExists(
  supabase: any, 
  weightUnitName: string | null | undefined,
  weightUnitShortform: string | null | undefined,
  shoprenterWeightClassId?: string | null
): Promise<string | null> {
  if (!weightUnitName || !weightUnitName.trim()) {
    return null
  }

  const trimmedName = weightUnitName.trim()
  const trimmedShortform = weightUnitShortform?.trim() || trimmedName.toLowerCase().substring(0, 10)

  // Check if weight unit already exists by name
  const { data: existingWeightUnit } = await supabase
    .from('weight_units')
    .select('id')
    .eq('name', trimmedName)
    .is('deleted_at', null)
    .maybeSingle()

  if (existingWeightUnit) {
    // Update shoprenter_weight_class_id if provided and not set
    if (shoprenterWeightClassId && !existingWeightUnit.shoprenter_weight_class_id) {
      await supabase
        .from('weight_units')
        .update({ shoprenter_weight_class_id: shoprenterWeightClassId })
        .eq('id', existingWeightUnit.id)
    }
    return existingWeightUnit.id
  }

  // Check by shortform as fallback
  const { data: existingByShortform } = await supabase
    .from('weight_units')
    .select('id')
    .eq('shortform', trimmedShortform)
    .is('deleted_at', null)
    .maybeSingle()

  if (existingByShortform) {
    // Update shoprenter_weight_class_id if provided and not set
    if (shoprenterWeightClassId && !existingByShortform.shoprenter_weight_class_id) {
      await supabase
        .from('weight_units')
        .update({ shoprenter_weight_class_id: shoprenterWeightClassId })
        .eq('id', existingByShortform.id)
    }
    return existingByShortform.id
  }

  // Weight unit doesn't exist, create it
  const { data: newWeightUnit, error } = await supabase
    .from('weight_units')
    .insert({
      name: trimmedName,
      shortform: trimmedShortform,
      shoprenter_weight_class_id: shoprenterWeightClassId || null
    })
    .select('id')
    .single()

  if (error) {
    console.error(`[SYNC] Failed to create weight unit "${trimmedName}":`, error)
    return null
  }

  console.log(`[SYNC] Auto-created weight unit: "${trimmedName}" (${trimmedShortform})`)
  return newWeightUnit.id
}

/**
 * Sync a single product to database
 * @param attributeDescriptionsMap Optional map of attributeId -> {display_name, prefix, postfix} for batch-fetched attributes
 */
export async function syncProductToDatabase(
  supabase: any,
  connection: any,
  product: any,
  forceSync: boolean = false,
  apiBaseUrl?: string,
  authHeaderParam?: string,
  attributeDescriptionsMap?: Map<string, { display_name: string | null; prefix: string | null; postfix: string | null }>,
  tenantId?: string,
  attributeGroupNamesMap?: Map<string, string | null>,
  productClassName?: string | null,
  manufacturerName?: string | null
) {
  try {
    console.log(`[SYNC] syncProductToDatabase called for product ${product.sku}`)
    console.log(`[SYNC] apiBaseUrl provided: ${!!apiBaseUrl}, value: ${apiBaseUrl || 'none'}`)
    console.log(`[SYNC] authHeaderParam provided: ${!!authHeaderParam}, length: ${authHeaderParam?.length || 0}`)
    
    // Validate product has required fields
    if (!product.id) {
      throw new Error('Termék hiányzik az ID mező')
    }
    if (!product.sku) {
      throw new Error('Termék hiányzik az SKU mező')
    }

    // Extract URL information
    const urlAliasData = extractUrlAlias(product)
    const shopName = extractShopNameFromUrl(connection.api_url)
    const productUrl = shopName && urlAliasData.slug ? constructProductUrl(shopName, urlAliasData.slug) : null
    
    // Log URL extraction for debugging
    if (urlAliasData.slug) {
      console.log(`[SYNC] Extracted URL for product ${product.sku}: slug="${urlAliasData.slug}", id="${urlAliasData.id}", full="${productUrl}"`)
    } else {
      console.log(`[SYNC] No URL alias found for product ${product.sku}`)
    }

    // Extract parent product ID (if this is a child/variant)
    const parentShopRenterId = extractParentProductId(product)
    let parentProductId: string | null = null
    
    // If this product has a parent, find the parent product in our database
    if (parentShopRenterId) {
      // CRITICAL: Check if ShopRenter is saying this product is its own parent (invalid)
      if (parentShopRenterId === product.id) {
        console.warn(`[SYNC] Product ${product.sku} has parent pointing to itself in ShopRenter API. Ignoring invalid parent.`)
        parentProductId = null
      } else {
        // Log for debugging
        console.log(`[SYNC] Product ${product.sku} has parent in ShopRenter: ${parentShopRenterId}`)
        
        const { data: parentProduct, error: parentError } = await supabase
          .from('shoprenter_products')
          .select('id, sku')
          .eq('connection_id', connection.id)
          .eq('shoprenter_id', parentShopRenterId)
          .single()
        
        if (parentError) {
          // Parent not found yet - will be updated in post-sync step
          console.log(`[SYNC] Product ${product.sku} has parent ${parentShopRenterId} but parent not found in database yet (will be updated in post-sync)`)
        } else if (parentProduct) {
          // The parent lookup is already validated at the top (parentShopRenterId !== product.id)
          // So we can safely set the parent ID here
          parentProductId = parentProduct.id
          console.log(`[SYNC] Product ${product.sku} is a child of parent ${parentProduct.sku} (${parentProduct.id})`)
        }
      }
    } else {
      // Log when no parent is found in API response
      if (product.parentProduct) {
        console.warn(`[SYNC] Product ${product.sku} has parentProduct field but couldn't extract ID:`, JSON.stringify(product.parentProduct))
      }
    }

    // Extract Product Class ID
    let productClassShoprenterId: string | null = null
    if (product.productClass) {
      if (typeof product.productClass === 'object' && product.productClass.id) {
        productClassShoprenterId = product.productClass.id
      } else if (product.productClass.href) {
        // Extract ID from href like: "http://shopname.api.myshoprenter.hu/productClasses/cHJvZHVjdENsYXNzLXByb2R1Y3RfY2xhc3NfaWQ9MQ=="
        const hrefParts = product.productClass.href.split('/')
        productClassShoprenterId = hrefParts[hrefParts.length - 1] || null
      }
    }
    if (productClassShoprenterId) {
      console.log(`[SYNC] Product ${product.sku} - Found Product Class ID: ${productClassShoprenterId}`)
    } else {
      console.log(`[SYNC] Product ${product.sku} - No Product Class assigned`)
    }

    // Extract product attributes (productAttributeExtend from ShopRenter)
    // This contains structured attributes like size, color, dimensions, etc.
    // Fetch display names from AttributeDescription for each attribute
    console.log(`[SYNC] Product ${product.sku} - Checking productAttributeExtend...`)
    console.log(`[SYNC] productAttributeExtend exists: ${!!product.productAttributeExtend}`)
    console.log(`[SYNC] productAttributeExtend isArray: ${Array.isArray(product.productAttributeExtend)}`)
    console.log(`[SYNC] productAttributeExtend length: ${product.productAttributeExtend?.length || 0}`)
    if (product.productAttributeExtend && product.productAttributeExtend.length > 0) {
      console.log(`[SYNC] First attribute sample:`, JSON.stringify(product.productAttributeExtend[0], null, 2).substring(0, 500))
    }
    
    let productAttributes = null
    if (product.productAttributeExtend && Array.isArray(product.productAttributeExtend) && product.productAttributeExtend.length > 0) {
      console.log(`[SYNC] Processing ${product.productAttributeExtend.length} attributes for product ${product.sku}`)
      
      // Process attributes - use pre-fetched descriptions if available, otherwise fall back to internal name
      productAttributes = []
      for (const attr of product.productAttributeExtend) {
        // Extract attribute ID - can be in id field or href
        let attributeId = attr.id || null
        if (!attributeId && attr.href) {
          // Extract ID from href like: "http://shopname.api.myshoprenter.hu/listAttributes/bGlzdEF0dHJpYnV0ZS1hdHRyaWJ1dGVfaWQ9Mg=="
          const hrefParts = attr.href.split('/')
          attributeId = hrefParts[hrefParts.length - 1] || null
        }
        
        // Get display name from pre-fetched map if available
        let displayName = attr.name // Fallback to internal name
        let prefix = null
        let postfix = null
        let groupName = null // Group name (e.g., "Fiók", "Méret", "Szín")
        
        if (attributeId && attributeDescriptionsMap && attributeDescriptionsMap.has(attributeId)) {
          const desc = attributeDescriptionsMap.get(attributeId)!
          if (desc.display_name) {
            displayName = desc.display_name
            prefix = desc.prefix
            postfix = desc.postfix
            console.log(`[SYNC] Using pre-fetched display name for "${attr.name}": "${displayName}"`)
          } else {
            console.warn(`[SYNC] AttributeDescription found for "${attr.name}" (ID: ${attributeId}) but display_name is null`)
          }
        } else if (attributeId && attributeDescriptionsMap) {
          console.warn(`[SYNC] AttributeDescription NOT found in map for "${attr.name}" (ID: ${attributeId}). Map has ${attributeDescriptionsMap.size} entries. Available IDs: ${Array.from(attributeDescriptionsMap.keys()).slice(0, 5).join(', ')}...`)
        } else if (attributeId && apiBaseUrl && authHeaderParam && !attributeDescriptionsMap) {
          // Fallback: fetch individually only if batch map not provided (backward compatibility)
          try {
            const rateLimiter = getShopRenterRateLimiter(tenantId)
            const desc = await rateLimiter.execute(() =>
              fetchAttributeDescription(
                apiBaseUrl,
                authHeaderParam,
                attributeId,
                attr.type as 'LIST' | 'INTEGER' | 'FLOAT' | 'TEXT'
              )
            )
            if (desc.display_name) {
              displayName = desc.display_name
              prefix = desc.prefix
              postfix = desc.postfix
            }
          } catch (error) {
            console.warn(`[SYNC] Failed to fetch display name for attribute ${attr.name}:`, error)
          }
        }

        // Get group name from Product Class name (primary) or fallback to widget descriptions map
        // Product Class name takes priority as it's the correct source according to ShopRenter documentation
        if (productClassName) {
          groupName = productClassName
          console.log(`[SYNC] Using Product Class name "${productClassName}" as group_name for "${attr.name}"`)
        } else if (attributeId && attributeGroupNamesMap && attributeGroupNamesMap.has(attributeId)) {
          // Fallback to widget description (deprecated approach)
          groupName = attributeGroupNamesMap.get(attributeId) || null
          if (groupName) {
            console.log(`[SYNC] Using pre-fetched widget description group name for "${attr.name}": "${groupName}"`)
          }
        }

        // For LIST attributes, extract and store listAttributeValue ID
        // This is critical for syncing values back to ShopRenter
        let processedValue = attr.value
        if (attr.type === 'LIST' && Array.isArray(attr.value) && attr.value.length > 0) {
          processedValue = await Promise.all(
            attr.value.map(async (listValue: any) => {
              const processedListValue = { ...listValue }
              
              // Try to extract listAttributeValue ID from the description
              // The description should have a listAttributeValue href or id
              if (listValue.listAttributeValue?.id) {
                // Already have the ID in full response
                processedListValue.listAttributeValueId = listValue.listAttributeValue.id
                console.log(`[SYNC] Extracted listAttributeValue ID from full response for "${attr.name}": ${processedListValue.listAttributeValueId}`)
              } else if (listValue.listAttributeValue?.href) {
                // Extract ID from href: "http://shop.api.myshoprenter.hu/listAttributeValues/{id}"
                const hrefMatch = listValue.listAttributeValue.href.match(/\/listAttributeValues\/([^\/\?]+)/)
                if (hrefMatch && hrefMatch[1]) {
                  processedListValue.listAttributeValueId = hrefMatch[1]
                  console.log(`[SYNC] Extracted listAttributeValue ID from href for "${attr.name}": ${processedListValue.listAttributeValueId}`)
                }
              }
              
              // If we still don't have the ID, try to fetch it from the description
              // This is a fallback for when full=1 doesn't include the nested data
              if (!processedListValue.listAttributeValueId && (listValue.id || listValue.href) && apiBaseUrl && authHeaderParam) {
                try {
                  const descId = listValue.id || (listValue.href ? listValue.href.split('/').pop()?.split('?')[0] : null)
                  if (descId) {
                    const descUrl = `${apiBaseUrl}/listAttributeValueDescriptions/${encodeURIComponent(descId)}?full=1`
                    const descResponse = await shopFetch(descUrl, {
                      method: 'GET',
                      headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'Authorization': authHeaderParam
                      },
                      signal: AbortSignal.timeout(5000)
                    })
                    
                    if (descResponse.ok) {
                      const descData = await descResponse.json()
                      if (descData.listAttributeValue?.id) {
                        processedListValue.listAttributeValueId = descData.listAttributeValue.id
                        console.log(`[SYNC] Fetched listAttributeValue ID from description for "${attr.name}": ${processedListValue.listAttributeValueId}`)
                      } else if (descData.listAttributeValue?.href) {
                        const hrefMatch = descData.listAttributeValue.href.match(/\/listAttributeValues\/([^\/\?]+)/)
                        if (hrefMatch && hrefMatch[1]) {
                          processedListValue.listAttributeValueId = hrefMatch[1]
                          console.log(`[SYNC] Extracted listAttributeValue ID from description href for "${attr.name}": ${processedListValue.listAttributeValueId}`)
                        }
                      }
                    } else {
                      console.warn(`[SYNC] Failed to fetch description for "${attr.name}" to extract listAttributeValue ID: ${descResponse.status}`)
                    }
                  }
                } catch (error) {
                  console.warn(`[SYNC] Error fetching listAttributeValue ID for "${attr.name}":`, error)
                  // Don't fail the entire sync if this fails - fallback strategies will handle it
                }
              }
              
              return processedListValue
            })
          )
        }

        productAttributes.push({
          type: attr.type, // LIST, INTEGER, FLOAT, TEXT
          name: attr.name, // Internal identifier (e.g., "meret", "szin")
          id: attributeId, // Store attribute_shoprenter_id for filtering
          attribute_shoprenter_id: attributeId, // Also store as attribute_shoprenter_id for consistency
          display_name: displayName, // Display name (e.g., "Méret", "Szín") - PRIMARY
          group_name: groupName, // Group name (e.g., "Fiók", "Méret", "Szín") - NEW
          prefix: prefix, // Text before value
          postfix: postfix, // Text after value
          value: processedValue // Can be array (LIST) or single value (INTEGER/FLOAT/TEXT)
        })
      }
      
      // For LIST attributes, fetch and store productListAttributeValueRelation IDs
      // This enables direct updates during sync without searching
      if (productAttributes && productAttributes.length > 0) {
        const listAttributes = productAttributes.filter((attr: any) => attr.type === 'LIST')
        
        if (listAttributes.length > 0 && apiBaseUrl && authHeaderParam && product.id) {
          try {
            // Fetch all relations for this product
            const relationsUrl = `${apiBaseUrl}/productListAttributeValueRelations?productId=${encodeURIComponent(product.id)}&full=1`
            const relationsResponse = await shopFetch(relationsUrl, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': authHeaderParam
              },
              signal: AbortSignal.timeout(5000)
            })
            
            if (relationsResponse.ok) {
              const relationsData = await relationsResponse.json()
              const relations = relationsData.items || relationsData.productListAttributeValueRelations?.productListAttributeValueRelation || []
              const relationsArray = Array.isArray(relations) ? relations : [relations].filter(Boolean)
              
              console.log(`[SYNC] Found ${relationsArray.length} productListAttributeValueRelations for product ${product.sku}`)
              
              // Create a map of listAttribute ID -> relation
              // We need to match by the listAttribute ID (not listAttributeValue ID)
              const relationMap = new Map<string, any>()
              
              for (const relation of relationsArray) {
                // Get the listAttribute ID from the relation's listAttributeValue
                let listAttributeId: string | null = null
                
                if (relation.listAttributeValue) {
                  if (typeof relation.listAttributeValue === 'object') {
                    // If we have full data, get listAttribute ID from listAttributeValue.listAttribute
                    if (relation.listAttributeValue.listAttribute?.id) {
                      listAttributeId = relation.listAttributeValue.listAttribute.id
                    } else if (relation.listAttributeValue.listAttribute?.href) {
                      const hrefMatch = relation.listAttributeValue.listAttribute.href.match(/\/listAttributes\/([^\/\?]+)/)
                      if (hrefMatch && hrefMatch[1]) {
                        listAttributeId = hrefMatch[1]
                      }
                    }
                    
                    // If we still don't have it, we might need to fetch the listAttributeValue
                    if (!listAttributeId && relation.listAttributeValue.id) {
                      try {
                        const valueUrl = `${apiBaseUrl}/listAttributeValues/${encodeURIComponent(relation.listAttributeValue.id)}?full=1`
                        const valueResponse = await shopFetch(valueUrl, {
                          method: 'GET',
                          headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                            'Authorization': authHeaderParam
                          },
                          signal: AbortSignal.timeout(5000)
                        })
                        
                        if (valueResponse.ok) {
                          const valueData = await valueResponse.json()
                          if (valueData.listAttribute?.id) {
                            listAttributeId = valueData.listAttribute.id
                          } else if (valueData.listAttribute?.href) {
                            const hrefMatch = valueData.listAttribute.href.match(/\/listAttributes\/([^\/\?]+)/)
                            if (hrefMatch && hrefMatch[1]) {
                              listAttributeId = hrefMatch[1]
                            }
                          }
                        }
                      } catch (error) {
                        console.warn(`[SYNC] Error fetching listAttributeValue to get listAttribute ID:`, error)
                      }
                    }
                  }
                }
                
                if (listAttributeId && relation.id) {
                  relationMap.set(listAttributeId, relation)
                  console.log(`[SYNC] Mapped relation ${relation.id} to listAttribute ${listAttributeId}`)
                }
              }
              
              // Add relation IDs to attributes
              for (const attr of listAttributes) {
                // Get the attribute ID from productAttributeExtend
                let attributeId: string | null = null
                if (product.productAttributeExtend && Array.isArray(product.productAttributeExtend)) {
                  const matchingAttr = product.productAttributeExtend.find((a: any) => a.name === attr.name)
                  if (matchingAttr) {
                    attributeId = matchingAttr.id || null
                    if (!attributeId && matchingAttr.href) {
                      const hrefParts = matchingAttr.href.split('/')
                      attributeId = hrefParts[hrefParts.length - 1] || null
                    }
                  }
                }
                
                if (attributeId && relationMap.has(attributeId)) {
                  const relation = relationMap.get(attributeId)
                  if (Array.isArray(attr.value) && attr.value.length > 0) {
                    attr.value[0].relationId = relation.id
                    console.log(`[SYNC] Stored relation ID ${relation.id} for attribute "${attr.name}"`)
                  }
                }
              }
            } else {
              console.warn(`[SYNC] Failed to fetch productListAttributeValueRelations for product ${product.sku}: ${relationsResponse.status}`)
            }
          } catch (error) {
            console.warn(`[SYNC] Error fetching relations for product ${product.sku}:`, error)
            // Don't fail the entire sync if this fails - we can still use search during sync
          }
        }
      }
      
      // Log what we're storing
      console.log(`[SYNC] Processed ${productAttributes.length} attributes for product ${product.sku}:`)
      productAttributes.forEach((attr: any) => {
        if (attr.type === 'LIST' && Array.isArray(attr.value) && attr.value[0]) {
          console.log(`  - ${attr.name}: display_name="${attr.display_name || 'NOT SET'}", group_name="${attr.group_name || 'NOT SET'}", type=${attr.type}, hasListAttributeValueId=${!!attr.value[0].listAttributeValueId}, hasRelationId=${!!attr.value[0].relationId}`)
        } else {
        console.log(`  - ${attr.name}: display_name="${attr.display_name || 'NOT SET'}", group_name="${attr.group_name || 'NOT SET'}", type=${attr.type}`)
        }
      })
    }

    // Extract manufacturer from productExtend (non-blocking - won't fail sync if extraction fails)
    let manufacturerId: string | null = null // ShopRenter manufacturer ID
    let erp_manufacturer_id: string | null = null // ERP manufacturer ID (from manufacturers table)
    try {
      // If manufacturerName was provided from batch fetch, use it (for batch sync performance)
      if (manufacturerName) {
        erp_manufacturer_id = await ensureManufacturerExists(supabase, manufacturerName)
        // Extract manufacturer ID from product.manufacturer if available
      if (product.manufacturer) {
          if (typeof product.manufacturer === 'object' && product.manufacturer.id) {
            manufacturerId = product.manufacturer.id
          } else if (product.manufacturer.href) {
            const hrefParts = product.manufacturer.href.split('/')
            const lastPart = hrefParts[hrefParts.length - 1]
            if (lastPart && lastPart !== 'manufacturers') {
              manufacturerId = lastPart
            }
          }
        }
        console.log(`[SYNC] Using batch-fetched manufacturer name: "${manufacturerName}" (ShopRenter ID: ${manufacturerId}, ERP ID: ${erp_manufacturer_id}) for product ${product.sku}`)
      } else if (product.manufacturer) {
        // Fallback: Extract from product.manufacturer (for single product sync or when batch fetch didn't work)
        // manufacturer can be an object with name and id properties, or just href
        if (typeof product.manufacturer === 'object') {
          if (product.manufacturer.name) {
            const manufacturerNameFromProduct = product.manufacturer.name
            // Auto-create manufacturer in ERP if it doesn't exist
            erp_manufacturer_id = await ensureManufacturerExists(supabase, manufacturerNameFromProduct)
          }
          if (product.manufacturer.id) {
            manufacturerId = product.manufacturer.id
          }
          console.log(`[SYNC] Extracted manufacturer: "${product.manufacturer.name || 'no name'}" (ShopRenter ID: ${manufacturerId}, ERP ID: ${erp_manufacturer_id}) for product ${product.sku}`)
        } else if (product.manufacturer.href) {
          // Extract ID from href if available
          const hrefParts = product.manufacturer.href.split('/')
          const lastPart = hrefParts[hrefParts.length - 1]
          if (lastPart && lastPart !== 'manufacturers') {
            manufacturerId = lastPart
          }
          console.log(`[SYNC] Manufacturer href found for product ${product.sku}: ${product.manufacturer.href}, extracted ID: ${manufacturerId}`)
          // Note: If we only have href and no batch-fetched name, we can't auto-create manufacturer without name
          // This should only happen if batch fetch failed or for single product sync without full=1
        }
      }
    } catch (manufacturerError: any) {
      // Non-blocking: log error but continue sync
      console.warn(`[SYNC] Failed to extract manufacturer for product ${product.sku}:`, manufacturerError?.message || manufacturerError)
      // Continue with brand = null and manufacturerId = null
    }

    // Extract taxClass and map to VAT
    let vat_id: string | null = null
    let shoprenter_tax_class_id: string | null = null
    let gross_price: number | null = null

    // Log taxClass extraction for debugging
    console.log(`[SYNC] Product ${product.sku} - Checking taxClass...`)
    console.log(`[SYNC] product.taxClass:`, JSON.stringify(product.taxClass, null, 2))
    
    // Handle taxClass - can be in different formats
    let taxClassId: string | null = null
    if (product.taxClass) {
      if (typeof product.taxClass === 'string') {
        taxClassId = product.taxClass
      } else if (product.taxClass.id) {
        taxClassId = product.taxClass.id
      } else if (product.taxClass.href) {
        // Extract ID from href like: "http://shopname.api.myshoprenter.hu/taxClasses/dGF4Q2xhc3MtdGF4X2NsYXNzX2lkPTEw"
        const hrefMatch = product.taxClass.href.match(/\/taxClasses\/([^\/\?]+)/)
        if (hrefMatch && hrefMatch[1]) {
          taxClassId = hrefMatch[1]
        }
      }
    }

    if (taxClassId) {
      shoprenter_tax_class_id = taxClassId
      console.log(`[SYNC] Product ${product.sku} - Found taxClass ID: ${taxClassId}`)
      
      // Find mapping: ShopRenter taxClass → ERP vat_id
      const { data: mapping, error: mappingError } = await supabase
        .from('shoprenter_tax_class_mappings')
        .select('vat_id')
        .eq('connection_id', connection.id)
        .eq('shoprenter_tax_class_id', taxClassId)
        .single()
      
      if (mappingError) {
        console.warn(`[SYNC] Product ${product.sku} - No VAT mapping found for taxClass ${taxClassId}:`, mappingError.message)
      } else if (mapping) {
        vat_id = mapping.vat_id
        console.log(`[SYNC] Product ${product.sku} - Mapped taxClass ${taxClassId} to vat_id: ${vat_id}`)
      } else {
        console.warn(`[SYNC] Product ${product.sku} - No VAT mapping found for taxClass ${taxClassId}`)
      }
    } else {
      console.log(`[SYNC] Product ${product.sku} - No taxClass found in product data`)
    }

    // Calculate gross_price from net + VAT
    const netPrice = product.price ? parseFloat(product.price) : null
    
    // Log cost and multiplier for debugging
    if (product.cost) {
      console.log(`[SYNC] Product ${product.sku} - Cost from ShopRenter: ${product.cost}`)
    }
    if (product.multiplier) {
      console.log(`[SYNC] Product ${product.sku} - Multiplier from ShopRenter: ${product.multiplier}, Locked: ${product.multiplierLock}`)
    }
    
    // Edge case handling for PULL (ShopRenter → ERP)
    let finalCost = product.cost ? parseFloat(product.cost) : null
    let finalMultiplier = product.multiplier ? parseFloat(product.multiplier) : 1.0
    let finalPrice = netPrice

    if (finalPrice && finalPrice > 0) {
      // Case 2: Has cost, no multiplier (or multiplier is 1.0) -> calculate multiplier
      if (finalCost && finalCost > 0 && (!product.multiplier || parseFloat(product.multiplier) === 1.0)) {
        finalMultiplier = finalPrice / finalCost
        console.log(`[SYNC] Product ${product.sku} - Calculated multiplier from cost: ${finalMultiplier.toFixed(3)} (price: ${finalPrice}, cost: ${finalCost})`)
      }
      
      // Case 3: No cost, has multiplier (and multiplier is not 1.0) -> calculate cost
      if (!finalCost && finalMultiplier > 0 && finalMultiplier !== 1.0) {
        finalCost = finalPrice / finalMultiplier
        console.log(`[SYNC] Product ${product.sku} - Calculated cost from multiplier: ${finalCost.toFixed(2)} (price: ${finalPrice}, multiplier: ${finalMultiplier})`)
      }
      
      // Case 4: Has both, but don't match -> validate and fix
      if (finalCost && finalCost > 0 && finalMultiplier > 0) {
        const expectedPrice = finalCost * finalMultiplier
        const difference = Math.abs(finalPrice - expectedPrice)
        
        if (difference > 0.01) {
          console.warn(`[SYNC] Product ${product.sku} - ⚠️ Price mismatch: cost (${finalCost}) × multiplier (${finalMultiplier}) = ${expectedPrice.toFixed(2)}, but price is ${finalPrice}`)
          // Fix multiplier to match price / cost (more reliable than fixing price)
          finalMultiplier = finalPrice / finalCost
          console.log(`[SYNC] Product ${product.sku} - Fixed multiplier to: ${finalMultiplier.toFixed(3)}`)
        }
      }
    } else {
      // Case 5: No price -> clear cost and multiplier
      finalCost = null
      finalMultiplier = 1.0
      console.log(`[SYNC] Product ${product.sku} - No price found, clearing cost and multiplier`)
    }
    
    if (finalPrice && vat_id) {
      // Fetch VAT rate
      const { data: vat } = await supabase
        .from('vat')
        .select('kulcs')
        .eq('id', vat_id)
        .single()
      
      if (vat) {
        gross_price = Math.round(finalPrice * (1 + vat.kulcs / 100))
      }
    }

    // Extract dimensions and weight units (non-blocking)
    let width: number | null = null
    let height: number | null = null
    let length: number | null = null
    let weight: number | null = null
    let erp_weight_unit_id: string | null = null
    let shoprenter_volume_unit_id: string | null = null
    let shoprenter_weight_unit_id: string | null = null
    
    try {
      // Extract dimensions (width, height, length) - stored in cm by default
      if (product.width !== undefined && product.width !== null && product.width !== '') {
        width = parseFloat(String(product.width))
      }
      if (product.height !== undefined && product.height !== null && product.height !== '') {
        height = parseFloat(String(product.height))
      }
      if (product.length !== undefined && product.length !== null && product.length !== '') {
        length = parseFloat(String(product.length))
      }
      
      // Extract weight
      if (product.weight !== undefined && product.weight !== null && product.weight !== '') {
        weight = parseFloat(String(product.weight))
      }
      
      // Extract volumeUnit (for dimensions - lengthClass)
      if (product.volumeUnit) {
        if (typeof product.volumeUnit === 'object' && product.volumeUnit.id) {
          shoprenter_volume_unit_id = product.volumeUnit.id
        } else if (product.volumeUnit.href) {
          const hrefParts = product.volumeUnit.href.split('/')
          shoprenter_volume_unit_id = hrefParts[hrefParts.length - 1] || null
        }
      }
      
      // Extract weightUnit and get/create ERP weight unit
      if (product.weightUnit) {
        let weightClassId: string | null = null
        if (typeof product.weightUnit === 'object' && product.weightUnit.id) {
          weightClassId = product.weightUnit.id
          shoprenter_weight_unit_id = weightClassId
        } else if (product.weightUnit.href) {
          const hrefParts = product.weightUnit.href.split('/')
          weightClassId = hrefParts[hrefParts.length - 1] || null
          shoprenter_weight_unit_id = weightClassId
        }
        
        // Fetch weightClassDescription to get unit name (if we have weightClassId and API access)
        if (weightClassId && apiBaseUrl && authHeaderParam) {
          try {
            // Try to fetch weightClassDescription for Hungarian language first, then any language
            const weightClassDescUrl = `${apiBaseUrl}/weightClassDescriptions?weightClassId=${encodeURIComponent(weightClassId)}&full=1`
            const weightClassDescResponse = await shopFetch(weightClassDescUrl, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': authHeaderParam
              },
              signal: AbortSignal.timeout(5000)
            })
            
            if (weightClassDescResponse.ok) {
              const weightClassDescData = await weightClassDescResponse.json()
              const descriptions = weightClassDescData?.items || weightClassDescData?.response?.items || []
              
              // Prefer Hungarian, fallback to first available
              const huDesc = descriptions.find((d: any) => d.language?.id?.includes('hu') || d.language?.innerId === '1')
              const desc = huDesc || descriptions[0]
              
              if (desc) {
                const weightUnitName = desc.title || desc.unit || null
                const weightUnitShortform = desc.unit || null
                
                if (weightUnitName) {
                  erp_weight_unit_id = await ensureWeightUnitExists(
                    supabase,
                    weightUnitName,
                    weightUnitShortform,
                    weightClassId
                  )
                  console.log(`[SYNC] Extracted weight unit: "${weightUnitName}" (${weightUnitShortform}) for product ${product.sku}`)
                }
              }
            }
          } catch (weightUnitError) {
            console.warn(`[SYNC] Failed to fetch weightClassDescription for product ${product.sku}:`, weightUnitError)
          }
        }
      }
    } catch (dimensionError) {
      console.warn(`[SYNC] Failed to extract dimensions/weight for product ${product.sku}:`, dimensionError)
      // Continue without dimensions - non-blocking
    }

    // Extract product data
    const productData: any = {
      connection_id: connection.id,
      shoprenter_id: product.id,
      shoprenter_inner_id: product.innerId || null,
      sku: product.sku || '',
      model_number: product.modelNumber || null, // Gyártói cikkszám (Manufacturer part number)
      gtin: product.gtin || null, // Vonalkód (Barcode/GTIN)
      name: null, // Will be set from description
      manufacturer_id: manufacturerId, // ShopRenter manufacturer ID for syncing back
      erp_manufacturer_id: erp_manufacturer_id, // ERP manufacturer ID (from manufacturers table)
      // Dimensions
      width: width,
      height: height,
      length: length,
      weight: weight,
      erp_weight_unit_id: erp_weight_unit_id,
      shoprenter_volume_unit_id: shoprenter_volume_unit_id,
      shoprenter_weight_unit_id: shoprenter_weight_unit_id,
      status: product.status === '1' || product.status === 1 ? 1 : 0,
      // Product Class
      product_class_shoprenter_id: productClassShoprenterId, // Store Product Class ID for attribute filtering
      // Pricing fields (Árazás) - using calculated values
      price: finalPrice, // Nettó ár
      cost: finalCost, // Beszerzési ár (calculated if needed)
      multiplier: Math.round(finalMultiplier * 1000) / 1000, // Árazási szorzó (calculated if needed, rounded to 3 decimals)
      multiplier_lock: product.multiplierLock === '1' || product.multiplierLock === 1 || product.multiplierLock === true, // Szorzó zárolás
      // VAT fields
      vat_id: vat_id,
      gross_price: gross_price,
      shoprenter_tax_class_id: shoprenter_tax_class_id,
      // Parent-child relationship
      parent_product_id: parentProductId, // UUID of parent product in our database
      // Product attributes (size, color, dimensions, etc.)
      product_attributes: productAttributes, // JSONB: stores productAttributeExtend data
      // URLs
      product_url: productUrl,
      url_slug: urlAliasData.slug,
      url_alias_id: urlAliasData.id,
      last_url_synced_at: urlAliasData.slug ? new Date().toISOString() : null,
      sync_status: 'synced',
      sync_error: null,
      last_synced_from_shoprenter_at: new Date().toISOString() // Track when we synced FROM ShopRenter
      // Note: Keep last_synced_at for backward compatibility (can be deprecated later)
    }

    // Resolve soft-delete restore before write (same row as upsert target)
    // IMPORTANT: Don't filter by deleted_at - we need to find soft-deleted products too
    const { data: existingProduct } = await supabase
      .from('shoprenter_products')
      .select('id, deleted_at, status')
      .eq('connection_id', connection.id)
      .eq('shoprenter_id', product.id)
      .maybeSingle()

    const isEnabledInShopRenter = product.status === '1' || product.status === 1
    if (existingProduct && existingProduct.deleted_at && isEnabledInShopRenter) {
      console.log(`[SYNC] Product ${product.sku} is soft-deleted in ERP but enabled in ShopRenter (status = ${product.status}). Restoring...`)
      productData.deleted_at = null
      productData.status = 1
    }

    // Single upsert avoids race: parallel sync batches can no longer double-insert the same (connection_id, shoprenter_id)
    const productResult = await retryTransientAsync(
      async () => {
        const r = await supabase
          .from('shoprenter_products')
          .upsert(productData, { onConflict: 'connection_id,shoprenter_id' })
          .select()
          .single()
        if (r.error && isTransientSupabaseClientError(r.error)) {
          throw new Error(r.error.message || 'transient supabase')
        }
        return r
      },
      { maxRetries: 4, initialDelayMs: 300, maxDelayMs: 8000 }
    )

    if (productResult.error) {
      console.error('Error syncing product to database:', productResult.error)
      throw new Error(`Adatbázis hiba: ${productResult.error.message || 'Ismeretlen hiba'}`)
    }

    if (!productResult.data) {
      throw new Error('Termék nem lett létrehozva/frissítve az adatbázisban')
    }

    const dbProduct = productResult.data

    // Prepare auth for API calls (use provided authHeader or create new one)
    let authHeader = authHeaderParam
    if (!authHeader) {
      const credentials = `${connection.username}:${connection.password}`
      const base64Credentials = Buffer.from(credentials).toString('base64')
      authHeader = `Basic ${base64Credentials}`
    }

    let apiUrl = apiBaseUrl || connection.api_url.replace(/\/$/, '')
    if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
      apiUrl = `http://${apiUrl}`
    }

    // Ensure all ShopRenter API calls go through the same tenant limiter.
    const rateLimiter = getShopRenterRateLimiter(tenantId)
    const shopFetch = (url: string, init: RequestInit) => rateLimiter.execute(() => fetch(url, init))

    // Fetch product descriptions if available
    // Note: No delay - descriptions are fetched per product but batches are already rate-limited
    if (product.productDescriptions?.href) {
      try {
        // Convert relative href to full URL if needed
        let descUrl = product.productDescriptions.href
        if (descUrl.startsWith('http://') || descUrl.startsWith('https://')) {
          // Already full URL
        } else if (descUrl.startsWith('/')) {
          descUrl = `${apiUrl}${descUrl}`
        } else {
          descUrl = `${apiUrl}/${descUrl}`
        }

        // Use retry logic for 429 rate limit errors
        const descResponse = await retryWithBackoff(
          () => shopFetch(descUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': authHeader
            },
            signal: AbortSignal.timeout(10000)
          }),
          {
            maxRetries: 3,
            initialDelayMs: 2000, // Start with 2 seconds for 429 errors
            maxDelayMs: 30000, // Max 30 seconds delay
            retryableStatusCodes: [429, 500, 502, 503, 504] // Retry on rate limit and server errors
          }
        )

        // Handle ShopRenter API errors according to documentation
        // Reference: https://doc.shoprenter.hu/development/api/02_status_codes.html
        if (!descResponse.ok) {
          const errorText = await descResponse.text().catch(() => 'Unknown error')
          let errorMessage = `ShopRenter API error (${descResponse.status})`
          
          // Parse error response if JSON
          try {
            const errorJson = JSON.parse(errorText)
            errorMessage = errorJson.message || errorJson.error || errorMessage
          } catch {
            if (errorText) {
              errorMessage = `${errorMessage}: ${errorText.substring(0, 200)}`
            }
          }
          
          // Handle specific ShopRenter error codes
          if (descResponse.status === 401) {
            console.error(`[SYNC] Authentication failed (401) for product ${product.sku}: ${errorMessage}`)
            // Continue - don't block sync for auth errors on descriptions
          } else if (descResponse.status === 404) {
            console.warn(`[SYNC] Product descriptions not found (404) for product ${product.sku} - this may be normal`)
            // Continue - 404 is acceptable if product has no descriptions
          } else if (descResponse.status === 429) {
            // After retries, if still 429, log but continue (retry logic already tried)
            console.error(`[SYNC] Rate limit exceeded (429) for product ${product.sku} after retries: ${errorMessage}`)
            // Skip this product's description but continue sync
            return
          } else if (descResponse.status === 403) {
            console.error(`[SYNC] Access forbidden (403) for product ${product.sku}: ${errorMessage}`)
            // Continue - but log the error
          } else if (descResponse.status >= 500) {
            console.error(`[SYNC] ShopRenter server error (${descResponse.status}) for product ${product.sku}: ${errorMessage}`)
            // Continue - server errors are temporary
          } else {
            console.error(`[SYNC] ShopRenter API error (${descResponse.status}) for product ${product.sku}: ${errorMessage}`)
          }
          
          // For non-retryable errors, continue but skip description processing
          return
        }

        if (descResponse.ok) {
          // Check content type
          const descContentType = descResponse.headers.get('content-type')
          if (!descContentType || !descContentType.includes('application/json')) {
            console.warn('Non-JSON description response, skipping')
            return
          }

          // Parse JSON safely
          let descData
          try {
            const descText = await descResponse.text()
            if (!descText || descText.trim().length === 0) {
              console.warn('Empty description response')
              return
            }
            descData = JSON.parse(descText)
          } catch (parseError) {
            console.error('Error parsing description JSON:', parseError)
            return
          }

          // Handle multiple response formats
          let descriptions: any[] = []
          if (descData.items) {
            descriptions = descData.items
          } else if (descData.response?.items) {
            descriptions = descData.response.items
          } else if (Array.isArray(descData)) {
            descriptions = descData
          } else if (descData.id) {
            // Single description
            descriptions = [descData]
          }

          // FIRST: Extract product name from descriptions (before smart sync check)
          let productNameToUpdate: string | null = null
          for (const desc of descriptions) {
            // Determine language code - handle multiple formats
            let languageCode = 'hu' // Default
            if (desc.language?.innerId) {
              languageCode = desc.language.innerId === '1' || desc.language.innerId === 1 ? 'hu' : 'en'
            } else if (desc.language?.id) {
              languageCode = 'hu'
            }
            
            // Extract name - prefer Hungarian, fallback to any language
            if (desc.name && desc.name.trim()) {
              if (languageCode === 'hu') {
                productNameToUpdate = desc.name.trim()
                break // Hungarian found, use it
              } else if (!productNameToUpdate) {
                // Fallback to first available name
                productNameToUpdate = desc.name.trim()
              }
            }
          }
          
          // Update product name immediately (before smart sync checks)
          if (productNameToUpdate) {
            const { data: updateData, error: updateError } = await supabase
              .from('shoprenter_products')
              .update({ name: productNameToUpdate })
              .eq('id', dbProduct.id)
            
            if (updateError) {
              console.error(`[SYNC] Failed to update product name for ${product.sku}:`, updateError)
              console.error(`[SYNC] Update error details:`, {
                code: updateError.code,
                message: updateError.message,
                details: updateError.details,
                hint: updateError.hint
              })
            } else {
              console.log(`[SYNC] Updated product name for ${product.sku}: ${productNameToUpdate}`)
              
              // CRITICAL: Also update description name for Hungarian description
              // This ensures the UI shows the correct name even if smart sync skips description content
              const { data: huDesc, error: huDescError } = await supabase
                .from('shoprenter_product_descriptions')
                .select('id')
                .eq('product_id', dbProduct.id)
                .eq('language_code', 'hu')
                .maybeSingle()
              
              if (huDesc && !huDescError) {
                const { error: descUpdateError } = await supabase
                  .from('shoprenter_product_descriptions')
                  .update({ name: productNameToUpdate })
                  .eq('id', huDesc.id)
                
                if (descUpdateError) {
                  console.error(`[SYNC] Failed to update description name for ${product.sku}:`, descUpdateError)
                } else {
                  console.log(`[SYNC] Updated description name for ${product.sku}: ${productNameToUpdate}`)
                }
              }
            }
          }

          // NOW process descriptions (with smart sync)
          for (const desc of descriptions) {
            // Determine language code - handle multiple formats
            let languageCode = 'hu' // Default
            if (desc.language?.innerId) {
              languageCode = desc.language.innerId === '1' || desc.language.innerId === 1 ? 'hu' : 'en'
            } else if (desc.language?.id) {
              // Try to extract from base64 ID or use default
              languageCode = 'hu'
            }

            // Check if description already exists
            const { data: existingDesc } = await supabase
              .from('shoprenter_product_descriptions')
              .select('*')
              .eq('product_id', dbProduct.id)
              .eq('language_code', languageCode)
              .single()

            // Smart sync: only update if empty or force sync
            if (!forceSync && existingDesc) {
              // Check if local descriptions are not empty
              const hasLocalContent = 
                (existingDesc.short_description && existingDesc.short_description.trim().length > 0) ||
                (existingDesc.description && existingDesc.description.trim().length > 0)
              
              if (hasLocalContent) {
                // Skip updating descriptions if local content exists (unless force sync)
                console.log(`Skipping description update for product ${product.sku} (local content exists, use force sync to overwrite)`)
                continue
              }
            }

            const descDataToSave = {
              product_id: dbProduct.id,
              language_code: languageCode,
              name: desc.name || '',
              meta_title: desc.metaTitle || null,
              meta_keywords: desc.metaKeywords || null,
              meta_description: desc.metaDescription || null,
              short_description: desc.shortDescription || null,
              description: desc.description || null,
              parameters: desc.parameters || null, // Add parameters field
              shoprenter_id: desc.id || null
            }

            // Upsert description (name already updated above)
            if (existingDesc) {
              await supabase
                .from('shoprenter_product_descriptions')
                .update(descDataToSave)
                .eq('id', existingDesc.id)
            } else {
              await supabase
                .from('shoprenter_product_descriptions')
                .insert(descDataToSave)
            }
          }
        }
      } catch (descError) {
        console.error('Error fetching descriptions:', descError)
        // Continue even if descriptions fail
      }
    }

    // If productDescriptions is an array (from productExtend)
    if (Array.isArray(product.productDescriptions)) {
      // FIRST: Extract product name from descriptions (before smart sync check)
      let productNameToUpdate: string | null = null
      
      for (const desc of product.productDescriptions) {
        // Determine language code
        let languageCode = 'hu' // Default
        if (desc.language?.innerId) {
          languageCode = desc.language.innerId === '1' || desc.language.innerId === 1 ? 'hu' : 'en'
        } else if (desc.language?.id) {
          languageCode = 'hu'
        }
        
        // Extract name - prefer Hungarian, fallback to any language
        if (desc.name && desc.name.trim()) {
          if (languageCode === 'hu') {
            productNameToUpdate = desc.name.trim()
            break // Hungarian found, use it
          } else if (!productNameToUpdate) {
            // Fallback to first available name
            productNameToUpdate = desc.name.trim()
          }
        }
      }
      
      // Update product name immediately (before smart sync checks)
      if (productNameToUpdate) {
        const { data: updateData, error: updateError } = await supabase
          .from('shoprenter_products')
          .update({ name: productNameToUpdate })
          .eq('id', dbProduct.id)
        
        if (updateError) {
          console.error(`[SYNC] Failed to update product name for ${product.sku}:`, updateError)
          console.error(`[SYNC] Update error details:`, {
            code: updateError.code,
            message: updateError.message,
            details: updateError.details,
            hint: updateError.hint
          })
        } else {
          console.log(`[SYNC] Updated product name for ${product.sku}: ${productNameToUpdate}`)
          
          // CRITICAL: Also update description name for Hungarian description
          // This ensures the UI shows the correct name even if smart sync skips description content
          const { data: huDesc, error: huDescError } = await supabase
            .from('shoprenter_product_descriptions')
            .select('id')
            .eq('product_id', dbProduct.id)
            .eq('language_code', 'hu')
            .maybeSingle()
          
          if (huDesc && !huDescError) {
            const { error: descUpdateError } = await supabase
              .from('shoprenter_product_descriptions')
              .update({ name: productNameToUpdate })
              .eq('id', huDesc.id)
            
            if (descUpdateError) {
              console.error(`[SYNC] Failed to update description name for ${product.sku}:`, descUpdateError)
            } else {
              console.log(`[SYNC] Updated description name for ${product.sku}: ${productNameToUpdate}`)
            }
          }
        }
      }
      
      // Track unit_id from descriptions (use Hungarian description as primary)
      let productUnitId: string | null = null

      // NOW process descriptions (with smart sync)
      for (const desc of product.productDescriptions) {
        // Determine language code
        let languageCode = 'hu' // Default
        if (desc.language?.innerId) {
          languageCode = desc.language.innerId === '1' || desc.language.innerId === 1 ? 'hu' : 'en'
        } else if (desc.language?.id) {
          languageCode = 'hu'
        }

        // Check if description already exists
        const { data: existingDesc } = await supabase
          .from('shoprenter_product_descriptions')
          .select('*')
          .eq('product_id', dbProduct.id)
          .eq('language_code', languageCode)
          .single()

        // Smart sync: only update if empty or force sync
        if (!forceSync && existingDesc) {
          // Check if local descriptions are not empty
          const hasLocalContent = 
            (existingDesc.short_description && existingDesc.short_description.trim().length > 0) ||
            (existingDesc.description && existingDesc.description.trim().length > 0)
          
          if (hasLocalContent) {
            // Skip updating descriptions if local content exists (unless force sync)
            console.log(`Skipping description update for product ${product.sku} (local content exists, use force sync to overwrite)`)
            continue
          }
        }

        // Ensure unit exists in units table if measurementUnit is provided
        const measurementUnit = desc.measurementUnit || null
        let unitId: string | null = null
        if (measurementUnit) {
          unitId = await ensureUnitExists(supabase, measurementUnit)
          // Use Hungarian description's unit_id for the product
          if (languageCode === 'hu' && unitId) {
            productUnitId = unitId
          }
        }

        const descDataToSave = {
          product_id: dbProduct.id,
          language_code: languageCode,
          name: desc.name || '',
          meta_title: desc.metaTitle || null,
          meta_keywords: desc.metaKeywords || null,
          meta_description: desc.metaDescription || null,
          short_description: desc.shortDescription || null,
          description: desc.description || null,
          parameters: desc.parameters || null, // Add parameters field
          measurement_unit: measurementUnit, // Add measurementUnit field (for ShopRenter sync compatibility)
          shoprenter_id: desc.id || null
        }

        // Upsert description (name already updated above)
        if (existingDesc) {
          await supabase
            .from('shoprenter_product_descriptions')
            .update(descDataToSave)
            .eq('id', existingDesc.id)
        } else {
          await supabase
            .from('shoprenter_product_descriptions')
            .insert(descDataToSave)
        }
      }

      // Update product with unit_id (from Hungarian description)
      if (productUnitId) {
        await supabase
          .from('shoprenter_products')
          .update({ unit_id: productUnitId })
          .eq('id', dbProduct.id)
      } else {
        // If no unit found, set default to 'db' (Darab)
        const { data: defaultUnit } = await supabase
          .from('units')
          .select('id')
          .eq('shortform', 'db')
          .is('deleted_at', null)
          .maybeSingle()
        
        if (defaultUnit) {
          await supabase
            .from('shoprenter_products')
            .update({ unit_id: defaultUnit.id })
            .eq('id', dbProduct.id)
        }
      }
    }

    // Extract and store product images
    try {
      const extractedImages = extractImagesFromProductExtend(product, product.id)
      
      if (extractedImages.length > 0) {
        // Try to fetch images from ShopRenter API to get alt text and ShopRenter IDs
        let shoprenterImages: any[] = []
        try {
          const shopName = extractShopNameFromUrl(connection.api_url)
          if (shopName) {
            // Use product.shoprenter_id (ShopRenter's ID), not our internal ID
            shoprenterImages = await fetchProductImages(
              {
                apiUrl: connection.api_url,
                username: connection.username,
                password: connection.password,
                shopName: shopName
              },
              product.id, // This is the ShopRenter product ID from productExtend
              tenantId
            )
            console.log(`[SYNC] Fetched ${shoprenterImages.length} images from ShopRenter API for product ${product.sku}`)
            if (shoprenterImages.length > 0) {
              console.log(`[SYNC] ShopRenter images:`, shoprenterImages.map(img => ({ path: img.imagePath, alt: img.imageAlt, id: img.id })))
            }
            if (product.imageAlt) {
              console.log(`[SYNC] Main image alt from productExtend: "${product.imageAlt}"`)
            }
          }
        } catch (fetchError: any) {
          // Non-fatal: continue with extracted images from allImages
          console.warn(`[SYNC] Failed to fetch images from ShopRenter API for product ${product.sku}:`, fetchError?.message || fetchError)
        }

        // Delete existing images for this product (to handle removed images)
        await supabase
          .from('product_images')
          .delete()
          .eq('product_id', dbProduct.id)

        // Insert/update images
        for (const img of extractedImages) {
          const imageData: any = {
            product_id: dbProduct.id,
            connection_id: connection.id,
            image_path: img.imagePath,
            image_url: img.imageUrl,
            sort_order: img.sortOrder,
            is_main_image: img.isMain,
            last_synced_at: new Date().toISOString()
          }

          // For main image, check productExtend.imageAlt first (this is the main image alt text)
          if (img.isMain && product.imageAlt) {
            imageData.alt_text = product.imageAlt
            imageData.alt_text_status = 'synced'
            imageData.alt_text_synced_at = new Date().toISOString()
            console.log(`[SYNC] Set main image alt text from productExtend: "${product.imageAlt}"`)
          }

          // Try to find matching ShopRenter image to get alt text and ID
          // Use flexible matching: normalize paths for comparison
          const normalizePath = (path: string) => {
            if (!path) return ''
            // Remove leading "data/" if present, normalize slashes, remove query params
            return path
              .replace(/^data\//, '')
              .replace(/\\/g, '/')
              .split('?')[0] // Remove query params
              .toLowerCase()
              .trim()
          }

          // Extract filename from path for better matching
          const getFilename = (path: string) => {
            if (!path) return ''
            const normalized = normalizePath(path)
            const parts = normalized.split('/')
            return parts[parts.length - 1] || normalized
          }

          const normalizedExtractedPath = normalizePath(img.imagePath)
          const extractedFilename = getFilename(img.imagePath)
          
          // Try multiple matching strategies
          const matchingShopRenterImage = shoprenterImages.find((srImg: any) => {
            const normalizedShopRenterPath = normalizePath(srImg.imagePath)
            const shoprenterFilename = getFilename(srImg.imagePath)
            
            // Strategy 1: Exact normalized path match
            if (normalizedExtractedPath === normalizedShopRenterPath) {
              return true
            }
            
            // Strategy 2: Filename match (most reliable for secondary images)
            if (extractedFilename && shoprenterFilename && extractedFilename === shoprenterFilename) {
              return true
            }
            
            // Strategy 3: Path ends match (one contains the other)
            if (normalizedExtractedPath && normalizedShopRenterPath) {
              if (normalizedExtractedPath.endsWith(normalizedShopRenterPath) ||
                  normalizedShopRenterPath.endsWith(normalizedExtractedPath)) {
                return true
              }
            }
            
            // Strategy 4: Check if sortOrder matches (for secondary images)
            // This is a fallback if path matching fails
            if (!img.isMain && srImg.sortOrder && img.sortOrder === srImg.sortOrder) {
              return true
            }
            
            return false
          })

          if (matchingShopRenterImage) {
            imageData.shoprenter_image_id = matchingShopRenterImage.id
            // Only set alt text from productImages if we don't already have it from productExtend
            if (!imageData.alt_text && matchingShopRenterImage.imageAlt) {
              imageData.alt_text = matchingShopRenterImage.imageAlt
              imageData.alt_text_status = 'synced'
              imageData.alt_text_synced_at = new Date().toISOString()
              console.log(`[SYNC] ✓ Matched and set alt text from productImages for ${img.isMain ? 'main' : 'secondary'} image ${img.imagePath}: "${matchingShopRenterImage.imageAlt}"`)
            } else if (!imageData.alt_text) {
              imageData.alt_text_status = 'pending'
              console.log(`[SYNC] ⚠ Matched ShopRenter image for ${img.imagePath} but no alt text available`)
            } else {
              console.log(`[SYNC] ✓ Matched ShopRenter image for ${img.imagePath} (alt text already set from productExtend)`)
            }
          } else {
            // No match found - log details for debugging
            if (!imageData.alt_text) {
              imageData.alt_text_status = 'pending'
            }
            console.log(`[SYNC] ⚠ No matching ShopRenter image found for ${img.isMain ? 'main' : 'secondary'} image:`)
            console.log(`[SYNC]   - Extracted path: "${img.imagePath}" (normalized: "${normalizedExtractedPath}", filename: "${extractedFilename}")`)
            console.log(`[SYNC]   - Sort order: ${img.sortOrder}`)
            if (shoprenterImages.length > 0) {
              console.log(`[SYNC]   - Available ShopRenter images:`, shoprenterImages.map((sr: any) => ({
                path: sr.imagePath,
                normalized: normalizePath(sr.imagePath),
                filename: getFilename(sr.imagePath),
                sortOrder: sr.sortOrder,
                alt: sr.imageAlt || '(no alt)'
              })))
            } else {
              console.log(`[SYNC]   - No ShopRenter images fetched from API`)
            }
          }

          await supabase
            .from('product_images')
            .upsert(imageData, {
              onConflict: 'product_id,image_path',
              ignoreDuplicates: false
            })
        }

        console.log(`[SYNC] Stored ${extractedImages.length} images for product ${product.sku}`)
      }
    } catch (imageError: any) {
      // Don't fail the entire sync if image extraction fails
      console.warn(`[SYNC] Failed to extract/store images for product ${product.sku}:`, imageError?.message || imageError)
    }

    // Sync product-category relations
    try {
      // Collect ShopRenter category IDs from the response
      const shoprenterCategoryIds = new Set<string>()
      
      if (product.productCategoryRelations && Array.isArray(product.productCategoryRelations) && product.productCategoryRelations.length > 0) {
        console.log(`[SYNC] Processing ${product.productCategoryRelations.length} product-category relations for product ${product.sku}`)
        
        for (const relation of product.productCategoryRelations) {
          try {
            // Extract IDs from hrefs
            const productShopRenterId = relation.product?.href?.match(/\/products\/([^\/\?]+)/)?.[1] || 
                                       relation.product?.id || 
                                       product.id // Fallback to current product ID
            
            const categoryShopRenterId = relation.category?.href?.match(/\/categories\/([^\/\?]+)/)?.[1] || 
                                        relation.category?.id || 
                                        null
            
            if (!categoryShopRenterId) {
              console.warn(`[SYNC] Skipping product-category relation for product ${product.sku}: missing category ID`)
              continue
            }

            // Track this category ID from ShopRenter
            shoprenterCategoryIds.add(categoryShopRenterId)

            // Find category in database
            const { data: categoryInDb } = await supabase
              .from('shoprenter_categories')
              .select('id')
              .eq('connection_id', connection.id)
              .eq('shoprenter_id', categoryShopRenterId)
              .is('deleted_at', null)
              .single()

            if (!categoryInDb) {
              console.warn(`[SYNC] Category ${categoryShopRenterId} not found in database for product ${product.sku} relation. Category may need to be synced first.`)
              continue
            }

            // Prepare relation data
            const relationData = {
              connection_id: connection.id,
              shoprenter_id: relation.id || `${productShopRenterId}-${categoryShopRenterId}`,
              product_id: dbProduct.id,
              category_id: categoryInDb.id,
              product_shoprenter_id: productShopRenterId,
              category_shoprenter_id: categoryShopRenterId,
              deleted_at: null
            }

            // Check if relation exists
            const { data: existingRelation } = await supabase
              .from('shoprenter_product_category_relations')
              .select('id')
              .eq('connection_id', connection.id)
              .eq('shoprenter_id', relationData.shoprenter_id)
              .single()

            if (existingRelation) {
              // Update existing relation
              const { error: updateError } = await supabase
                .from('shoprenter_product_category_relations')
                .update({
                  product_id: relationData.product_id,
                  category_id: relationData.category_id,
                  product_shoprenter_id: relationData.product_shoprenter_id,
                  category_shoprenter_id: relationData.category_shoprenter_id,
                  deleted_at: null
                })
                .eq('id', existingRelation.id)

              if (updateError) {
                console.error(`[SYNC] Failed to update product-category relation for product ${product.sku}:`, updateError)
              } else {
                console.log(`[SYNC] Updated product-category relation: product ${product.sku} -> category ${categoryShopRenterId}`)
              }
            } else {
              // Try to find by product_id + category_id (unique constraint)
              const { data: existingByProductCategory } = await supabase
                .from('shoprenter_product_category_relations')
                .select('id')
                .eq('product_id', dbProduct.id)
                .eq('category_id', categoryInDb.id)
                .single()

              if (existingByProductCategory) {
                // Update existing relation by product+category
                const { error: updateError } = await supabase
                  .from('shoprenter_product_category_relations')
                  .update({
                    shoprenter_id: relationData.shoprenter_id,
                    product_shoprenter_id: relationData.product_shoprenter_id,
                    category_shoprenter_id: relationData.category_shoprenter_id,
                    deleted_at: null
                  })
                  .eq('id', existingByProductCategory.id)

                if (updateError) {
                  console.error(`[SYNC] Failed to update product-category relation (by product+category) for product ${product.sku}:`, updateError)
                } else {
                  console.log(`[SYNC] Updated product-category relation (by product+category): product ${product.sku} -> category ${categoryShopRenterId}`)
                }
              } else {
                // Insert new relation
                const { error: insertError } = await supabase
                  .from('shoprenter_product_category_relations')
                  .insert(relationData)

                if (insertError) {
                  console.error(`[SYNC] Failed to insert product-category relation for product ${product.sku}:`, insertError)
                } else {
                  console.log(`[SYNC] Inserted product-category relation: product ${product.sku} -> category ${categoryShopRenterId}`)
                }
              }
            }
          } catch (relationError: any) {
            console.warn(`[SYNC] Error processing product-category relation for product ${product.sku}:`, relationError?.message || relationError)
            // Continue with next relation
          }
        }
      } else {
        console.log(`[SYNC] No product-category relations found for product ${product.sku}`)
      }

      // Now remove relations that exist in DB but not in ShopRenter (deleted in ShopRenter)
      // Get all current relations for this product in database
      const { data: allDbRelations } = await supabase
        .from('shoprenter_product_category_relations')
        .select('id, category_shoprenter_id')
        .eq('product_id', dbProduct.id)
        .is('deleted_at', null)

      if (allDbRelations && allDbRelations.length > 0) {
        // Find relations that exist in DB but not in ShopRenter response
        const relationsToDelete = allDbRelations.filter(rel => 
          rel.category_shoprenter_id && !shoprenterCategoryIds.has(rel.category_shoprenter_id)
        )

        if (relationsToDelete.length > 0) {
          console.log(`[SYNC] Found ${relationsToDelete.length} category relations to remove (deleted in ShopRenter) for product ${product.sku}`)
          
          // Soft-delete relations that were removed in ShopRenter
          const relationIdsToDelete = relationsToDelete.map(rel => rel.id)
          const { error: deleteError } = await supabase
            .from('shoprenter_product_category_relations')
            .update({ deleted_at: new Date().toISOString() })
            .in('id', relationIdsToDelete)

          if (deleteError) {
            console.error(`[SYNC] Failed to remove deleted category relations for product ${product.sku}:`, deleteError)
          } else {
            console.log(`[SYNC] Removed ${relationsToDelete.length} category relations (deleted in ShopRenter) for product ${product.sku}`)
          }
        }
      }
    } catch (relationSyncError: any) {
      // Don't fail the entire sync if relation sync fails
      console.warn(`[SYNC] Failed to sync product-category relations for product ${product.sku}:`, relationSyncError?.message || relationSyncError)
    }

    // Sync product tags (productTags)
    try {
      if (product.productTags && Array.isArray(product.productTags) && product.productTags.length > 0) {
        console.log(`[SYNC] Processing ${product.productTags.length} product tags for product ${product.sku}`)
        
        for (const tagData of product.productTags) {
          try {
            // Determine language code
            let languageCode = 'hu' // Default
            if (tagData.language?.innerId) {
              languageCode = tagData.language.innerId === '1' || tagData.language.innerId === 1 ? 'hu' : 'en'
            } else if (tagData.language?.id) {
              // Try to extract from href
              const langMatch = tagData.language.href?.match(/language[_-]language_id=(\d+)/i)
              if (langMatch) {
                languageCode = langMatch[1] === '1' ? 'hu' : 'en'
              }
            }

            // Get tags string (comma-separated)
            const tagsString = tagData.tags || ''
            
            if (!tagsString || tagsString.trim().length === 0) {
              console.log(`[SYNC] Skipping empty product tags for product ${product.sku}, language ${languageCode}`)
              continue
            }

            // Check if tag entry already exists
            const { data: existingTag } = await supabase
              .from('product_tags')
              .select('*')
              .eq('product_id', dbProduct.id)
              .eq('language_code', languageCode)
              .is('deleted_at', null)
              .single()

            const tagDataToSave = {
              product_id: dbProduct.id,
              connection_id: connection.id,
              language_code: languageCode,
              tags: tagsString.trim(),
              shoprenter_id: tagData.id || tagData.href?.split('/').pop() || null
            }

            if (existingTag) {
              // Update existing tag entry
              const { error: updateError } = await supabase
                .from('product_tags')
                .update(tagDataToSave)
                .eq('id', existingTag.id)

              if (updateError) {
                console.error(`[SYNC] Failed to update product tags for product ${product.sku}, language ${languageCode}:`, updateError)
              } else {
                console.log(`[SYNC] Updated product tags for product ${product.sku}, language ${languageCode}: "${tagsString}"`)
              }
            } else {
              // Insert new tag entry
              const { error: insertError } = await supabase
                .from('product_tags')
                .insert(tagDataToSave)

              if (insertError) {
                console.error(`[SYNC] Failed to insert product tags for product ${product.sku}, language ${languageCode}:`, insertError)
              } else {
                console.log(`[SYNC] Inserted product tags for product ${product.sku}, language ${languageCode}: "${tagsString}"`)
              }
            }
          } catch (tagError: any) {
            console.warn(`[SYNC] Error processing product tag for product ${product.sku}:`, tagError?.message || tagError)
            // Continue with next tag
          }
        }
      } else {
        console.log(`[SYNC] No product tags found for product ${product.sku}`)
      }
    } catch (tagSyncError: any) {
      // Don't fail the entire sync if tag sync fails
      console.warn(`[SYNC] Failed to sync product tags for product ${product.sku}:`, tagSyncError?.message || tagSyncError)
    }

    // Sync customer group prices FROM ShopRenter
    try {
      if (product.id && !product.id.startsWith('pending-')) {
        // Fetch customer group prices from ShopRenter
        const pricesResponse = await shopFetch(`${apiUrl}/customerGroupProductPrices?productId=${encodeURIComponent(product.id)}&full=1`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': authHeader
          },
          signal: AbortSignal.timeout(10000)
        })

        if (pricesResponse.ok) {
          const pricesData = await pricesResponse.json().catch(() => null)
          const prices = pricesData?.items || pricesData?.response?.items || []

          if (prices.length > 0) {
            console.log(`[SYNC] Found ${prices.length} customer group prices for product ${product.sku}`)

            for (const shoprenterPrice of prices) {
              const shoprenterPriceId = shoprenterPrice.id || shoprenterPrice.href?.split('/').pop()
              const priceValue = shoprenterPrice.price ? parseFloat(shoprenterPrice.price) : null
              const customerGroupId = shoprenterPrice.customerGroup?.id || shoprenterPrice.customerGroup?.href?.split('/').pop()

              if (!shoprenterPriceId || !priceValue || !customerGroupId) {
                continue
              }

              // Find or create customer group in ERP
              // First, try to find by ShopRenter ID
              let { data: customerGroup } = await supabase
                .from('customer_groups')
                .select('id')
                .eq('shoprenter_customer_group_id', customerGroupId)
                .is('deleted_at', null)
                .maybeSingle()

              // If not found, try to fetch customer group name from ShopRenter
              if (!customerGroup) {
                try {
                  const groupResponse = await shopFetch(`${apiUrl}/customerGroups/${customerGroupId}`, {
                    method: 'GET',
                    headers: {
                      'Content-Type': 'application/json',
                      'Accept': 'application/json',
                      'Authorization': authHeader
                    },
                    signal: AbortSignal.timeout(5000)
                  })

                  if (groupResponse.ok) {
                    const groupData = await groupResponse.json().catch(() => null)
                    const groupName = groupData?.name

                    if (groupName) {
                      // Create customer group in ERP
                      const code = groupName
                        .toUpperCase()
                        .replace(/[^A-Z0-9_]/g, '_')
                        .replace(/_+/g, '_')
                        .replace(/^_|_$/g, '')

                      const { data: newGroup, error: createError } = await supabase
                        .from('customer_groups')
                        .insert({
                          name: groupName,
                          code: code,
                          shoprenter_customer_group_id: customerGroupId,
                          is_default: false,
                          is_active: true
                        })
                        .select('id')
                        .single()

                      if (!createError && newGroup) {
                        customerGroup = newGroup
                        console.log(`[SYNC] Created customer group "${groupName}" for product ${product.sku}`)
                      }
                    }
                  }
                } catch (groupError) {
                  console.warn(`[SYNC] Failed to fetch customer group ${customerGroupId}:`, groupError)
                }
              }

              if (customerGroup) {
                // Upsert customer group price
                const { data: existingPrice } = await supabase
                  .from('product_customer_group_prices')
                  .select('id')
                  .eq('product_id', dbProduct.id)
                  .eq('customer_group_id', customerGroup.id)
                  .maybeSingle()

                const priceData = {
                  product_id: dbProduct.id,
                  customer_group_id: customerGroup.id,
                  price: priceValue,
                  shoprenter_customer_group_price_id: shoprenterPriceId,
                  last_synced_at: new Date().toISOString(),
                  is_active: true
                }

                if (existingPrice) {
                  await supabase
                    .from('product_customer_group_prices')
                    .update(priceData)
                    .eq('id', existingPrice.id)
                } else {
                  await supabase
                    .from('product_customer_group_prices')
                    .insert(priceData)
                }

                console.log(`[SYNC] Synced customer group price for product ${product.sku}: ${priceValue} Ft`)
              } else {
                console.warn(`[SYNC] Could not find or create customer group ${customerGroupId} for product ${product.sku}`)
              }
            }
          }
        } else {
          // 404 is acceptable - product might not have customer group prices
          if (pricesResponse.status !== 404) {
            const errorText = await pricesResponse.text().catch(() => 'Unknown error')
            console.warn(`[SYNC] Failed to fetch customer group prices for product ${product.sku}: ${pricesResponse.status} - ${errorText}`)
          }
        }
      }
    } catch (customerGroupPriceSyncError: any) {
      // Don't fail the entire sync if customer group price sync fails
      console.warn(`[SYNC] Error syncing customer group prices for product ${product.sku}:`, customerGroupPriceSyncError?.message || customerGroupPriceSyncError)
    }

    // Return product ID for tracking synced products
    return { productId: dbProduct.id }
  } catch (error) {
    console.error('Error in syncProductToDatabase:', error)
    throw error
  }
}
