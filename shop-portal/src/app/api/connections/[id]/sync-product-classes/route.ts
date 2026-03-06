import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase, getTenantFromSession } from '@/lib/tenant-supabase'
import { getConnectionById } from '@/lib/connections-server'
import { Buffer } from 'buffer'
import { getShopRenterRateLimiter } from '@/lib/shoprenter-rate-limiter'
import { getShopRenterAuthHeader, extractShopNameFromUrl } from '@/lib/shoprenter-api'

/**
 * POST /api/connections/[id]/sync-product-classes
 * Sync Product Classes from ShopRenter to database
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: connectionId } = await params
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get tenant context
    const tenantContext = await getTenantFromSession()
    if (!tenantContext) {
      return NextResponse.json({ error: 'Tenant context not found' }, { status: 401 })
    }

    // Get connection
    const connection = await getConnectionById(connectionId)
    if (!connection || connection.connection_type !== 'shoprenter') {
      return NextResponse.json(
        { error: 'Kapcsolat nem található vagy érvénytelen típus' },
        { status: 404 }
      )
    }

    if (!connection.is_active || !connection.username || !connection.password) {
      return NextResponse.json(
        { error: 'A kapcsolat inaktív vagy hiányoznak a hitelesítési adatok' },
        { status: 400 }
      )
    }

    // Prepare API call
    const shopName = extractShopNameFromUrl(connection.api_url)
    if (!shopName) {
      return NextResponse.json(
        { error: 'Invalid API URL format' },
        { status: 400 }
      )
    }

    const { authHeader, apiBaseUrl } = await getShopRenterAuthHeader(
      shopName,
      connection.username || '',
      connection.password || '',
      connection.api_url
    )

    const rateLimiter = getShopRenterRateLimiter(tenantContext.tenantId)

    // Fetch all Product Classes from ShopRenter
    const productClasses: any[] = []
    let page = 0
    const limit = 100
    let hasMore = true

    console.log(`[PRODUCT-CLASS SYNC] Starting sync for connection ${connectionId}`)

    while (hasMore) {
      const productClassesUrl = `${apiBaseUrl}/productClasses?page=${page}&limit=${limit}&full=1`
      
      const response = await rateLimiter.execute(async () => {
        return fetch(productClassesUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': authHeader
          },
          signal: AbortSignal.timeout(10000)
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`[PRODUCT-CLASS SYNC] API error ${response.status}:`, errorText)
        if (response.status === 401) {
          return NextResponse.json(
            { error: 'Hitelesítési hiba. Ellenőrizze a kapcsolat beállításait.' },
            { status: 401 }
          )
        }
        return NextResponse.json(
          { error: `ShopRenter API hiba: ${response.status} - ${errorText.substring(0, 200)}` },
          { status: response.status }
        )
      }

      const data = await response.json()
      
      // Try multiple response formats
      let itemHrefs: string[] = []
      if (data.items && Array.isArray(data.items)) {
        // Items are hrefs, extract them
        itemHrefs = data.items
          .map((item: any) => {
            if (typeof item === 'string') return item
            if (item.href) return item.href
            if (item.id) {
              // Construct href from id
              return `${apiBaseUrl}/productClasses/${item.id}?full=1`
            }
            return null
          })
          .filter((href: string | null): href is string => href !== null)
      } else if (data.productClasses?.productClass) {
        const classes = Array.isArray(data.productClasses.productClass) 
          ? data.productClasses.productClass 
          : [data.productClasses.productClass]
        itemHrefs = classes
          .map((item: any) => {
            if (item.href) return item.href
            if (item.id) return `${apiBaseUrl}/productClasses/${item.id}?full=1`
            return null
          })
          .filter((href: string | null): href is string => href !== null)
      }

      console.log(`[PRODUCT-CLASS SYNC] Found ${itemHrefs.length} Product Class hrefs on page ${page}`)

      // Fetch each Product Class individually to get full data including attribute relations
      for (const href of itemHrefs) {
        try {
          const fullHref = href.startsWith('http') ? href : `${apiBaseUrl}${href.startsWith('/') ? href : `/${href}`}?full=1`
          
          const classResponse = await rateLimiter.execute(async () => {
            return fetch(fullHref, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': authHeader
              },
              signal: AbortSignal.timeout(10000)
            })
          })

          if (classResponse.ok) {
            const classData = await classResponse.json()
            // Extract the actual Product Class object
            const productClass = classData.productClass || classData
            if (productClass && productClass.id) {
              productClasses.push(productClass)
            }
          } else {
            console.warn(`[PRODUCT-CLASS SYNC] Failed to fetch Product Class from ${fullHref}: ${classResponse.status}`)
          }
        } catch (error) {
          console.warn(`[PRODUCT-CLASS SYNC] Error fetching Product Class from ${href}:`, error)
        }
      }

      if (productClasses.length > 0) {
        console.log(`[PRODUCT-CLASS SYNC] Fetched ${itemHrefs.length} Product Classes from page ${page}`)
      }

      // Check if there are more pages
      // ShopRenter API uses 'next' field in pagination (can be null or an href)
      const nextHref = data.next?.href || data.next
      const pagination = data.pagination || data.response?.pagination
      
      if (nextHref && nextHref !== null) {
        // There's a next page
        page++
      } else if (pagination && pagination.hasNext === true) {
        // Fallback to hasNext if available
        page++
      } else {
        // No more pages
        hasMore = false
      }

      // Safety check: if we got fewer items than limit, we're done
      if (itemHrefs.length < limit) {
        hasMore = false
      }
      
      // If no items and no next page, we're done
      if (itemHrefs.length === 0 && !nextHref && (!pagination || pagination.hasNext !== true)) {
        hasMore = false
      }
    }

    console.log(`[PRODUCT-CLASS SYNC] Total Product Classes fetched: ${productClasses.length}`)

    // Sync each Product Class to database
    let syncedCount = 0
    let errorCount = 0
    const errors: string[] = []

    for (const productClass of productClasses) {
      try {
        await syncProductClassToDatabase(
          supabase,
          connection,
          productClass,
          apiBaseUrl,
          authHeader,
          rateLimiter
        )
        syncedCount++
      } catch (error: any) {
        errorCount++
        const errorMsg = error.message || 'Unknown error'
        errors.push(`Product Class ${productClass.id || 'unknown'}: ${errorMsg}`)
        console.error(`[PRODUCT-CLASS SYNC] Error syncing Product Class:`, error)
      }
    }

    return NextResponse.json({
      success: true,
      message: `${syncedCount} termék típus szinkronizálva${errorCount > 0 ? `, ${errorCount} hiba` : ''}`,
      synced: syncedCount,
      errors: errorCount,
      total: productClasses.length,
      errorDetails: errors.length > 0 ? errors.slice(0, 10) : [] // Limit to first 10 errors
    })
  } catch (error: any) {
    console.error('[PRODUCT-CLASS SYNC] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Sync a single Product Class to database
 */
async function syncProductClassToDatabase(
  supabase: any,
  connection: any,
  productClass: any,
  apiBaseUrl: string,
  authHeader: string,
  rateLimiter: any
) {
  const shoprenterId = productClass.id
  const innerId = productClass.innerId || null
  const name = productClass.name || ''
  const description = productClass.description || null
  
  // Extract variant configuration
  const firstVariantSelectType = productClass.firstVariantSelectType || null
  const secondVariantSelectType = productClass.secondVariantSelectType || null
  
  let firstVariantParameterShoprenterId: string | null = null
  let secondVariantParameterShoprenterId: string | null = null
  
  if (productClass.firstVariantParameter) {
    if (typeof productClass.firstVariantParameter === 'object' && productClass.firstVariantParameter.id) {
      firstVariantParameterShoprenterId = productClass.firstVariantParameter.id
    } else if (productClass.firstVariantParameter.href) {
      const hrefParts = productClass.firstVariantParameter.href.split('/')
      firstVariantParameterShoprenterId = hrefParts[hrefParts.length - 1] || null
    }
  }
  
  if (productClass.secondVariantParameter) {
    if (typeof productClass.secondVariantParameter === 'object' && productClass.secondVariantParameter.id) {
      secondVariantParameterShoprenterId = productClass.secondVariantParameter.id
    } else if (productClass.secondVariantParameter.href) {
      const hrefParts = productClass.secondVariantParameter.href.split('/')
      secondVariantParameterShoprenterId = hrefParts[hrefParts.length - 1] || null
    }
  }

  // Prepare Product Class data
  const productClassData = {
    connection_id: connection.id,
    shoprenter_id: shoprenterId,
    shoprenter_inner_id: innerId,
    name: name,
    description: description,
    first_variant_select_type: firstVariantSelectType,
    second_variant_select_type: secondVariantSelectType,
    first_variant_parameter_shoprenter_id: firstVariantParameterShoprenterId,
    second_variant_parameter_shoprenter_id: secondVariantParameterShoprenterId,
    sync_status: 'synced',
    sync_error: null,
    last_synced_from_shoprenter_at: new Date().toISOString(),
    date_created: productClass.dateCreated || null,
    date_updated: productClass.dateUpdated || null
  }

  // Check if Product Class exists
  const { data: existingProductClass } = await supabase
    .from('shoprenter_product_classes')
    .select('id')
    .eq('connection_id', connection.id)
    .eq('shoprenter_id', shoprenterId)
    .maybeSingle()

  let productClassResult: any

  if (existingProductClass) {
    // Update existing Product Class
    const { data, error } = await supabase
      .from('shoprenter_product_classes')
      .update(productClassData)
      .eq('id', existingProductClass.id)
      .select()
      .single()

    if (error) {
      console.error(`[PRODUCT-CLASS SYNC] Failed to update Product Class ${shoprenterId}:`, error)
      throw new Error(`Failed to update Product Class: ${error.message || 'Unknown error'}`)
    }

    productClassResult = data
  } else {
    // Insert new Product Class
    const { data, error } = await supabase
      .from('shoprenter_product_classes')
      .insert(productClassData)
      .select()
      .single()

    if (error) {
      console.error(`[PRODUCT-CLASS SYNC] Failed to insert Product Class ${shoprenterId}:`, error)
      throw new Error(`Failed to insert Product Class: ${error.message || 'Unknown error'}`)
    }

    productClassResult = data
  }

  // Sync Product Class - Attribute Relations
  // Fetch relations from ShopRenter
  if (productClass.productClassAttributeRelations) {
    let relationsHref: string | null = null
    
    if (typeof productClass.productClassAttributeRelations === 'string') {
      relationsHref = productClass.productClassAttributeRelations
    } else if (productClass.productClassAttributeRelations.href) {
      relationsHref = productClass.productClassAttributeRelations.href
    }

    if (relationsHref) {
      // Make sure href is absolute
      if (!relationsHref.startsWith('http://') && !relationsHref.startsWith('https://')) {
        if (relationsHref.startsWith('/')) {
          relationsHref = `${apiBaseUrl}${relationsHref}`
        } else {
          relationsHref = `${apiBaseUrl}/${relationsHref}`
        }
      }

      // Add ?full=1 parameter to try to get full data in one request
      const fullRelationsHref = relationsHref.includes('?') 
        ? `${relationsHref}&full=1` 
        : `${relationsHref}?full=1`

      try {
        // First attempt: Try to get full data with ?full=1
        const relationsResponse = await rateLimiter.execute(async () => {
          return fetch(fullRelationsHref, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': authHeader
            },
            signal: AbortSignal.timeout(10000)
          })
        })

        if (relationsResponse.ok) {
          const relationsData = await relationsResponse.json()
          
          // Log response structure for debugging
          console.log(`[PRODUCT-CLASS SYNC] Relations response structure for ${name}:`, JSON.stringify(Object.keys(relationsData)).substring(0, 200))
          
          // Extract relations - try multiple response formats
          let relations: any[] = []
          
          // Format 1: Full relations in productClassAttributeRelations.productClassAttributeRelation
          if (relationsData.productClassAttributeRelations?.productClassAttributeRelation) {
            relations = Array.isArray(relationsData.productClassAttributeRelations.productClassAttributeRelation)
              ? relationsData.productClassAttributeRelations.productClassAttributeRelation
              : [relationsData.productClassAttributeRelations.productClassAttributeRelation]
            console.log(`[PRODUCT-CLASS SYNC] Found ${relations.length} relations in productClassAttributeRelations.productClassAttributeRelation format`)
          }
          // Format 2: Items array with full relation objects
          else if (relationsData.items && Array.isArray(relationsData.items)) {
            // Check if items are full objects (have 'id' property) or just hrefs
            const firstItem = relationsData.items[0]
            if (firstItem && firstItem.id) {
              // Items are full relation objects
              relations = relationsData.items
              console.log(`[PRODUCT-CLASS SYNC] Found ${relations.length} relations in items array (full objects)`)
            } else {
              // Items are hrefs - need to fetch each individually
              console.log(`[PRODUCT-CLASS SYNC] Found ${relationsData.items.length} relation hrefs in items array, fetching individually...`)
              
              // Extract hrefs from items
              const relationHrefs: string[] = relationsData.items
                .map((item: any) => {
                  if (typeof item === 'string') return item
                  if (item.href) return item.href
                  return null
                })
                .filter((href: string | null): href is string => href !== null)
              
              // Fetch each relation individually
              for (const href of relationHrefs) {
                try {
                  const fullHref = href.startsWith('http') 
                    ? `${href}${href.includes('?') ? '&' : '?'}full=1`
                    : `${apiBaseUrl}${href.startsWith('/') ? href : `/${href}`}${href.includes('?') ? '&' : '?'}full=1`
                  
                  const relationResponse = await rateLimiter.execute(async () => {
                    return fetch(fullHref, {
                      method: 'GET',
                      headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'Authorization': authHeader
                      },
                      signal: AbortSignal.timeout(10000)
                    })
                  })

                  if (relationResponse.ok) {
                    const relationData = await relationResponse.json()
                    // Extract the actual relation object
                    const relation = relationData.productClassAttributeRelation || relationData
                    if (relation && relation.id) {
                      relations.push(relation)
                    }
                  } else {
                    console.warn(`[PRODUCT-CLASS SYNC] Failed to fetch relation from ${fullHref}: ${relationResponse.status}`)
                  }
                } catch (error) {
                  console.warn(`[PRODUCT-CLASS SYNC] Error fetching relation from ${href}:`, error)
                }
              }
              
              console.log(`[PRODUCT-CLASS SYNC] Fetched ${relations.length} relations individually`)
            }
          }
          // Format 3: Direct array
          else if (Array.isArray(relationsData)) {
            relations = relationsData
            console.log(`[PRODUCT-CLASS SYNC] Found ${relations.length} relations in direct array format`)
          }
          // Format 4: Single relation object
          else if (relationsData.id && relationsData.productClass) {
            relations = [relationsData]
            console.log(`[PRODUCT-CLASS SYNC] Found single relation object`)
          }

          // Soft-delete all existing relations for this Product Class
          await supabase
            .from('shoprenter_product_class_attribute_relations')
            .update({ deleted_at: new Date().toISOString() })
            .eq('product_class_id', productClassResult.id)

          // Insert/update relations
          let syncedRelationsCount = 0
          for (const relation of relations) {
            if (!relation || !relation.id) {
              console.warn(`[PRODUCT-CLASS SYNC] Skipping invalid relation:`, relation)
              continue
            }

            const relationShoprenterId = relation.id
            let attributeShoprenterId: string | null = null
            let attributeType: string | null = null
            let attributeName: string | null = null

            // Extract attribute info
            if (relation.attribute) {
              if (typeof relation.attribute === 'object') {
                attributeShoprenterId = relation.attribute.id || null
                
                // Determine attribute type from href
                if (relation.attribute.href) {
                  if (relation.attribute.href.includes('/listAttributes/')) {
                    attributeType = 'LIST'
                  } else if (relation.attribute.href.includes('/numberAttributes/')) {
                    attributeType = 'INTEGER' // Could be INTEGER or FLOAT, but we'll default to INTEGER
                  } else if (relation.attribute.href.includes('/textAttributes/')) {
                    attributeType = 'TEXT'
                  }
                }
                
                // If we still don't have attributeShoprenterId, try to extract from href
                if (!attributeShoprenterId && relation.attribute.href) {
                  const hrefParts = relation.attribute.href.split('/')
                  attributeShoprenterId = hrefParts[hrefParts.length - 1] || null
                }
              } else if (typeof relation.attribute === 'string') {
                // Attribute is just an href string
                const hrefParts = relation.attribute.split('/')
                attributeShoprenterId = hrefParts[hrefParts.length - 1] || null
                
                if (relation.attribute.includes('/listAttributes/')) {
                  attributeType = 'LIST'
                } else if (relation.attribute.includes('/numberAttributes/')) {
                  attributeType = 'INTEGER'
                } else if (relation.attribute.includes('/textAttributes/')) {
                  attributeType = 'TEXT'
                }
              }
            }

            if (!attributeShoprenterId) {
              console.warn(`[PRODUCT-CLASS SYNC] Could not extract attribute ID from relation ${relationShoprenterId}`)
              continue
            }

            const relationData = {
              connection_id: connection.id,
              shoprenter_id: relationShoprenterId,
              product_class_id: productClassResult.id,
              attribute_shoprenter_id: attributeShoprenterId,
              attribute_type: attributeType || 'TEXT',
              attribute_name: attributeName,
              deleted_at: null
            }

            // Check if relation exists (including soft-deleted ones)
            const { data: existingRelation } = await supabase
              .from('shoprenter_product_class_attribute_relations')
              .select('id')
              .eq('product_class_id', productClassResult.id)
              .eq('attribute_shoprenter_id', attributeShoprenterId)
              .maybeSingle()

            if (existingRelation) {
              // Update existing relation (restore if soft-deleted)
              const { error: updateError } = await supabase
                .from('shoprenter_product_class_attribute_relations')
                .update(relationData)
                .eq('id', existingRelation.id)
              
              if (updateError) {
                console.error(`[PRODUCT-CLASS SYNC] Failed to update relation ${relationShoprenterId}:`, updateError)
              } else {
                syncedRelationsCount++
              }
            } else {
              // Insert new relation
              const { error: insertError } = await supabase
                .from('shoprenter_product_class_attribute_relations')
                .insert(relationData)
              
              if (insertError) {
                console.error(`[PRODUCT-CLASS SYNC] Failed to insert relation ${relationShoprenterId}:`, insertError)
              } else {
                syncedRelationsCount++
              }
            }
          }

          console.log(`[PRODUCT-CLASS SYNC] Synced ${syncedRelationsCount} attribute relations for Product Class ${name} (${relations.length} total found)`)
        } else {
          console.warn(`[PRODUCT-CLASS SYNC] Failed to fetch relations for Product Class ${name}: ${relationsResponse.status} ${relationsResponse.statusText}`)
        }
      } catch (error) {
        console.warn(`[PRODUCT-CLASS SYNC] Could not fetch attribute relations for Product Class ${name}:`, error)
        // Don't fail the entire sync if relations can't be fetched
      }
    }
  }

  console.log(`[PRODUCT-CLASS SYNC] Synced Product Class: ${name} (${shoprenterId})`)
}
