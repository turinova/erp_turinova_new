import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getConnectionById } from '@/lib/connections-server'
import {
  extractShopNameFromUrl,
  getShopRenterAuthHeader,
  getLanguageId,
  getProductDescriptionId
} from '@/lib/shoprenter-api'
import { updateProgress, incrementProgress, clearProgress, shouldStopSync } from '@/lib/sync-progress-store'
import { getShopRenterRateLimiter } from '@/lib/shoprenter-rate-limiter'

/**
 * POST /api/products/bulk-sync-to-shoprenter
 * Sync multiple products TO ShopRenter (push local changes) using batch API
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

    // Get products with descriptions and connections
    const { data: products, error: productsError } = await supabase
      .from('shoprenter_products')
      .select(`
        *,
        webshop_connections(*),
        shoprenter_product_descriptions(*)
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
    const progressKey = `bulk-sync-to-shoprenter-${Date.now()}`
    
    // Initialize progress
    updateProgress(progressKey, {
      total: productIds.length,
      synced: 0,
      current: 0,
      status: 'syncing',
      errors: 0
    })

    // Return immediately and process in background
    processBulkSyncToShopRenterInBackground(
      supabase,
      productsByConnection,
      progressKey,
      request.nextUrl.origin
    ).catch(error => {
      console.error('[BULK SYNC TO SHOPRENTER] Background sync error:', error)
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
    console.error('[BULK SYNC TO SHOPRENTER] Error:', error)
    return NextResponse.json({
      success: false,
      error: error?.message || 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * Process bulk sync to ShopRenter in background using batch API
 */
async function processBulkSyncToShopRenterInBackground(
  supabase: any,
  productsByConnection: Map<string, any[]>,
  progressKey: string,
  origin: string
) {
  const rateLimiter = getShopRenterRateLimiter()
  let totalSynced = 0
  let totalErrors = 0
  const BATCH_SIZE = 200 // ShopRenter batch limit

  try {
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

      // Get authentication
      const { authHeader, apiBaseUrl } = await getShopRenterAuthHeader(
        shopName,
        connection.username,
        connection.password,
        connection.api_url
      )

      // Get language ID (once per connection)
      const languageId = await getLanguageId(apiBaseUrl, authHeader, 'hu')
      if (!languageId) {
        console.error(`[BULK SYNC TO SHOPRENTER] Failed to get language ID for connection ${connectionId}`)
        totalErrors += connectionProducts.length
        incrementProgress(progressKey, { errors: connectionProducts.length })
        continue
      }

      // Filter products with Hungarian descriptions
      const productsWithDescriptions = connectionProducts.filter(p => {
        const descriptions = p.shoprenter_product_descriptions || []
        return descriptions.some((d: any) => d.language_code === 'hu')
      })

      if (productsWithDescriptions.length === 0) {
        console.warn(`[BULK SYNC TO SHOPRENTER] No products with Hungarian descriptions for connection ${connectionId}`)
        totalErrors += connectionProducts.length
        incrementProgress(progressKey, { errors: connectionProducts.length })
        continue
      }

      // Split into batches
      const batches: any[][] = []
      for (let i = 0; i < productsWithDescriptions.length; i += BATCH_SIZE) {
        batches.push(productsWithDescriptions.slice(i, i + BATCH_SIZE))
      }

      console.log(`[BULK SYNC TO SHOPRENTER] Processing ${productsWithDescriptions.length} products in ${batches.length} batches for connection ${connectionId}`)

      // Process batches (2 at a time for parallel processing)
      const CONCURRENT_BATCHES = 2
      for (let i = 0; i < batches.length; i += CONCURRENT_BATCHES) {
        if (shouldStopSync(progressKey)) {
          console.log(`[BULK SYNC TO SHOPRENTER] Sync stopped by user`)
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
            // Build batch requests for product updates
            const productBatchRequests: any[] = []
            const descriptionBatchRequests: any[] = []
            const productMapping: Map<number, { product: any; descriptionId: string | null }> = new Map()

            for (let j = 0; j < batch.length; j++) {
              const product = batch[j]
              const descriptions = product.shoprenter_product_descriptions || []
              const huDescription = descriptions.find((d: any) => d.language_code === 'hu') || descriptions[0]

              if (!huDescription) {
                batchResults.errors++
                continue
              }

              // Prepare product update payload
              const productPayload: any = {}
              if (product.model_number !== null && product.model_number !== undefined) {
                productPayload.modelNumber = product.model_number || ''
              }
              if (product.gtin !== null && product.gtin !== undefined) {
                productPayload.gtin = product.gtin || ''
              }
              if (product.price !== null && product.price !== undefined) {
                productPayload.price = String(product.price)
              }
              if (product.cost !== null && product.cost !== undefined) {
                productPayload.cost = String(product.cost)
              }
              if (product.multiplier !== null && product.multiplier !== undefined) {
                productPayload.multiplier = String(product.multiplier)
              }
              if (product.multiplier_lock !== null && product.multiplier_lock !== undefined) {
                productPayload.multiplierLock = product.multiplier_lock ? '1' : '0'
              }

              // Add product update to batch if there's data to update
              if (Object.keys(productPayload).length > 0) {
                productBatchRequests.push({
                  method: 'PUT',
                  uri: `${apiBaseUrl}/products/${product.shoprenter_id}`,
                  body: productPayload
                })
              }

              // Get description ID
              const descriptionId = await getProductDescriptionId(
                apiBaseUrl,
                authHeader,
                product.shoprenter_id,
                languageId,
                huDescription.shoprenter_id
              )

              // Prepare description payload
              const descriptionPayload: any = {
                name: huDescription.name || product.name || '',
                metaTitle: huDescription.meta_title || null,
                metaKeywords: huDescription.meta_keywords || null,
                metaDescription: huDescription.meta_description || null,
                shortDescription: huDescription.short_description || null,
                description: huDescription.description || null,
                product: {
                  id: product.shoprenter_id
                },
                language: {
                  id: languageId
                }
              }

              // Remove null values
              Object.keys(descriptionPayload).forEach(key => {
                if (descriptionPayload[key] === null) {
                  delete descriptionPayload[key]
                }
              })

              // Add description update/create to batch
              if (descriptionId) {
                descriptionBatchRequests.push({
                  method: 'PUT',
                  uri: `${apiBaseUrl}/productDescriptions/${descriptionId}`,
                  body: descriptionPayload
                })
              } else {
                descriptionBatchRequests.push({
                  method: 'POST',
                  uri: `${apiBaseUrl}/productDescriptions`,
                  body: descriptionPayload
                })
              }

              productMapping.set(j, { product, descriptionId })
            }

            // Execute product updates batch
            if (productBatchRequests.length > 0) {
              const productBatchPayload = {
                data: {
                  requests: productBatchRequests
                }
              }

              await rateLimiter.execute(async () => {
                const productBatchResponse = await fetch(`${apiBaseUrl}/batch`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': authHeader
                  },
                  body: JSON.stringify(productBatchPayload),
                  signal: AbortSignal.timeout(600000)
                })

                if (!productBatchResponse.ok) {
                  console.warn(`[BULK SYNC TO SHOPRENTER] Product batch update failed: ${productBatchResponse.status}`)
                }
              })
            }

            // Execute description updates batch
            if (descriptionBatchRequests.length > 0) {
              const descriptionBatchPayload = {
                data: {
                  requests: descriptionBatchRequests
                }
              }

              const descriptionBatchResponse = await rateLimiter.execute(async () => {
                return fetch(`${apiBaseUrl}/batch`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': authHeader
                  },
                  body: JSON.stringify(descriptionBatchPayload),
                  signal: AbortSignal.timeout(600000)
                })
              })

              if (!descriptionBatchResponse.ok) {
                const errorText = await descriptionBatchResponse.text().catch(() => 'Unknown error')
                console.error(`[BULK SYNC TO SHOPRENTER] Description batch failed: ${descriptionBatchResponse.status} - ${errorText.substring(0, 200)}`)
                batchResults.errors += descriptionBatchRequests.length
                incrementProgress(progressKey, { errors: descriptionBatchRequests.length })
                totalErrors += descriptionBatchRequests.length
                return batchResults
              }

              // Parse batch response
              const descriptionBatchData = await descriptionBatchResponse.json()
              const descriptionResponses = descriptionBatchData.requests?.request || descriptionBatchData.response?.requests?.request || []

              // Process responses and update database
              for (let j = 0; j < descriptionResponses.length && j < batch.length; j++) {
                const batchItem = descriptionResponses[j]
                const statusCode = parseInt(batchItem.response?.header?.statusCode || '0', 10)
                const mapping = productMapping.get(j)

                if (statusCode >= 200 && statusCode < 300 && mapping) {
                  const { product, descriptionId } = mapping
                  
                  // Extract new description ID if created
                  const pushResult = batchItem.response?.body
                  let finalDescriptionId = descriptionId
                  if (!finalDescriptionId && pushResult?.id) {
                    finalDescriptionId = pushResult.id
                  } else if (!finalDescriptionId && pushResult?.href) {
                    const parts = pushResult.href.split('/')
                    finalDescriptionId = parts[parts.length - 1]
                  }

                  // Update local database with ShopRenter description ID if we got it
                  const descriptions = product.shoprenter_product_descriptions || []
                  const huDescription = descriptions.find((d: any) => d.language_code === 'hu')
                  if (finalDescriptionId && huDescription && !huDescription.shoprenter_id) {
                    await supabase
                      .from('shoprenter_product_descriptions')
                      .update({ shoprenter_id: finalDescriptionId })
                      .eq('id', huDescription.id)
                  }

                  // Update product sync status
                  await supabase
                    .from('shoprenter_products')
                    .update({
                      sync_status: 'synced',
                      sync_error: null,
                      last_synced_at: new Date().toISOString()
                    })
                    .eq('id', product.id)

                  batchResults.synced++
                } else {
                  // Update product sync status with error
                  if (mapping) {
                    await supabase
                      .from('shoprenter_products')
                      .update({
                        sync_status: 'error',
                        sync_error: `Sync failed: ${statusCode}`,
                        last_synced_at: new Date().toISOString()
                      })
                      .eq('id', mapping.product.id)
                  }
                  batchResults.errors++
                }
              }
            }

            // Update progress
            incrementProgress(progressKey, {
              synced: batchResults.synced,
              errors: batchResults.errors
            })

            totalSynced += batchResults.synced
            totalErrors += batchResults.errors

            console.log(`[BULK SYNC TO SHOPRENTER] Batch ${batchIndex + 1} completed: ${batchResults.synced} synced, ${batchResults.errors} errors`)

            return batchResults
          } catch (error: any) {
            console.error(`[BULK SYNC TO SHOPRENTER] Batch ${batchIndex + 1} error:`, error)
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

    console.log(`[BULK SYNC TO SHOPRENTER] Completed: ${totalSynced} synced, ${totalErrors} errors`)
  } catch (error: any) {
    console.error('[BULK SYNC TO SHOPRENTER] Fatal error:', error)
    updateProgress(progressKey, {
      status: 'error',
      errors: totalErrors
    })
  }
}
