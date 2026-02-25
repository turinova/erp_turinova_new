import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getConnectionById } from '@/lib/connections-server'
import { extractShopNameFromUrl } from '@/lib/shoprenter-api'
import { Buffer } from 'buffer'
import { getShopRenterRateLimiter } from '@/lib/shoprenter-rate-limiter'
import { updateProgress, incrementProgress, getProgress, clearProgress, shouldStopSync } from '@/lib/sync-progress-store'

/**
 * POST /api/products/bulk-sync
 * Sync multiple products from ShopRenter to database using batch API
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { productIds } = body

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Product IDs are required' 
      }, { status: 400 })
    }

    const cookieStore = await cookies()
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseAnonKey!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ 
        success: false,
        error: 'Unauthorized' 
      }, { status: 401 })
    }

    // Get products with their connections
    const { data: products, error: productsError } = await supabase
      .from('shoprenter_products')
      .select(`
        id,
        shoprenter_id,
        connection_id,
        webshop_connections(*)
      `)
      .in('id', productIds)
      .is('deleted_at', null)

    if (productsError || !products || products.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Products not found' 
      }, { status: 404 })
    }

    // Group products by connection_id
    const productsByConnection = new Map<string, typeof products>()
    for (const product of products) {
      const connId = product.connection_id
      if (!productsByConnection.has(connId)) {
        productsByConnection.set(connId, [])
      }
      productsByConnection.get(connId)!.push(product)
    }

    // Use a unique progress key for this bulk sync
    const progressKey = `bulk-sync-products-${Date.now()}`
    
    // Initialize progress
    updateProgress(progressKey, {
      total: productIds.length,
      synced: 0,
      current: 0,
      status: 'syncing',
      errors: 0
    })

    // Return immediately and process in background
    processBulkSyncInBackground(
      supabase,
      productsByConnection,
      progressKey
    ).catch(error => {
      console.error('[BULK SYNC] Background sync error:', error)
      updateProgress(progressKey, {
        status: 'error',
        errors: productIds.length
      })
    })

    // Small delay to ensure progress is set
    await new Promise(resolve => setTimeout(resolve, 200))

    return NextResponse.json({ 
      success: true,
      message: 'Szinkronizálás elindítva',
      total: productIds.length,
      progressKey
    })
  } catch (error: any) {
    console.error('[BULK SYNC] Error:', error)
    return NextResponse.json({
      success: false,
      error: error?.message || 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * Process bulk sync in background using batch API
 */
async function processBulkSyncInBackground(
  supabase: any,
  productsByConnection: Map<string, any[]>,
  progressKey: string
) {
  const rateLimiter = getShopRenterRateLimiter()
  let totalSynced = 0
  let totalErrors = 0
  const BATCH_SIZE = 200 // ShopRenter batch limit

  try {
    // Import batch fetch function and sync function
    const syncProductsModule = await import('@/app/api/connections/[id]/sync-products/route')
    const batchFetchAttributeDescriptions = syncProductsModule.batchFetchAttributeDescriptions
    const syncProductToDatabase = syncProductsModule.syncProductToDatabase

    // Process each connection group
    for (const [connectionId, connectionProducts] of productsByConnection.entries()) {
      // Get connection
      const connection = await getConnectionById(connectionId)
      if (!connection || connection.connection_type !== 'shoprenter') {
        totalErrors += connectionProducts.length
        incrementProgress(progressKey, { errors: connectionProducts.length })
        continue
      }

      // Extract shop name
      const shopName = extractShopNameFromUrl(connection.api_url)
      if (!shopName) {
        totalErrors += connectionProducts.length
        incrementProgress(progressKey, { errors: connectionProducts.length })
        continue
      }

      // Use Basic Auth
      const credentials = `${connection.username}:${connection.password}`
      const base64Credentials = Buffer.from(credentials).toString('base64')
      const authHeader = `Basic ${base64Credentials}`

      let apiUrl = connection.api_url.replace(/\/$/, '')
      if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
        apiUrl = `http://${apiUrl}`
      }

      // Split products into batches
      const batches: string[][] = []
      for (let i = 0; i < connectionProducts.length; i += BATCH_SIZE) {
        batches.push(connectionProducts.slice(i, i + BATCH_SIZE).map(p => p.shoprenter_id))
      }

      console.log(`[BULK SYNC] Processing ${connectionProducts.length} products in ${batches.length} batches for connection ${connectionId}`)

      // Process batches (2 at a time for parallel processing)
      const CONCURRENT_BATCHES = 2
      for (let i = 0; i < batches.length; i += CONCURRENT_BATCHES) {
        if (shouldStopSync(progressKey)) {
          console.log(`[BULK SYNC] Sync stopped by user`)
          updateProgress(progressKey, {
            status: 'stopped',
            synced: totalSynced,
            current: totalSynced + totalErrors,
            errors: totalErrors
          })
          break
        }

        const batchGroup = batches.slice(i, i + CONCURRENT_BATCHES)
        
        // Process batches in parallel
        const batchPromises = batchGroup.map(async (batch, batchIdx) => {
          const batchIndex = i + batchIdx
          const batchResults = { synced: 0, errors: 0 }

          try {
            // Build batch request
            const batchRequests = batch.map(productId => ({
              method: 'GET',
              uri: `${apiUrl}/productExtend/${productId}?full=1`
            }))

            const batchPayload = {
              data: {
                requests: batchRequests
              }
            }

            // Send batch request
            const batchResponse = await rateLimiter.execute(async () => {
              return fetch(`${apiUrl}/batch`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'Authorization': authHeader
                },
                body: JSON.stringify(batchPayload),
                signal: AbortSignal.timeout(600000) // 10 minutes
              })
            })

            if (!batchResponse.ok) {
              const errorText = await batchResponse.text().catch(() => 'Unknown error')
              batchResults.errors += batch.length
              console.error(`[BULK SYNC] Batch ${batchIndex + 1} failed: ${batchResponse.status} - ${errorText.substring(0, 200)}`)
              return batchResults
            }

            // Parse batch response
            const batchData = await batchResponse.json()
            const batchResponses = batchData.requests?.request || batchData.response?.requests?.request || []

            // Collect all attribute IDs for batch fetching
            const attributeRequests: Array<{ attributeId: string; attributeType: 'LIST' | 'INTEGER' | 'FLOAT' | 'TEXT' }> = []
            const productsToSync: Array<{ product: any; shoprenterId: string; dbId: string }> = []

            for (let j = 0; j < batchResponses.length; j++) {
              const batchItem = batchResponses[j]
              const statusCode = parseInt(batchItem.response?.header?.statusCode || '0', 10)
              
              if (statusCode >= 200 && statusCode < 300) {
                const product = batchItem.response?.body
                if (product && product.id) {
                  // Find corresponding DB product
                  const dbProduct = connectionProducts.find(p => p.shoprenter_id === product.id)
                  if (dbProduct) {
                    productsToSync.push({ product, shoprenterId: product.id, dbId: dbProduct.id })
                    
                    // Collect attribute IDs
                    if (product.productAttributeExtend && Array.isArray(product.productAttributeExtend)) {
                      product.productAttributeExtend.forEach((attr: any) => {
                        let attributeId = attr.id || null
                        if (!attributeId && attr.href) {
                          const hrefParts = attr.href.split('/')
                          attributeId = hrefParts[hrefParts.length - 1] || null
                        }
                        
                        if (attributeId) {
                          attributeRequests.push({
                            attributeId,
                            attributeType: attr.type as 'LIST' | 'INTEGER' | 'FLOAT' | 'TEXT'
                          })
                        }
                      })
                    }
                  }
                } else {
                  batchResults.errors++
                }
              } else {
                batchResults.errors++
              }
            }

            // Batch fetch all attribute descriptions at once
            let attributeDescriptionsMap = new Map<string, { display_name: string | null; prefix: string | null; postfix: string | null }>()
            if (attributeRequests.length > 0) {
              console.log(`[BULK SYNC] Batch fetching ${attributeRequests.length} attribute descriptions for batch ${batchIndex + 1}`)
              attributeDescriptionsMap = await batchFetchAttributeDescriptions(
                apiUrl,
                authHeader,
                attributeRequests
              )
            }

            // Sync products to database
            for (const { product, dbId } of productsToSync) {
              try {
                await syncProductToDatabase(
                  supabase,
                  connection,
                  product,
                  false, // forceSync
                  apiUrl,
                  authHeader,
                  attributeDescriptionsMap
                )
                batchResults.synced++
                // Update progress after each product for real-time updates
                incrementProgress(progressKey, {
                  synced: 1,
                  errors: 0
                })
              } catch (error: any) {
                console.error(`[BULK SYNC] Error syncing product ${dbId}:`, error)
                batchResults.errors++
                // Update progress even on error
                incrementProgress(progressKey, {
                  synced: 0,
                  errors: 1
                })
              }
            }

            totalSynced += batchResults.synced
            totalErrors += batchResults.errors

            console.log(`[BULK SYNC] Batch ${batchIndex + 1} completed: ${batchResults.synced} synced, ${batchResults.errors} errors`)

            return batchResults
          } catch (error: any) {
            console.error(`[BULK SYNC] Batch ${batchIndex + 1} error:`, error)
            batchResults.errors += batch.length
            incrementProgress(progressKey, { errors: batch.length })
            totalErrors += batch.length
            return batchResults
          }
        })

        // Wait for all batches in group to complete
        await Promise.all(batchPromises)

        // Small delay between batch groups
        if (i + CONCURRENT_BATCHES < batches.length) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }
    }

    // Mark as completed
    updateProgress(progressKey, {
      status: 'completed',
      synced: totalSynced,
      current: totalSynced + totalErrors,
      errors: totalErrors
    })

    console.log(`[BULK SYNC] Completed: ${totalSynced} synced, ${totalErrors} errors`)
  } catch (error: any) {
    console.error('[BULK SYNC] Fatal error:', error)
    updateProgress(progressKey, {
      status: 'error',
      errors: totalErrors
    })
  }
}
