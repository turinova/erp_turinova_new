import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getConnectionById } from '@/lib/connections-server'
import { Buffer } from 'buffer'
import { updateProgress, clearProgress, shouldStopSync } from '@/lib/sync-progress-store'
import { updateCanonicalUrlForChild } from '@/lib/canonical-url-service'

/**
 * Extract shop name from ShopRenter API URL
 */
function extractShopNameFromUrl(apiUrl: string): string | null {
  try {
    const cleanUrl = apiUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
    const match = cleanUrl.match(/^([^.]+)\.api(2)?\.myshoprenter\.hu/)
    return match && match[1] ? match[1] : null
  } catch {
    return null
  }
}

/**
 * Construct full product URL from shop name and URL alias
 * Note: This constructs a standard ShopRenter URL. If the shop uses a custom domain,
 * the URL may need to be updated manually or fetched from ShopRenter settings.
 */
function constructProductUrl(shopName: string, urlAlias: string | null | undefined): string | null {
  if (!urlAlias || !urlAlias.trim()) {
    return null
  }
  
  if (!shopName) {
    return null
  }
  
  // Construct frontend URL from shop name
  // Format: https://shopname.shoprenter.hu/urlAlias
  // Note: If shop uses custom domain (e.g., vasalatmester.hu), this will need to be updated
  // For now, use the standard ShopRenter format
  const cleanAlias = urlAlias.trim().replace(/^\//, '') // Remove leading slash if present
  return `https://${shopName}.shoprenter.hu/${cleanAlias}`
}

/**
 * Extract URL alias from productExtend response
 */
function extractUrlAlias(product: any): { slug: string | null; id: string | null } {
  // Check if urlAliases exists and has urlAlias
  if (product.urlAliases) {
    // urlAliases can be an object with urlAlias property
    if (typeof product.urlAliases === 'object' && product.urlAliases.urlAlias) {
      return {
        slug: product.urlAliases.urlAlias,
        id: product.urlAliases.id || null
      }
    }
    // Or it might be an array
    if (Array.isArray(product.urlAliases) && product.urlAliases.length > 0) {
      const firstAlias = product.urlAliases[0]
      if (firstAlias.urlAlias) {
        return {
          slug: firstAlias.urlAlias,
          id: firstAlias.id || null
        }
      }
    }
  }
  
  return { slug: null, id: null }
}

/**
 * Extract parent product ID from productExtend response
 * Returns the ShopRenter ID of the parent product (if this is a child/variant)
 */
function extractParentProductId(product: any): string | null {
  if (!product.parentProduct) {
    return null
  }

  // parentProduct can be an object with id property
  if (typeof product.parentProduct === 'object') {
    // Check for direct id property
    if (product.parentProduct.id) {
      return product.parentProduct.id
    }
    
    // Check for href and extract ID from URL
    // Format: http://shopname.api.myshoprenter.hu/products/cHJvZHVjdC1wcm9kdWN0X2lkPTE3MDc=
    if (product.parentProduct.href) {
      const hrefMatch = product.parentProduct.href.match(/\/products\/([^\/\?]+)/)
      if (hrefMatch && hrefMatch[1]) {
        return hrefMatch[1]
      }
    }
  }
  
  // Or it might be a string (the ID itself)
  if (typeof product.parentProduct === 'string') {
    return product.parentProduct
  }
  
  return null
}

/**
 * POST /api/connections/[id]/sync-products
 * Sync products from ShopRenter to database
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: connectionId } = await params
  try {
    let product_id: string | undefined
    let forceSync = false
    try {
      const body = await request.json().catch(() => ({}))
      product_id = body?.product_id
      forceSync = body?.force === true
    } catch {
      // Body might be empty, that's OK
      product_id = undefined
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get connection
    const connection = await getConnectionById(connectionId)
    if (!connection || connection.connection_type !== 'shoprenter') {
      return NextResponse.json({ error: 'Connection not found or invalid type' }, { status: 404 })
    }

    // Extract shop name
    const shopName = extractShopNameFromUrl(connection.api_url)
    if (!shopName) {
      return NextResponse.json({ error: 'Invalid API URL format' }, { status: 400 })
    }

    // Use Basic Auth for old API
    const credentials = `${connection.username}:${connection.password}`
    const base64Credentials = Buffer.from(credentials).toString('base64')
    const authHeader = `Basic ${base64Credentials}`

    let apiUrl = connection.api_url.replace(/\/$/, '')
    if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
      apiUrl = `http://${apiUrl}`
    }

    // Handle single product sync (no batch needed)
    if (product_id) {
      const productUrl = `${apiUrl}/productExtend/${product_id}?full=1`
      const response = await fetch(productUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader
        },
        signal: AbortSignal.timeout(30000)
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        return NextResponse.json({ 
          success: false, 
          error: `API error: ${response.status} - ${errorText.substring(0, 200)}` 
        }, { status: response.status })
      }

      const data = await response.json().catch(() => null)
      if (!data || !data.id) {
        return NextResponse.json({ 
          success: false, 
          error: 'Nem található termék a válaszban' 
        }, { status: 500 })
      }

      try {
        await syncProductToDatabase(supabase, connection, data)
        return NextResponse.json({ success: true, synced: 1 })
      } catch (error) {
        return NextResponse.json({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Ismeretlen hiba' 
        }, { status: 500 })
      }
    }

    // For bulk sync, use Batch API for efficiency
    // First, get all product IDs (paginated)
    const allProductIds: string[] = []
    let page = 0
    const pageSize = 200
    let hasMorePages = true
    let firstPageData: any = null

    while (hasMorePages) {
      // Use full=1 to get product IDs in the response (not just hrefs)
      const productsListUrl = `${apiUrl}/products?full=1&limit=${pageSize}&page=${page}`
      const listResponse = await fetch(productsListUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader
        },
        signal: AbortSignal.timeout(30000)
      })

      if (!listResponse.ok) {
        const errorText = await listResponse.text().catch(() => 'Unknown error')
        console.error(`[SYNC] Error fetching product list page ${page}:`, {
          status: listResponse.status,
          error: errorText.substring(0, 200),
          url: productsListUrl
        })
        return NextResponse.json({ 
          success: false, 
          error: `API error fetching product list: ${listResponse.status} - ${errorText.substring(0, 200)}` 
        }, { status: listResponse.status })
      }

      // Check content type
      const contentType = listResponse.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await listResponse.text().catch(() => '')
        console.error(`[SYNC] Non-JSON response for page ${page}:`, contentType, text.substring(0, 100))
        return NextResponse.json({ 
          success: false, 
          error: `Nem JSON válasz érkezett. Content-Type: ${contentType}` 
        }, { status: 500 })
      }

      let listData
      try {
        const text = await listResponse.text()
        if (!text || text.trim().length === 0) {
          console.error(`[SYNC] Empty response for page ${page}`)
          return NextResponse.json({ 
            success: false, 
            error: 'Üres válasz érkezett az API-tól' 
          }, { status: 500 })
        }
        listData = JSON.parse(text)
      } catch (parseError) {
        console.error(`[SYNC] JSON parse error for page ${page}:`, parseError)
        return NextResponse.json({ 
          success: false, 
          error: `JSON parse hiba: ${parseError instanceof Error ? parseError.message : 'Ismeretlen hiba'}` 
        }, { status: 500 })
      }

      if (!listData) {
        console.error(`[SYNC] listData is null for page ${page}`)
        return NextResponse.json({ 
          success: false, 
          error: 'Nem sikerült feldolgozni a terméklistát' 
        }, { status: 500 })
      }

      // Store first page data for debugging
      if (page === 0) {
        firstPageData = listData
        console.log(`[SYNC] First page response structure:`, {
          hasItems: !!listData.items,
          hasResponse: !!listData.response,
          itemsCount: listData.items?.length || listData.response?.items?.length || 0,
          pageCount: listData.pageCount || listData.response?.pageCount,
          keys: Object.keys(listData)
        })
      }

      // Extract product IDs from response - handle multiple response formats
      let items: any[] = []
      if (listData.items) {
        items = listData.items
      } else if (listData.response?.items) {
        items = listData.response.items
      } else if (Array.isArray(listData)) {
        items = listData
      }

      console.log(`[SYNC] Page ${page}: Found ${items.length} items`)

      for (const item of items) {
        if (item.id) {
          // Direct ID available
          allProductIds.push(item.id)
        } else if (item.href) {
          // Extract ID from href (format: /products/cHJvZHVjdC1wcm9kdWN0X2lkPTI0NTE=)
          // The ID is the last part of the path
          const hrefParts = item.href.split('/')
          const lastPart = hrefParts[hrefParts.length - 1]
          if (lastPart && lastPart !== 'products') {
            allProductIds.push(lastPart)
          } else {
            console.warn(`[SYNC] Could not extract ID from href on page ${page}:`, item.href)
          }
        } else {
          console.warn(`[SYNC] Item without ID or href on page ${page}:`, Object.keys(item))
        }
      }

      // Check if there are more pages
      // Handle both string and number pageCount
      let pageCount = 0
      if (listData.pageCount !== undefined) {
        pageCount = typeof listData.pageCount === 'string' ? parseInt(listData.pageCount, 10) : listData.pageCount
      } else if (listData.response?.pageCount !== undefined) {
        pageCount = typeof listData.response.pageCount === 'string' ? parseInt(listData.response.pageCount, 10) : listData.response.pageCount
      }

      // If we got items on this page, continue to next page
      // If pageCount is 0 or not set, but we have items, assume there might be more
      if (pageCount > 0) {
        hasMorePages = page < pageCount - 1
      } else {
        // If no pageCount, check if we got a full page (might indicate more pages)
        hasMorePages = items.length === pageSize
      }

      console.log(`[SYNC] Page ${page}: pageCount=${pageCount}, items=${items.length}, hasMorePages=${hasMorePages}, totalIds=${allProductIds.length}`)

      page++

      // Minimal delay between page requests (ShopRenter API can handle faster requests)
      if (hasMorePages) {
        await new Promise(resolve => setTimeout(resolve, 50))
      }
    }

    console.log(`[SYNC] Total product IDs collected: ${allProductIds.length}`)

    if (allProductIds.length === 0) {
      console.error(`[SYNC] No products found. First page data:`, JSON.stringify(firstPageData, null, 2).substring(0, 500))
      clearProgress(connectionId)
      return NextResponse.json({ 
        success: false, 
        error: 'Nem található termék a webshopban. Ellenőrizze, hogy a kapcsolat helyes-e és hogy vannak-e termékek a webshopban.' 
      }, { status: 404 })
    }

    // Now use Batch API to fetch products in batches of 200
    const BATCH_SIZE = 200 // Recommended by ShopRenter
    const batches: string[][] = []
    for (let i = 0; i < allProductIds.length; i += BATCH_SIZE) {
      batches.push(allProductIds.slice(i, i + BATCH_SIZE))
    }

    // Initialize progress tracking BEFORE starting background process
    // This ensures the frontend can immediately see the total count
    // Clear any previous stop flag when starting a new sync
    updateProgress(connectionId, {
      total: allProductIds.length,
      synced: 0,
      current: 0,
      status: 'syncing',
      errors: 0,
      shouldStop: false // Clear any previous stop flag
    })

    // Return immediately and run sync in background
    // The frontend will poll for progress
    // Don't await - let it run in background
    processSyncInBackground(supabase, connection, allProductIds, batches, connectionId, forceSync, apiUrl, authHeader).catch(error => {
      console.error('Background sync error:', error)
      updateProgress(connectionId, {
        status: 'error',
        errors: allProductIds.length
      })
    })

    // Small delay to ensure progress is set in memory before returning response
    // This gives the progress store time to be initialized
    await new Promise(resolve => setTimeout(resolve, 200))

    return NextResponse.json({ 
      success: true,
      message: 'Szinkronizálás elindítva',
      total: allProductIds.length
    })
  } catch (error) {
    console.error('Error syncing products:', error)
    
    // Handle specific error types
    let errorMessage = 'Unknown error'
    if (error instanceof SyntaxError && error.message.includes('JSON')) {
      errorMessage = 'JSON parse hiba: ' + error.message
    } else if (error instanceof TypeError && error.message.includes('fetch')) {
      errorMessage = 'Hálózati hiba: ' + error.message
    } else if (error instanceof Error) {
      errorMessage = error.message
    }
    
    clearProgress(connectionId)
    
    return NextResponse.json({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 })
  }
}

/**
 * Process sync in background (non-blocking)
 */
async function processSyncInBackground(
  supabase: any,
  connection: any,
  allProductIds: string[],
  batches: string[][],
  connectionId: string,
  forceSync: boolean,
  apiUrl: string,
  authHeader: string
) {
  // Initialize variables at function scope so they're accessible in catch block
  let syncedCount = 0
  let errorCount = 0
  const errors: string[] = []
  const totalProducts = allProductIds.length
  const totalBatches = batches.length

  try {
    // Ensure progress is initialized at the start of background process
    // This is a safety check in case the main handler didn't set it
    // Clear any previous stop flag when starting a new sync
    updateProgress(connectionId, {
      total: allProductIds.length,
      synced: 0,
      current: 0,
      status: 'syncing',
      errors: 0,
      shouldStop: false // Clear any previous stop flag
    })

    console.log(`[SYNC] Background process started for ${allProductIds.length} products in ${batches.length} batches`)

    // Process batches sequentially (as recommended by ShopRenter)
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      // Check if sync should stop
      if (shouldStopSync(connectionId)) {
        console.log(`[SYNC] Sync stopped by user at batch ${batchIndex + 1}/${totalBatches}`)
        updateProgress(connectionId, {
          status: 'stopped',
          synced: syncedCount,
          current: syncedCount + errorCount,
          errors: errorCount
        })
        return // Exit the sync process
      }

      const batch = batches[batchIndex]
      
      console.log(`[SYNC] Processing batch ${batchIndex + 1}/${totalBatches} with ${batch.length} items`)
      
      // Update progress at start of each batch (show current state)
      updateProgress(connectionId, {
        synced: syncedCount,
        current: syncedCount + errorCount,
        status: 'syncing',
        errors: errorCount
      })
      
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
      const batchResponse = await fetch(`${apiUrl}/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify(batchPayload),
        signal: AbortSignal.timeout(600000) // 10 minutes for batch processing (increased for large batches)
      })

      if (!batchResponse.ok) {
        const errorText = await batchResponse.text().catch(() => 'Unknown error')
        errors.push(`Batch ${batchIndex + 1} hiba: ${batchResponse.status} - ${errorText.substring(0, 200)}`)
        errorCount += batch.length
        continue
      }

      // Parse batch response
      let batchData
      try {
        const batchText = await batchResponse.text()
        if (!batchText || batchText.trim().length === 0) {
          errors.push(`Batch ${batchIndex + 1}: Üres válasz`)
          errorCount += batch.length
          continue
        }
        batchData = JSON.parse(batchText)
      } catch (parseError) {
        errors.push(`Batch ${batchIndex + 1}: JSON parse hiba - ${parseError instanceof Error ? parseError.message : 'Ismeretlen'}`)
        errorCount += batch.length
        continue
      }

      // Check again before processing batch items
      if (shouldStopSync(connectionId)) {
        console.log(`[SYNC] Sync stopped by user during batch ${batchIndex + 1} processing`)
        updateProgress(connectionId, {
          status: 'stopped',
          synced: syncedCount,
          current: syncedCount + errorCount,
          errors: errorCount
        })
        return // Exit the sync process
      }

      // Process batch responses
      const batchResponses = batchData.requests?.request || batchData.response?.requests?.request || []
      
      console.log(`[SYNC] Processing batch ${batchIndex + 1}/${totalBatches} with ${batchResponses.length} items`)
      
      for (const batchItem of batchResponses) {
        // Check if sync should stop before each item
        if (shouldStopSync(connectionId)) {
          console.log(`[SYNC] Sync stopped by user during item processing`)
          updateProgress(connectionId, {
            status: 'stopped',
            synced: syncedCount,
            current: syncedCount + errorCount,
            errors: errorCount
          })
          return // Exit the sync process
        }

        try {
          const statusCode = parseInt(batchItem.response?.header?.statusCode || '0', 10)
          
          if (statusCode >= 200 && statusCode < 300) {
            const product = batchItem.response?.body
            if (product && product.id) {
              try {
                await syncProductToDatabase(supabase, connection, product, forceSync)
                syncedCount++
                // Update progress after EVERY product for real-time updates
                updateProgress(connectionId, {
                  synced: syncedCount,
                  current: syncedCount + errorCount,
                  status: 'syncing',
                  errors: errorCount
                })
              } catch (error) {
                errorCount++
                const errorMsg = error instanceof Error ? error.message : 'Ismeretlen hiba'
                errors.push(`Termék ${product.sku || product.id}: ${errorMsg}`)
                console.error(`[SYNC] Error syncing product ${product.sku || product.id}:`, errorMsg)
                // Update progress even on error
                updateProgress(connectionId, {
                  current: syncedCount + errorCount,
                  errors: errorCount
                })
              }
            } else {
              errorCount++
              errors.push(`Termék: Hiányzó adatok a válaszban`)
              updateProgress(connectionId, {
                current: syncedCount + errorCount,
                errors: errorCount
              })
            }
          } else {
            errorCount++
            const errorMsg = batchItem.response?.body?.message || `HTTP ${statusCode}`
            errors.push(`Termék ${batchItem.uri}: ${errorMsg}`)
            console.warn(`[SYNC] Product sync failed with status ${statusCode}: ${errorMsg}`)
            updateProgress(connectionId, {
              current: syncedCount + errorCount,
              errors: errorCount
            })
          }
        } catch (itemError) {
          // Handle errors in processing individual items - don't stop the entire sync
          errorCount++
          const errorMsg = itemError instanceof Error ? itemError.message : 'Ismeretlen hiba'
          errors.push(`Termék feldolgozási hiba: ${errorMsg}`)
          console.error(`[SYNC] Error processing batch item:`, itemError)
          updateProgress(connectionId, {
            current: syncedCount + errorCount,
            errors: errorCount
          })
        }
      }
      
      console.log(`[SYNC] Batch ${batchIndex + 1}/${totalBatches} completed: ${syncedCount} synced, ${errorCount} errors`)

      // Update progress after each batch
      updateProgress(connectionId, {
        synced: syncedCount,
        current: syncedCount + errorCount,
        status: 'syncing', // Keep status as 'syncing' until complete
        errors: errorCount
      })

      // Minimal delay between batches (ShopRenter recommends waiting for response, not fixed delays)
      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 50))
      }
    }

    // Post-sync: Update parent_product_id for products that were synced before their parent
    console.log(`[SYNC] Updating parent-child relationships for products synced before their parent...`)
    try {
      // Get all products for this connection that might have parents
      // We'll re-fetch their parentProduct from ShopRenter and update if parent now exists
      const { data: allProducts, error: productsError } = await supabase
        .from('shoprenter_products')
        .select('id, shoprenter_id, sku, parent_product_id')
        .eq('connection_id', connection.id)
        .is('deleted_at', null)
      
      if (productsError) {
        console.error(`[SYNC] Error fetching products for parent update:`, productsError)
      } else if (allProducts && allProducts.length > 0) {
        let updatedCount = 0
        const batchSize = 50 // Process in smaller batches to avoid timeout
        
        for (let i = 0; i < allProducts.length; i += batchSize) {
          const batch = allProducts.slice(i, i + batchSize)
          
          // Build batch request to fetch parentProduct for each product
          const batchRequests = batch.map(p => ({
            method: 'GET',
            uri: `${apiUrl}/productExtend/${p.shoprenter_id}?full=1`
          }))
          
          const batchPayload = {
            data: {
              requests: batchRequests
            }
          }
          
          try {
            const batchResponse = await fetch(`${apiUrl}/batch`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': authHeader
              },
              body: JSON.stringify(batchPayload),
              signal: AbortSignal.timeout(300000) // 5 minutes
            })
            
            if (batchResponse.ok) {
              const batchData = await batchResponse.json()
              const batchResponses = batchData.requests?.request || batchData.response?.requests?.request || []
              
              for (let j = 0; j < batch.length && j < batchResponses.length; j++) {
                const product = batch[j]
                const batchItem = batchResponses[j]
                
                if (batchItem.response?.body) {
                  const productData = batchItem.response.body
                  const parentShopRenterId = extractParentProductId(productData)
                  
                  // Only update if we found a parent and it's different from current
                  if (parentShopRenterId && (!product.parent_product_id || product.parent_product_id !== parentShopRenterId)) {
                    // Find parent in database
                    const { data: parentProduct } = await supabase
                      .from('shoprenter_products')
                      .select('id')
                      .eq('connection_id', connection.id)
                      .eq('shoprenter_id', parentShopRenterId)
                      .single()
                    
                    if (parentProduct) {
                      // Update the child product with parent UUID
                      const { error: updateError } = await supabase
                        .from('shoprenter_products')
                        .update({ parent_product_id: parentProduct.id })
                        .eq('id', product.id)
                      
                      if (!updateError) {
                        updatedCount++
                        console.log(`[SYNC] Updated parent for ${product.sku}: ${parentProduct.id}`)
                      } else {
                        console.error(`[SYNC] Error updating parent for ${product.sku}:`, updateError)
                      }
                    }
                  }
                }
              }
            }
          } catch (batchError) {
            console.error(`[SYNC] Error in parent update batch ${Math.floor(i / batchSize) + 1}:`, batchError)
          }
          
          // Small delay between batches
          if (i + batchSize < allProducts.length) {
            await new Promise(resolve => setTimeout(resolve, 100))
          }
        }
        
        console.log(`[SYNC] Updated ${updatedCount} parent-child relationships`)
      }
    } catch (parentUpdateError) {
      console.error(`[SYNC] Error updating parent relationships (non-fatal):`, parentUpdateError)
    }

    // Mark as complete
    updateProgress(connectionId, {
      synced: syncedCount,
      current: totalProducts,
      status: 'completed',
      errors: errorCount
    })

    // Clear progress after 30 seconds (give time for final poll)
    setTimeout(() => {
      clearProgress(connectionId)
    }, 30 * 1000)

    console.log(`[SYNC] Completed: ${syncedCount}/${totalProducts} synced, ${errorCount} errors`)
  } catch (error) {
    console.error('Error in background sync:', error)
    const errorMessage = error instanceof Error ? error.message : 'Ismeretlen hiba'
    console.error(`[SYNC] Fatal error at batch ${Math.floor(syncedCount / 200) + 1}: ${errorMessage}`)
    updateProgress(connectionId, {
      status: 'error',
      errors: errorCount,
      synced: syncedCount,
      current: syncedCount + errorCount
    })
    // Don't throw - log the error but mark progress as error so UI can show it
    console.error(`[SYNC] Sync stopped at ${syncedCount}/${totalProducts} products due to error`)
  }
}

/**
 * Sync a single product to database
 */
async function syncProductToDatabase(
  supabase: any,
  connection: any,
  product: any,
  forceSync: boolean = false
) {
  try {
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
        parentProductId = parentProduct.id
        console.log(`[SYNC] Product ${product.sku} is a child of parent ${parentProduct.sku} (${parentProduct.id})`)
      }
    } else {
      // Log when no parent is found in API response
      if (product.parentProduct) {
        console.warn(`[SYNC] Product ${product.sku} has parentProduct field but couldn't extract ID:`, JSON.stringify(product.parentProduct))
      }
    }

    // Extract product attributes (productAttributeExtend from ShopRenter)
    // This contains structured attributes like size, color, dimensions, etc.
    let productAttributes = null
    if (product.productAttributeExtend && Array.isArray(product.productAttributeExtend)) {
      // Store the full attribute structure for later use
      productAttributes = product.productAttributeExtend.map((attr: any) => ({
        type: attr.type, // LIST, INTEGER, FLOAT, TEXT
        name: attr.name, // e.g., "size", "color", "weight"
        value: attr.value // Can be array (LIST) or single value (INTEGER/FLOAT/TEXT)
      }))
    }

    // Extract product data
    const productData = {
      connection_id: connection.id,
      shoprenter_id: product.id,
      shoprenter_inner_id: product.innerId || null,
      sku: product.sku || '',
      model_number: product.modelNumber || null, // Gyártói cikkszám (Manufacturer part number)
      gtin: product.gtin || null, // Vonalkód (Barcode/GTIN)
      name: null, // Will be set from description
      status: product.status === '1' || product.status === 1 ? 1 : 0,
      // Pricing fields (Árazás)
      price: product.price ? parseFloat(product.price) : null, // Nettó ár
      cost: product.cost ? parseFloat(product.cost) : null, // Beszerzési ár
      multiplier: product.multiplier ? parseFloat(product.multiplier) : 1.0, // Árazási szorzó
      multiplier_lock: product.multiplierLock === '1' || product.multiplierLock === 1 || product.multiplierLock === true, // Szorzó zárolás
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
      last_synced_at: new Date().toISOString()
    }

    // Upsert product
    const { data: existingProduct } = await supabase
      .from('shoprenter_products')
      .select('id')
      .eq('connection_id', connection.id)
      .eq('shoprenter_id', product.id)
      .single()

    let productResult
    if (existingProduct) {
      productResult = await supabase
        .from('shoprenter_products')
        .update(productData)
        .eq('id', existingProduct.id)
        .select()
        .single()
    } else {
      productResult = await supabase
        .from('shoprenter_products')
        .insert(productData)
        .select()
        .single()
    }

    if (productResult.error) {
      console.error('Error syncing product to database:', productResult.error)
      throw new Error(`Adatbázis hiba: ${productResult.error.message || 'Ismeretlen hiba'}`)
    }

    if (!productResult.data) {
      throw new Error('Termék nem lett létrehozva/frissítve az adatbázisban')
    }

    const dbProduct = productResult.data

    // Prepare auth for API calls
    const credentials = `${connection.username}:${connection.password}`
    const base64Credentials = Buffer.from(credentials).toString('base64')
    const authHeader = `Basic ${base64Credentials}`

    let apiUrl = connection.api_url.replace(/\/$/, '')
    if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
      apiUrl = `http://${apiUrl}`
    }

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

        const descResponse = await fetch(descUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': authHeader
          },
          signal: AbortSignal.timeout(10000)
        })

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
              shoprenter_id: desc.id || null
            }

            // Update product name if it's Hungarian
            if (descDataToSave.language_code === 'hu' && descDataToSave.name) {
              await supabase
                .from('shoprenter_products')
                .update({ name: descDataToSave.name })
                .eq('id', dbProduct.id)
            }

            // Upsert description
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

        const descDataToSave = {
          product_id: dbProduct.id,
          language_code: languageCode,
          name: desc.name || '',
          meta_title: desc.metaTitle || null,
          meta_keywords: desc.metaKeywords || null,
          meta_description: desc.metaDescription || null,
          short_description: desc.shortDescription || null,
          description: desc.description || null,
          shoprenter_id: desc.id || null
        }

        if (descDataToSave.language_code === 'hu' && descDataToSave.name) {
          await supabase
            .from('shoprenter_products')
            .update({ name: descDataToSave.name })
            .eq('id', dbProduct.id)
        }

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

    // Auto-update canonical URL if this is a child product
    if (parentProductId) {
      try {
        await updateCanonicalUrlForChild(supabase, dbProduct.id)
        console.log(`[SYNC] Updated canonical URL for child product ${product.sku}`)
      } catch (canonicalError) {
        // Non-fatal - log but don't fail the sync
        console.warn(`[SYNC] Failed to update canonical URL for ${product.sku} (non-fatal):`, canonicalError)
      }
    }
  } catch (error) {
    console.error('Error in syncProductToDatabase:', error)
    throw error
  }
}
