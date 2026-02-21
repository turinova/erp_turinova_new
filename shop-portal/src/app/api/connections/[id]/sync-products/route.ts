import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getConnectionById } from '@/lib/connections-server'
import { Buffer } from 'buffer'
import { updateProgress, clearProgress, shouldStopSync } from '@/lib/sync-progress-store'
import { extractImagesFromProductExtend, fetchProductImages } from '@/lib/shoprenter-image-service'
import { getShopRenterRateLimiter } from '@/lib/shoprenter-rate-limiter'

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
 * Fetch AttributeDescription for an attribute to get display name
 */
async function fetchAttributeDescription(
  apiBaseUrl: string,
  authHeader: string,
  attributeId: string,
  attributeType: 'LIST' | 'INTEGER' | 'FLOAT' | 'TEXT',
  languageId: string = 'bGFuZ3VhZ2UtbGFuZ3VhZ2VfaWQ9MQ==' // Hungarian default
): Promise<{ display_name: string | null; prefix: string | null; postfix: string | null }> {
  try {
    // Build query parameter based on attribute type
    let queryParam = ''
    if (attributeType === 'LIST') {
      queryParam = `listAttributeId=${encodeURIComponent(attributeId)}`
    } else if (attributeType === 'TEXT') {
      queryParam = `textAttributeId=${encodeURIComponent(attributeId)}`
    } else if (attributeType === 'INTEGER' || attributeType === 'FLOAT') {
      queryParam = `numberAttributeId=${encodeURIComponent(attributeId)}`
    } else {
      return { display_name: null, prefix: null, postfix: null }
    }

    const url = `${apiBaseUrl}/attributeDescriptions?${queryParam}&languageId=${encodeURIComponent(languageId)}&full=1`
    
    console.log(`[SYNC] Fetching AttributeDescription from: ${url}`)
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': authHeader
      },
      signal: AbortSignal.timeout(5000)
    })

    if (response.ok) {
      const data = await response.json()
      const items = data.items || data.response?.items || []
      
      // Get first matching description (should be only one per language)
      if (items.length > 0) {
        let desc = items[0]
        
        // If item only has href (not full data), fetch it individually
        if (desc.href && !desc.name && !desc.id) {
          console.log(`[SYNC] AttributeDescription item only has href, fetching full data: ${desc.href}`)
          try {
            const fullResponse = await fetch(desc.href, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': authHeader
              },
              signal: AbortSignal.timeout(5000)
            })
            
            if (fullResponse.ok) {
              desc = await fullResponse.json()
            }
          } catch (fetchError) {
            console.warn(`[SYNC] Failed to fetch full AttributeDescription from href:`, fetchError)
          }
        }
        
        // Log the full response structure to debug
        console.log(`[SYNC] AttributeDescription response for ${attributeType} ${attributeId}:`, JSON.stringify(desc, null, 2).substring(0, 500))
        
        // Extract display name - according to API docs, it should be in 'name' field
        const displayName = desc.name || null
        const prefix = desc.prefix || null
        const postfix = desc.postfix || null
        
        console.log(`[SYNC] Extracted from AttributeDescription: name="${displayName}", prefix="${prefix}", postfix="${postfix}"`)
        
        return {
          display_name: displayName,
          prefix: prefix,
          postfix: postfix
        }
      } else {
        console.warn(`[SYNC] No AttributeDescription found for ${attributeType} attribute ${attributeId} (language: ${languageId})`)
      }
    } else {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.warn(`[SYNC] AttributeDescription API error for ${attributeType} ${attributeId}: ${response.status} - ${errorText.substring(0, 200)}`)
    }
  } catch (error) {
    console.warn(`[SYNC] Failed to fetch AttributeDescription for ${attributeType} attribute ${attributeId}:`, error)
  }

  return { display_name: null, prefix: null, postfix: null }
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
      console.error('[SYNC] Authentication failed:', userError?.message || 'No user found')
      return NextResponse.json({ 
        success: false,
        error: 'Authentication failed. Please log out and log back in, then try again.',
        details: userError?.message || 'Session expired or invalid'
      }, { status: 401 })
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
        await syncProductToDatabase(supabase, connection, data, false, apiUrl, authHeader)
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
    processSyncInBackground(supabase, connection, allProductIds, batches, connectionId, forceSync, apiUrl, authHeader, request).catch(error => {
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
  authHeader: string,
  request: NextRequest
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
                await syncProductToDatabase(supabase, connection, product, forceSync, apiUrl, authHeader)
                syncedCount++
                // Update progress after EVERY product for real-time updates
                updateProgress(connectionId, {
                  synced: syncedCount,
                  current: syncedCount + errorCount,
                  status: 'syncing',
                  errors: errorCount
                })
                
                // Small delay between products to prevent overwhelming the API
                // This helps ensure rate limiter has time to process attribute requests
                await new Promise(resolve => setTimeout(resolve, 50))
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
                      // CRITICAL: Prevent self-referencing parent_product_id
                      // A product cannot be its own parent
                      if (parentProduct.id === product.id) {
                        console.warn(`[SYNC] Product ${product.sku} has parent_product_id pointing to itself. Clearing invalid parent_product_id.`)
                        // Clear the invalid parent_product_id
                        await supabase
                          .from('shoprenter_products')
                          .update({ parent_product_id: null })
                          .eq('id', product.id)
                        continue
                      }
                      
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
  forceSync: boolean = false,
  apiBaseUrl?: string,
  authHeaderParam?: string
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
      
      // Get rate limiter instance
      const rateLimiter = getShopRenterRateLimiter()
      
      // Process attributes sequentially with rate limiting to respect ShopRenter's 3 req/sec limit
      productAttributes = []
      for (const attr of product.productAttributeExtend) {
        // Extract attribute ID - can be in id field or href
        let attributeId = attr.id || null
        if (!attributeId && attr.href) {
          // Extract ID from href like: "http://shopname.api.myshoprenter.hu/listAttributes/bGlzdEF0dHJpYnV0ZS1hdHRyaWJ1dGVfaWQ9Mg=="
          const hrefParts = attr.href.split('/')
          attributeId = hrefParts[hrefParts.length - 1] || null
        }
        
        console.log(`[SYNC] Processing attribute: name="${attr.name}", type="${attr.type}", id="${attributeId}", href="${attr.href || 'none'}"`)
        
        // If we have an attribute ID, fetch the display name with rate limiting
        let displayName = attr.name // Fallback to internal name
        let prefix = null
        let postfix = null
        
        if (attributeId && apiBaseUrl && authHeaderParam) {
          try {
            console.log(`[SYNC] Fetching AttributeDescription for attribute: name="${attr.name}", type="${attr.type}", id="${attributeId}"`)
            // Use rate limiter to ensure we don't exceed 3 req/sec
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
              console.log(`[SYNC] Successfully fetched display name for "${attr.name}": "${displayName}"`)
            } else {
              console.warn(`[SYNC] No display_name returned for attribute "${attr.name}" (id: ${attributeId})`)
            }
          } catch (error) {
            console.warn(`[SYNC] Failed to fetch display name for attribute ${attr.name}:`, error)
            // Continue with internal name as fallback
          }
        } else {
          console.warn(`[SYNC] Skipping AttributeDescription fetch for "${attr.name}": attributeId=${attributeId}, apiBaseUrl=${!!apiBaseUrl}, authHeaderParam=${!!authHeaderParam}`)
        }

        productAttributes.push({
          type: attr.type, // LIST, INTEGER, FLOAT, TEXT
          name: attr.name, // Internal identifier (e.g., "meret", "szin")
          display_name: displayName, // Display name (e.g., "Méret", "Szín") - PRIMARY
          prefix: prefix, // Text before value
          postfix: postfix, // Text after value
          value: attr.value // Can be array (LIST) or single value (INTEGER/FLOAT/TEXT)
        })
      }
      
      // Log what we're storing
      console.log(`[SYNC] Processed ${productAttributes.length} attributes for product ${product.sku}:`)
      productAttributes.forEach((attr: any) => {
        console.log(`  - ${attr.name}: display_name="${attr.display_name || 'NOT SET'}", type=${attr.type}`)
      })
    }

    // Extract brand/manufacturer from productExtend
    let brand = null
    if (product.manufacturer) {
      // manufacturer can be an object with name property, or just href
      if (typeof product.manufacturer === 'object' && product.manufacturer.name) {
        brand = product.manufacturer.name
        console.log(`[SYNC] Extracted brand from manufacturer: "${brand}" for product ${product.sku}`)
      } else if (product.manufacturer.href) {
        // If only href is available, we could fetch it, but for now just log
        console.log(`[SYNC] Manufacturer href found but no name for product ${product.sku}: ${product.manufacturer.href}`)
      }
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
      brand: brand, // Brand/manufacturer name from ShopRenter
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
            await supabase
              .from('shoprenter_products')
              .update({ name: productNameToUpdate })
              .eq('id', dbProduct.id)
            console.log(`[SYNC] Updated product name for ${product.sku}: ${productNameToUpdate}`)
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
        await supabase
          .from('shoprenter_products')
          .update({ name: productNameToUpdate })
          .eq('id', dbProduct.id)
        console.log(`[SYNC] Updated product name for ${product.sku}: ${productNameToUpdate}`)
      }
      
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
              product.id // This is the ShopRenter product ID from productExtend
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
            // Remove leading "data/" if present, normalize slashes
            return path.replace(/^data\//, '').replace(/\\/g, '/').toLowerCase()
          }

          const normalizedExtractedPath = normalizePath(img.imagePath)
          const matchingShopRenterImage = shoprenterImages.find((srImg: any) => {
            const normalizedShopRenterPath = normalizePath(srImg.imagePath)
            // Exact match or path ends match
            return normalizedExtractedPath === normalizedShopRenterPath ||
                   normalizedExtractedPath.endsWith(normalizedShopRenterPath) ||
                   normalizedShopRenterPath.endsWith(normalizedExtractedPath)
          })

          if (matchingShopRenterImage) {
            imageData.shoprenter_image_id = matchingShopRenterImage.id
            // Only set alt text from productImages if we don't already have it from productExtend
            if (!imageData.alt_text && matchingShopRenterImage.imageAlt) {
              imageData.alt_text = matchingShopRenterImage.imageAlt
              imageData.alt_text_status = 'synced'
              imageData.alt_text_synced_at = new Date().toISOString()
              console.log(`[SYNC] Set alt text from productImages for ${img.imagePath}: "${matchingShopRenterImage.imageAlt}"`)
            } else if (!imageData.alt_text) {
              imageData.alt_text_status = 'pending'
            }
          } else {
            // No match found
            if (!imageData.alt_text) {
              imageData.alt_text_status = 'pending'
            }
            console.log(`[SYNC] No matching ShopRenter image found for ${img.imagePath} (extracted: "${normalizedExtractedPath}")`)
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
    } catch (relationSyncError: any) {
      // Don't fail the entire sync if relation sync fails
      console.warn(`[SYNC] Failed to sync product-category relations for product ${product.sku}:`, relationSyncError?.message || relationSyncError)
    }

  } catch (error) {
    console.error('Error in syncProductToDatabase:', error)
    throw error
  }
}
