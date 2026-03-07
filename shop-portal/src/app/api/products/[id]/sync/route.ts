import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { getConnectionById } from '@/lib/connections-server'
import {
  extractShopNameFromUrl,
  getShopRenterAuthHeader,
  getLanguageId,
  getProductDescriptionId,
  syncCustomerGroupToShopRenter,
  syncCustomerGroupPriceToShopRenter,
  syncProductSpecialToShopRenter
} from '@/lib/shoprenter-api'

/**
 * POST /api/products/[id]/sync
 * Sync product TO ShopRenter (push local changes) and then pull back to verify
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get product with description and tags (including soft-deleted products for sync)
    const { data: product, error: productError } = await supabase
      .from('shoprenter_products')
      .select(`
        *,
        webshop_connections(*),
        shoprenter_product_descriptions(*),
        product_tags(*)
      `)
      .eq('id', id)
      .single()

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // If product is soft-deleted, check ShopRenter status first
    // If ShopRenter has it enabled (status = 1), restore it in ERP
    // If ShopRenter has it disabled (status = 0), keep it disabled
    if (product.deleted_at) {
      console.log(`[SYNC] Product ${product.sku} is soft-deleted in ERP, checking ShopRenter status...`)
      
      const connection = product.webshop_connections
      if (!connection || connection.connection_type !== 'shoprenter') {
        return NextResponse.json({ error: 'Invalid connection' }, { status: 400 })
      }

      // Only check if product is synced to ShopRenter
      if (product.shoprenter_id && !product.shoprenter_id.startsWith('pending-')) {
        const shopName = extractShopNameFromUrl(connection.api_url)
        if (!shopName) {
          return NextResponse.json({ error: 'Invalid API URL format' }, { status: 400 })
        }

        const { authHeader, apiBaseUrl } = await getShopRenterAuthHeader(
          shopName,
          connection.username,
          connection.password,
          connection.api_url
        )

        // First, check current status in ShopRenter
        // Use productExtend to get full product data including status
        const checkResponse = await fetch(`${apiBaseUrl}/productExtend/${product.shoprenter_id}?full=1`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': authHeader
          },
          signal: AbortSignal.timeout(10000)
        })

        if (checkResponse.ok) {
          const shoprenterProduct = await checkResponse.json().catch(() => null)
          
          // Log the full response for debugging
          console.log(`[SYNC] ShopRenter product response:`, JSON.stringify(shoprenterProduct, null, 2).substring(0, 500))
          
          // Extract status - ShopRenter returns status as '1' (string) or 1 (number) for enabled
          // The response might be wrapped in a 'response' object or directly have 'status'
          let shoprenterStatus = shoprenterProduct?.status || shoprenterProduct?.response?.status
          
          // Handle different response formats
          if (shoprenterStatus === undefined && shoprenterProduct?.product) {
            shoprenterStatus = shoprenterProduct.product.status
          }
          
          console.log(`[SYNC] Extracted ShopRenter status: ${shoprenterStatus} (type: ${typeof shoprenterStatus})`)

          // If ShopRenter has it enabled (status = '1' or 1), restore it in ERP
          if (shoprenterStatus === '1' || shoprenterStatus === 1) {
            console.log(`[SYNC] Product is enabled in ShopRenter (status = ${shoprenterStatus}), restoring in ERP...`)
            
            // Restore product in ERP (set deleted_at = NULL)
            const { error: restoreError } = await supabase
              .from('shoprenter_products')
              .update({
                deleted_at: null,
                status: 1, // Ensure status is 1
                sync_status: 'synced',
                sync_error: null,
                last_synced_to_shoprenter_at: new Date().toISOString()
              })
              .eq('id', id)

            if (restoreError) {
              console.error(`[SYNC] Failed to restore product in ERP:`, restoreError)
              return NextResponse.json({
                success: false,
                error: `Nem sikerült visszaállítani a terméket: ${restoreError.message}`
              }, { status: 500 })
            }

            console.log(`[SYNC] ✅ Product restored in ERP (deleted_at = NULL, status = 1)`)
            return NextResponse.json({
              success: true,
              message: 'Termék visszaállítva (ShopRenter-ben engedélyezve volt)'
            })
          } else {
            // ShopRenter has it disabled, ensure it stays disabled
            console.log(`[SYNC] Product is disabled in ShopRenter (status = ${shoprenterStatus}), keeping disabled...`)
            
            // Ensure it's disabled in ShopRenter (in case it was changed manually)
            const disableResponse = await fetch(`${apiBaseUrl}/products/${product.shoprenter_id}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': authHeader
              },
              body: JSON.stringify({
                status: '0' // Disabled
              }),
              signal: AbortSignal.timeout(10000)
            })

            if (!disableResponse.ok) {
              const errorText = await disableResponse.text().catch(() => 'Unknown error')
              console.warn(`[SYNC] Failed to disable soft-deleted product in ShopRenter: ${disableResponse.status} - ${errorText}`)
            }

            // Update sync status
            await supabase
              .from('shoprenter_products')
              .update({
                sync_status: 'synced',
                sync_error: null,
                last_synced_to_shoprenter_at: new Date().toISOString()
              })
              .eq('id', id)

            return NextResponse.json({
              success: true,
              message: 'Törölt termék letiltva ShopRenter-ben'
            })
          }
        } else {
          // Failed to check ShopRenter status, assume it should be disabled
          console.warn(`[SYNC] Failed to check ShopRenter status for soft-deleted product: ${checkResponse.status}`)
          
          // Try to disable it anyway
          const disableResponse = await fetch(`${apiBaseUrl}/products/${product.shoprenter_id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': authHeader
            },
            body: JSON.stringify({
              status: '0' // Disabled
            }),
            signal: AbortSignal.timeout(10000)
          })

          await supabase
            .from('shoprenter_products')
            .update({
              sync_status: 'synced',
              sync_error: null,
              last_synced_to_shoprenter_at: new Date().toISOString()
            })
            .eq('id', id)

          return NextResponse.json({
            success: true,
            message: 'Törölt termék letiltva ShopRenter-ben'
          })
        }
      } else {
        // Product not yet synced, just update sync status
        await supabase
          .from('shoprenter_products')
          .update({
            sync_status: 'synced',
            sync_error: null
          })
          .eq('id', id)

        return NextResponse.json({
          success: true,
          message: 'Termék törölve (még nem volt szinkronizálva ShopRenter-be)'
        })
      }
    }

    const connection = product.webshop_connections
    if (!connection || connection.connection_type !== 'shoprenter') {
      return NextResponse.json({ error: 'Invalid connection' }, { status: 400 })
    }

    // Get Hungarian description (or first available)
    const descriptions = product.shoprenter_product_descriptions || []
    const huDescription = descriptions.find((d: any) => d.language_code === 'hu') || descriptions[0]
    
    if (!huDescription) {
      return NextResponse.json({ 
        success: false, 
        error: 'Nincs leírás a termékhez. Kérjük, mentse el a leírást először.' 
      }, { status: 400 })
    }

    // Extract shop name
    const shopName = extractShopNameFromUrl(connection.api_url)
    if (!shopName) {
      return NextResponse.json({ error: 'Invalid API URL format' }, { status: 400 })
    }

    // Get authentication
    const { authHeader, apiBaseUrl, useOAuth } = await getShopRenterAuthHeader(
      shopName,
      connection.username,
      connection.password,
      connection.api_url
    )

    // Get language ID
    const languageId = await getLanguageId(apiBaseUrl, authHeader, 'hu')
    if (!languageId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Nem sikerült meghatározni a nyelv azonosítóját' 
      }, { status: 500 })
    }

    // Check if this is a new product (has placeholder shoprenter_id)
    // Use let so we can flip this flag if we discover the product already exists in ShopRenter (409 conflict handling)
    let isNewProduct = product.shoprenter_id?.startsWith('pending-') || product.sync_status === 'pending'
    
    // If new product, create it in ShopRenter first
    if (isNewProduct) {
      console.log(`[SYNC] 🆕 New product detected (${product.sku}), creating in ShopRenter...`)
      
      // Calculate price
      let priceToSend: number | null = product.price ? parseFloat(product.price.toString()) : null
      const cost = product.cost ? parseFloat(product.cost.toString()) : null
      const multiplier = product.multiplier ? parseFloat(product.multiplier.toString()) : 1.0

      if (!priceToSend || priceToSend <= 0) {
        if (cost && cost > 0 && multiplier > 0) {
          priceToSend = cost * multiplier
          console.log(`[SYNC] Calculated price from cost × multiplier: ${priceToSend.toFixed(2)}`)
        } else {
          return NextResponse.json({ 
            success: false, 
            error: 'Cannot create product without price. Please set a price or provide both cost and multiplier.' 
          }, { status: 400 })
        }
      }

      // Build productExtend payload for new product
      const productExtendPayload: any = {
        sku: product.sku,
        price: String(priceToSend),
        multiplier: '1.0',
        multiplierLock: '1',
        status: product.status?.toString() || '1',
        orderable: '1',
        stock1: '0',
        stock2: '0',
        subtractStock: '1',
        shipped: '1',
        minimalOrderNumber: '1',
        maximalOrderNumber: '0',
        minimalOrderNumberMultiply: '0',
        availableDate: '0000-00-00',
        quantity: '0.0000',
        sortOrder: '0',
        freeShipping: '0',
        durableMediaDevice: '0'
      }

      // Add cost to ShopRenter (költség field) for new products
      if (cost !== null && cost !== undefined && !isNaN(cost) && isFinite(cost) && cost > 0) {
        productExtendPayload.cost = String(Math.round(cost * 100) / 100) // Round to 2 decimal places
        console.log(`[SYNC] ✅ Added cost to new product payload: ${productExtendPayload.cost}`)
      }

      // Add modelNumber if exists
      if (product.model_number !== null && product.model_number !== undefined) {
        productExtendPayload.modelNumber = product.model_number || ''
      }

      // Add gtin if exists
      if (product.gtin !== null && product.gtin !== undefined) {
        productExtendPayload.gtin = product.gtin || ''
      }

      // Add dimensions (width, height, length) - stored in cm
      const width = (product as any).width
      const height = (product as any).height
      const length = (product as any).length
      if (width !== null && width !== undefined) {
        productExtendPayload.width = String(width)
      }
      if (height !== null && height !== undefined) {
        productExtendPayload.height = String(height)
      }
      if (length !== null && length !== undefined) {
        productExtendPayload.length = String(length)
      }

      // Add weight
      const weight = (product as any).weight
      if (weight !== null && weight !== undefined) {
        productExtendPayload.weight = String(weight)
      }

      // Add volumeUnit (for dimensions - default to cm if not set)
      const shoprenterVolumeUnitId = (product as any).shoprenter_volume_unit_id
      if (shoprenterVolumeUnitId) {
        productExtendPayload.volumeUnit = {
          id: shoprenterVolumeUnitId
        }
        console.log(`[SYNC] Adding volumeUnit: ${shoprenterVolumeUnitId}`)
      }

      // Add weightUnit if set
      const shoprenterWeightUnitId = (product as any).shoprenter_weight_unit_id
      let finalWeightUnitId = shoprenterWeightUnitId
      
      if (!finalWeightUnitId) {
        // Try to get ShopRenter weight unit ID from erp_weight_unit_id
        const erpWeightUnitId = (product as any).erp_weight_unit_id
        if (erpWeightUnitId) {
          const { data: weightUnit } = await supabase
            .from('weight_units')
            .select('shoprenter_weight_class_id, name, shortform')
            .eq('id', erpWeightUnitId)
            .is('deleted_at', null)
            .single()
          
          if (weightUnit?.shoprenter_weight_class_id) {
            finalWeightUnitId = weightUnit.shoprenter_weight_class_id
            console.log(`[SYNC] Mapped ERP weight unit ${erpWeightUnitId} to ShopRenter weightUnit ${finalWeightUnitId}`)
          } else if (weightUnit) {
            // Weight unit exists in ERP but not in ShopRenter - try to find matching weight class
            console.log(`[SYNC] Searching for matching weight class in ShopRenter for "${weightUnit.name}" (${weightUnit.shortform})...`)
            try {
              // Search existing weight classes
              const weightClassesResponse = await fetch(`${apiBaseUrl}/weightClasses?full=1`, {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'Authorization': authHeader
                },
                signal: AbortSignal.timeout(10000)
              })

              if (weightClassesResponse.ok) {
                const weightClassesData = await weightClassesResponse.json()
                const weightClasses = weightClassesData?.items || weightClassesData?.response?.items || []
                
                // Search for matching weight class by fetching descriptions
                for (const weightClass of weightClasses) {
                  const weightClassId = weightClass.id
                  if (!weightClassId) continue
                  
                  try {
                    const descResponse = await fetch(`${apiBaseUrl}/weightClassDescriptions?weightClassId=${encodeURIComponent(weightClassId)}&full=1`, {
                      method: 'GET',
                      headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'Authorization': authHeader
                      },
                      signal: AbortSignal.timeout(5000)
                    })
                    
                    if (descResponse.ok) {
                      const descData = await descResponse.json()
                      const descriptions = descData?.items || descData?.response?.items || []
                      
                      // Check if any description matches our weight unit name or shortform
                      const matchingDesc = descriptions.find((d: any) => 
                        d.title?.toLowerCase() === weightUnit.name.toLowerCase() ||
                        d.unit?.toLowerCase() === weightUnit.shortform.toLowerCase()
                      )
                      
                      if (matchingDesc) {
                        finalWeightUnitId = weightClassId
                        // Update our database with the found ShopRenter ID
                        await supabase
                          .from('weight_units')
                          .update({ shoprenter_weight_class_id: weightClassId })
                          .eq('id', erpWeightUnitId)
                        
                        console.log(`[SYNC] ✅ Found matching weight class "${matchingDesc.title}" (${matchingDesc.unit}) in ShopRenter: ${weightClassId}`)
                        break
                      }
                    }
                  } catch (descError) {
                    // Continue searching
                    continue
                  }
                }
                
                if (!finalWeightUnitId) {
                  console.warn(`[SYNC] ⚠️ Weight unit "${weightUnit.name}" (${weightUnit.shortform}) not found in ShopRenter. Weight classes are read-only in ShopRenter API, so new weight units cannot be created. Please create the weight class manually in ShopRenter or use an existing one.`)
                }
              }
            } catch (searchError) {
              console.warn(`[SYNC] ⚠️ Error searching for weight class:`, searchError)
            }
          }
        }
      }
      
      if (finalWeightUnitId) {
        productExtendPayload.weightUnit = {
          id: finalWeightUnitId
        }
        console.log(`[SYNC] Adding weightUnit: ${finalWeightUnitId}`)
      }

      // Add taxClass if VAT is set
      const vatId = (product as any).vat_id
      if (vatId) {
        const { data: mapping } = await supabase
          .from('shoprenter_tax_class_mappings')
          .select('shoprenter_tax_class_id, shoprenter_tax_class_name')
          .eq('connection_id', connection.id)
          .eq('vat_id', vatId)
          .single()
        
        if (mapping?.shoprenter_tax_class_id) {
          productExtendPayload.taxClass = {
            id: mapping.shoprenter_tax_class_id
          }
          console.log(`[SYNC] Mapped VAT ${vatId} to ShopRenter taxClass ${mapping.shoprenter_tax_class_id}`)
        }
      }

      // Add productClass if set
      if (product.product_class_shoprenter_id) {
        productExtendPayload.productClass = {
          id: product.product_class_shoprenter_id
        }
        console.log(`[SYNC] Adding product class: ${product.product_class_shoprenter_id}`)
      }

      // Add parentProduct if set
      if (product.parent_product_id) {
        const { data: parentProduct } = await supabase
          .from('shoprenter_products')
          .select('shoprenter_id')
          .eq('id', product.parent_product_id)
          .is('deleted_at', null)
          .single()

        if (parentProduct?.shoprenter_id && !parentProduct.shoprenter_id.startsWith('pending-')) {
          productExtendPayload.parentProduct = {
            id: parentProduct.shoprenter_id
          }
          console.log(`[SYNC] Adding parent product: ${parentProduct.shoprenter_id}`)
        } else {
          console.warn(`[SYNC] ⚠️ Parent product not yet synced to ShopRenter, skipping parentProduct in creation`)
        }
      }

      // Add manufacturer if set
      const manufacturerId = (product as any).manufacturer_id
      const erpManufacturerId = (product as any).erp_manufacturer_id
      
      // Get manufacturer name from erp_manufacturer_id for logging
      let manufacturerName: string | null = null
      if (erpManufacturerId) {
        const { data: manufacturer } = await supabase
          .from('manufacturers')
          .select('name')
          .eq('id', erpManufacturerId)
          .is('deleted_at', null)
          .single()
        if (manufacturer) {
          manufacturerName = manufacturer.name
        }
      }
      
      // Use manufacturerId if it exists and is valid, otherwise try to create from erp_manufacturer_id
      let finalManufacturerId: string | null = null
      
      // If we have both manufacturer_id and erp_manufacturer_id, verify they match
      if (manufacturerId && manufacturerId.trim() !== '' && !manufacturerId.startsWith('pending-') && erpManufacturerId && manufacturerName) {
        // Verify that the ShopRenter manufacturer_id actually matches the erp_manufacturer_id
        try {
          console.log(`[SYNC] Verifying manufacturer match: checking if ShopRenter manufacturer_id ${manufacturerId} matches erp_manufacturer_id ${erpManufacturerId}...`)
          const verifyResponse = await fetch(`${apiBaseUrl}/manufacturers/${manufacturerId}?full=1`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': authHeader
            },
            signal: AbortSignal.timeout(5000)
          })

          if (verifyResponse.ok) {
            const shoprenterManufacturer = await verifyResponse.json()
            const shoprenterManufacturerName = shoprenterManufacturer?.name || ''
            
            // Compare names (case-insensitive, trimmed)
            if (shoprenterManufacturerName.trim().toLowerCase() === manufacturerName.trim().toLowerCase()) {
              // They match! Use the existing manufacturer_id
              finalManufacturerId = manufacturerId
              console.log(`[SYNC] ✅ Verified manufacturer match: "${shoprenterManufacturerName}" matches "${manufacturerName}", using existing ShopRenter manufacturer_id: ${finalManufacturerId}`)
            } else {
              // They don't match - manufacturer was changed, need to find/create the correct one
              console.log(`[SYNC] ⚠️ Manufacturer mismatch detected: ShopRenter has "${shoprenterManufacturerName}" but ERP has "${manufacturerName}". Need to find/create correct manufacturer.`)
              // Continue to find/create logic below
            }
          } else {
            // Couldn't verify - manufacturer might not exist in ShopRenter anymore
            console.warn(`[SYNC] ⚠️ Could not verify manufacturer ${manufacturerId} in ShopRenter (${verifyResponse.status}), will find/create correct one`)
            // Continue to find/create logic below
          }
        } catch (verifyError) {
          console.warn(`[SYNC] ⚠️ Error verifying manufacturer:`, verifyError)
          // Continue to find/create logic below
        }
      }
      
      // If we don't have a verified match, find or create the correct manufacturer
      if (!finalManufacturerId && erpManufacturerId && manufacturerName) {
        // Try to find existing manufacturer in ShopRenter by name
        try {
          console.log(`[SYNC] Searching for manufacturer "${manufacturerName}" in ShopRenter...`)
          const searchResponse = await fetch(`${apiBaseUrl}/manufacturers?name=${encodeURIComponent(manufacturerName.trim())}&full=1`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': authHeader
            },
            signal: AbortSignal.timeout(10000)
          })

          if (searchResponse.ok) {
            const searchData = await searchResponse.json()
            const manufacturers = searchData?.items || searchData?.response?.items || []
            
            // Find exact match by name (case-insensitive)
            const matchingManufacturer = manufacturers.find((m: any) => 
              m.name?.trim().toLowerCase() === manufacturerName.trim().toLowerCase()
            )
            
            if (matchingManufacturer?.id) {
              finalManufacturerId = matchingManufacturer.id
              console.log(`[SYNC] ✅ Found existing manufacturer "${manufacturerName}" in ShopRenter with ID: ${finalManufacturerId}`)
              
              // Update product with the correct ShopRenter manufacturer ID
              await supabase
                .from('shoprenter_products')
                .update({ manufacturer_id: finalManufacturerId })
                .eq('id', id)
            }
          }
        } catch (searchError) {
          console.warn(`[SYNC] ⚠️ Error searching for manufacturer:`, searchError)
        }
        
        // If still not found, create it
        if (!finalManufacturerId) {
          try {
            console.log(`[SYNC] Creating manufacturer "${manufacturerName}" in ShopRenter...`)
            const createManufacturerResponse = await fetch(`${apiBaseUrl}/manufacturers`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': authHeader
              },
              body: JSON.stringify({
                name: manufacturerName.trim(),
                sortOrder: '0',
                robotsMetaTag: '0'
              }),
              signal: AbortSignal.timeout(10000)
            })

            if (createManufacturerResponse.ok) {
              const createdManufacturer = await createManufacturerResponse.json()
              finalManufacturerId = createdManufacturer.id
              
              // Update product with the new ShopRenter manufacturer ID
              await supabase
                .from('shoprenter_products')
                .update({ manufacturer_id: finalManufacturerId })
                .eq('id', id)
              
              console.log(`[SYNC] ✅ Created manufacturer "${manufacturerName}" in ShopRenter with ID: ${finalManufacturerId}`)
            } else {
              const errorText = await createManufacturerResponse.text().catch(() => 'Unknown error')
              console.warn(`[SYNC] ⚠️ Failed to create manufacturer "${manufacturerName}" in ShopRenter: ${createManufacturerResponse.status} - ${errorText}`)
            }
          } catch (manufacturerError) {
            console.warn(`[SYNC] ⚠️ Error creating manufacturer "${manufacturerName}" in ShopRenter:`, manufacturerError)
          }
        }
      } else if (manufacturerId && manufacturerId.trim() !== '' && !manufacturerId.startsWith('pending-') && !erpManufacturerId) {
        // We have manufacturer_id but no erp_manufacturer_id - use it (backward compatibility)
        finalManufacturerId = manufacturerId
        console.log(`[SYNC] Using existing ShopRenter manufacturer_id (no erp_manufacturer_id): ${finalManufacturerId}`)
      }
      
      if (finalManufacturerId) {
        productExtendPayload.manufacturer = {
          id: finalManufacturerId
        }
        console.log(`[SYNC] Adding manufacturer: ${finalManufacturerId} (${manufacturerName || 'no name'})`)
      } else if (erpManufacturerId && !finalManufacturerId) {
        // We tried to create but failed - don't remove, just skip
        console.warn(`[SYNC] ⚠️ Could not create or find manufacturer for erp_manufacturer_id ${erpManufacturerId}, skipping manufacturer in product creation`)
      } else if (!erpManufacturerId) {
        // If no manufacturer at all, remove it
        productExtendPayload.manufacturer = null
        console.log(`[SYNC] Removing manufacturer`)
      }

      // Add productDescriptions
      productExtendPayload.productDescriptions = [{
        name: huDescription.name || product.name || '',
        shortDescription: huDescription.short_description?.trim() || '',
        description: huDescription.description?.trim() || '',
        metaTitle: huDescription.meta_title?.trim() || '',
        metaKeywords: huDescription.meta_keywords?.trim() || '',
        metaDescription: huDescription.meta_description?.trim() || '',
        parameters: huDescription.parameters?.trim() || '',
        measurementUnit: (huDescription as any).measurement_unit || 'db', // Add measurementUnit (default to 'db' if empty)
        language: {
          id: languageId
        }
      }]

      // Add productCategoryRelations if categories exist
      const { data: currentRelations } = await supabase
        .from('shoprenter_product_category_relations')
        .select('category_shoprenter_id')
        .eq('product_id', id)
        .is('deleted_at', null)

      if (currentRelations && currentRelations.length > 0) {
        productExtendPayload.productCategoryRelations = currentRelations
          .filter((r: any) => r.category_shoprenter_id && !r.category_shoprenter_id.startsWith('pending-'))
          .map((r: any) => ({
            category: {
              id: r.category_shoprenter_id
            }
          }))
        
        if (productExtendPayload.productCategoryRelations.length > 0) {
          console.log(`[SYNC] Adding ${productExtendPayload.productCategoryRelations.length} category relations`)
        }
      }

      // Create product in ShopRenter
      console.log(`[SYNC] POST ${apiBaseUrl}/productExtend`)
      console.log(`[SYNC] Payload:`, JSON.stringify(productExtendPayload, null, 2).substring(0, 1000))

      const createResponse = await fetch(`${apiBaseUrl}/productExtend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify(productExtendPayload),
        signal: AbortSignal.timeout(30000)
      })

      if (!createResponse.ok) {
        const errorText = await createResponse.text().catch(() => 'Unknown error')

        // Handle 409 conflict: product already exists in ShopRenter
        if (createResponse.status === 409) {
          console.warn(`[SYNC] ⚠️ Product create returned 409 (already exists) for SKU ${product.sku}. Attempting to extract existing ShopRenter ID...`)

          try {
            const errorData = JSON.parse(errorText)
            const existingId =
              errorData?.id ||
              errorData?.href?.split('/').pop() ||
              errorData?.response?.id

            if (existingId) {
              console.log(`[SYNC] ✅ Extracted existing ShopRenter product ID for ${product.sku}: ${existingId}`)

              // Update local database with the existing ShopRenter ID
              await supabase
                .from('shoprenter_products')
                .update({
                  shoprenter_id: existingId,
                  sync_status: 'synced',
                  sync_error: null,
                  last_synced_to_shoprenter_at: new Date().toISOString()
                })
                .eq('id', id)

              // Update in-memory product for the rest of the sync flow
              product.shoprenter_id = existingId
              // From this point, treat it as an existing product (will go through the update flow below)
              isNewProduct = false

              console.log(`[SYNC] ✅ Linked ERP product to existing ShopRenter product. Continuing with update flow...`)
              // IMPORTANT: do NOT return here – we fall through and let the "existing product" update logic run
            } else {
              throw new Error('Could not extract existing product ID from ShopRenter 409 response')
            }
          } catch (parseError) {
            console.error(`[SYNC] ❌ Failed to handle 409 conflict for product ${product.sku}:`, parseError)

            await supabase
              .from('shoprenter_products')
              .update({
                sync_status: 'error',
                sync_error: `Product exists in ShopRenter but ID extraction failed: ${errorText.substring(0, 200)}`
              })
              .eq('id', id)

            return NextResponse.json({ 
              success: false, 
              error: 'Termék már létezik a ShopRenter-ben, de nem sikerült meghatározni az azonosítóját. Kérjük, futtassa a termékek teljes szinkronizálását a kapcsolat oldaláról.' 
            }, { status: 409 })
          }
        } else {
        console.error(`[SYNC] ❌ Failed to create product in ShopRenter: ${createResponse.status} - ${errorText}`)
        
        await supabase
          .from('shoprenter_products')
          .update({
            sync_status: 'error',
            sync_error: `Product creation failed: ${createResponse.status} - ${errorText.substring(0, 200)}`
          })
          .eq('id', id)

        return NextResponse.json({ 
          success: false, 
          error: `Termék létrehozása sikertelen: ${errorText.substring(0, 200)}` 
        }, { status: createResponse.status })
      }
      } else {
        // Extract shoprenter_id from successful response
      const createData = await createResponse.json().catch(() => null)
      const newShopRenterId = createData?.id || createData?.response?.id || createData?.href?.split('/').pop()

      if (!newShopRenterId) {
        console.error(`[SYNC] ❌ Failed to extract shoprenter_id from create response:`, createData)
        await supabase
          .from('shoprenter_products')
          .update({
            sync_status: 'error',
            sync_error: 'Failed to extract shoprenter_id from create response'
          })
          .eq('id', id)

        return NextResponse.json({ 
          success: false, 
          error: 'Nem sikerült meghatározni a termék ShopRenter azonosítóját' 
        }, { status: 500 })
      }

      console.log(`[SYNC] ✅ Product created in ShopRenter with ID: ${newShopRenterId}`)

      // Update local database with real shoprenter_id
      await supabase
        .from('shoprenter_products')
        .update({
          shoprenter_id: newShopRenterId,
          sync_status: 'synced',
          sync_error: null,
          last_synced_to_shoprenter_at: new Date().toISOString()
        })
        .eq('id', id)

      // Update product object for rest of sync
      product.shoprenter_id = newShopRenterId

      // Extract description ID from response if available
      if (createData?.productDescriptions && Array.isArray(createData.productDescriptions) && createData.productDescriptions.length > 0) {
        const createdDescription = createData.productDescriptions.find((d: any) => 
          d.language?.id === languageId || d.language?.href?.includes(languageId)
        )
        
        if (createdDescription?.id) {
          await supabase
            .from('shoprenter_product_descriptions')
            .update({ shoprenter_id: createdDescription.id })
            .eq('id', huDescription.id)
          
          huDescription.shoprenter_id = createdDescription.id
          console.log(`[SYNC] Updated description shoprenter_id: ${createdDescription.id}`)
        }
      }

      // Update category relations with real shoprenter_ids if available
      if (createData?.productCategoryRelations && Array.isArray(createData.productCategoryRelations)) {
        for (const relation of createData.productCategoryRelations) {
          const categoryId = relation.category?.id || relation.category?.href?.split('/').pop()
          if (categoryId) {
            await supabase
              .from('shoprenter_product_category_relations')
              .update({ shoprenter_id: relation.id || relation.href?.split('/').pop() })
              .eq('product_id', id)
              .eq('category_shoprenter_id', categoryId)
          }
        }
      }

      console.log(`[SYNC] ✅ New product creation completed, continuing with attribute sync...`)
      }
    }

    // Get product description ID (for existing products or after creation)
    const descriptionId = await getProductDescriptionId(
      apiBaseUrl,
      authHeader,
      product.shoprenter_id,
      languageId,
      huDescription.shoprenter_id
    )

    // For existing products, update basic data (modelNumber, gtin, pricing) if changed
    // Skip this for new products as they were just created with all data
    if (!isNewProduct) {
      const productPayload: any = {}
      
      // Add modelNumber if exists
      if (product.model_number !== null && product.model_number !== undefined) {
        productPayload.modelNumber = product.model_number || ''
      }
      
      // Add gtin (barcode) if exists
      if (product.gtin !== null && product.gtin !== undefined) {
        productPayload.gtin = product.gtin || ''
      }

      // Add dimensions (width, height, length) - stored in cm
      const width = (product as any).width
      const height = (product as any).height
      const length = (product as any).length
      if (width !== null && width !== undefined) {
        productPayload.width = String(width)
      }
      if (height !== null && height !== undefined) {
        productPayload.height = String(height)
      }
      if (length !== null && length !== undefined) {
        productPayload.length = String(length)
      }

      // Add weight
      const weight = (product as any).weight
      if (weight !== null && weight !== undefined) {
        productPayload.weight = String(weight)
      }

      // Add volumeUnit (for dimensions - default to cm if not set)
      const shoprenterVolumeUnitId = (product as any).shoprenter_volume_unit_id
      if (shoprenterVolumeUnitId) {
        productPayload.volumeUnit = {
          id: shoprenterVolumeUnitId
        }
        console.log(`[SYNC] Updating volumeUnit: ${shoprenterVolumeUnitId}`)
      }

      // Add weightUnit if set
      const shoprenterWeightUnitId = (product as any).shoprenter_weight_unit_id
      let finalWeightUnitId = shoprenterWeightUnitId
      
      if (!finalWeightUnitId) {
        // Try to get ShopRenter weight unit ID from erp_weight_unit_id
        const erpWeightUnitId = (product as any).erp_weight_unit_id
        if (erpWeightUnitId) {
          const { data: weightUnit } = await supabase
            .from('weight_units')
            .select('shoprenter_weight_class_id, name, shortform')
            .eq('id', erpWeightUnitId)
            .is('deleted_at', null)
            .single()
          
          if (weightUnit?.shoprenter_weight_class_id) {
            finalWeightUnitId = weightUnit.shoprenter_weight_class_id
            console.log(`[SYNC] Mapped ERP weight unit ${erpWeightUnitId} to ShopRenter weightUnit ${finalWeightUnitId}`)
          } else if (weightUnit) {
            // Weight unit exists in ERP but not in ShopRenter - try to find matching weight class
            console.log(`[SYNC] Searching for matching weight class in ShopRenter for "${weightUnit.name}" (${weightUnit.shortform})...`)
            try {
              // Search existing weight classes
              const weightClassesResponse = await fetch(`${apiBaseUrl}/weightClasses?full=1`, {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'Authorization': authHeader
                },
                signal: AbortSignal.timeout(10000)
              })

              if (weightClassesResponse.ok) {
                const weightClassesData = await weightClassesResponse.json()
                const weightClasses = weightClassesData?.items || weightClassesData?.response?.items || []
                
                // Search for matching weight class by fetching descriptions
                for (const weightClass of weightClasses) {
                  const weightClassId = weightClass.id
                  if (!weightClassId) continue
                  
                  try {
                    const descResponse = await fetch(`${apiBaseUrl}/weightClassDescriptions?weightClassId=${encodeURIComponent(weightClassId)}&full=1`, {
                      method: 'GET',
                      headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'Authorization': authHeader
                      },
                      signal: AbortSignal.timeout(5000)
                    })
                    
                    if (descResponse.ok) {
                      const descData = await descResponse.json()
                      const descriptions = descData?.items || descData?.response?.items || []
                      
                      // Check if any description matches our weight unit name or shortform
                      const matchingDesc = descriptions.find((d: any) => 
                        d.title?.toLowerCase() === weightUnit.name.toLowerCase() ||
                        d.unit?.toLowerCase() === weightUnit.shortform.toLowerCase()
                      )
                      
                      if (matchingDesc) {
                        finalWeightUnitId = weightClassId
                        // Update our database with the found ShopRenter ID
                        await supabase
                          .from('weight_units')
                          .update({ shoprenter_weight_class_id: weightClassId })
                          .eq('id', erpWeightUnitId)
                        
                        console.log(`[SYNC] ✅ Found matching weight class "${matchingDesc.title}" (${matchingDesc.unit}) in ShopRenter: ${weightClassId}`)
                        break
                      }
                    }
                  } catch (descError) {
                    // Continue searching
                    continue
                  }
                }
                
                if (!finalWeightUnitId) {
                  console.warn(`[SYNC] ⚠️ Weight unit "${weightUnit.name}" (${weightUnit.shortform}) not found in ShopRenter. Weight classes are read-only in ShopRenter API, so new weight units cannot be created. Please create the weight class manually in ShopRenter or use an existing one.`)
                }
              }
            } catch (searchError) {
              console.warn(`[SYNC] ⚠️ Error searching for weight class:`, searchError)
            }
          }
        }
      }
      
      if (finalWeightUnitId) {
        productPayload.weightUnit = {
          id: finalWeightUnitId
        }
        console.log(`[SYNC] Updating weightUnit: ${finalWeightUnitId}`)
      } else if (!(product as any).erp_weight_unit_id) {
        // If erp_weight_unit_id is null, remove weightUnit
        productPayload.weightUnit = null
        console.log(`[SYNC] Removing weightUnit`)
      }
      
      // Add manufacturer if set
      const manufacturerId = (product as any).manufacturer_id
      const erpManufacturerId = (product as any).erp_manufacturer_id
      
      // Get manufacturer name from erp_manufacturer_id for logging
      let manufacturerName: string | null = null
      if (erpManufacturerId) {
        const { data: manufacturer } = await supabase
          .from('manufacturers')
          .select('name')
          .eq('id', erpManufacturerId)
          .is('deleted_at', null)
          .single()
        if (manufacturer) {
          manufacturerName = manufacturer.name
        }
      }
      
      // Use manufacturerId if it exists and is valid, otherwise try to create from erp_manufacturer_id
      let finalManufacturerId: string | null = null
      
      // If we have both manufacturer_id and erp_manufacturer_id, verify they match
      if (manufacturerId && manufacturerId.trim() !== '' && !manufacturerId.startsWith('pending-') && erpManufacturerId && manufacturerName) {
        // Verify that the ShopRenter manufacturer_id actually matches the erp_manufacturer_id
        try {
          console.log(`[SYNC] Verifying manufacturer match: checking if ShopRenter manufacturer_id ${manufacturerId} matches erp_manufacturer_id ${erpManufacturerId}...`)
          const verifyResponse = await fetch(`${apiBaseUrl}/manufacturers/${manufacturerId}?full=1`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': authHeader
            },
            signal: AbortSignal.timeout(5000)
          })

          if (verifyResponse.ok) {
            const shoprenterManufacturer = await verifyResponse.json()
            const shoprenterManufacturerName = shoprenterManufacturer?.name || ''
            
            // Compare names (case-insensitive, trimmed)
            if (shoprenterManufacturerName.trim().toLowerCase() === manufacturerName.trim().toLowerCase()) {
              // They match! Use the existing manufacturer_id
              finalManufacturerId = manufacturerId
              console.log(`[SYNC] ✅ Verified manufacturer match: "${shoprenterManufacturerName}" matches "${manufacturerName}", using existing ShopRenter manufacturer_id: ${finalManufacturerId}`)
            } else {
              // They don't match - manufacturer was changed, need to find/create the correct one
              console.log(`[SYNC] ⚠️ Manufacturer mismatch detected: ShopRenter has "${shoprenterManufacturerName}" but ERP has "${manufacturerName}". Need to find/create correct manufacturer.`)
              // Continue to find/create logic below
            }
          } else {
            // Couldn't verify - manufacturer might not exist in ShopRenter anymore
            console.warn(`[SYNC] ⚠️ Could not verify manufacturer ${manufacturerId} in ShopRenter (${verifyResponse.status}), will find/create correct one`)
            // Continue to find/create logic below
          }
        } catch (verifyError) {
          console.warn(`[SYNC] ⚠️ Error verifying manufacturer:`, verifyError)
          // Continue to find/create logic below
        }
      }
      
      // If we don't have a verified match, find or create the correct manufacturer
      if (!finalManufacturerId && erpManufacturerId && manufacturerName) {
        // Try to find existing manufacturer in ShopRenter by name
        try {
          console.log(`[SYNC] Searching for manufacturer "${manufacturerName}" in ShopRenter...`)
          const searchResponse = await fetch(`${apiBaseUrl}/manufacturers?name=${encodeURIComponent(manufacturerName.trim())}&full=1`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': authHeader
            },
            signal: AbortSignal.timeout(10000)
          })

          if (searchResponse.ok) {
            const searchData = await searchResponse.json()
            const manufacturers = searchData?.items || searchData?.response?.items || []
            
            // Find exact match by name (case-insensitive)
            const matchingManufacturer = manufacturers.find((m: any) => 
              m.name?.trim().toLowerCase() === manufacturerName.trim().toLowerCase()
            )
            
            if (matchingManufacturer?.id) {
              finalManufacturerId = matchingManufacturer.id
              console.log(`[SYNC] ✅ Found existing manufacturer "${manufacturerName}" in ShopRenter with ID: ${finalManufacturerId}`)
              
              // Update product with the correct ShopRenter manufacturer ID
              await supabase
                .from('shoprenter_products')
                .update({ manufacturer_id: finalManufacturerId })
                .eq('id', id)
            }
          }
        } catch (searchError) {
          console.warn(`[SYNC] ⚠️ Error searching for manufacturer:`, searchError)
        }
        
        // If still not found, create it
        if (!finalManufacturerId) {
          try {
            console.log(`[SYNC] Creating manufacturer "${manufacturerName}" in ShopRenter...`)
            const createManufacturerResponse = await fetch(`${apiBaseUrl}/manufacturers`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': authHeader
              },
              body: JSON.stringify({
                name: manufacturerName.trim(),
                sortOrder: '0',
                robotsMetaTag: '0'
              }),
              signal: AbortSignal.timeout(10000)
            })

            if (createManufacturerResponse.ok) {
              const createdManufacturer = await createManufacturerResponse.json()
              finalManufacturerId = createdManufacturer.id
              
              // Update product with the new ShopRenter manufacturer ID
              await supabase
                .from('shoprenter_products')
                .update({ manufacturer_id: finalManufacturerId })
                .eq('id', id)
              
              console.log(`[SYNC] ✅ Created manufacturer "${manufacturerName}" in ShopRenter with ID: ${finalManufacturerId}`)
            } else {
              const errorText = await createManufacturerResponse.text().catch(() => 'Unknown error')
              console.warn(`[SYNC] ⚠️ Failed to create manufacturer "${manufacturerName}" in ShopRenter: ${createManufacturerResponse.status} - ${errorText}`)
            }
          } catch (manufacturerError) {
            console.warn(`[SYNC] ⚠️ Error creating manufacturer "${manufacturerName}" in ShopRenter:`, manufacturerError)
          }
        }
      } else if (manufacturerId && manufacturerId.trim() !== '' && !manufacturerId.startsWith('pending-') && !erpManufacturerId) {
        // We have manufacturer_id but no erp_manufacturer_id - use it (backward compatibility)
        finalManufacturerId = manufacturerId
        console.log(`[SYNC] Using existing ShopRenter manufacturer_id (no erp_manufacturer_id): ${finalManufacturerId}`)
      }
      
      // Manufacturer must be updated via productExtend endpoint, not /products endpoint
      // We'll handle it separately after the product update
      let manufacturerToUpdate: { id: string } | null | undefined = undefined
      if (finalManufacturerId) {
        manufacturerToUpdate = { id: finalManufacturerId }
        console.log(`[SYNC] Will update manufacturer via productExtend: ${finalManufacturerId} (${manufacturerName || 'no name'})`)
      } else if (!erpManufacturerId) {
        // If erp_manufacturer_id is null, remove manufacturer
        manufacturerToUpdate = null
        console.log(`[SYNC] Will remove manufacturer via productExtend`)
      } else {
        // We have erp_manufacturer_id but couldn't create/get ShopRenter ID - skip (don't remove existing)
        console.warn(`[SYNC] ⚠️ Could not create or find manufacturer for erp_manufacturer_id ${erpManufacturerId}, skipping manufacturer update (preserving existing)`)
        // Don't set manufacturerToUpdate - this preserves existing manufacturer in ShopRenter
      }
      
      // Edge case handling for PUSH (ERP → ShopRenter)
      // Handle price parsing - ensure we get a valid number or null
      let priceToSend: number | null = null
      console.log(`[SYNC] Raw product.price value: ${product.price} (type: ${typeof product.price})`)
      
      if (product.price !== null && product.price !== undefined && product.price !== '') {
        const parsedPrice = parseFloat(product.price.toString())
        console.log(`[SYNC] Parsed price: ${parsedPrice} (isNaN: ${isNaN(parsedPrice)}, isFinite: ${isFinite(parsedPrice)})`)
        if (!isNaN(parsedPrice) && isFinite(parsedPrice) && parsedPrice > 0) {
          priceToSend = parsedPrice
          console.log(`[SYNC] ✅ Using product.price: ${priceToSend}`)
        } else {
          console.warn(`[SYNC] ⚠️ Invalid parsed price: ${parsedPrice}, will try to calculate from cost × multiplier`)
        }
      } else {
        console.log(`[SYNC] Product price is null/undefined/empty, will try to calculate from cost × multiplier`)
      }
      
      const cost = product.cost ? parseFloat(product.cost.toString()) : null
      const multiplier = product.multiplier ? parseFloat(product.multiplier.toString()) : 1.0
      console.log(`[SYNC] Cost: ${cost}, Multiplier: ${multiplier}`)

      // Case 4: No price, but has cost and multiplier -> calculate price
      if (!priceToSend || priceToSend <= 0 || isNaN(priceToSend)) {
        if (cost && cost > 0 && multiplier > 0 && !isNaN(cost) && !isNaN(multiplier)) {
          priceToSend = cost * multiplier
          console.log(`[SYNC] ✅ Calculated price from cost × multiplier: ${priceToSend.toFixed(2)} (cost: ${cost}, multiplier: ${multiplier})`)
        } else {
          console.error(`[SYNC] ❌ Cannot sync product ${product.sku}: No valid price and cannot calculate from cost/multiplier`)
          console.error(`[SYNC]   - priceToSend: ${priceToSend}`)
          console.error(`[SYNC]   - cost: ${cost} (valid: ${cost && cost > 0 && !isNaN(cost)})`)
          console.error(`[SYNC]   - multiplier: ${multiplier} (valid: ${multiplier > 0 && !isNaN(multiplier)})`)
          return NextResponse.json({ 
            success: false, 
            error: 'Nem lehet szinkronizálni a terméket ár nélkül. Kérjük, állítson be árat vagy adjon meg beszerzési árat és szorzót.' 
          }, { status: 400 })
        }
      } else {
        // Case 2 & 3: Has price, missing cost or multiplier -> calculate missing one for informational purposes only
        // NOTE: We don't override the user's price - they may have set it manually
        if (cost && cost > 0 && (!multiplier || multiplier === 1.0)) {
          const calculatedMultiplier = priceToSend / cost
          console.log(`[SYNC] Calculated multiplier for reference: ${calculatedMultiplier.toFixed(3)} (price: ${priceToSend}, cost: ${cost})`)
        } else if (!cost && multiplier > 0 && multiplier !== 1.0) {
          const calculatedCost = priceToSend / multiplier
          console.log(`[SYNC] Calculated cost for reference: ${calculatedCost.toFixed(2)} (price: ${priceToSend}, multiplier: ${multiplier})`)
        }
        
        // Case 5: Validate consistency (informational only - don't override user's price)
        if (cost && cost > 0 && multiplier > 0 && multiplier !== 1.0) {
          const expectedPrice = cost * multiplier
          const difference = Math.abs(priceToSend - expectedPrice)
          
          if (difference > 0.01) {
            console.warn(`[SYNC] ⚠️ Price mismatch: cost (${cost}) × multiplier (${multiplier}) = ${expectedPrice.toFixed(2)}, but user set price is ${priceToSend}`)
            console.warn(`[SYNC] ⚠️ Using user's explicit price (${priceToSend}) instead of calculated price`)
            // Don't override - user may have set price manually
          } else {
            console.log(`[SYNC] ✅ Price matches cost × multiplier: ${priceToSend}`)
          }
        }
      }
      
      // Add pricing fields
      // IMPORTANT: ShopRenter calculates: price * multiplier * VAT
      // In ERP: cost * multiplier = price (net price already includes multiplier)
      // So we send net price to ShopRenter and set multiplier to 1.0 to avoid double calculation
      // Ensure priceToSend is a valid number before adding to payload
      console.log(`[SYNC] Final priceToSend before validation: ${priceToSend} (type: ${typeof priceToSend}, isNaN: ${isNaN(priceToSend as number)}, isFinite: ${isFinite(priceToSend as number)})`)
      
      if (priceToSend !== null && priceToSend !== undefined && !isNaN(priceToSend) && isFinite(priceToSend) && priceToSend > 0) {
        const roundedPrice = Math.round(priceToSend * 100) / 100
        productPayload.price = String(roundedPrice)
        console.log(`[SYNC] ✅ Added price to payload: ${productPayload.price}`)
      } else {
        console.error(`[SYNC] ❌ Invalid priceToSend value: ${priceToSend} (type: ${typeof priceToSend}, isNaN: ${isNaN(priceToSend as number)}, isFinite: ${isFinite(priceToSend as number)})`)
        return NextResponse.json({ 
          success: false, 
          error: `Érvénytelen ár érték: ${priceToSend}. Kérjük, ellenőrizze az árat és próbálja újra.` 
        }, { status: 400 })
      }
      // Add cost to ShopRenter (költség field)
      if (cost !== null && cost !== undefined && !isNaN(cost) && isFinite(cost) && cost > 0) {
        productPayload.cost = String(Math.round(cost * 100) / 100) // Round to 2 decimal places
        console.log(`[SYNC] ✅ Added cost to payload: ${productPayload.cost}`)
      } else {
        console.log(`[SYNC] Cost not added (value: ${cost}, valid: ${cost !== null && cost !== undefined && !isNaN(cost) && isFinite(cost) && cost > 0})`)
      }
      
      // Multiplier is set to 1.0 because the net price already includes it
      // This prevents ShopRenter from calculating: (cost * multiplier) * multiplier * VAT
      productPayload.multiplier = '1.0'
      productPayload.multiplierLock = '1' // Lock multiplier at 1.0

      // Add status (sync from ERP to ShopRenter)
      // This ensures restored products (deleted_at = NULL, status = 1) are re-enabled in ShopRenter
      if (product.status !== null && product.status !== undefined) {
        productPayload.status = String(product.status)
        console.log(`[SYNC] Syncing product status: ${product.status} (${product.status === 1 ? 'Enabled' : product.status === 0 ? 'Disabled' : 'Deprecated'})`)
      }

      // Add taxClass if VAT is set
      const vatId = (product as any).vat_id
      if (vatId) {
        // Get taxClass mapping
        const { data: mapping, error: mappingError } = await supabase
          .from('shoprenter_tax_class_mappings')
          .select('shoprenter_tax_class_id, shoprenter_tax_class_name')
          .eq('connection_id', connection.id)
          .eq('vat_id', vatId)
          .single()
        
        if (mapping && mapping.shoprenter_tax_class_id) {
          productPayload.taxClass = {
            id: mapping.shoprenter_tax_class_id
          }
          console.log(`[SYNC] Mapped VAT ${vatId} to ShopRenter taxClass ${mapping.shoprenter_tax_class_id} (${mapping.shoprenter_tax_class_name || 'Unknown'})`)
        } else {
          console.warn(`[SYNC] ⚠️ WARNING: No taxClass mapping found for vat_id: ${vatId}`)
          console.warn(`[SYNC] Product will sync without taxClass - ShopRenter will use default taxClass`)
          // Don't fail sync, but log warning
        }
      }

      // Log pricing sync
      const priceSource = priceToSend === parseFloat(String(product.price || '')) 
        ? 'user-set price from ERP' 
        : 'calculated from cost × multiplier (price was missing/invalid)'
      console.log(`[SYNC] Syncing net price: ${priceToSend} (${priceSource})`)
      console.log(`[SYNC] Setting ShopRenter multiplier to 1.0 to avoid double calculation`)
      if (cost !== null && cost !== undefined) {
        console.log(`[SYNC] Cost (informational only, not synced): ${cost}`)
      }
      if (multiplier !== null && multiplier !== undefined) {
        console.log(`[SYNC] ERP multiplier (informational only, not synced): ${multiplier}`)
      }
      
      // Always ensure price is in payload (it's required for ShopRenter)
      if (!productPayload.price) {
        console.error(`[SYNC] ❌ CRITICAL: Price is missing from productPayload!`)
        console.error(`[SYNC]   productPayload keys: ${Object.keys(productPayload).join(', ')}`)
        console.error(`[SYNC]   priceToSend: ${priceToSend}`)
        return NextResponse.json({ 
          success: false, 
          error: 'Hiba: Az ár nem került hozzáadásra a szinkronizálási adatokhoz. Kérjük, próbálja újra.' 
        }, { status: 500 })
      }
      
      // Only update if there's something to update
      if (Object.keys(productPayload).length > 0) {
        const productUpdateUrl = `${apiBaseUrl}/products/${product.shoprenter_id}`
        console.log(`[SYNC] Updating product data: PUT ${productUpdateUrl}`)
        console.log(`[SYNC] Product payload:`, JSON.stringify(productPayload))
        console.log(`[SYNC] ✅ Price in payload: ${productPayload.price}`)
        
        const productUpdateResponse = await fetch(productUpdateUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': authHeader
          },
          body: JSON.stringify(productPayload),
          signal: AbortSignal.timeout(30000)
        })

        if (!productUpdateResponse.ok) {
          const errorText = await productUpdateResponse.text().catch(() => 'Unknown error')
          console.warn(`[SYNC] Product data update failed: ${productUpdateResponse.status} - ${errorText.substring(0, 200)}`)
          // Continue with description sync even if product update fails
        } else {
          console.log(`[SYNC] Product data updated successfully`)
        }
      }
      
      // Update manufacturer via productExtend endpoint (manufacturer cannot be updated via /products endpoint)
      if (manufacturerToUpdate !== undefined) {
        try {
          const productExtendUrl = `${apiBaseUrl}/productExtend/${product.shoprenter_id}`
          const manufacturerPayload: any = {}
          
          if (manufacturerToUpdate === null) {
            manufacturerPayload.manufacturer = null
            console.log(`[SYNC] Removing manufacturer via productExtend`)
          } else {
            manufacturerPayload.manufacturer = manufacturerToUpdate
            console.log(`[SYNC] Updating manufacturer via productExtend: ${manufacturerToUpdate.id}`)
          }
          
          const manufacturerUpdateResponse = await fetch(productExtendUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': authHeader
            },
            body: JSON.stringify(manufacturerPayload),
            signal: AbortSignal.timeout(10000)
          })
          
          if (!manufacturerUpdateResponse.ok) {
            const errorText = await manufacturerUpdateResponse.text().catch(() => 'Unknown error')
            console.warn(`[SYNC] ⚠️ Manufacturer update via productExtend failed: ${manufacturerUpdateResponse.status} - ${errorText.substring(0, 200)}`)
          } else {
            console.log(`[SYNC] ✅ Manufacturer updated successfully via productExtend`)
          }
        } catch (manufacturerUpdateError) {
          console.warn(`[SYNC] ⚠️ Error updating manufacturer via productExtend:`, manufacturerUpdateError)
        }
      }
    }

    // Update product description (skip for new products as description was created with product)
    if (!isNewProduct) {
      // Prepare payload for ShopRenter
      // Note: For empty strings, we send empty string (not null) to delete in ShopRenter
      const payload: any = {
      name: huDescription.name || product.name || '',
      // Send empty string if meta fields are empty/null to delete in ShopRenter
      metaTitle: huDescription.meta_title && huDescription.meta_title.trim().length > 0
        ? huDescription.meta_title.trim()
        : '', // Empty string will delete metaTitle in ShopRenter
      metaKeywords: huDescription.meta_keywords && huDescription.meta_keywords.trim().length > 0
        ? huDescription.meta_keywords.trim()
        : '', // Empty string will delete metaKeywords in ShopRenter
      metaDescription: huDescription.meta_description && huDescription.meta_description.trim().length > 0
        ? huDescription.meta_description.trim()
        : '', // Empty string will delete metaDescription in ShopRenter
      // Send empty string if descriptions are empty/null to delete in ShopRenter
      shortDescription: huDescription.short_description && huDescription.short_description.trim().length > 0
        ? huDescription.short_description.trim()
        : '', // Empty string will delete shortDescription in ShopRenter
      description: huDescription.description && huDescription.description.trim().length > 0
        ? huDescription.description.trim()
        : '', // Empty string will delete description in ShopRenter
      // Send empty string if parameters is empty/null to delete in ShopRenter
      parameters: huDescription.parameters && huDescription.parameters.trim().length > 0 
        ? huDescription.parameters.trim() 
        : '', // Empty string will delete parameters in ShopRenter
      measurementUnit: (huDescription as any).measurement_unit || 'db', // Add measurementUnit (default to 'db' if empty)
      product: {
        id: product.shoprenter_id
      },
      language: {
        id: languageId
      }
    }

    // Note: We keep all fields (including empty strings) to ensure deletion in ShopRenter
    // Empty strings will delete the corresponding fields in ShopRenter

    // Determine endpoint - use PUT if we have description ID, POST if not
    let updateUrl: string
    let method: string

    if (descriptionId) {
      // Update existing description
      updateUrl = `${apiBaseUrl}/productDescriptions/${descriptionId}`
      method = 'PUT'
    } else {
      // Create new description
      updateUrl = `${apiBaseUrl}/productDescriptions`
      method = 'POST'
    }

    console.log(`[SYNC] ${method} ${updateUrl}`)
    console.log(`[SYNC] Payload:`, JSON.stringify(payload, null, 2).substring(0, 500))

    // Push to ShopRenter
    const pushResponse = await fetch(updateUrl, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000)
    })

    if (!pushResponse.ok) {
      const errorText = await pushResponse.text().catch(() => 'Unknown error')
      console.error(`[SYNC] Push failed: ${pushResponse.status} - ${errorText}`)
      
      // Update product sync status
      // Don't update last_synced_to_shoprenter_at on error
      await supabase
        .from('shoprenter_products')
        .update({
          sync_status: 'error',
          sync_error: `Push failed: ${pushResponse.status} - ${errorText.substring(0, 200)}`
          // Note: Don't update last_synced_to_shoprenter_at on error
        })
        .eq('id', id)

      return NextResponse.json({ 
        success: false, 
        error: `ShopRenter API hiba (${pushResponse.status}): ${errorText.substring(0, 200)}` 
      }, { status: pushResponse.status })
    }

    const pushResult = await pushResponse.json().catch(() => null)
    
    // Extract description ID from response if we created it
    let finalDescriptionId = descriptionId
    if (!finalDescriptionId && pushResult?.id) {
      finalDescriptionId = pushResult.id
    } else if (!finalDescriptionId && pushResult?.href) {
      const parts = pushResult.href.split('/')
      finalDescriptionId = parts[parts.length - 1]
    }

      // Update local database with ShopRenter description ID if we got it
      if (finalDescriptionId && !huDescription.shoprenter_id) {
        await supabase
          .from('shoprenter_product_descriptions')
          .update({ shoprenter_id: finalDescriptionId })
          .eq('id', huDescription.id)
      }
    }

    // Sync product categories (productCategoryRelations)
    // NOTE: This only runs when user manually clicks "Szinkronizálás" button
    // Adding/deleting categories via UI only updates the database, not ShopRenter
    try {
      // Get current product-category relations from database
      const { data: currentRelations } = await supabase
        .from('shoprenter_product_category_relations')
        .select('category_id, category_shoprenter_id, shoprenter_id')
        .eq('product_id', id)
        .is('deleted_at', null)

      // Get all existing relations in ShopRenter
      const existingRelationsUrl = `${apiBaseUrl}/productCategoryRelations?productId=${encodeURIComponent(product.shoprenter_id)}&full=1`
      const existingRelationsResponse = await fetch(existingRelationsUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader
        },
        signal: AbortSignal.timeout(10000)
      })

      const existingShopRenterRelations: Map<string, string> = new Map() // category_shoprenter_id -> relation_shoprenter_id
      
      if (existingRelationsResponse.ok) {
        const existingData = await existingRelationsResponse.json().catch(() => null)
        if (existingData?.response?.items) {
          for (const relation of existingData.response.items) {
            const categoryId = relation.category?.id || relation.category?.href?.split('/').pop()
            if (categoryId) {
              existingShopRenterRelations.set(categoryId, relation.id || relation.href?.split('/').pop() || '')
            }
          }
        }
      }

      // Get categories that should be synced (from database)
      const categoriesToSync = currentRelations || []
      const categoryShopRenterIds = new Set(categoriesToSync.map(r => r.category_shoprenter_id).filter(Boolean))

      // Delete relations that exist in ShopRenter but not in our database
      for (const [categoryShopRenterId, relationShopRenterId] of existingShopRenterRelations.entries()) {
        if (!categoryShopRenterIds.has(categoryShopRenterId)) {
          // This category relation exists in ShopRenter but not in our database - delete it
          try {
            const deleteResponse = await fetch(`${apiBaseUrl}/productCategoryRelations/${relationShopRenterId}`, {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': authHeader
              },
              signal: AbortSignal.timeout(10000)
            })

            if (deleteResponse.ok || deleteResponse.status === 204) {
              console.log(`[SYNC] Deleted product-category relation in ShopRenter for category ${categoryShopRenterId}`)
            } else {
              const errorText = await deleteResponse.text().catch(() => 'Unknown error')
              console.warn(`[SYNC] Failed to delete product-category relation: ${deleteResponse.status} - ${errorText}`)
            }
          } catch (deleteError) {
            console.warn(`[SYNC] Error deleting product-category relation:`, deleteError)
          }
        }
      }

      // Add/update relations that exist in our database
      for (const relation of categoriesToSync) {
        if (!relation.category_shoprenter_id) {
          console.warn(`[SYNC] Skipping category relation - missing category_shoprenter_id`)
          continue
        }

        const relationShopRenterId = existingShopRenterRelations.get(relation.category_shoprenter_id)

        if (relationShopRenterId) {
          // Relation already exists in ShopRenter - update if needed
          // Note: ProductCategoryRelation doesn't have updatable fields, so we skip update
          console.log(`[SYNC] Product-category relation already exists in ShopRenter for category ${relation.category_shoprenter_id}`)
          
          // Update local database with ShopRenter relation ID if we don't have it
          if (relationShopRenterId && !relation.shoprenter_id) {
            await supabase
              .from('shoprenter_product_category_relations')
              .update({ shoprenter_id: relationShopRenterId })
              .eq('product_id', id)
              .eq('category_id', relation.category_id)
          }
        } else {
          // Relation doesn't exist in ShopRenter - create it
          const categoryPayload = {
            product: {
              id: product.shoprenter_id
            },
            category: {
              id: relation.category_shoprenter_id
            }
          }

          try {
            const createResponse = await fetch(`${apiBaseUrl}/productCategoryRelations`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': authHeader
              },
              body: JSON.stringify(categoryPayload),
              signal: AbortSignal.timeout(10000)
            })

            if (createResponse.ok) {
              const createResult = await createResponse.json().catch(() => null)
              const newRelationId = createResult?.id || createResult?.href?.split('/').pop()
              
              if (newRelationId) {
                // Update local database with ShopRenter relation ID
                await supabase
                  .from('shoprenter_product_category_relations')
                  .update({ shoprenter_id: newRelationId })
                  .eq('product_id', id)
                  .eq('category_id', relation.category_id)
                
                console.log(`[SYNC] Created product-category relation in ShopRenter for category ${relation.category_shoprenter_id}`)
              }
            } else {
              const errorText = await createResponse.text().catch(() => 'Unknown error')
              console.warn(`[SYNC] Failed to create product-category relation: ${createResponse.status} - ${errorText}`)
            }
          } catch (createError) {
            console.warn(`[SYNC] Error creating product-category relation:`, createError)
          }
        }
      }

      console.log(`[SYNC] Successfully synced product categories`)
    } catch (categorySyncError: any) {
      // Don't fail the entire sync if category sync fails
      console.warn(`[SYNC] Error syncing product categories:`, categorySyncError?.message || categorySyncError)
    }

    // Sync product tags (productTags)
    try {
      const productTags = product.product_tags || []
      const huTags = productTags.find((t: any) => t.language_code === 'hu')
      
      // Always sync tags - if empty, delete in ShopRenter
      if (huTags) {
        const tagsValue = huTags.tags ? huTags.tags.trim() : ''
        
        // If tags are empty, delete in ShopRenter
        if (tagsValue.length === 0) {
          // Try to find and delete existing tag in ShopRenter
          let productTagId = huTags.shoprenter_id
          
          if (!productTagId) {
            try {
              const tagSearchUrl = `${apiBaseUrl}/productTags?productId=${encodeURIComponent(product.shoprenter_id)}&languageId=${languageId}&full=1`
              const tagSearchResponse = await fetch(tagSearchUrl, {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'Authorization': authHeader
                },
                signal: AbortSignal.timeout(10000)
              })
              
              if (tagSearchResponse.ok) {
                const tagSearchData = await tagSearchResponse.json().catch(() => null)
                if (tagSearchData?.response?.items && tagSearchData.response.items.length > 0) {
                  const matchingTag = tagSearchData.response.items.find((item: any) => {
                    const itemLangId = item.language?.innerId || item.language?.id
                    return itemLangId === languageId || itemLangId === '1' || itemLangId === 1
                  })
                  if (matchingTag) {
                    productTagId = matchingTag.id || matchingTag.href?.split('/').pop()
                  }
                }
              }
            } catch (tagSearchError) {
              console.warn('[SYNC] Failed to search for existing productTag for deletion:', tagSearchError)
            }
          }

          if (productTagId) {
            // Delete tag in ShopRenter
            try {
              const deleteResponse = await fetch(`${apiBaseUrl}/productTags/${productTagId}`, {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'Authorization': authHeader
                },
                signal: AbortSignal.timeout(10000)
              })

              if (deleteResponse.ok || deleteResponse.status === 204) {
                console.log(`[SYNC] Successfully deleted product tags in ShopRenter`)
              } else {
                const errorText = await deleteResponse.text().catch(() => 'Unknown error')
                console.warn(`[SYNC] Failed to delete product tags in ShopRenter: ${deleteResponse.status} - ${errorText}`)
              }
            } catch (deleteError) {
              console.warn(`[SYNC] Error deleting product tags in ShopRenter:`, deleteError)
            }
          } else {
            console.log(`[SYNC] No product tags to delete in ShopRenter (not found)`)
          }
        } else {
          // Tags are not empty - update or create
          // Get or create productTag in ShopRenter
          // First, try to get existing productTag ID
          let productTagId = huTags.shoprenter_id
          
          // If we don't have a ShopRenter ID, try to find it
          if (!productTagId) {
            try {
              const tagSearchUrl = `${apiBaseUrl}/productTags?productId=${encodeURIComponent(product.shoprenter_id)}&languageId=${languageId}&full=1`
              const tagSearchResponse = await fetch(tagSearchUrl, {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'Authorization': authHeader
                },
                signal: AbortSignal.timeout(10000)
              })
              
              if (tagSearchResponse.ok) {
                const tagSearchData = await tagSearchResponse.json().catch(() => null)
                if (tagSearchData?.response?.items && tagSearchData.response.items.length > 0) {
                  // Find tag with matching language
                  const matchingTag = tagSearchData.response.items.find((item: any) => {
                    const itemLangId = item.language?.innerId || item.language?.id
                    return itemLangId === languageId || itemLangId === '1' || itemLangId === 1
                  })
                  if (matchingTag) {
                    productTagId = matchingTag.id || matchingTag.href?.split('/').pop()
                  }
                }
              }
            } catch (tagSearchError) {
              console.warn('[SYNC] Failed to search for existing productTag:', tagSearchError)
            }
          }

          // Prepare productTag payload
          const tagPayload: any = {
            tags: tagsValue,
            product: {
              id: product.shoprenter_id
            },
            language: {
              id: languageId
            }
          }

        // Determine endpoint - use PUT if we have tag ID, POST if not
        let tagUpdateUrl: string
        let tagMethod: string

        if (productTagId) {
          // Update existing tag
          tagUpdateUrl = `${apiBaseUrl}/productTags/${productTagId}`
          tagMethod = 'PUT'
        } else {
          // Create new tag
          tagUpdateUrl = `${apiBaseUrl}/productTags`
          tagMethod = 'POST'
        }

        console.log(`[SYNC] ${tagMethod} ${tagUpdateUrl} for product tags`)

        // Push tags to ShopRenter
        const tagPushResponse = await fetch(tagUpdateUrl, {
          method: tagMethod,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': authHeader
          },
          body: JSON.stringify(tagPayload),
          signal: AbortSignal.timeout(10000)
        })

        if (tagPushResponse.ok) {
          const tagPushResult = await tagPushResponse.json().catch(() => null)
          
          // Extract tag ID from response if we created it
          let finalTagId = productTagId
          if (!finalTagId && tagPushResult?.id) {
            finalTagId = tagPushResult.id
          } else if (!finalTagId && tagPushResult?.href) {
            const parts = tagPushResult.href.split('/')
            finalTagId = parts[parts.length - 1]
          }

          // Update local database with ShopRenter tag ID if we got it
          if (finalTagId && !huTags.shoprenter_id) {
            await supabase
              .from('product_tags')
              .update({ shoprenter_id: finalTagId })
              .eq('id', huTags.id)
          }

          console.log(`[SYNC] Successfully synced product tags: "${tagsValue}"`)
        } else {
          const errorText = await tagPushResponse.text().catch(() => 'Unknown error')
          console.warn(`[SYNC] Failed to sync product tags: ${tagPushResponse.status} - ${errorText}`)
          // Don't fail the entire sync if tag sync fails
        }
        }
      } else {
        // No tags entry in database - check if we need to delete in ShopRenter
        // (This handles the case where tags were deleted in ERP but ShopRenter still has them)
        try {
          const tagSearchUrl = `${apiBaseUrl}/productTags?productId=${encodeURIComponent(product.shoprenter_id)}&languageId=${languageId}&full=1`
          const tagSearchResponse = await fetch(tagSearchUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': authHeader
            },
            signal: AbortSignal.timeout(10000)
          })
          
          if (tagSearchResponse.ok) {
            const tagSearchData = await tagSearchResponse.json().catch(() => null)
            if (tagSearchData?.response?.items && tagSearchData.response.items.length > 0) {
              // Find and delete tag with matching language
              const matchingTag = tagSearchData.response.items.find((item: any) => {
                const itemLangId = item.language?.innerId || item.language?.id
                return itemLangId === languageId || itemLangId === '1' || itemLangId === 1
              })
              
              if (matchingTag) {
                const productTagId = matchingTag.id || matchingTag.href?.split('/').pop()
                if (productTagId) {
                  const deleteResponse = await fetch(`${apiBaseUrl}/productTags/${productTagId}`, {
                    method: 'DELETE',
                    headers: {
                      'Content-Type': 'application/json',
                      'Accept': 'application/json',
                      'Authorization': authHeader
                    },
                    signal: AbortSignal.timeout(10000)
                  })

                  if (deleteResponse.ok || deleteResponse.status === 204) {
                    console.log(`[SYNC] Deleted product tags in ShopRenter (no tags in ERP)`)
                  }
                }
              }
            }
          }
        } catch (deleteError) {
          console.warn(`[SYNC] Error checking/deleting product tags in ShopRenter:`, deleteError)
        }
      }
    } catch (tagSyncError: any) {
      // Don't fail the entire sync if tag sync fails
      console.warn(`[SYNC] Error syncing product tags:`, tagSyncError?.message || tagSyncError)
    }

    // Sync Product Class (if changed)
    try {
      if (product.product_class_shoprenter_id) {
        // Fetch current Product Class from ShopRenter to compare
        const productExtendCheckUrl = `${apiBaseUrl}/productExtend/${product.shoprenter_id}?full=1`
        const productExtendCheckResponse = await fetch(productExtendCheckUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': authHeader
          },
          signal: AbortSignal.timeout(10000)
        })

        if (productExtendCheckResponse.ok) {
          const productExtendData = await productExtendCheckResponse.json()
          const currentProductClass = productExtendData.productClass
          
          let currentProductClassId: string | null = null
          if (currentProductClass) {
            if (typeof currentProductClass === 'object' && currentProductClass.id) {
              currentProductClassId = currentProductClass.id
            } else if (currentProductClass.href) {
              const hrefParts = currentProductClass.href.split('/')
              currentProductClassId = hrefParts[hrefParts.length - 1] || null
            }
          }

          // Only sync if Product Class has changed
          if (currentProductClassId !== product.product_class_shoprenter_id) {
            console.log(`[SYNC] Product Class changed from "${currentProductClassId}" to "${product.product_class_shoprenter_id}", syncing...`)
            
            const productExtendUpdateUrl = `${apiBaseUrl}/productExtend/${product.shoprenter_id}`
            const productClassUpdateResponse = await fetch(productExtendUpdateUrl, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': authHeader
              },
              body: JSON.stringify({
                productClass: {
                  id: product.product_class_shoprenter_id
                }
              }),
              signal: AbortSignal.timeout(10000)
            })

            if (productClassUpdateResponse.ok) {
              console.log(`[SYNC] ✅ Product Class updated to "${product.product_class_shoprenter_id}"`)
            } else {
              const errorText = await productClassUpdateResponse.text().catch(() => 'Unknown error')
              console.warn(`[SYNC] ❌ Failed to update Product Class: ${productClassUpdateResponse.status} - ${errorText}`)
              // Don't fail entire sync, but log the error
            }
          } else {
            console.log(`[SYNC] Product Class unchanged (${product.product_class_shoprenter_id}), skipping sync`)
          }
        } else {
          console.warn(`[SYNC] Failed to fetch productExtend for Product Class check: ${productExtendCheckResponse.status}`)
        }
      }
    } catch (productClassSyncError: any) {
      // Don't fail the entire sync if Product Class sync fails
      console.warn(`[SYNC] Error syncing Product Class:`, productClassSyncError?.message || productClassSyncError)
    }

    // Sync parent product (parent_product_id)
    try {
      if (product.parent_product_id) {
        // Get parent product's shoprenter_id
        const { data: parentProduct } = await supabase
          .from('shoprenter_products')
          .select('shoprenter_id')
          .eq('id', product.parent_product_id)
          .is('deleted_at', null)
          .single()

        if (parentProduct?.shoprenter_id) {
          // Fetch current parent from ShopRenter to compare
          const productExtendCheckUrl = `${apiBaseUrl}/productExtend/${product.shoprenter_id}?full=1`
          const productExtendCheckResponse = await fetch(productExtendCheckUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': authHeader
            },
            signal: AbortSignal.timeout(10000)
          })

          if (productExtendCheckResponse.ok) {
            const productExtendData = await productExtendCheckResponse.json()
            const currentParentProduct = productExtendData.parentProduct
            
            let currentParentProductId: string | null = null
            if (currentParentProduct) {
              if (typeof currentParentProduct === 'object' && currentParentProduct.id) {
                currentParentProductId = currentParentProduct.id
              } else if (currentParentProduct.href) {
                const hrefParts = currentParentProduct.href.split('/')
                currentParentProductId = hrefParts[hrefParts.length - 1] || null
              }
            }

            // Only update if parent has changed
            if (currentParentProductId !== parentProduct.shoprenter_id) {
              console.log(`[SYNC] Parent product changed from "${currentParentProductId || 'null'}" to "${parentProduct.shoprenter_id}", syncing...`)
              
              const productExtendUpdateUrl = `${apiBaseUrl}/productExtend/${product.shoprenter_id}`
              const productExtendPayload = {
                parentProduct: {
                  id: parentProduct.shoprenter_id
                }
              }

              const productExtendUpdateResponse = await fetch(productExtendUpdateUrl, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'Authorization': authHeader
                },
                body: JSON.stringify(productExtendPayload),
                signal: AbortSignal.timeout(10000)
              })

              if (productExtendUpdateResponse.ok) {
                console.log(`[SYNC] ✅ Parent product updated successfully`)
              } else {
                const errorText = await productExtendUpdateResponse.text().catch(() => 'Unknown error')
                console.warn(`[SYNC] ❌ Failed to update parent product: ${productExtendUpdateResponse.status} - ${errorText}`)
              }
            } else {
              console.log(`[SYNC] Parent product unchanged (${parentProduct.shoprenter_id}), skipping sync`)
            }
          } else {
            console.warn(`[SYNC] Failed to fetch productExtend for parent product check: ${productExtendCheckResponse.status}`)
          }
        } else {
          console.warn(`[SYNC] Parent product not found or missing shoprenter_id`)
        }
      } else {
        // Check if parent should be removed (product has no parent but ShopRenter might have one)
        const productExtendCheckUrl = `${apiBaseUrl}/productExtend/${product.shoprenter_id}?full=1`
        const productExtendCheckResponse = await fetch(productExtendCheckUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': authHeader
          },
          signal: AbortSignal.timeout(10000)
        })

        if (productExtendCheckResponse.ok) {
          const productExtendData = await productExtendCheckResponse.json()
          const currentParentProduct = productExtendData.parentProduct
          
          // If ShopRenter has a parent but local doesn't, remove it
          if (currentParentProduct) {
            console.log(`[SYNC] Removing parent product from ShopRenter (local has no parent)`)
            
            // Try multiple strategies to remove parent product
            // Based on ShopRenter docs: For OneToMany (categories), empty array [] removes them
            // For OneToOne (parentProduct), we'll try empty object {} as equivalent
            let removed = false
            const productExtendUpdateUrl = `${apiBaseUrl}/productExtend/${product.shoprenter_id}`
            
            // Strategy 1: Use productExtend with parentProduct: {} (empty object, similar to [] for OneToMany)
            console.log(`[SYNC] Strategy 1: Trying productExtend with parentProduct: {}`)
            const productExtendPayloadEmpty = {
              parentProduct: {}
            }
            
            const productExtendUpdateResponseEmpty = await fetch(productExtendUpdateUrl, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': authHeader
              },
              body: JSON.stringify(productExtendPayloadEmpty),
              signal: AbortSignal.timeout(10000)
            })
            
            const responseBody1 = productExtendUpdateResponseEmpty.ok 
              ? await productExtendUpdateResponseEmpty.json().catch(() => null)
              : await productExtendUpdateResponseEmpty.text().catch(() => '')
            
            console.log(`[SYNC] Strategy 1 response status: ${productExtendUpdateResponseEmpty.status}`)
            if (!productExtendUpdateResponseEmpty.ok) {
              console.log(`[SYNC] Strategy 1 error response:`, responseBody1)
            }
            
            if (productExtendUpdateResponseEmpty.ok) {
              // Verify removal
              const verifyResponse = await fetch(`${apiBaseUrl}/productExtend/${product.shoprenter_id}?full=1`, {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'Authorization': authHeader
                },
                signal: AbortSignal.timeout(10000)
              })

              if (verifyResponse.ok) {
                const verifyData = await verifyResponse.json()
                const stillHasParent = verifyData.parentProduct && (
                  (typeof verifyData.parentProduct === 'object' && verifyData.parentProduct.id) ||
                  verifyData.parentProduct.href
                )
                
                if (!stillHasParent) {
                  console.log(`[SYNC] ✅ Parent product removed successfully via productExtend with empty object`)
                  removed = true
                } else {
                  console.log(`[SYNC] Strategy 1 failed - parent still exists:`, verifyData.parentProduct)
                }
              }
            }
            
            // Strategy 2: Use productExtend with parentProduct: null
            if (!removed) {
              console.log(`[SYNC] Strategy 2: Trying productExtend with parentProduct: null`)
              const productExtendPayloadNull = {
                parentProduct: null
              }
              
              const productExtendUpdateResponseNull = await fetch(productExtendUpdateUrl, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'Authorization': authHeader
                },
                body: JSON.stringify(productExtendPayloadNull),
                signal: AbortSignal.timeout(10000)
              })
              
              const responseBody2 = productExtendUpdateResponseNull.ok 
                ? await productExtendUpdateResponseNull.json().catch(() => null)
                : await productExtendUpdateResponseNull.text().catch(() => '')
              
              console.log(`[SYNC] Strategy 2 response status: ${productExtendUpdateResponseNull.status}`)
              if (!productExtendUpdateResponseNull.ok) {
                console.log(`[SYNC] Strategy 2 error response:`, responseBody2)
              }
              
              if (productExtendUpdateResponseNull.ok) {
                // Verify removal
                const verifyResponse2 = await fetch(`${apiBaseUrl}/productExtend/${product.shoprenter_id}?full=1`, {
                  method: 'GET',
                  headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': authHeader
                  },
                  signal: AbortSignal.timeout(10000)
                })

                if (verifyResponse2.ok) {
                  const verifyData2 = await verifyResponse2.json()
                  const stillHasParent2 = verifyData2.parentProduct && (
                    (typeof verifyData2.parentProduct === 'object' && verifyData2.parentProduct.id) ||
                    verifyData2.parentProduct.href
                  )
                  
                  if (!stillHasParent2) {
                    console.log(`[SYNC] ✅ Parent product removed successfully via productExtend with null`)
                    removed = true
                  } else {
                    console.log(`[SYNC] Strategy 2 failed - parent still exists:`, verifyData2.parentProduct)
                  }
                }
              }
            }
            
            // Strategy 3: If null didn't work, try omitting the field entirely (send empty payload)
            if (!removed) {
              console.log(`[SYNC] Strategy 3: Trying productExtend with empty payload (omitting parentProduct field)`)
              const productExtendPayloadOmit = {}
              
              const productExtendUpdateResponseOmit = await fetch(productExtendUpdateUrl, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'Authorization': authHeader
                },
                body: JSON.stringify(productExtendPayloadOmit),
                signal: AbortSignal.timeout(10000)
              })
              
              if (productExtendUpdateResponseOmit.ok) {
                // Verify removal
                const verifyResponse2 = await fetch(`${apiBaseUrl}/productExtend/${product.shoprenter_id}?full=1`, {
                  method: 'GET',
                  headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': authHeader
                  },
                  signal: AbortSignal.timeout(10000)
                })

                if (verifyResponse2.ok) {
                  const verifyData2 = await verifyResponse2.json()
                  const stillHasParent2 = verifyData2.parentProduct && (
                    (typeof verifyData2.parentProduct === 'object' && verifyData2.parentProduct.id) ||
                    verifyData2.parentProduct.href
                  )
                  
                  if (!stillHasParent2) {
                    console.log(`[SYNC] ✅ Parent product removed successfully by omitting field`)
                    removed = true
                  }
                }
              }
            }
            
            // Strategy 4: Try /products endpoint with null
            if (!removed) {
              console.log(`[SYNC] Strategy 4: Trying /products endpoint with parentProduct: null`)
              const productUpdateUrl = `${apiBaseUrl}/products/${product.shoprenter_id}`
              const productPayload = {
                parentProduct: null
              }
              
              const productUpdateResponse = await fetch(productUpdateUrl, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'Authorization': authHeader
                },
                body: JSON.stringify(productPayload),
                signal: AbortSignal.timeout(10000)
              })
              
              if (productUpdateResponse.ok) {
                // Verify removal
                const verifyResponse3 = await fetch(`${apiBaseUrl}/productExtend/${product.shoprenter_id}?full=1`, {
                  method: 'GET',
                  headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': authHeader
                  },
                  signal: AbortSignal.timeout(10000)
                })

                if (verifyResponse3.ok) {
                  const verifyData3 = await verifyResponse3.json()
                  const stillHasParent3 = verifyData3.parentProduct && (
                    (typeof verifyData3.parentProduct === 'object' && verifyData3.parentProduct.id) ||
                    verifyData3.parentProduct.href
                  )
                  
                  if (!stillHasParent3) {
                    console.log(`[SYNC] ✅ Parent product removed successfully via /products endpoint`)
                    removed = true
                  } else {
                    console.log(`[SYNC] Strategy 4 failed - parent still exists:`, verifyData3.parentProduct)
                  }
                }
              } else {
                const errorText = await productUpdateResponse.text().catch(() => 'Unknown error')
                console.log(`[SYNC] Strategy 4 error response: ${productUpdateResponse.status} - ${errorText}`)
              }
            }
            
            // Strategy 5: Try productExtend with empty string ID (based on error message format hint)
            if (!removed) {
              console.log(`[SYNC] Strategy 5: Trying productExtend with parentProduct: {"id": ""}`)
              const productExtendPayloadEmptyId = {
                parentProduct: {
                  id: ""
                }
              }
              
              const productExtendUpdateResponseEmptyId = await fetch(productExtendUpdateUrl, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'Authorization': authHeader
                },
                body: JSON.stringify(productExtendPayloadEmptyId),
                signal: AbortSignal.timeout(10000)
              })
              
              const responseBody5 = productExtendUpdateResponseEmptyId.ok 
                ? await productExtendUpdateResponseEmptyId.json().catch(() => null)
                : await productExtendUpdateResponseEmptyId.text().catch(() => '')
              
              console.log(`[SYNC] Strategy 5 response status: ${productExtendUpdateResponseEmptyId.status}`)
              if (!productExtendUpdateResponseEmptyId.ok) {
                console.log(`[SYNC] Strategy 5 error response:`, responseBody5)
              }
              
              if (productExtendUpdateResponseEmptyId.ok) {
                // Verify removal
                const verifyResponse5 = await fetch(`${apiBaseUrl}/productExtend/${product.shoprenter_id}?full=1`, {
                  method: 'GET',
                  headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': authHeader
                  },
                  signal: AbortSignal.timeout(10000)
                })

                if (verifyResponse5.ok) {
                  const verifyData5 = await verifyResponse5.json()
                  const stillHasParent5 = verifyData5.parentProduct && (
                    (typeof verifyData5.parentProduct === 'object' && verifyData5.parentProduct.id) ||
                    verifyData5.parentProduct.href
                  )
                  
                  if (!stillHasParent5) {
                    console.log(`[SYNC] ✅ Parent product removed successfully via productExtend with empty string ID`)
                    removed = true
                  } else {
                    console.log(`[SYNC] Strategy 5 failed - parent still exists:`, verifyData5.parentProduct)
                  }
                }
              }
            }
            
            // Strategy 6: Try /products endpoint with empty string ID
            if (!removed) {
              console.log(`[SYNC] Strategy 6: Trying /products endpoint with parentProduct: {"id": ""}`)
              const productUpdateUrl = `${apiBaseUrl}/products/${product.shoprenter_id}`
              const productPayloadEmptyId = {
                parentProduct: {
                  id: ""
                }
              }
              
              const productUpdateResponseEmptyId = await fetch(productUpdateUrl, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'Authorization': authHeader
                },
                body: JSON.stringify(productPayloadEmptyId),
                signal: AbortSignal.timeout(10000)
              })
              
              const responseBody6 = productUpdateResponseEmptyId.ok 
                ? await productUpdateResponseEmptyId.json().catch(() => null)
                : await productUpdateResponseEmptyId.text().catch(() => '')
              
              console.log(`[SYNC] Strategy 6 response status: ${productUpdateResponseEmptyId.status}`)
              if (!productUpdateResponseEmptyId.ok) {
                console.log(`[SYNC] Strategy 6 error response:`, responseBody6)
              }
              
              if (productUpdateResponseEmptyId.ok) {
                // Verify removal
                const verifyResponse6 = await fetch(`${apiBaseUrl}/productExtend/${product.shoprenter_id}?full=1`, {
                  method: 'GET',
                  headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': authHeader
                  },
                  signal: AbortSignal.timeout(10000)
                })

                if (verifyResponse6.ok) {
                  const verifyData6 = await verifyResponse6.json()
                  const stillHasParent6 = verifyData6.parentProduct && (
                    (typeof verifyData6.parentProduct === 'object' && verifyData6.parentProduct.id) ||
                    verifyData6.parentProduct.href
                  )
                  
                  if (!stillHasParent6) {
                    console.log(`[SYNC] ✅ Parent product removed successfully via /products endpoint with empty string ID`)
                    removed = true
                  } else {
                    console.log(`[SYNC] Strategy 6 failed - parent still exists:`, verifyData6.parentProduct)
                  }
                }
              }
            }
            
            if (!removed) {
              console.warn(`[SYNC] ⚠️ All removal strategies failed - parent product still exists in ShopRenter`)
              console.warn(`[SYNC] The ShopRenter API documentation does not explicitly show how to remove a OneToOne relationship.`)
              console.warn(`[SYNC] Manual removal via ShopRenter admin interface may be required.`)
            }
          } else {
            console.log(`[SYNC] No parent product to sync (local and ShopRenter both have no parent)`)
          }
        }
      }
    } catch (parentProductSyncError: any) {
      // Don't fail the entire sync if parent product sync fails
      console.warn(`[SYNC] Error syncing parent product:`, parentProductSyncError?.message || parentProductSyncError)
    }

    // Sync product attributes (product_attributes)
    try {
      const localAttributes = (product.product_attributes as any[]) || []
      
      if (localAttributes.length > 0) {
        console.log(`[SYNC] Product has ${localAttributes.length} attributes to sync`)
        
        // First, fetch current attributes from ShopRenter to compare
        const productExtendUrl = `${apiBaseUrl}/productExtend/${product.shoprenter_id}?full=1`
        const productExtendResponse = await fetch(productExtendUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': authHeader
          },
          signal: AbortSignal.timeout(10000)
        })

        if (!productExtendResponse.ok) {
          throw new Error(`Failed to fetch productExtend: ${productExtendResponse.status}`)
        }

        const productExtend = await productExtendResponse.json()
        const shoprenterAttributes = productExtend.productAttributeExtend || []
        
        // Create maps for ShopRenter attributes by name and by ID for quick lookup
        const shoprenterAttrMapByName = new Map<string, any>()
        const shoprenterAttrMapById = new Map<string, any>()
        
        shoprenterAttributes.forEach((attr: any) => {
          // Map by name (e.g., "szin", "medence")
          if (attr.name) {
            shoprenterAttrMapByName.set(attr.name, attr)
          }
          
          // Map by attribute ID (listAttribute.id, numberAttribute.id, textAttribute.id)
          const attributeId = attr.listAttribute?.id || attr.numberAttribute?.id || attr.textAttribute?.id || attr.id
          if (attributeId) {
            shoprenterAttrMapById.set(attributeId, attr)
          }
        })

        // Validate Product Class if set (attributes must belong to Product Class)
        let validAttributeIds: Set<string> | null = null
        if (product.product_class_shoprenter_id) {
          // First, get the Product Class ID from database
          const { data: productClassData } = await supabase
            .from('shoprenter_product_classes')
            .select('id')
            .eq('connection_id', connection.id)
            .eq('shoprenter_id', product.product_class_shoprenter_id)
            .is('deleted_at', null)
            .single()

          if (productClassData?.id) {
            // Then get all attribute relations for this Product Class
            const { data: attributeRelations } = await supabase
              .from('shoprenter_product_class_attribute_relations')
              .select('attribute_shoprenter_id')
              .eq('product_class_id', productClassData.id)
              .is('deleted_at', null)

            if (attributeRelations && attributeRelations.length > 0) {
              validAttributeIds = new Set(attributeRelations.map((rel: any) => rel.attribute_shoprenter_id))
              console.log(`[SYNC] Validating attributes against Product Class "${product.product_class_shoprenter_id}" (${validAttributeIds.size} valid attributes)`)
            }
          }
        }

        // Process each local attribute
        for (const localAttr of localAttributes) {
          try {
            // Try to find the attribute in ShopRenter
            // Strategy 1: Look up by name (e.g., "szin", "medence")
            let shoprenterAttr = shoprenterAttrMapByName.get(localAttr.name)
            
            // Strategy 2: If not found by name, try by attribute ID
            // The localAttr.name might be the attribute ID (e.g., "bGlzdEF0dHJpYnV0ZS1hdHRyaWJ1dGVfaWQ9MjM=")
            if (!shoprenterAttr) {
              shoprenterAttr = shoprenterAttrMapById.get(localAttr.name)
              if (shoprenterAttr) {
                console.log(`[SYNC] Found attribute "${localAttr.name}" by ID in ShopRenter`)
              }
            }
            
            // Strategy 3: If still not found, check if localAttr has an id field that matches
            if (!shoprenterAttr && localAttr.id) {
              shoprenterAttr = shoprenterAttrMapById.get(localAttr.id)
              if (shoprenterAttr) {
                console.log(`[SYNC] Found attribute by localAttr.id "${localAttr.id}" in ShopRenter`)
              }
            }
            
            if (!shoprenterAttr) {
              // Attribute not found in ShopRenter's productExtend - it might be a new attribute
              // that was just added locally but not yet assigned to the product in ShopRenter
              // Try to find it by attribute ID from the Product Class relations
              let attributeIdToUse: string | null = localAttr.name
              
              // Check if localAttr.name is actually an attribute ID (base64 encoded, longer string)
              const isAttributeId = localAttr.name && localAttr.name.length > 30 && !localAttr.name.includes(' ')
              
              if (!isAttributeId && localAttr.id) {
                attributeIdToUse = localAttr.id
              }
              
              // Validate that this attribute belongs to the Product Class
              if (validAttributeIds && attributeIdToUse && validAttributeIds.has(attributeIdToUse)) {
                console.log(`[SYNC] Attribute "${localAttr.name}" not in ShopRenter productExtend but belongs to Product Class, will create relation`)
                // We'll handle this in the LIST/INTEGER/FLOAT/TEXT sections below
                // For now, we need to construct a shoprenterAttr-like object
                // But first, let's try to fetch the attribute from ShopRenter API
                try {
                  // Try to determine attribute type and fetch it
                  const { data: attrRelation } = await supabase
                    .from('shoprenter_product_class_attribute_relations')
                    .select('attribute_type, attribute_shoprenter_id')
                    .eq('connection_id', connection.id)
                    .eq('attribute_shoprenter_id', attributeIdToUse)
                    .is('deleted_at', null)
                    .maybeSingle()
                  
                  if (attrRelation) {
                    // Construct a minimal shoprenterAttr object for syncing
                    shoprenterAttr = {
                      name: localAttr.name,
                      type: attrRelation.attribute_type,
                      id: attributeIdToUse,
                      listAttribute: attrRelation.attribute_type === 'LIST' ? { id: attributeIdToUse } : undefined,
                      numberAttribute: (attrRelation.attribute_type === 'INTEGER' || attrRelation.attribute_type === 'FLOAT') ? { id: attributeIdToUse } : undefined,
                      textAttribute: attrRelation.attribute_type === 'TEXT' ? { id: attributeIdToUse } : undefined,
                      value: null // Not assigned yet
                    }
                    console.log(`[SYNC] Constructed shoprenterAttr for new attribute "${localAttr.name}" (type: ${attrRelation.attribute_type})`)
                  } else {
                    console.warn(`[SYNC] Attribute "${localAttr.name}" (ID: ${attributeIdToUse}) not found in Product Class relations, skipping`)
              continue
            }
                } catch (fetchError) {
                  console.warn(`[SYNC] Failed to fetch attribute relation for "${localAttr.name}":`, fetchError)
                  continue
                }
              } else {
                console.warn(`[SYNC] Attribute "${localAttr.name}" (ID: ${localAttr.id || 'N/A'}) not found in ShopRenter and not in Product Class, skipping`)
                console.warn(`[SYNC] Available ShopRenter attributes:`, Array.from(shoprenterAttrMapByName.keys()))
                continue
              }
            }

            // Validate attribute belongs to Product Class (if Product Class is set)
            if (validAttributeIds && product.product_class_shoprenter_id) {
              const attributeId = shoprenterAttr.listAttribute?.id || shoprenterAttr.numberAttribute?.id || shoprenterAttr.textAttribute?.id || shoprenterAttr.id
              if (!validAttributeIds.has(attributeId)) {
                console.warn(`[SYNC] Attribute "${localAttr.name}" (ID: ${attributeId}) does not belong to Product Class "${product.product_class_shoprenter_id}", skipping`)
                continue
              }
            }

            // Handle different attribute types

            if (localAttr.type === 'LIST') {
              // For LIST attributes, we need to sync the listAttributeValueRelation
              // The local value is an array containing listAttributeValueDescription objects
              const localValue = Array.isArray(localAttr.value) ? localAttr.value[0] : null
              
              if (!localValue) {
                console.warn(`[SYNC] No value found for LIST attribute "${localAttr.name}"`)
                continue
              }

              // Extract the listAttributeValue ID
              let listAttributeValueId: string | null = null
              
              // Strategy 1 (BEST): Use the stored listAttributeValueId if available
              // This is the most reliable because it's stored when the user saves the value
              // and avoids extra API calls
              if (localValue.listAttributeValueId) {
                listAttributeValueId = localValue.listAttributeValueId
                console.log(`[SYNC] Using stored listAttributeValueId for "${localAttr.name}": ${listAttributeValueId}`)
              }
              
              // Strategy 2: Use stored relationId to fetch relation and extract listAttributeValueId
              // This is faster than searching through all relations
              if (!listAttributeValueId && localValue.relationId) {
                try {
                  const relationUrl = `${apiBaseUrl}/productListAttributeValueRelations/${encodeURIComponent(localValue.relationId)}?full=1`
                  const relationResponse = await fetch(relationUrl, {
                    method: 'GET',
                    headers: {
                      'Content-Type': 'application/json',
                      'Accept': 'application/json',
                      'Authorization': authHeader
                    },
                    signal: AbortSignal.timeout(5000)
                  })
                  
                  if (relationResponse.ok) {
                    const relationData = await relationResponse.json()
                    if (relationData.listAttributeValue?.id) {
                      listAttributeValueId = relationData.listAttributeValue.id
                      console.log(`[SYNC] Strategy 2: Extracted listAttributeValueId from stored relationId for "${localAttr.name}": ${listAttributeValueId}`)
                    } else if (relationData.listAttributeValue?.href) {
                      const hrefMatch = relationData.listAttributeValue.href.match(/\/listAttributeValues\/([^\/\?]+)/)
                      if (hrefMatch && hrefMatch[1]) {
                        listAttributeValueId = hrefMatch[1]
                        console.log(`[SYNC] Strategy 2: Extracted listAttributeValueId from relation href for "${localAttr.name}": ${listAttributeValueId}`)
                      }
                    }
                  }
                } catch (err) {
                  console.warn(`[SYNC] Strategy 2: Failed to fetch relation by relationId:`, err)
                }
              }
              
              // Strategy 3: Extract from ShopRenter's current value (from productExtend we just fetched)
              // This works if the value hasn't changed, but fails if user changed it
              if (!listAttributeValueId) {
              const shoprenterValue = Array.isArray(shoprenterAttr.value) ? shoprenterAttr.value[0] : shoprenterAttr.value
              
              // Log the ShopRenter value structure for debugging
              console.log(`[SYNC] ShopRenter value for "${localAttr.name}":`, JSON.stringify(shoprenterValue, null, 2).substring(0, 500))
              
              if (shoprenterValue?.href) {
                // The href points to listAttributeValueDescription, but we need listAttributeValue
                // Extract the description ID from href, then fetch it to get listAttributeValue ID
                // Format: http://shop.api.myshoprenter.hu/listAttributeValueDescriptions/{descId}
                const descHrefMatch = shoprenterValue.href.match(/\/listAttributeValueDescriptions\/([^\/\?]+)/)
                if (descHrefMatch && descHrefMatch[1]) {
                  const descId = descHrefMatch[1]
                  console.log(`[SYNC] Extracted description ID from ShopRenter value href: ${descId}`)
                  // Fetch the description to get listAttributeValue ID
                  const descUrl = `${apiBaseUrl}/listAttributeValueDescriptions/${encodeURIComponent(descId)}?full=1`
                  const descResponse = await fetch(descUrl, {
                    method: 'GET',
                    headers: {
                      'Content-Type': 'application/json',
                      'Accept': 'application/json',
                      'Authorization': authHeader
                    },
                    signal: AbortSignal.timeout(5000)
                  })

                  if (descResponse.ok) {
                    const descData = await descResponse.json()
                    console.log(`[SYNC] Description data for "${localAttr.name}":`, JSON.stringify(descData, null, 2).substring(0, 500))
                    if (descData.listAttributeValue?.id) {
                      listAttributeValueId = descData.listAttributeValue.id
                    } else if (descData.listAttributeValue?.href) {
                      const hrefMatch = descData.listAttributeValue.href.match(/\/listAttributeValues\/([^\/\?]+)/)
                      if (hrefMatch && hrefMatch[1]) {
                        listAttributeValueId = hrefMatch[1]
                      }
                    }
                  } else {
                    const errorText = await descResponse.text().catch(() => 'Unknown error')
                      if (descResponse.status === 404) {
                        console.warn(`[SYNC] Description not found (404) for "${localAttr.name}" from ShopRenter value href. Will attempt Strategy 5 (text matching).`)
                      } else {
                    console.warn(`[SYNC] Failed to fetch description from ShopRenter value href for "${localAttr.name}": ${descResponse.status} - ${errorText}`)
                      }
                    }
                  }
                }
              }
              
              // Strategy 4: If we have local value ID, try to fetch it (but this might fail with 404)
              // The local value.id is the listAttributeValueDescription ID
              // This is the fallback if the value was changed but we don't have the listAttributeValueId stored
              if (!listAttributeValueId && localValue.id) {
                const descUrl = `${apiBaseUrl}/listAttributeValueDescriptions/${encodeURIComponent(localValue.id)}?full=1`
                const descResponse = await fetch(descUrl, {
                  method: 'GET',
                  headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': authHeader
                  },
                  signal: AbortSignal.timeout(5000)
                })

                if (descResponse.ok) {
                  const descData = await descResponse.json()
                  if (descData.listAttributeValue?.id) {
                    listAttributeValueId = descData.listAttributeValue.id
                  } else if (descData.listAttributeValueId) {
                    listAttributeValueId = descData.listAttributeValueId
                  } else if (descData.listAttributeValue?.href) {
                    const hrefMatch = descData.listAttributeValue.href.match(/\/listAttributeValues\/([^\/\?]+)/)
                    if (hrefMatch && hrefMatch[1]) {
                      listAttributeValueId = hrefMatch[1]
                    }
                  }
                } else {
                  // If description fetch fails, log but don't fail yet
                  const errorText = await descResponse.text().catch(() => 'Unknown error')
                  if (descResponse.status === 404) {
                        console.warn(`[SYNC] Local description ID not found (404) for "${localAttr.name}" (ID: ${localValue.id}). Will attempt Strategy 5 (text matching).`)
                  } else {
                  console.warn(`[SYNC] Failed to fetch listAttributeValueDescription for "${localAttr.name}" (ID: ${localValue.id}): ${descResponse.status} - ${errorText}`)
                  }
                }
              }
              
              // Strategy 5: Query listAttributeValues by attribute ID and match by value text
              // This is a last resort if all other strategies fail
              if (!listAttributeValueId) {
                const listAttributeId = shoprenterAttr.listAttribute?.id || shoprenterAttr.id
                if (listAttributeId && localValue.value) {
                  const valueText = typeof localValue.value === 'string' ? localValue.value : localValue.value?.toString()
                  if (valueText) {
                    console.log(`[SYNC] Strategy 5: Trying to find listAttributeValue by querying listAttributeValues for attribute "${localAttr.name}" (ID: ${listAttributeId}) with value text: "${valueText}"`)
                    const listValuesUrl = `${apiBaseUrl}/listAttributeValues?listAttributeId=${encodeURIComponent(listAttributeId)}&full=1`
                    const listValuesResponse = await fetch(listValuesUrl, {
                      method: 'GET',
                      headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'Authorization': authHeader
                      },
                      signal: AbortSignal.timeout(10000)
                    })

                    if (listValuesResponse.ok) {
                      const listValuesData = await listValuesResponse.json()
                      const listValues = listValuesData.items || listValuesData.listAttributeValues?.listAttributeValue || []
                      const valuesArray = Array.isArray(listValues) ? listValues : [listValues].filter(Boolean)
                      
                      console.log(`[SYNC] Strategy 5: Found ${valuesArray.length} listAttributeValues for attribute "${localAttr.name}"`)

                      // Fetch descriptions for each value to enable text matching
                      // The full=1 parameter might not include descriptions, so we need to fetch them
                      const languageId = 'bGFuZ3VhZ2UtbGFuZ3VhZ2VfaWQ9MQ==' // Hungarian
                      const normalizedValueText = valueText.trim().toLowerCase()
                      
                      for (const listValue of valuesArray) {
                        if (!listValue || !listValue.id) continue
                        
                        try {
                          // First, check if descriptions are already in the response
                          let descriptions: any[] = []
                          if (listValue.listAttributeValueDescriptions) {
                            if (Array.isArray(listValue.listAttributeValueDescriptions?.listAttributeValueDescription)) {
                              descriptions = listValue.listAttributeValueDescriptions.listAttributeValueDescription
                            } else if (listValue.listAttributeValueDescriptions?.listAttributeValueDescription) {
                              descriptions = [listValue.listAttributeValueDescriptions.listAttributeValueDescription]
                            }
                          }
                          
                          // Also check if descriptions are directly in the response
                          if (descriptions.length === 0 && listValue.listAttributeValueDescription) {
                            descriptions = Array.isArray(listValue.listAttributeValueDescription) 
                              ? listValue.listAttributeValueDescription 
                              : [listValue.listAttributeValueDescription]
                          }
                          
                          // If we don't have descriptions in the response, fetch them
                          if (descriptions.length === 0) {
                            const descUrl = `${apiBaseUrl}/listAttributeValueDescriptions?listAttributeValueId=${encodeURIComponent(listValue.id)}&languageId=${encodeURIComponent(languageId)}&full=1`
                            const descResponse = await fetch(descUrl, {
                              method: 'GET',
                              headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json',
                                'Authorization': authHeader
                              },
                              signal: AbortSignal.timeout(5000)
                            })

                            if (descResponse.ok) {
                              const descData = await descResponse.json()
                              
                              // Extract descriptions from response
                              if (descData.items && Array.isArray(descData.items)) {
                                descriptions = descData.items
                              } else if (descData.listAttributeValueDescriptions?.listAttributeValueDescription) {
                                const descs = descData.listAttributeValueDescriptions.listAttributeValueDescription
                                descriptions = Array.isArray(descs) ? descs : [descs]
                              } else if (descData.listAttributeValueDescription) {
                                descriptions = [descData.listAttributeValueDescription]
                              }
                            }
                          }
                          
                          // Try to match by text in descriptions
                          const matchingDesc = descriptions.find((desc: any) => {
                            if (!desc) return false
                            const descName = (desc.name || desc.value || '').trim().toLowerCase()
                            const descValue = (desc.value || desc.name || '').trim().toLowerCase()
                            
                            // Exact match
                            if (descName === normalizedValueText || descValue === normalizedValueText) {
                              return true
                            }
                            
                            // Partial match (contains)
                            if (descName.includes(normalizedValueText) || descValue.includes(normalizedValueText)) {
                              return true
                            }
                            
                            // Reverse partial match (value text contains description)
                            if (normalizedValueText.includes(descName) || normalizedValueText.includes(descValue)) {
                              return true
                            }
                            
                            return false
                          })
                          
                          if (matchingDesc) {
                            listAttributeValueId = listValue.id
                            console.log(`[SYNC] Strategy 5: ✅ Found listAttributeValue ID by matching value text "${valueText}": ${listAttributeValueId}`)
                            break
                          }
                        } catch (error) {
                          console.warn(`[SYNC] Strategy 5: Error fetching descriptions for value ${listValue.id}:`, error)
                          // Continue to next value
                        }
                      }
                      
                      if (!listAttributeValueId) {
                        console.warn(`[SYNC] Strategy 5: Could not find matching listAttributeValue for "${localAttr.name}" with value text "${valueText}"`)
                      }
                    } else {
                      const errorText = await listValuesResponse.text().catch(() => 'Unknown error')
                      console.warn(`[SYNC] Strategy 5: Failed to fetch listAttributeValues: ${listValuesResponse.status} - ${errorText}`)
                    }
                  }
                }
              }
              
              // If we still don't have the ID, we can't proceed
              if (!listAttributeValueId) {
                console.warn(`[SYNC] Could not extract listAttributeValue ID for "${localAttr.name}"`)
                console.warn(`[SYNC] Local value:`, JSON.stringify(localValue, null, 2).substring(0, 300))
                continue
              }

              console.log(`[SYNC] Extracted listAttributeValue ID for "${localAttr.name}": ${listAttributeValueId}`)

              // Get the listAttribute ID from the ShopRenter attribute
              // This is needed to find the existing relation for this attribute
              const listAttributeId = shoprenterAttr.listAttribute?.id || shoprenterAttr.id
              
              if (!listAttributeId) {
                console.warn(`[SYNC] No listAttribute ID found for "${localAttr.name}", skipping`)
                continue
              }

              // Check if we have stored relation ID (from pull) - this is the fastest path
              let existingRelation: any = null
              if (localValue.relationId) {
                // Use stored relation ID directly - fetch with full=1 to get complete data
                const relationUrl = `${apiBaseUrl}/productListAttributeValueRelations/${encodeURIComponent(localValue.relationId)}?full=1`
              const relationResponse = await fetch(relationUrl, {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'Authorization': authHeader
                },
                signal: AbortSignal.timeout(5000)
              })

              if (relationResponse.ok) {
                  existingRelation = await relationResponse.json()
                  console.log(`[SYNC] ✅ Using stored relation ID for "${localAttr.name}": ${localValue.relationId}`)
                  // Log the relation structure for debugging
                  if (existingRelation.listAttributeValue) {
                    console.log(`[SYNC] Relation listAttributeValue structure:`, JSON.stringify({
                      id: existingRelation.listAttributeValue.id,
                      href: existingRelation.listAttributeValue.href
                    }, null, 2))
                  }
                } else {
                  console.warn(`[SYNC] Stored relation ID ${localValue.relationId} not found (${relationResponse.status}), will search for relation`)
                }
              }

              // Fallback to searching if stored ID doesn't work or wasn't available
              if (!existingRelation) {
                // Get all relations for this product to find the one for this attribute
                // We need to find the existing relation by attribute ID, not by value ID
                const allRelationsUrl = `${apiBaseUrl}/productListAttributeValueRelations?productId=${encodeURIComponent(product.shoprenter_id)}&full=1`
                const allRelationsResponse = await fetch(allRelationsUrl, {
                  method: 'GET',
                  headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': authHeader
                  },
                  signal: AbortSignal.timeout(10000)
                })

                if (allRelationsResponse.ok) {
                  const allRelationsData = await allRelationsResponse.json()
                  const allRelations = allRelationsData.items || allRelationsData.productListAttributeValueRelations?.productListAttributeValueRelation || []
                  const relationsArray = Array.isArray(allRelations) ? allRelations : [allRelations].filter(Boolean)
                  
                  console.log(`[SYNC] Found ${relationsArray.length} existing relations for product, looking for attribute "${localAttr.name}" (ID: ${listAttributeId})`)

                  // Find the relation where the listAttributeValue belongs to our attribute
                  // We need to check each relation's listAttributeValue to see if it belongs to our attribute
                  for (const relation of relationsArray) {
                    if (!relation) continue
                    
                    let relationListAttributeId: string | null = null
                    
                    // Try to get the attribute ID from the relation
                    if (relation.listAttributeValue?.listAttribute?.id) {
                      relationListAttributeId = relation.listAttributeValue.listAttribute.id
                    } else if (relation.listAttributeValue?.listAttribute?.href) {
                      // Extract from href: /listAttributes/{id}
                      const attrHrefMatch = relation.listAttributeValue.listAttribute.href.match(/\/listAttributes\/([^\/\?]+)/)
                      if (attrHrefMatch && attrHrefMatch[1]) {
                        relationListAttributeId = attrHrefMatch[1]
                      }
                    } else if (relation.listAttributeValue?.href) {
                      // We need to fetch the listAttributeValue to get its attribute
                      try {
                        const listValueUrl = relation.listAttributeValue.href + '?full=1'
                        const listValueResponse = await fetch(listValueUrl, {
                          method: 'GET',
                          headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                            'Authorization': authHeader
                          },
                          signal: AbortSignal.timeout(5000)
                        })
                        
                        if (listValueResponse.ok) {
                          const listValueData = await listValueResponse.json()
                          if (listValueData.listAttribute?.id) {
                            relationListAttributeId = listValueData.listAttribute.id
                          } else if (listValueData.listAttribute?.href) {
                            const attrHrefMatch = listValueData.listAttribute.href.match(/\/listAttributes\/([^\/\?]+)/)
                            if (attrHrefMatch && attrHrefMatch[1]) {
                              relationListAttributeId = attrHrefMatch[1]
                            }
                          }
                        }
                      } catch (err) {
                        // Continue to next relation if fetch fails
                        console.warn(`[SYNC] Failed to fetch listAttributeValue for relation:`, err)
                      }
                    }
                    
                    // If we only have href for the relation itself, fetch it
                    if (!relationListAttributeId && relation.href && !relation.listAttributeValue) {
                      try {
                        const relationDetailResponse = await fetch(relation.href + '?full=1', {
                          method: 'GET',
                          headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                            'Authorization': authHeader
                          },
                          signal: AbortSignal.timeout(5000)
                        })
                        
                        if (relationDetailResponse.ok) {
                          const relationDetail = await relationDetailResponse.json()
                          if (relationDetail.listAttributeValue?.listAttribute?.id) {
                            relationListAttributeId = relationDetail.listAttributeValue.listAttribute.id
                          } else if (relationDetail.listAttributeValue?.href) {
                            // Fetch the listAttributeValue
                            const listValueUrl = relationDetail.listAttributeValue.href + '?full=1'
                            const listValueResponse = await fetch(listValueUrl, {
                              method: 'GET',
                              headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json',
                                'Authorization': authHeader
                              },
                              signal: AbortSignal.timeout(5000)
                            })
                            
                            if (listValueResponse.ok) {
                              const listValueData = await listValueResponse.json()
                              if (listValueData.listAttribute?.id) {
                                relationListAttributeId = listValueData.listAttribute.id
                              }
                            }
                          }
                          
                          if (relationListAttributeId === listAttributeId) {
                            existingRelation = relationDetail
                            break
                          }
                        }
                      } catch (err) {
                        console.warn(`[SYNC] Failed to fetch relation detail:`, err)
                      }
                    }
                    
                    // Check if this relation matches our attribute
                    if (relationListAttributeId === listAttributeId) {
                      // Fetch full relation data if we only have href
                      if (relation.href && (!relation.listAttributeValue || !relation.listAttributeValue.id)) {
                        try {
                          const fullRelationResponse = await fetch(relation.href + '?full=1', {
                            method: 'GET',
                            headers: {
                              'Content-Type': 'application/json',
                              'Accept': 'application/json',
                              'Authorization': authHeader
                            },
                            signal: AbortSignal.timeout(5000)
                          })
                          
                          if (fullRelationResponse.ok) {
                            existingRelation = await fullRelationResponse.json()
                            console.log(`[SYNC] Found existing relation for attribute "${localAttr.name}" (fetched full data): ${relation.href}`)
                          } else {
                            existingRelation = relation
                            console.log(`[SYNC] Found existing relation for attribute "${localAttr.name}": ${relation.href || relation.id}`)
                          }
                        } catch (err) {
                          existingRelation = relation
                          console.log(`[SYNC] Found existing relation for attribute "${localAttr.name}": ${relation.href || relation.id}`)
                        }
                      } else {
                        existingRelation = relation
                        console.log(`[SYNC] Found existing relation for attribute "${localAttr.name}": ${relation.href || relation.id}`)
                      }
                      break
                    }
                  }
                  
                  if (!existingRelation) {
                    console.log(`[SYNC] No existing relation found for attribute "${localAttr.name}", will create new one`)
                  }
                } else {
                  const errorText = await allRelationsResponse.text().catch(() => 'Unknown error')
                  console.warn(`[SYNC] Failed to fetch all relations for product: ${allRelationsResponse.status} - ${errorText}`)
                }
              }

                // According to ShopRenter API docs, we only need to send product and listAttributeValue IDs
                // NOT the listAttribute ID!
                const payload = {
                  product: { id: product.shoprenter_id },
                  listAttributeValue: { id: listAttributeValueId }
                }

                if (existingRelation) {
                // Extract current listAttributeValue ID from the relation
                // The relation response has listAttributeValue.href, not .id
                let currentListAttributeValueId: string | null = null
                
                if (existingRelation.listAttributeValue?.id) {
                  currentListAttributeValueId = existingRelation.listAttributeValue.id
                } else if (existingRelation.listAttributeValue?.href) {
                  // Extract ID from href: http://shop.api.myshoprenter.hu/listAttributeValues/{id}
                  const hrefParts = existingRelation.listAttributeValue.href.split('/')
                  currentListAttributeValueId = hrefParts[hrefParts.length - 1] || null
                }
                
                console.log(`[SYNC] Current listAttributeValueId for "${localAttr.name}": ${currentListAttributeValueId}`)
                console.log(`[SYNC] New listAttributeValueId for "${localAttr.name}": ${listAttributeValueId}`)
                
                // Check if value actually changed
                const valueChanged = currentListAttributeValueId !== listAttributeValueId
                
                console.log(`[SYNC] Updating LIST attribute "${localAttr.name}" relation`)
                console.log(`[SYNC] Current value ID: ${currentListAttributeValueId || 'null'}`)
                console.log(`[SYNC] New value ID: ${listAttributeValueId}`)
                console.log(`[SYNC] Value changed: ${valueChanged}`)
                
                // According to ShopRenter behavior, when the value changes, we MUST use DELETE + POST
                // PUT might not reliably update the relation when the value ID changes
                // We'll use DELETE + POST for all updates to ensure consistency
                const relationId = existingRelation.id || existingRelation.href?.split('/').pop()
                
                if (!relationId) {
                  console.warn(`[SYNC] No relation ID found for "${localAttr.name}", cannot update`)
                } else {
                  // Always use DELETE + POST for updates (most reliable)
                  console.log(`[SYNC] Using DELETE + POST strategy for "${localAttr.name}" (most reliable)`)
                  
                  // Step 1: Delete the old relation
                  const deleteUrl = existingRelation.href || `${apiBaseUrl}/productListAttributeValueRelations/${relationId}`
                  console.log(`[SYNC] Deleting old relation: ${deleteUrl}`)
                  
                  const deleteResponse = await fetch(deleteUrl, {
                    method: 'DELETE',
                    headers: {
                      'Content-Type': 'application/json',
                      'Accept': 'application/json',
                      'Authorization': authHeader
                    },
                    signal: AbortSignal.timeout(5000)
                  })

                  if (deleteResponse.ok || deleteResponse.status === 204 || deleteResponse.status === 404) {
                    // 404 means it was already gone, which is fine
                    console.log(`[SYNC] ✅ Deleted old relation for "${localAttr.name}" (status: ${deleteResponse.status})`)
                    
                    // Step 2: Create new relation with the (possibly updated) value
                    const createUrl = `${apiBaseUrl}/productListAttributeValueRelations`
                    console.log(`[SYNC] Creating new relation: ${createUrl}`)
                  console.log(`[SYNC] Payload:`, JSON.stringify(payload, null, 2))
                  
                    const createResponse = await fetch(createUrl, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'Authorization': authHeader
                      },
                      body: JSON.stringify(payload),
                      signal: AbortSignal.timeout(5000)
                    })

                    if (createResponse.ok) {
                      const createResult = await createResponse.json().catch(() => null)
                      console.log(`[SYNC] ✅ Successfully updated LIST attribute "${localAttr.name}" value (via DELETE + POST)`)
                      if (createResult) {
                        console.log(`[SYNC] New relation created:`, JSON.stringify(createResult, null, 2).substring(0, 300))
                      }
                    } else {
                      const createErrorText = await createResponse.text().catch(() => 'Unknown error')
                      console.warn(`[SYNC] ❌ Failed to create new relation for "${localAttr.name}": ${createResponse.status} - ${createErrorText}`)
                      
                      // If POST fails with 409 (already exists), try PUT as fallback
                      if (createResponse.status === 409) {
                        console.log(`[SYNC] Relation already exists (409), attempting PUT as fallback`)
                        const putUrl = `${apiBaseUrl}/productListAttributeValueRelations`
                        const putResponse = await fetch(putUrl, {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                      'Accept': 'application/json',
                      'Authorization': authHeader
                    },
                    body: JSON.stringify(payload),
                    signal: AbortSignal.timeout(5000)
                  })

                        if (putResponse.ok) {
                          const putResult = await putResponse.json().catch(() => null)
                          console.log(`[SYNC] ✅ Updated LIST attribute "${localAttr.name}" value (via PUT fallback)`)
                          if (putResult) {
                            console.log(`[SYNC] PUT response:`, JSON.stringify(putResult, null, 2).substring(0, 300))
                          }
                  } else {
                          const putErrorText = await putResponse.text().catch(() => 'Unknown error')
                          console.warn(`[SYNC] ❌ PUT fallback also failed for "${localAttr.name}": ${putResponse.status} - ${putErrorText}`)
                        }
                      }
                    }
                  } else {
                    const deleteErrorText = await deleteResponse.text().catch(() => 'Unknown error')
                    console.warn(`[SYNC] Failed to delete old relation for "${localAttr.name}": ${deleteResponse.status} - ${deleteErrorText}`)
                    
                    // If delete fails, try PUT as fallback
                    console.log(`[SYNC] Attempting PUT as fallback after delete failure`)
                    const putUrl = `${apiBaseUrl}/productListAttributeValueRelations`
                    const putResponse = await fetch(putUrl, {
                      method: 'PUT',
                      headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'Authorization': authHeader
                      },
                      body: JSON.stringify(payload),
                      signal: AbortSignal.timeout(5000)
                    })
                    
                    if (putResponse.ok) {
                      const putResult = await putResponse.json().catch(() => null)
                      console.log(`[SYNC] ✅ Updated LIST attribute "${localAttr.name}" value (via PUT fallback after delete failure)`)
                      if (putResult) {
                        console.log(`[SYNC] PUT response:`, JSON.stringify(putResult, null, 2).substring(0, 300))
                      }
                    } else {
                      const putErrorText = await putResponse.text().catch(() => 'Unknown error')
                      console.warn(`[SYNC] ❌ PUT fallback also failed for "${localAttr.name}": ${putResponse.status} - ${putErrorText}`)
                    }
                  }
                  }
                } else {
                  // Create new relation using POST
                  const createUrl = `${apiBaseUrl}/productListAttributeValueRelations`
                  console.log(`[SYNC] Creating LIST attribute "${localAttr.name}" relation: ${createUrl}`)
                  console.log(`[SYNC] Payload:`, JSON.stringify(payload, null, 2))
                  
                  const createResponse = await fetch(createUrl, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Accept': 'application/json',
                      'Authorization': authHeader
                    },
                    body: JSON.stringify(payload),
                    signal: AbortSignal.timeout(5000)
                  })

                  if (createResponse.ok) {
                    console.log(`[SYNC] ✅ Created LIST attribute "${localAttr.name}" value`)
                  } else {
                    const errorText = await createResponse.text().catch(() => 'Unknown error')
                    console.warn(`[SYNC] ❌ Failed to create LIST attribute "${localAttr.name}": ${createResponse.status} - ${errorText}`)
                  }
              }
            } else if (localAttr.type === 'INTEGER' || localAttr.type === 'FLOAT') {
              // For INTEGER/FLOAT attributes, use numberAttributeValues
              const localValue = typeof localAttr.value === 'object' ? localAttr.value.value : localAttr.value
              const numberAttributeId = shoprenterAttr.numberAttribute?.id || shoprenterAttr.id
              
              if (!numberAttributeId) {
                console.warn(`[SYNC] No numberAttribute ID found for "${localAttr.name}"`)
                continue
              }

              // Check if value already exists
              const valueUrl = `${apiBaseUrl}/numberAttributeValues?productId=${encodeURIComponent(product.shoprenter_id)}&numberAttributeId=${encodeURIComponent(numberAttributeId)}&full=1`
              const valueResponse = await fetch(valueUrl, {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'Authorization': authHeader
                },
                signal: AbortSignal.timeout(5000)
              })

              if (valueResponse.ok) {
                const valueData = await valueResponse.json()
                const existingValues = valueData.items || valueData.numberAttributeValues?.numberAttributeValue || []
                const existingValue = Array.isArray(existingValues) ? existingValues[0] : existingValues

                if (existingValue) {
                  // Update existing value
                  const updateUrl = existingValue.href || `${apiBaseUrl}/numberAttributeValues/${existingValue.id}`
                  const updateResponse = await fetch(updateUrl, {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                      'Accept': 'application/json',
                      'Authorization': authHeader
                    },
                    body: JSON.stringify({
                      product: { id: product.shoprenter_id },
                      numberAttribute: { id: numberAttributeId },
                      value: String(localValue)
                    }),
                    signal: AbortSignal.timeout(5000)
                  })

                  if (updateResponse.ok) {
                    console.log(`[SYNC] Updated ${localAttr.type} attribute "${localAttr.name}" value to ${localValue}`)
                  } else {
                    const errorText = await updateResponse.text().catch(() => 'Unknown error')
                    console.warn(`[SYNC] Failed to update ${localAttr.type} attribute "${localAttr.name}": ${updateResponse.status} - ${errorText}`)
                  }
                } else {
                  // Create new value
                  const createUrl = `${apiBaseUrl}/numberAttributeValues`
                  const createResponse = await fetch(createUrl, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Accept': 'application/json',
                      'Authorization': authHeader
                    },
                    body: JSON.stringify({
                      product: { id: product.shoprenter_id },
                      numberAttribute: { id: numberAttributeId },
                      value: String(localValue)
                    }),
                    signal: AbortSignal.timeout(5000)
                  })

                  if (createResponse.ok) {
                    console.log(`[SYNC] Created ${localAttr.type} attribute "${localAttr.name}" value: ${localValue}`)
                  } else {
                    const errorText = await createResponse.text().catch(() => 'Unknown error')
                    console.warn(`[SYNC] Failed to create ${localAttr.type} attribute "${localAttr.name}": ${createResponse.status} - ${errorText}`)
                  }
                }
              } else {
                // valueResponse.ok was false
                const errorText = await valueResponse.text().catch(() => 'Unknown error')
                console.warn(`[SYNC] Failed to fetch numberAttributeValues for "${localAttr.name}": ${valueResponse.status} - ${errorText}`)
              }
            } else if (localAttr.type === 'TEXT') {
              // For TEXT attributes, use textAttributeValues + textAttributeValueDescriptions
              const localValue = typeof localAttr.value === 'object' ? localAttr.value.value : localAttr.value
              const textAttributeId = shoprenterAttr.textAttribute?.id || shoprenterAttr.id
              const languageId = 'bGFuZ3VhZ2UtbGFuZ3VhZ2VfaWQ9MQ==' // Hungarian
              
              if (!textAttributeId) {
                console.warn(`[SYNC] No textAttribute ID found for "${localAttr.name}"`)
                continue
              }

              // Check if value already exists
              const valueUrl = `${apiBaseUrl}/textAttributeValues?productId=${encodeURIComponent(product.shoprenter_id)}&textAttributeId=${encodeURIComponent(textAttributeId)}&full=1`
              const valueResponse = await fetch(valueUrl, {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'Authorization': authHeader
                },
                signal: AbortSignal.timeout(5000)
              })

              if (valueResponse.ok) {
                const valueData = await valueResponse.json()
                const existingValues = valueData.items || valueData.textAttributeValues?.textAttributeValue || []
                let existingValue = Array.isArray(existingValues) ? existingValues[0] : existingValues

                if (!existingValue) {
                  // Create new textAttributeValue first
                  const createValueUrl = `${apiBaseUrl}/textAttributeValues`
                  const createValueResponse = await fetch(createValueUrl, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Accept': 'application/json',
                      'Authorization': authHeader
                    },
                    body: JSON.stringify({
                      product: { id: product.shoprenter_id },
                      textAttribute: { id: textAttributeId }
                    }),
                    signal: AbortSignal.timeout(5000)
                  })

                  if (createValueResponse.ok) {
                    const createResult = await createValueResponse.json()
                    existingValue = createResult.textAttributeValue || createResult
                    console.log(`[SYNC] Created textAttributeValue for "${localAttr.name}"`)
                  } else {
                    const errorText = await createValueResponse.text().catch(() => 'Unknown error')
                    console.warn(`[SYNC] Failed to create textAttributeValue for "${localAttr.name}": ${createValueResponse.status} - ${errorText}`)
                    continue
                  }
                }

                // Now update/create the description
                const textAttributeValueId = existingValue.id || existingValue.href?.split('/').pop()
                if (textAttributeValueId) {
                  const descUrl = `${apiBaseUrl}/textAttributeValueDescriptions?textAttributeValueId=${encodeURIComponent(textAttributeValueId)}&languageId=${encodeURIComponent(languageId)}&full=1`
                  const descResponse = await fetch(descUrl, {
                    method: 'GET',
                    headers: {
                      'Content-Type': 'application/json',
                      'Accept': 'application/json',
                      'Authorization': authHeader
                    },
                    signal: AbortSignal.timeout(5000)
                  })

                  if (descResponse.ok) {
                    const descData = await descResponse.json()
                    const existingDescs = descData.items || descData.textAttributeValueDescriptions?.textAttributeValueDescription || []
                    const existingDesc = Array.isArray(existingDescs) ? existingDescs[0] : existingDescs

                    if (existingDesc) {
                      // Update existing description
                      const updateDescUrl = existingDesc.href || `${apiBaseUrl}/textAttributeValueDescriptions/${existingDesc.id}`
                      const updateDescResponse = await fetch(updateDescUrl, {
                        method: 'PUT',
                        headers: {
                          'Content-Type': 'application/json',
                          'Accept': 'application/json',
                          'Authorization': authHeader
                        },
                        body: JSON.stringify({
                          textAttributeValue: { id: textAttributeValueId },
                          language: { id: languageId },
                          value: String(localValue)
                        }),
                        signal: AbortSignal.timeout(5000)
                      })

                      if (updateDescResponse.ok) {
                        console.log(`[SYNC] Updated TEXT attribute "${localAttr.name}" value to "${localValue}"`)
                      } else {
                        const errorText = await updateDescResponse.text().catch(() => 'Unknown error')
                        console.warn(`[SYNC] Failed to update TEXT attribute "${localAttr.name}": ${updateDescResponse.status} - ${errorText}`)
                      }
                    } else {
                      // Create new description
                      const createDescUrl = `${apiBaseUrl}/textAttributeValueDescriptions`
                      const createDescResponse = await fetch(createDescUrl, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Accept': 'application/json',
                          'Authorization': authHeader
                        },
                        body: JSON.stringify({
                          textAttributeValue: { id: textAttributeValueId },
                          language: { id: languageId },
                          value: String(localValue)
                        }),
                        signal: AbortSignal.timeout(5000)
                      })

                      if (createDescResponse.ok) {
                        console.log(`[SYNC] Created TEXT attribute "${localAttr.name}" value: "${localValue}"`)
                      } else {
                        const errorText = await createDescResponse.text().catch(() => 'Unknown error')
                        console.warn(`[SYNC] Failed to create TEXT attribute "${localAttr.name}": ${createDescResponse.status} - ${errorText}`)
                      }
                    }
                  } else {
                    // descResponse.ok was false
                    const errorText = await descResponse.text().catch(() => 'Unknown error')
                    console.warn(`[SYNC] Failed to fetch textAttributeValueDescriptions for "${localAttr.name}": ${descResponse.status} - ${errorText}`)
                  }
                } else {
                  // textAttributeValueId was null/undefined
                  console.warn(`[SYNC] No textAttributeValueId found for "${localAttr.name}"`)
                }
              } else {
                // valueResponse.ok was false
                const errorText = await valueResponse.text().catch(() => 'Unknown error')
                console.warn(`[SYNC] Failed to fetch textAttributeValues for "${localAttr.name}": ${valueResponse.status} - ${errorText}`)
              }
            }
          } catch (attrError: any) {
            console.warn(`[SYNC] Error syncing attribute "${localAttr.name}":`, attrError?.message || attrError)
            // Continue with next attribute
          }
        }

        console.log(`[SYNC] Completed attribute syncing`)
      }
    } catch (attributeSyncError: any) {
      // Don't fail the entire sync if attribute sync fails
      console.warn(`[SYNC] Error syncing product attributes:`, attributeSyncError?.message || attributeSyncError)
    }

    // Sync customer group prices
    try {
      if (product.shoprenter_id && !product.shoprenter_id.startsWith('pending-')) {
        // Get all customer group prices for this product
        const { data: customerGroupPrices } = await supabase
          .from('product_customer_group_prices')
          .select(`
            *,
            customer_groups(*)
          `)
          .eq('product_id', id)
          .eq('is_active', true)

        if (customerGroupPrices && customerGroupPrices.length > 0) {
          console.log(`[SYNC] Syncing ${customerGroupPrices.length} customer group prices...`)

          for (const groupPrice of customerGroupPrices) {
            const customerGroup = groupPrice.customer_groups
            if (!customerGroup) {
              console.warn(`[SYNC] Customer group not found for price ${groupPrice.id}`)
              continue
            }

            // First, ensure customer group is synced to ShopRenter
            let customerGroupShopRenterId = customerGroup.shoprenter_customer_group_id

            if (!customerGroupShopRenterId) {
              console.log(`[SYNC] Customer group "${customerGroup.name}" not synced, syncing now...`)
              const syncResult = await syncCustomerGroupToShopRenter(
                apiBaseUrl,
                authHeader,
                {
                  id: customerGroup.id,
                  name: customerGroup.name,
                  code: customerGroup.code,
                  shoprenter_customer_group_id: null
                }
              )

              if (syncResult.shoprenterId) {
                customerGroupShopRenterId = syncResult.shoprenterId
                // Update customer group with ShopRenter ID
                await supabase
                  .from('customer_groups')
                  .update({ shoprenter_customer_group_id: customerGroupShopRenterId })
                  .eq('id', customerGroup.id)
                console.log(`[SYNC] ✅ Synced customer group "${customerGroup.name}" to ShopRenter: ${customerGroupShopRenterId}`)
              } else {
                console.warn(`[SYNC] ⚠️ Failed to sync customer group "${customerGroup.name}": ${syncResult.error}`)
                continue // Skip this price if customer group sync failed
              }
            }

            // Now sync the price
            const priceSyncResult = await syncCustomerGroupPriceToShopRenter(
              apiBaseUrl,
              authHeader,
              product.shoprenter_id,
              customerGroupShopRenterId,
              parseFloat(groupPrice.price.toString()),
              groupPrice.shoprenter_customer_group_price_id || null
            )

            if (priceSyncResult.shoprenterId) {
              // Update local database with ShopRenter price ID
              await supabase
                .from('product_customer_group_prices')
                .update({
                  shoprenter_customer_group_price_id: priceSyncResult.shoprenterId,
                  last_synced_at: new Date().toISOString()
                })
                .eq('id', groupPrice.id)
              console.log(`[SYNC] ✅ Synced customer group price for "${customerGroup.name}": ${priceSyncResult.shoprenterId}`)
            } else {
              console.warn(`[SYNC] ⚠️ Failed to sync customer group price for "${customerGroup.name}": ${priceSyncResult.error}`)
            }
          }

          console.log(`[SYNC] Completed customer group price syncing`)
        }
      }
    } catch (customerGroupPriceSyncError: any) {
      // Don't fail the entire sync if customer group price sync fails
      console.warn(`[SYNC] Error syncing customer group prices:`, customerGroupPriceSyncError?.message || customerGroupPriceSyncError)
    }

    // Sync promotions (product specials)
    try {
      if (product.shoprenter_id && !product.shoprenter_id.startsWith('pending-')) {
        // Get all active promotions for this product
        const { data: promotions } = await supabase
          .from('product_specials')
          .select(`
            *,
            customer_groups (
              id,
              name,
              shoprenter_customer_group_id
            )
          `)
          .eq('product_id', id)
          .eq('is_active', true)
          .is('deleted_at', null)

        if (promotions && promotions.length > 0) {
          console.log(`[SYNC] Syncing ${promotions.length} promotions...`)

          for (const promotion of promotions) {
            // Get customer group ShopRenter ID if applicable
            let customerGroupShopRenterId: string | null = null
            if (promotion.customer_group_id && promotion.customer_groups) {
              const customerGroup = promotion.customer_groups as any
              customerGroupShopRenterId = customerGroup.shoprenter_customer_group_id || null

              // If customer group not synced, sync it first
              if (!customerGroupShopRenterId) {
                console.log(`[SYNC] Customer group "${customerGroup.name}" not synced, syncing now...`)
                const syncResult = await syncCustomerGroupToShopRenter(
                  apiBaseUrl,
                  authHeader,
                  {
                    id: customerGroup.id,
                    name: customerGroup.name,
                    code: customerGroup.code,
                    shoprenter_customer_group_id: null
                  }
                )

                if (syncResult.shoprenterId) {
                  customerGroupShopRenterId = syncResult.shoprenterId
                  // Update customer group with ShopRenter ID
                  await supabase
                    .from('customer_groups')
                    .update({ shoprenter_customer_group_id: customerGroupShopRenterId })
                    .eq('id', customerGroup.id)
                  console.log(`[SYNC] ✅ Synced customer group "${customerGroup.name}" to ShopRenter: ${customerGroupShopRenterId}`)
                } else {
                  console.warn(`[SYNC] ⚠️ Failed to sync customer group "${customerGroup.name}": ${syncResult.error}`)
                  // Continue without customer group - promotion will be for "Everyone"
                }
              }
            }

            // Sync promotion to ShopRenter
            const syncResult = await syncProductSpecialToShopRenter(
              apiBaseUrl,
              authHeader,
              product.shoprenter_id,
              {
                priority: promotion.priority,
                price: parseFloat(promotion.price.toString()),
                dateFrom: promotion.date_from || null,
                dateTo: promotion.date_to || null,
                minQuantity: promotion.min_quantity || 0,
                maxQuantity: promotion.max_quantity || 0,
                type: promotion.type as 'interval' | 'day_spec',
                dayOfWeek: promotion.day_of_week || null,
                customerGroupShopRenterId: customerGroupShopRenterId
              },
              promotion.shoprenter_special_id || null
            )

            if (syncResult.shoprenterId) {
              // Update local database with ShopRenter promotion ID
              await supabase
                .from('product_specials')
                .update({
                  shoprenter_special_id: syncResult.shoprenterId,
                  updated_at: new Date().toISOString()
                })
                .eq('id', promotion.id)
              console.log(`[SYNC] ✅ Synced promotion (priority: ${promotion.priority}, price: ${promotion.price}): ${syncResult.shoprenterId}`)
            } else {
              console.warn(`[SYNC] ⚠️ Failed to sync promotion (priority: ${promotion.priority}): ${syncResult.error}`)
            }
          }

          console.log(`[SYNC] Completed promotion syncing`)
        }
      }
    } catch (promotionSyncError: any) {
      // Don't fail the entire sync if promotion sync fails
      console.warn(`[SYNC] Error syncing promotions:`, promotionSyncError?.message || promotionSyncError)
    }

    // Now pull back from ShopRenter to verify
    const pullUrl = useOAuth 
      ? `${apiBaseUrl}/productExtend/${product.shoprenter_id}?full=1`
      : `${apiBaseUrl}/productExtend/${product.shoprenter_id}?full=1`
    
    const pullResponse = await fetch(pullUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': authHeader
      },
      signal: AbortSignal.timeout(30000)
    })

    if (pullResponse.ok) {
      const pullData = await pullResponse.json().catch(() => null)
      
      if (pullData) {
        // Update local database with pulled data (sync from ShopRenter)
        // This ensures local DB matches what's in ShopRenter
        const syncResponse = await fetch(`${request.nextUrl.origin}/api/connections/${connection.id}/sync-products`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            product_id: product.shoprenter_id
          })
        })

        // Don't fail if pull sync fails, we already pushed successfully
        if (!syncResponse.ok) {
          console.warn('[SYNC] Pull verification failed, but push was successful')
        }
      }
    }

    // Update product sync status
    // Use last_synced_to_shoprenter_at to track when we synced TO ShopRenter
    // This prevents incremental sync from overwriting changes we just pushed
    // IMPORTANT: We explicitly set updated_at to the same value as last_synced_to_shoprenter_at
    // to ensure that after sync, updated_at is not newer than last_synced_to_shoprenter_at
    const syncTimestamp = new Date().toISOString()
    await supabase
      .from('shoprenter_products')
      .update({
        sync_status: 'synced',
        sync_error: null,
        last_synced_to_shoprenter_at: syncTimestamp,
        updated_at: syncTimestamp // Set updated_at to sync time so comparison works correctly
        // Note: Don't update last_synced_at - that's only for FROM syncs
      })
      .eq('id', id)

    return NextResponse.json({ 
      success: true,
      message: 'Termék sikeresen szinkronizálva a webshopba'
    })
  } catch (error) {
    console.error('Error syncing product:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
