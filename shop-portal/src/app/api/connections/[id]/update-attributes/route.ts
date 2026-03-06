import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { getConnectionById } from '@/lib/connections-server'
import { Buffer } from 'buffer'
import { batchFetchAttributeDescriptions, batchFetchAttributeWidgetDescriptions } from '../sync-products/route'

/**
 * POST /api/connections/[id]/update-attributes
 * Update only the product_attributes field for all products in a connection
 * This is a test endpoint to update attribute group names without full sync
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
    const credentials = `${connection.username}:${connection.password}`
    const base64Credentials = Buffer.from(credentials).toString('base64')
    const authHeader = `Basic ${base64Credentials}`

    let apiUrl = connection.api_url.replace(/\/$/, '')
    if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
      apiUrl = `http://${apiUrl}`
    }

    // Get all products for this connection (fetch all, not just 1000)
    let allProducts: any[] = []
    let offset = 0
    const pageSize = 1000
    
    while (true) {
      const { data: products, error: productsError } = await supabase
        .from('shoprenter_products')
        .select('id, shoprenter_id, sku, product_attributes')
        .eq('connection_id', connection.id)
        .is('deleted_at', null)
        .range(offset, offset + pageSize - 1)
      
      if (productsError) {
        console.error('[UPDATE-ATTRIBUTES] Error fetching products:', productsError)
        return NextResponse.json(
          { error: 'Hiba a termékek lekérdezésekor' },
          { status: 500 }
        )
      }
      
      if (!products || products.length === 0) {
        break
      }
      
      allProducts = allProducts.concat(products)
      
      if (products.length < pageSize) {
        break // Last page
      }
      
      offset += pageSize
    }
    
    const products = allProducts

    if (!products || products.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nincs termék a kapcsolathoz',
        updated: 0
      })
    }

    console.log(`[UPDATE-ATTRIBUTES] Found ${products.length} products to update`)

    // Process products in batches
    const BATCH_SIZE = 50
    let updatedCount = 0
    let errorCount = 0

    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE)
      console.log(`[UPDATE-ATTRIBUTES] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(products.length / BATCH_SIZE)}`)

      // Collect all attribute IDs from this batch
      const attributeRequests: Array<{ attributeId: string; attributeType: 'LIST' | 'INTEGER' | 'FLOAT' | 'TEXT' }> = []
      const productAttributeMap = new Map<string, any[]>() // productId -> attributes

      // First, fetch productExtend for all products in batch to get attributes
      const batchRequests = batch.map(product => ({
        method: 'GET',
        uri: `${apiUrl}/productExtend/${product.shoprenter_id}?full=1`
      }))

      const batchPayload = {
        data: {
          requests: batchRequests
        }
      }

      const batchResponse = await fetch(`${apiUrl}/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify(batchPayload),
        signal: AbortSignal.timeout(60000)
      })

      if (!batchResponse.ok) {
        console.error(`[UPDATE-ATTRIBUTES] Batch request failed: ${batchResponse.status}`)
        errorCount += batch.length
        continue
      }

      const batchData = await batchResponse.json()
      const batchResponses = batchData.requests?.request || batchData.response?.requests?.request || []

      // Collect attributes from products and Product Class IDs
      const productClassIds = new Set<string>()
      const productToClassMap = new Map<string, string>() // productId -> productClassId
      
      for (let j = 0; j < batch.length && j < batchResponses.length; j++) {
        const product = batch[j]
        const batchItem = batchResponses[j]
        const statusCode = parseInt(batchItem.response?.header?.statusCode || '0', 10)

        if (statusCode >= 200 && statusCode < 300) {
          const productData = batchItem.response?.body
          
          // Extract Product Class ID
          if (productData && productData.productClass) {
            let productClassId: string | null = null
            if (typeof productData.productClass === 'object' && productData.productClass.id) {
              productClassId = productData.productClass.id
            } else if (productData.productClass.href) {
              const hrefParts = productData.productClass.href.split('/')
              productClassId = hrefParts[hrefParts.length - 1] || null
            }
            
            if (productClassId) {
              productClassIds.add(productClassId)
              productToClassMap.set(product.id, productClassId)
            }
          }
          
          if (productData && productData.productAttributeExtend && Array.isArray(productData.productAttributeExtend)) {
            productAttributeMap.set(product.id, productData.productAttributeExtend)

            productData.productAttributeExtend.forEach((attr: any) => {
              let attributeId = attr.id || null
              if (!attributeId && attr.href) {
                const hrefParts = attr.href.split('/')
                attributeId = hrefParts[hrefParts.length - 1] || null
              }

              if (attributeId && !attributeRequests.find(r => r.attributeId === attributeId)) {
                attributeRequests.push({
                  attributeId,
                  attributeType: attr.type as 'LIST' | 'INTEGER' | 'FLOAT' | 'TEXT'
                })
              }
            })
          }
        }
      }

      // Batch fetch Product Class details to get names (for group_name)
      const productClassNamesMap = new Map<string, string | null>()
      if (productClassIds.size > 0) {
        console.log(`[UPDATE-ATTRIBUTES] Fetching ${productClassIds.size} Product Class details`)
        try {
          const productClassArray = Array.from(productClassIds)
          const BATCH_SIZE = 200
          
          for (let i = 0; i < productClassArray.length; i += BATCH_SIZE) {
            const classBatch = productClassArray.slice(i, i + BATCH_SIZE)
            const batchRequests = classBatch.map(classId => ({
              method: 'GET',
              uri: `${apiUrl}/productClasses/${classId}?full=1`
            }))
            
            const batchPayload = {
              data: {
                requests: batchRequests
              }
            }
            
            const batchResponse = await fetch(`${apiUrl}/batch`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': authHeader
              },
              body: JSON.stringify(batchPayload),
              signal: AbortSignal.timeout(60000)
            })
            
            if (batchResponse.ok) {
              const batchData = await batchResponse.json()
              const batchResponses = batchData.requests?.request || batchData.response?.requests?.request || []
              
              for (let j = 0; j < batchResponses.length && j < classBatch.length; j++) {
                const batchItem = batchResponses[j]
                const classId = classBatch[j]
                const statusCode = parseInt(batchItem.response?.header?.statusCode || '0', 10)
                
                if (statusCode >= 200 && statusCode < 300) {
                  const productClass = batchItem.response?.body
                  const className = productClass?.name || null
                  productClassNamesMap.set(classId, className)
                  if (className) {
                    console.log(`[UPDATE-ATTRIBUTES] Found Product Class name "${className}" for ID ${classId}`)
                  }
                } else {
                  productClassNamesMap.set(classId, null)
                }
              }
            }
          }
          
          console.log(`[UPDATE-ATTRIBUTES] Fetched ${productClassNamesMap.size} Product Class names`)
        } catch (error) {
          console.warn(`[UPDATE-ATTRIBUTES] Error fetching Product Classes:`, error)
          productClassIds.forEach(classId => productClassNamesMap.set(classId, null))
        }
      }

      // Batch fetch attribute descriptions
      let attributeDescriptionsMap = new Map<string, { display_name: string | null; prefix: string | null; postfix: string | null }>()
      if (attributeRequests.length > 0) {
        attributeDescriptionsMap = await batchFetchAttributeDescriptions(
          apiUrl,
          authHeader,
          attributeRequests
        )
      }

      // DEPRECATED: Fetch full attributes to get widget information (kept as fallback)
      let attributeGroupNamesMap = new Map<string, string | null>()
      if (attributeRequests.length > 0) {
        try {
          const attributeFetchRequests = attributeRequests.map(req => {
            let endpoint = ''
            if (req.attributeType === 'LIST') {
              endpoint = `listAttributes/${req.attributeId}`
            } else if (req.attributeType === 'TEXT') {
              endpoint = `textAttributes/${req.attributeId}`
            } else if (req.attributeType === 'INTEGER' || req.attributeType === 'FLOAT') {
              endpoint = `numberAttributes/${req.attributeId}`
            }

            return {
              method: 'GET',
              uri: `${apiUrl}/${endpoint}?full=1`
            }
          }).filter(req => req.uri.includes('Attributes/'))

          if (attributeFetchRequests.length > 0) {
            const widgetRequests: Array<{ widgetId: string; widgetType: 'LIST' | 'NUMBER'; attributeId: string }> = []

            // Split into batches of 200
            const WIDGET_BATCH_SIZE = 200
            for (let k = 0; k < attributeFetchRequests.length; k += WIDGET_BATCH_SIZE) {
              const widgetBatch = attributeFetchRequests.slice(k, k + WIDGET_BATCH_SIZE)
              const correspondingAttributeRequests = attributeRequests.slice(k, k + WIDGET_BATCH_SIZE)

              const widgetBatchPayload = {
                data: {
                  requests: widgetBatch
                }
              }

              const widgetBatchResponse = await fetch(`${apiUrl}/batch`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'Authorization': authHeader
                },
                body: JSON.stringify(widgetBatchPayload),
                signal: AbortSignal.timeout(60000)
              })

              if (widgetBatchResponse.ok) {
                const widgetBatchData = await widgetBatchResponse.json()
                const widgetBatchResponses = widgetBatchData.requests?.request || widgetBatchData.response?.requests?.request || []

                for (let l = 0; l < widgetBatchResponses.length && l < correspondingAttributeRequests.length; l++) {
                  const widgetBatchItem = widgetBatchResponses[l]
                  const attrReq = correspondingAttributeRequests[l]
                  const widgetStatusCode = parseInt(widgetBatchItem.response?.header?.statusCode || '0', 10)

                  if (widgetStatusCode >= 200 && widgetStatusCode < 300) {
                    const attrData = widgetBatchItem.response?.body

                    let widgetHref: string | null = null
                    if (attrReq.attributeType === 'LIST' && attrData.listAttributeWidget?.href) {
                      widgetHref = attrData.listAttributeWidget.href
                    } else if ((attrReq.attributeType === 'INTEGER' || attrReq.attributeType === 'FLOAT') && attrData.numberAttributeWidget?.href) {
                      widgetHref = attrData.numberAttributeWidget.href
                    }

                    if (widgetHref) {
                      const hrefParts = widgetHref.split('/')
                      const widgetId = hrefParts[hrefParts.length - 1] || null

                      if (widgetId) {
                        widgetRequests.push({
                          widgetId,
                          widgetType: attrReq.attributeType === 'LIST' ? 'LIST' : 'NUMBER',
                          attributeId: attrReq.attributeId
                        })
                      } else {
                        console.warn(`[UPDATE-ATTRIBUTES] Could not extract widgetId from href: ${widgetHref} for attribute ${attrReq.attributeId}`)
                        attributeGroupNamesMap.set(attrReq.attributeId, null)
                      }
                    } else {
                      // No widget for this attribute type (TEXT attributes don't have widgets)
                      attributeGroupNamesMap.set(attrReq.attributeId, null)
                    }
                  } else {
                    console.warn(`[UPDATE-ATTRIBUTES] Failed to fetch attribute ${attrReq.attributeId}: status ${widgetStatusCode}`)
                    attributeGroupNamesMap.set(attrReq.attributeId, null)
                  }
                }
              }
            }

            // Batch fetch widget descriptions
            if (widgetRequests.length > 0) {
              console.log(`[UPDATE-ATTRIBUTES] Fetching ${widgetRequests.length} widget descriptions`)
              const widgetDescriptionsMap = await batchFetchAttributeWidgetDescriptions(
                apiUrl,
                authHeader,
                widgetRequests.map(w => ({ widgetId: w.widgetId, widgetType: w.widgetType }))
              )

              console.log(`[UPDATE-ATTRIBUTES] Got ${widgetDescriptionsMap.size} widget descriptions`)
              for (const widgetReq of widgetRequests) {
                const groupName = widgetDescriptionsMap.get(widgetReq.widgetId) || null
                if (groupName) {
                  console.log(`[UPDATE-ATTRIBUTES] Found group_name "${groupName}" for attribute ${widgetReq.attributeId}`)
                }
                attributeGroupNamesMap.set(widgetReq.attributeId, groupName)
              }
            } else {
              console.log(`[UPDATE-ATTRIBUTES] No widget requests to fetch for batch`)
            }
          }
        } catch (error) {
          console.warn(`[UPDATE-ATTRIBUTES] Error fetching widget information:`, error)
        }
      }

      // Create map: productId -> productClassName (for group_name)
      const productToClassNameMap = new Map<string, string | null>()
      productToClassMap.forEach((classId, productId) => {
        const className = productClassNamesMap.get(classId) || null
        productToClassNameMap.set(productId, className)
      })

      // Update each product's attributes
      for (const product of batch) {
        const attributes = productAttributeMap.get(product.id)
        if (!attributes || !Array.isArray(attributes)) {
          continue
        }

        // Get Product Class name for this product
        const productClassName = productToClassNameMap.get(product.id) || null

        const updatedAttributes: any[] = []

        for (const attr of attributes) {
          let attributeId = attr.id || null
          if (!attributeId && attr.href) {
            const hrefParts = attr.href.split('/')
            attributeId = hrefParts[hrefParts.length - 1] || null
          }

          let displayName = attr.name
          let prefix = null
          let postfix = null
          let groupName = null

          if (attributeId && attributeDescriptionsMap.has(attributeId)) {
            const desc = attributeDescriptionsMap.get(attributeId)!
            if (desc.display_name) {
              displayName = desc.display_name
              prefix = desc.prefix
              postfix = desc.postfix
            }
          }

          // Get group name from Product Class name (primary) or fallback to widget descriptions map
          // Product Class name takes priority as it's the correct source according to ShopRenter documentation
          if (productClassName) {
            groupName = productClassName
            console.log(`[UPDATE-ATTRIBUTES] Using Product Class name "${productClassName}" as group_name for attribute "${attr.name}"`)
          } else if (attributeId && attributeGroupNamesMap.has(attributeId)) {
            // Fallback to widget description (deprecated approach)
            groupName = attributeGroupNamesMap.get(attributeId) || null
            if (groupName) {
              console.log(`[UPDATE-ATTRIBUTES] Using widget description group name "${groupName}" for attribute "${attr.name}"`)
            }
          }

          updatedAttributes.push({
            type: attr.type,
            name: attr.name,
            display_name: displayName,
            group_name: groupName,
            prefix: prefix,
            postfix: postfix,
            value: attr.value
          })
        }

        // Update product in database
        const { error: updateError } = await supabase
          .from('shoprenter_products')
          .update({ product_attributes: updatedAttributes.length > 0 ? updatedAttributes : null })
          .eq('id', product.id)

        if (updateError) {
          console.error(`[UPDATE-ATTRIBUTES] Error updating product ${product.sku}:`, updateError)
          errorCount++
        } else {
          updatedCount++
        }
      }

      // Small delay between batches to respect rate limits
      if (i + BATCH_SIZE < products.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    return NextResponse.json({
      success: true,
      message: `${updatedCount} termék attribútumai frissítve${errorCount > 0 ? `, ${errorCount} hiba` : ''}`,
      updated: updatedCount,
      errors: errorCount,
      total: products.length
    })
  } catch (error: any) {
    console.error('[UPDATE-ATTRIBUTES] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Ismeretlen hiba' },
      { status: 500 }
    )
  }
}
