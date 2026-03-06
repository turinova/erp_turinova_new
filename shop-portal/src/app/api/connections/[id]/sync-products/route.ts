import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase, getTenantFromSession } from '@/lib/tenant-supabase'
import { getConnectionById } from '@/lib/connections-server'
import { Buffer } from 'buffer'
import { updateProgress, clearProgress, shouldStopSync, getProgress, incrementProgress } from '@/lib/sync-progress-store'
import { extractImagesFromProductExtend, fetchProductImages } from '@/lib/shoprenter-image-service'
import { getShopRenterRateLimiter } from '@/lib/shoprenter-rate-limiter'
import { retryWithBackoff } from '@/lib/retry-with-backoff'

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
 * Batch fetch AttributeDescriptions for multiple attributes
 * This is much faster than fetching them individually
 */
export async function batchFetchAttributeDescriptions(
  apiBaseUrl: string,
  authHeader: string,
  attributeRequests: Array<{ attributeId: string; attributeType: 'LIST' | 'INTEGER' | 'FLOAT' | 'TEXT' }>
): Promise<Map<string, { display_name: string | null; prefix: string | null; postfix: string | null }>> {
  const results = new Map<string, { display_name: string | null; prefix: string | null; postfix: string | null }>()
  
  if (attributeRequests.length === 0) {
    return results
  }

  try {
    // Build batch requests for attribute descriptions
    const batchRequests = attributeRequests.map(req => {
      let queryParam = ''
      if (req.attributeType === 'LIST') {
        queryParam = `listAttributeId=${encodeURIComponent(req.attributeId)}`
      } else if (req.attributeType === 'TEXT') {
        queryParam = `textAttributeId=${encodeURIComponent(req.attributeId)}`
      } else if (req.attributeType === 'INTEGER' || req.attributeType === 'FLOAT') {
        queryParam = `numberAttributeId=${encodeURIComponent(req.attributeId)}`
      }
      
      const languageId = 'bGFuZ3VhZ2UtbGFuZ3VhZ2VfaWQ9MQ==' // Hungarian default
      return {
        method: 'GET',
        uri: `${apiBaseUrl}/attributeDescriptions?${queryParam}&languageId=${encodeURIComponent(languageId)}&full=1`
      }
    })

    // Filter out invalid requests
    const validRequests = batchRequests.filter(req => req.uri.includes('AttributeId='))
    
    if (validRequests.length === 0) {
      return results
    }

    // Split into batches of 200 (ShopRenter limit)
    const BATCH_SIZE = 200
    for (let i = 0; i < validRequests.length; i += BATCH_SIZE) {
      const batch = validRequests.slice(i, i + BATCH_SIZE)
      const correspondingAttributeRequests = attributeRequests.slice(i, i + BATCH_SIZE)
      
      const batchPayload = {
        data: {
          requests: batch
        }
      }

      const batchResponse = await fetch(`${apiBaseUrl}/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify(batchPayload),
        signal: AbortSignal.timeout(60000) // 1 minute
      })

      if (batchResponse.ok) {
        const batchData = await batchResponse.json()
        const batchResponses = batchData.requests?.request || batchData.response?.requests?.request || []
        
        for (let j = 0; j < batchResponses.length && j < correspondingAttributeRequests.length; j++) {
          const batchItem = batchResponses[j]
          const attrReq = correspondingAttributeRequests[j]
          const statusCode = parseInt(batchItem.response?.header?.statusCode || '0', 10)
          
          if (statusCode >= 200 && statusCode < 300) {
            const data = batchItem.response?.body
            // Log the raw response structure for debugging
            console.log(`[SYNC] Batch AttributeDescription response for ${attrReq.attributeId} (type: ${attrReq.attributeType}):`, JSON.stringify(data, null, 2).substring(0, 500))
            
            // Handle different response structures from batch API
            // The response can be:
            // 1. Direct object with items array: { items: [...] }
            // 2. Nested response: { response: { items: [...] } }
            // 3. Direct description object (if full=1): { name: "...", prefix: "...", postfix: "..." }
            // 4. Pagination object with first.href (no items): { href: "...", first: { href: "..." }, ... }
            let items = data?.items || data?.response?.items || []
            
            // If data itself is a description object (full=1 might return single object)
            if (!items.length && data && (data.name || data.id)) {
              // This is a single description object, not an array
              const desc = data
              results.set(attrReq.attributeId, {
                display_name: desc.name || null,
                prefix: desc.prefix || null,
                postfix: desc.postfix || null
              })
              console.log(`[SYNC] Batch AttributeDescription (single object) for ${attrReq.attributeId}: name="${desc.name}", prefix="${desc.prefix}", postfix="${desc.postfix}"`)
            } else if (items.length > 0) {
              const desc = items[0]
              // If item only has href (not full data), we need to fetch it individually
              if (desc.href && !desc.name && !desc.id) {
                console.log(`[SYNC] Batch AttributeDescription item only has href for ${attrReq.attributeId}, fetching full data: ${desc.href}`)
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
                    const fullDesc = await fullResponse.json()
                    results.set(attrReq.attributeId, {
                      display_name: fullDesc.name || null,
                      prefix: fullDesc.prefix || null,
                      postfix: fullDesc.postfix || null
                    })
                    console.log(`[SYNC] Batch AttributeDescription (fetched from href) for ${attrReq.attributeId}: name="${fullDesc.name}", prefix="${fullDesc.prefix}", postfix="${fullDesc.postfix}"`)
                  } else {
                    console.warn(`[SYNC] Failed to fetch full AttributeDescription from href for ${attrReq.attributeId}: ${fullResponse.status}`)
                    results.set(attrReq.attributeId, { display_name: null, prefix: null, postfix: null })
                  }
                } catch (fetchError) {
                  console.warn(`[SYNC] Failed to fetch full AttributeDescription from href for ${attrReq.attributeId}:`, fetchError)
                  results.set(attrReq.attributeId, { display_name: null, prefix: null, postfix: null })
                }
              } else {
                results.set(attrReq.attributeId, {
                  display_name: desc.name || null,
                  prefix: desc.prefix || null,
                  postfix: desc.postfix || null
                })
                console.log(`[SYNC] Batch AttributeDescription (from items array) for ${attrReq.attributeId}: name="${desc.name}", prefix="${desc.prefix}", postfix="${desc.postfix}"`)
              }
            } else if (data?.first?.href || data?.href) {
              // No items array, but we have a pagination object with first.href or href
              // This means we need to fetch the first page to get the items
              const fetchUrl = data.first?.href || data.href
              console.log(`[SYNC] Batch AttributeDescription response has no items, but has href. Fetching from: ${fetchUrl}`)
              try {
                const fullResponse = await fetch(fetchUrl, {
                  method: 'GET',
                  headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': authHeader
                  },
                  signal: AbortSignal.timeout(5000)
                })
                
                if (fullResponse.ok) {
                  const fullData = await fullResponse.json()
                  const fullItems = fullData?.items || fullData?.response?.items || []
                  
                  if (fullItems.length > 0) {
                    const desc = fullItems[0]
                    results.set(attrReq.attributeId, {
                      display_name: desc.name || null,
                      prefix: desc.prefix || null,
                      postfix: desc.postfix || null
                    })
                    console.log(`[SYNC] Batch AttributeDescription (fetched from pagination href) for ${attrReq.attributeId}: name="${desc.name}", prefix="${desc.prefix}", postfix="${desc.postfix}"`)
                  } else {
                    console.warn(`[SYNC] Fetched from href but still no items found for ${attrReq.attributeId}`)
                    results.set(attrReq.attributeId, { display_name: null, prefix: null, postfix: null })
                  }
                } else {
                  console.warn(`[SYNC] Failed to fetch AttributeDescription from pagination href for ${attrReq.attributeId}: ${fullResponse.status}`)
                  results.set(attrReq.attributeId, { display_name: null, prefix: null, postfix: null })
                }
              } catch (fetchError) {
                console.warn(`[SYNC] Failed to fetch AttributeDescription from pagination href for ${attrReq.attributeId}:`, fetchError)
                results.set(attrReq.attributeId, { display_name: null, prefix: null, postfix: null })
              }
            } else {
              console.warn(`[SYNC] No AttributeDescription items found for ${attrReq.attributeId} (type: ${attrReq.attributeType}). Response data:`, JSON.stringify(data, null, 2).substring(0, 300))
              results.set(attrReq.attributeId, { display_name: null, prefix: null, postfix: null })
            }
          } else {
            const errorText = batchItem.response?.body?.error || batchItem.response?.body?.message || JSON.stringify(batchItem.response?.body || {}).substring(0, 200)
            console.warn(`[SYNC] AttributeDescription API error for ${attrReq.attributeId}: status ${statusCode} - ${errorText}`)
            results.set(attrReq.attributeId, { display_name: null, prefix: null, postfix: null })
          }
        }
      }
    }
  } catch (error) {
    console.error('[SYNC] Error batch fetching attribute descriptions:', error)
    // Return empty results on error - will fall back to internal names
  }

  return results
}

/**
 * Batch fetch AttributeWidgetDescriptions for multiple widgets to get group names
 * This fetches the label (group name) for each attribute widget
 */
export async function batchFetchAttributeWidgetDescriptions(
  apiBaseUrl: string,
  authHeader: string,
  widgetRequests: Array<{ widgetId: string; widgetType: 'LIST' | 'NUMBER' }>
): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>()
  
  if (widgetRequests.length === 0) {
    return results
  }

  try {
    // Build batch requests for widget descriptions
    const batchRequests = widgetRequests.map(req => {
      let queryParam = ''
      if (req.widgetType === 'LIST') {
        queryParam = `listAttributeWidgetId=${encodeURIComponent(req.widgetId)}`
      } else if (req.widgetType === 'NUMBER') {
        queryParam = `numberAttributeWidgetId=${encodeURIComponent(req.widgetId)}`
      }
      
      const languageId = 'bGFuZ3VhZ2UtbGFuZ3VhZ2VfaWQ9MQ==' // Hungarian default
      return {
        method: 'GET',
        uri: `${apiBaseUrl}/attributeWidgetDescriptions?${queryParam}&languageId=${encodeURIComponent(languageId)}&full=1`
      }
    })

    // Filter out invalid requests
    const validRequests = batchRequests.filter(req => req.uri.includes('WidgetId='))
    
    if (validRequests.length === 0) {
      return results
    }

    // Split into batches of 200 (ShopRenter limit)
    const BATCH_SIZE = 200
    for (let i = 0; i < validRequests.length; i += BATCH_SIZE) {
      const batch = validRequests.slice(i, i + BATCH_SIZE)
      const correspondingWidgetRequests = widgetRequests.slice(i, i + BATCH_SIZE)
      
      const batchPayload = {
        data: {
          requests: batch
        }
      }

      const batchResponse = await fetch(`${apiBaseUrl}/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify(batchPayload),
        signal: AbortSignal.timeout(60000) // 1 minute
      })

      if (batchResponse.ok) {
        const batchData = await batchResponse.json()
        const batchResponses = batchData.requests?.request || batchData.response?.requests?.request || []
        
        for (let j = 0; j < batchResponses.length && j < correspondingWidgetRequests.length; j++) {
          const batchItem = batchResponses[j]
          const widgetReq = correspondingWidgetRequests[j]
          const statusCode = parseInt(batchItem.response?.header?.statusCode || '0', 10)
          
          if (statusCode >= 200 && statusCode < 300) {
            const data = batchItem.response?.body
            const items = data?.items || data?.response?.items || []
            
            if (items.length > 0) {
              const desc = items[0]
              // Extract label - this is the group name (e.g., "Fiók", "Méret", "Szín")
              // According to ShopRenter docs: attributeWidgetDescriptions contains a "label" field
              const groupName = desc.label || null
              if (groupName) {
                console.log(`[SYNC] Found group_name "${groupName}" for widget ${widgetReq.widgetId}`)
              }
              results.set(widgetReq.widgetId, groupName)
            } else {
              console.warn(`[SYNC] No items found in widget description response for widget ${widgetReq.widgetId}`)
              results.set(widgetReq.widgetId, null)
            }
          } else {
            const errorMsg = batchItem.response?.body?.error || batchItem.response?.body?.message || 'Unknown error'
            console.warn(`[SYNC] Failed to fetch widget description for ${widgetReq.widgetId}: status ${statusCode}, error: ${errorMsg}`)
            results.set(widgetReq.widgetId, null)
          }
        }
      }
    }
  } catch (error) {
    console.error('[SYNC] Error batch fetching attribute widget descriptions:', error)
    // Return empty results on error - will fall back to null group_name
  }

  return results
}

/**
 * Fetch AttributeDescription for an attribute to get display name
 * (Kept for backward compatibility, but batchFetchAttributeDescriptions is preferred)
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

    // Get tenant-aware Supabase client - CRITICAL: No fallback to default database
    const supabase = await getTenantSupabase()

    // Get tenant context for tenant-specific rate limiting
    const tenant = await getTenantFromSession()
    const tenantId = tenant?.id

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

    // Check if sync is already running for this connection (prevent concurrent syncs)
    const existingProgress = getProgress(connectionId)
    if (existingProgress && (existingProgress.status === 'syncing' || existingProgress.status === 'starting')) {
      console.log(`[SYNC] Sync already running for connection ${connectionId}. Status: ${existingProgress.status}, Progress: ${existingProgress.synced}/${existingProgress.total}`)
      return NextResponse.json({ 
        success: false, 
        error: 'Szinkronizálás már folyamatban van erre a kapcsolatra.',
        details: `Jelenleg ${existingProgress.synced}/${existingProgress.total} termék szinkronizálva. Kérjük, várja meg a befejezését vagy állítsa le az előző szinkronizálást.`,
        existingProgress: {
          synced: existingProgress.synced,
          total: existingProgress.total,
          status: existingProgress.status
        }
      }, { status: 409 })
    }

    // Get connection
    const connection = await getConnectionById(connectionId)
    if (!connection || connection.connection_type !== 'shoprenter') {
      return NextResponse.json({ 
        success: false,
        error: 'Kapcsolat nem található vagy érvénytelen típus',
        details: 'Csak ShopRenter kapcsolatokhoz szinkronizálható termékek.'
      }, { status: 404 })
    }

    // Validate connection is active
    if (!connection.is_active) {
      return NextResponse.json({ 
        success: false,
        error: 'A kapcsolat inaktív',
        details: 'Kérjük, aktiválja a kapcsolatot a szinkronizálás előtt a kapcsolat szerkesztése menüpontban.'
      }, { status: 400 })
    }

    // Validate connection has required credentials
    if (!connection.username || !connection.password) {
      return NextResponse.json({ 
        success: false,
        error: 'Hiányzó hitelesítési adatok',
        details: 'Kérjük, ellenőrizze, hogy a kapcsolat rendelkezik-e felhasználónévvel és jelszóval. Frissítse a kapcsolat beállításait.'
      }, { status: 400 })
    }

    // Extract shop name
    const shopName = extractShopNameFromUrl(connection.api_url)
    if (!shopName) {
      return NextResponse.json({ 
        success: false,
        error: 'Érvénytelen API URL formátum',
        details: 'Az API URL formátuma nem megfelelő. Kérjük, ellenőrizze a kapcsolat beállításait. Várt formátum: https://shopname.api.myshoprenter.hu'
      }, { status: 400 })
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
        // Extract Product Class ID and fetch name (for group_name)
        let productClassName: string | null = null
        if (data.productClass) {
          let productClassId: string | null = null
          if (typeof data.productClass === 'object' && data.productClass.id) {
            productClassId = data.productClass.id
          } else if (data.productClass.href) {
            // Extract ID from href like: "http://shopname.api.myshoprenter.hu/productClasses/cHJvZHVjdENsYXNzLXByb2R1Y3RfY2xhc3NfaWQ9MQ=="
            const hrefParts = data.productClass.href.split('/')
            productClassId = hrefParts[hrefParts.length - 1] || null
          }
          
          // Fetch Product Class name if ID exists
          if (productClassId && apiUrl && authHeader) {
            try {
              const classUrl = `${apiUrl}/productClasses/${productClassId}?full=1`
              const classResponse = await fetch(classUrl, {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'Authorization': authHeader
                },
                signal: AbortSignal.timeout(10000)
              })
              
              if (classResponse.ok) {
                const classData = await classResponse.json()
                productClassName = classData?.name || null
                if (productClassName) {
                  console.log(`[SYNC] Found Product Class name "${productClassName}" for single product sync`)
                }
              } else {
                console.warn(`[SYNC] Failed to fetch Product Class ${productClassId}: ${classResponse.status}`)
              }
            } catch (classError) {
              console.warn(`[SYNC] Failed to fetch Product Class name for single product:`, classError)
            }
          }
        }
        
        // Collect attribute IDs and batch fetch descriptions (same as batch sync)
        const attributeRequests: Array<{ attributeId: string; attributeType: 'LIST' | 'INTEGER' | 'FLOAT' | 'TEXT' }> = []
        if (data.productAttributeExtend && Array.isArray(data.productAttributeExtend)) {
          data.productAttributeExtend.forEach((attr: any) => {
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
              console.log(`[SYNC] Single product: Collected attribute "${attr.name}" with ID "${attributeId}" (type: ${attr.type})`)
            } else {
              console.warn(`[SYNC] Single product: Could not extract attribute ID for "${attr.name}" (href: ${attr.href}, id: ${attr.id})`)
            }
          })
        }
        
        // Batch fetch attribute descriptions (same method as batch sync)
        let attributeDescriptionsMap = new Map<string, { display_name: string | null; prefix: string | null; postfix: string | null }>()
        if (attributeRequests.length > 0 && apiUrl && authHeader) {
          console.log(`[SYNC] Batch fetching ${attributeRequests.length} attribute descriptions for single product sync`)
          attributeDescriptionsMap = await batchFetchAttributeDescriptions(
            apiUrl,
            authHeader,
            attributeRequests
          )
          console.log(`[SYNC] Fetched ${attributeDescriptionsMap.size} attribute descriptions for single product`)
        }
        
        // For single product sync, use forceSync from request (defaults to false)
        // Pass both attributeDescriptionsMap and productClassName
        await syncProductToDatabase(supabase, connection, data, forceSync, apiUrl, authHeader, attributeDescriptionsMap, tenantId, undefined, productClassName)
        return NextResponse.json({ success: true, synced: 1 })
      } catch (error) {
        return NextResponse.json({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Ismeretlen hiba' 
        }, { status: 500 })
      }
    }

    // For bulk sync, check if user wants incremental sync (default) or force sync
    // If forceSync is not explicitly set to true, use incremental sync
    const useIncrementalSync = !forceSync

    // Get existing products with sync timestamps from ERP for incremental sync
    // We need:
    // - last_synced_from_shoprenter_at: When we last pulled FROM ShopRenter
    // - last_synced_to_shoprenter_at: When we last pushed TO ShopRenter
    // - updated_at: When product was last modified in ERP
    // This prevents overwriting ERP changes that were just synced to ShopRenter
    let lastSyncedMap = new Map<string, { 
      last_synced_from: string | null; 
      last_synced_to: string | null;
      updated_at: string | null 
    }>()
    if (useIncrementalSync) {
      console.log(`[SYNC] Using incremental sync - will only sync changed products`)
      
      // Fetch all existing products in batches to avoid Supabase's 1000 row limit
      const batchSize = 1000
      let allExistingProducts: any[] = []
      let hasMore = true
      let offset = 0
      
      while (hasMore) {
        const { data: existingProducts, error } = await supabase
          .from('shoprenter_products')
          .select('shoprenter_id, last_synced_from_shoprenter_at, last_synced_to_shoprenter_at, updated_at')
          .eq('connection_id', connectionId)
          .is('deleted_at', null)
          .range(offset, offset + batchSize - 1)
        
        if (error) {
          console.error(`[SYNC] Error fetching existing products (offset ${offset}):`, error)
          break
        }
        
        if (existingProducts && existingProducts.length > 0) {
          allExistingProducts = allExistingProducts.concat(existingProducts)
          hasMore = existingProducts.length === batchSize
          offset += batchSize
        } else {
          hasMore = false
        }
      }
      
      if (allExistingProducts.length > 0) {
        lastSyncedMap = new Map(
          allExistingProducts.map(p => [
            p.shoprenter_id, 
            { 
              last_synced_from: p.last_synced_from_shoprenter_at, 
              last_synced_to: p.last_synced_to_shoprenter_at,
              updated_at: p.updated_at 
            }
          ])
        )
        console.log(`[SYNC] Found ${lastSyncedMap.size} existing products in ERP (fetched in ${Math.ceil(allExistingProducts.length / batchSize)} batches)`)
      } else {
        console.log(`[SYNC] No existing products found in ERP`)
      }
    } else {
      console.log(`[SYNC] Using force sync - will sync all products`)
    }

    // For bulk sync, use Batch API for efficiency
    // First, get all product IDs with timestamps (paginated)
    const allProductIds: string[] = []
    const shoprenterProductIds = new Set<string>() // Track all products in ShopRenter for deletion detection
    let page = 0
    const pageSize = 200
    let hasMorePages = true
    let firstPageData: any = null
    let newProductsCount = 0
    let changedProductsCount = 0
    let skippedProductsCount = 0

    while (hasMorePages) {
      // Use full=1 to get product IDs and timestamps in the response
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

      // Diagnostic logging for dateUpdated availability (first page only)
      if (page === 0 && items.length > 0 && useIncrementalSync) {
        const sampleItems = items.slice(0, 3)
        const dateUpdatedStats = {
          total: sampleItems.length,
          hasDateUpdated: sampleItems.filter(i => i.dateUpdated || i.date_updated).length,
          missingDateUpdated: sampleItems.filter(i => !i.dateUpdated && !i.date_updated).length
        }
        
        console.log(`[SYNC] First page diagnostic - dateUpdated availability:`, {
          ...dateUpdatedStats,
          sample: sampleItems.map(i => ({
            id: i.id?.substring(0, 20) + '...',
            sku: i.sku,
            hasDateUpdated: !!(i.dateUpdated || i.date_updated),
            dateUpdated: i.dateUpdated || i.date_updated || 'MISSING'
          }))
        })
        
        if (dateUpdatedStats.missingDateUpdated > 0) {
          console.warn(`[SYNC] WARNING: ${dateUpdatedStats.missingDateUpdated}/${dateUpdatedStats.total} sample products missing dateUpdated. This may indicate an API issue.`)
        }
      }

      for (const item of items) {
        let productId: string | null = null
        
        if (item.id) {
          productId = item.id
        } else if (item.href) {
          // Extract ID from href (format: /products/cHJvZHVjdC1wcm9kdWN0X2lkPTI0NTE=)
          const hrefParts = item.href.split('/')
          const lastPart = hrefParts[hrefParts.length - 1]
          if (lastPart && lastPart !== 'products') {
            productId = lastPart
          }
        }

        if (!productId) {
          console.warn(`[SYNC] Item without ID or href on page ${page}:`, Object.keys(item))
          continue
        }

        // Track all products in ShopRenter for deletion detection
        shoprenterProductIds.add(productId)

        // Incremental sync: Only include if changed or new
        // CRITICAL: Prevent syncing products that were modified in ERP more recently than ShopRenter
        // This prevents overwriting ERP changes that were just synced to ShopRenter
        if (useIncrementalSync) {
          const productSyncInfo = lastSyncedMap.get(productId)
          // Try multiple possible field names for dateUpdated (fixed: removed duplicate check)
          const dateUpdated = item.dateUpdated || item.date_updated || null
          
          // Determine if we should sync:
          // 1. New product (not in ERP) -> always sync
          // 2. ShopRenter updated AND:
          //    - Never synced before, OR
          //    - ShopRenter updated after last sync, AND
          //    - Product wasn't modified in ERP more recently than ShopRenter's update
          let shouldSync = false
          let skipReason = ''
          
          if (!productSyncInfo) {
            // New product - always sync
            shouldSync = true
            newProductsCount++
          } else if (!dateUpdated) {
            // FIXED: Industry-standard fallback for missing dateUpdated
            // Strategy: Use time-based heuristic to avoid unnecessary syncs
            const lastSyncedFrom = productSyncInfo.last_synced_from ? new Date(productSyncInfo.last_synced_from) : null
            
            if (!lastSyncedFrom) {
              // Never synced before but product exists in ERP - sync to establish baseline
              shouldSync = true
              changedProductsCount++
              skipReason = 'dateUpdated missing, but never synced - syncing to establish baseline'
            } else {
              // We have sync history - use time-based heuristic
              const hoursSinceLastSync = (Date.now() - lastSyncedFrom.getTime()) / (1000 * 60 * 60)
              const RECENT_SYNC_THRESHOLD_HOURS = 24 // Configurable threshold
              
              if (hoursSinceLastSync < RECENT_SYNC_THRESHOLD_HOURS) {
                // Synced recently - assume API issue, not a change
                shouldSync = false
                skipReason = `dateUpdated missing, but synced ${Math.round(hoursSinceLastSync * 10) / 10}h ago (assuming API issue, not change)`
                skippedProductsCount++
                
                // Log first few for monitoring
                if (skippedProductsCount <= 5) {
                  console.warn(`[SYNC] Product ${productId}: dateUpdated missing from API. Last synced ${Math.round(hoursSinceLastSync * 10) / 10}h ago. Skipping.`)
                }
              } else {
                // Last sync was old - could be a real change, but we can't tell
                // Industry standard: Skip to avoid unnecessary syncs, but log for admin review
                shouldSync = false
                skipReason = `dateUpdated missing, last synced ${Math.round(hoursSinceLastSync * 10) / 10}h ago (skipping to avoid unnecessary sync)`
                skippedProductsCount++
                
                // Log for admin review (but don't spam)
                if (skippedProductsCount <= 10) {
                  console.warn(`[SYNC] Product ${productId}: dateUpdated missing, last synced ${Math.round(hoursSinceLastSync * 10) / 10}h ago. Consider force sync if needed.`)
                }
              }
            }
          } else {
            // dateUpdated is available - use precise comparison
            let shoprenterUpdated: Date | null = null
            
            try {
              // Parse dateUpdated - handle ISO format (e.g., "2013-08-08T12:30:00")
              shoprenterUpdated = new Date(dateUpdated)
              
              // Validate date
              if (isNaN(shoprenterUpdated.getTime())) {
                // Try alternative format (e.g., "2013-08-08 12:30:00")
                shoprenterUpdated = new Date(dateUpdated.replace(' ', 'T'))
              }
              
              if (isNaN(shoprenterUpdated.getTime())) {
                // Invalid date - fall back to time-based heuristic
                console.warn(`[SYNC] Invalid dateUpdated format for product ${productId}: ${dateUpdated}. Using fallback logic.`)
                const lastSyncedFrom = productSyncInfo.last_synced_from ? new Date(productSyncInfo.last_synced_from) : null
                if (lastSyncedFrom) {
                  const hoursSinceLastSync = (Date.now() - lastSyncedFrom.getTime()) / (1000 * 60 * 60)
                  if (hoursSinceLastSync < 24) {
                    shouldSync = false
                    skipReason = 'invalid dateUpdated format, but synced recently'
                    skippedProductsCount++
                  } else {
                    shouldSync = true
                    changedProductsCount++
                    skipReason = 'invalid dateUpdated format, last sync was old'
                  }
                } else {
                  shouldSync = true
                  changedProductsCount++
                }
              }
            } catch (error) {
              console.warn(`[SYNC] Error parsing dateUpdated for product ${productId}:`, error)
              // Fall back to time-based heuristic
              const lastSyncedFrom = productSyncInfo.last_synced_from ? new Date(productSyncInfo.last_synced_from) : null
              if (lastSyncedFrom) {
                const hoursSinceLastSync = (Date.now() - lastSyncedFrom.getTime()) / (1000 * 60 * 60)
                shouldSync = hoursSinceLastSync >= 24
                skipReason = `dateUpdated parse error, using time heuristic (${Math.round(hoursSinceLastSync * 10) / 10}h since last sync)`
                if (shouldSync) {
                  changedProductsCount++
                } else {
                  skippedProductsCount++
                }
              } else {
                shouldSync = true
                changedProductsCount++
              }
            }
            
            if (shoprenterUpdated && !isNaN(shoprenterUpdated.getTime())) {
              // Valid date - proceed with precise comparison
              const lastSyncedFrom = productSyncInfo.last_synced_from ? new Date(productSyncInfo.last_synced_from) : null
              const lastSyncedTo = productSyncInfo.last_synced_to ? new Date(productSyncInfo.last_synced_to) : null
              const erpUpdated = productSyncInfo.updated_at ? new Date(productSyncInfo.updated_at) : null
              
              // Check if ShopRenter was updated after last FROM sync
              const shoprenterUpdatedAfterFromSync = !lastSyncedFrom || shoprenterUpdated > lastSyncedFrom
              
              if (!shoprenterUpdatedAfterFromSync) {
                shouldSync = false
                skipReason = 'not updated in ShopRenter since last FROM sync'
              } else if (lastSyncedTo && shoprenterUpdated <= lastSyncedTo) {
                shouldSync = false
                skipReason = 'synced TO ShopRenter more recently than ShopRenter update (likely our push)'
              } else if (erpUpdated && erpUpdated >= shoprenterUpdated) {
                shouldSync = false
                skipReason = 'modified in ERP at same time or more recently'
              } else {
                shouldSync = true
                changedProductsCount++
              }
            }
          }
          
          if (shouldSync) {
            allProductIds.push(productId)
          } else {
            skippedProductsCount++
            if (skipReason && skippedProductsCount <= 10) {
              // Log first 10 skip reasons for debugging
              console.log(`[SYNC] Skipping product ${productId}: ${skipReason}`)
            }
          }
        } else {
          // Force sync: Include all products
          allProductIds.push(productId)
        }
      }

      // Check if there are more pages
      let pageCount = 0
      if (listData.pageCount !== undefined) {
        pageCount = typeof listData.pageCount === 'string' ? parseInt(listData.pageCount, 10) : listData.pageCount
      } else if (listData.response?.pageCount !== undefined) {
        pageCount = typeof listData.response.pageCount === 'string' ? parseInt(listData.response.pageCount, 10) : listData.response.pageCount
      }

      if (pageCount > 0) {
        hasMorePages = page < pageCount - 1
      } else {
        hasMorePages = items.length === pageSize
      }

      if (useIncrementalSync) {
        console.log(`[SYNC] Page ${page}: ${items.length} items, ${allProductIds.length - (allProductIds.length - (newProductsCount + changedProductsCount))} to sync (${newProductsCount} new, ${changedProductsCount} changed, ${skippedProductsCount} skipped)`)
      } else {
        console.log(`[SYNC] Page ${page}: pageCount=${pageCount}, items=${items.length}, hasMorePages=${hasMorePages}, totalIds=${allProductIds.length}`)
      }

      page++

      // Minimal delay between page requests
      if (hasMorePages) {
        await new Promise(resolve => setTimeout(resolve, 50))
      }
    }

    // Deletion detection: Find products in ERP that no longer exist in ShopRenter
    let deletedCount = 0
    if (shoprenterProductIds.size > 0) {
      const { data: erpProducts } = await supabase
        .from('shoprenter_products')
        .select('id, shoprenter_id, sku')
        .eq('connection_id', connectionId)
        .is('deleted_at', null)
      
      if (erpProducts) {
        const deletedProducts = erpProducts.filter(
          p => !shoprenterProductIds.has(p.shoprenter_id)
        )
        
        if (deletedProducts.length > 0) {
          const { error: deleteError } = await supabase
            .from('shoprenter_products')
            .update({ 
              deleted_at: new Date().toISOString(),
              status: 0,
              sync_status: 'deleted',
              last_synced_from_shoprenter_at: new Date().toISOString() // Track deletion detection sync
            })
            .in('id', deletedProducts.map(p => p.id))
          
          if (!deleteError) {
            deletedCount = deletedProducts.length
            console.log(`[SYNC] Marked ${deletedCount} products as deleted`)
          } else {
            console.error(`[SYNC] Error marking products as deleted:`, deleteError)
          }
        }
      }
    }

    if (useIncrementalSync) {
      console.log(`[SYNC] Incremental sync summary: ${allProductIds.length} to sync (${newProductsCount} new, ${changedProductsCount} changed), ${skippedProductsCount} skipped, ${deletedCount} deleted`)
    } else {
      console.log(`[SYNC] Total product IDs collected: ${allProductIds.length}, ${deletedCount} deleted`)
    }

    if (allProductIds.length === 0) {
      // For incremental sync, 0 products is a success (everything is up to date)
      // For force sync, 0 products might indicate an issue
      if (useIncrementalSync) {
        console.log(`[SYNC] Incremental sync: No products to sync - everything is up to date`)
        clearProgress(connectionId)
        return NextResponse.json({ 
          success: true, 
          message: 'Nincs szinkronizálandó termék. Minden termék naprakész.',
          total: 0,
          synced: 0,
          skipped: skippedProductsCount,
          newProducts: 0,
          changedProducts: 0,
          deletedProducts: deletedCount
        }, { status: 200 })
      } else {
        // Force sync with 0 products - this might be an issue
        console.error(`[SYNC] No products found. First page data:`, JSON.stringify(firstPageData, null, 2).substring(0, 500))
        clearProgress(connectionId)
        return NextResponse.json({ 
          success: false, 
          error: 'Nem található termék a webshopban. Ellenőrizze, hogy a kapcsolat helyes-e és hogy vannak-e termékek a webshopban.' 
        }, { status: 404 })
      }
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
    // Pass incremental sync stats to background process
    const incrementalStats = useIncrementalSync ? {
      newProducts: newProductsCount,
      changedProducts: changedProductsCount,
      skippedProducts: skippedProductsCount,
      deletedProducts: deletedCount
    } : undefined
    
    processSyncInBackground(supabase, connection, allProductIds, batches, connectionId, forceSync, apiUrl, authHeader, request, tenantId, user.id, user.email || null, incrementalStats).catch(error => {
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
  request: NextRequest,
  tenantId?: string,
  userId?: string,
  userEmail?: string | null,
  incrementalStats?: { newProducts: number; changedProducts: number; skippedProducts: number; deletedProducts: number }
) {
  // Initialize variables at function scope so they're accessible in catch block
  let syncedCount = 0
  let errorCount = 0
  const errors: string[] = []
  const totalProducts = allProductIds.length
  const totalBatches = batches.length
  const syncStartTime = new Date()
  // Track synced product IDs for post-sync optimization
  const syncedProductIds: string[] = [] // Store ERP UUIDs of synced products

  // For incremental sync, total_products should be total evaluated (synced + skipped)
  // For force sync, total_products is just the products to sync
  const totalProductsEvaluated = incrementalStats 
    ? totalProducts + (incrementalStats.skippedProducts || 0)
    : totalProducts

  // Create sync audit log entry
  let auditLogId: string | null = null
  try {
      if (tenantId && userId) {
        const syncType = forceSync ? 'full' : 'incremental'
        const { data: auditLog, error: auditError } = await supabase
          .from('sync_audit_logs')
          .insert({
            connection_id: connectionId,
            sync_type: syncType,
            sync_direction: 'from_shoprenter',
            user_id: userId,
            user_email: userEmail,
            total_products: totalProductsEvaluated, // Total products evaluated (synced + skipped for incremental)
            synced_count: 0,
            error_count: 0,
            skipped_count: incrementalStats?.skippedProducts || 0,
            started_at: syncStartTime.toISOString(),
            status: 'running',
            metadata: {
              forceSync: forceSync,
              batchSize: 200,
              totalBatches: totalBatches,
              incrementalStats: incrementalStats || null
            }
          })
          .select('id')
          .single()
      
      if (!auditError && auditLog) {
        auditLogId = auditLog.id
        console.log(`[SYNC] Created audit log entry: ${auditLogId}`)
      } else {
        console.warn(`[SYNC] Failed to create audit log:`, auditError)
      }
    }
  } catch (auditInitError) {
    console.warn(`[SYNC] Error creating audit log (non-fatal):`, auditInitError)
  }

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
    console.log(`[SYNC] Using optimized parallel batch processing (2 concurrent batches)`)

    // Process batches in parallel groups (2-3 at a time) for better performance
    const CONCURRENT_BATCHES = 2 // Process 2 batches in parallel
    const processSingleBatch = async (batch: string[], batchIndex: number) => {
      const batchResults = {
        synced: 0,
        errors: 0,
        errorMessages: [] as string[]
      }
        
      // Check if sync should stop
      if (shouldStopSync(connectionId)) {
        return batchResults
      }

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
        const batchResponse = await fetch(`${apiUrl}/batch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': authHeader
          },
          body: JSON.stringify(batchPayload),
          signal: AbortSignal.timeout(600000) // 10 minutes
        })

        if (!batchResponse.ok) {
          const errorText = await batchResponse.text().catch(() => 'Unknown error')
          batchResults.errors += batch.length
          batchResults.errorMessages.push(`Batch ${batchIndex + 1} hiba: ${batchResponse.status} - ${errorText.substring(0, 200)}`)
          return batchResults
        }

        // Parse batch response
        let batchData
        try {
          const batchText = await batchResponse.text()
          if (!batchText || batchText.trim().length === 0) {
            batchResults.errors += batch.length
            batchResults.errorMessages.push(`Batch ${batchIndex + 1}: Üres válasz`)
            return batchResults
          }
          batchData = JSON.parse(batchText)
        } catch (parseError) {
          batchResults.errors += batch.length
          batchResults.errorMessages.push(`Batch ${batchIndex + 1}: JSON parse hiba - ${parseError instanceof Error ? parseError.message : 'Ismeretlen'}`)
          return batchResults
        }

        // Process batch responses
        const batchResponses = batchData.requests?.request || batchData.response?.requests?.request || []
        
        // Collect all attribute IDs from this batch for batch fetching
        const attributeRequests: Array<{ attributeId: string; attributeType: 'LIST' | 'INTEGER' | 'FLOAT' | 'TEXT' }> = []
        
        // Collect Product Class IDs from products (for group_name)
        const productClassIds = new Set<string>()
        const productToClassMap = new Map<string, string>() // productId -> productClassId

        for (let i = 0; i < batchResponses.length; i++) {
          const batchItem = batchResponses[i]
          const statusCode = parseInt(batchItem.response?.header?.statusCode || '0', 10)
          
          if (statusCode >= 200 && statusCode < 300) {
            const product = batchItem.response?.body
            if (product && product.id) {
              // Extract Product Class ID for group_name
              if (product.productClass) {
                let productClassId: string | null = null
                if (typeof product.productClass === 'object' && product.productClass.id) {
                  productClassId = product.productClass.id
                } else if (product.productClass.href) {
                  // Extract ID from href like: "http://shopname.api.myshoprenter.hu/productClasses/cHJvZHVjdENsYXNzLXByb2R1Y3RfY2xhc3NfaWQ9MQ=="
                  const hrefParts = product.productClass.href.split('/')
                  productClassId = hrefParts[hrefParts.length - 1] || null
                }
                
                if (productClassId) {
                  productClassIds.add(productClassId)
                  productToClassMap.set(product.id, productClassId)
                }
              }
              
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
          }
        }

        // Batch fetch Product Class details to get names (for group_name)
        const productClassNamesMap = new Map<string, string | null>()
        if (productClassIds.size > 0 && apiUrl && authHeader) {
          console.log(`[SYNC] Batch fetching ${productClassIds.size} Product Class details for batch ${batchIndex + 1}`)
          try {
            const productClassArray = Array.from(productClassIds)
            const BATCH_SIZE = 200
            
            for (let i = 0; i < productClassArray.length; i += BATCH_SIZE) {
              const batch = productClassArray.slice(i, i + BATCH_SIZE)
              const batchRequests = batch.map(classId => ({
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
                
                for (let j = 0; j < batchResponses.length && j < batch.length; j++) {
                  const batchItem = batchResponses[j]
                  const classId = batch[j]
                  const statusCode = parseInt(batchItem.response?.header?.statusCode || '0', 10)
                  
                  if (statusCode >= 200 && statusCode < 300) {
                    const productClass = batchItem.response?.body
                    const className = productClass?.name || null
                    productClassNamesMap.set(classId, className)
                    if (className) {
                      console.log(`[SYNC] Found Product Class name "${className}" for ID ${classId}`)
                    }
                  } else {
                    productClassNamesMap.set(classId, null)
                    console.warn(`[SYNC] Failed to fetch Product Class ${classId}: status ${statusCode}`)
                  }
                }
              } else {
                console.warn(`[SYNC] Failed to fetch Product Classes batch: ${batchResponse.status}`)
                // Set all to null on batch failure
                batch.forEach(classId => productClassNamesMap.set(classId, null))
              }
            }
            
            console.log(`[SYNC] Fetched ${productClassNamesMap.size} Product Class names`)
          } catch (error) {
            console.warn(`[SYNC] Error fetching Product Classes:`, error)
            // Set all to null on error
            productClassIds.forEach(classId => productClassNamesMap.set(classId, null))
          }
        }

        // Batch fetch all attribute descriptions at once
        let attributeDescriptionsMap = new Map<string, { display_name: string | null; prefix: string | null; postfix: string | null }>()
        if (attributeRequests.length > 0 && apiUrl && authHeader) {
          console.log(`[SYNC] Batch fetching ${attributeRequests.length} attribute descriptions for batch ${batchIndex + 1}`)
          attributeDescriptionsMap = await batchFetchAttributeDescriptions(
            apiUrl,
            authHeader,
            attributeRequests
          )
          console.log(`[SYNC] Fetched ${attributeDescriptionsMap.size} attribute descriptions`)
        }

        // Create map: productId -> productClassId -> productClassName (for group_name)
        // This will be used in syncProductToDatabase to set group_name for all attributes
        const productToClassNameMap = new Map<string, string | null>()
        productToClassMap.forEach((classId, productId) => {
          const className = productClassNamesMap.get(classId) || null
          productToClassNameMap.set(productId, className)
        })

        // DEPRECATED: Fetch full attributes to get widget information, then fetch widget descriptions for group names
        // This is kept as fallback but Product Class name takes priority
        let attributeGroupNamesMap = new Map<string, string | null>()
        if (attributeRequests.length > 0 && apiUrl && authHeader) {
          try {
            // Build batch requests to fetch full attributes
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
              // Split into batches of 200
              const BATCH_SIZE = 200
              const widgetRequests: Array<{ widgetId: string; widgetType: 'LIST' | 'NUMBER'; attributeId: string }> = []
              
              for (let i = 0; i < attributeFetchRequests.length; i += BATCH_SIZE) {
                const batch = attributeFetchRequests.slice(i, i + BATCH_SIZE)
                const correspondingAttributeRequests = attributeRequests.slice(i, i + BATCH_SIZE)
                
                const batchPayload = {
                  data: {
                    requests: batch
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
                  
                  for (let j = 0; j < batchResponses.length && j < correspondingAttributeRequests.length; j++) {
                    const batchItem = batchResponses[j]
                    const attrReq = correspondingAttributeRequests[j]
                    const statusCode = parseInt(batchItem.response?.header?.statusCode || '0', 10)
                    
                    if (statusCode >= 200 && statusCode < 300) {
                      const attrData = batchItem.response?.body
                      
                      // Extract widget href based on attribute type
                      let widgetHref: string | null = null
                      if (attrReq.attributeType === 'LIST' && attrData.listAttributeWidget?.href) {
                        widgetHref = attrData.listAttributeWidget.href
                      } else if ((attrReq.attributeType === 'INTEGER' || attrReq.attributeType === 'FLOAT') && attrData.numberAttributeWidget?.href) {
                        widgetHref = attrData.numberAttributeWidget.href
                      }
                      // TEXT attributes usually don't have widgets
                      
                      if (widgetHref) {
                        // Extract widget ID from href
                        const hrefParts = widgetHref.split('/')
                        const widgetId = hrefParts[hrefParts.length - 1] || null
                        
                        if (widgetId) {
                          widgetRequests.push({
                            widgetId,
                            widgetType: attrReq.attributeType === 'LIST' ? 'LIST' : 'NUMBER',
                            attributeId: attrReq.attributeId
                          })
                        }
                      } else {
                        // No widget for this attribute
                        attributeGroupNamesMap.set(attrReq.attributeId, null)
                      }
                    }
                  }
                }
              }

              // Batch fetch widget descriptions to get group names
              if (widgetRequests.length > 0) {
                console.log(`[SYNC] Batch fetching ${widgetRequests.length} widget descriptions for batch ${batchIndex + 1}`)
                const widgetDescriptionsMap = await batchFetchAttributeWidgetDescriptions(
                  apiUrl,
                  authHeader,
                  widgetRequests.map(w => ({ widgetId: w.widgetId, widgetType: w.widgetType }))
                )
                console.log(`[SYNC] Fetched ${widgetDescriptionsMap.size} widget descriptions`)
                
                // Map widget IDs back to attribute IDs
                for (const widgetReq of widgetRequests) {
                  const groupName = widgetDescriptionsMap.get(widgetReq.widgetId) || null
                  attributeGroupNamesMap.set(widgetReq.attributeId, groupName)
                }
              }
            }
          } catch (error) {
            console.warn(`[SYNC] Error fetching attribute widget information:`, error)
            // Continue without group names - attributes will have group_name: null
          }
        }

        // Collect all valid products for batch processing
        const productsToSync: Array<{ product: any; batchItem: any }> = []
        for (const batchItem of batchResponses) {
          const statusCode = parseInt(batchItem.response?.header?.statusCode || '0', 10)
          
          if (statusCode >= 200 && statusCode < 300) {
            const product = batchItem.response?.body
            if (product && product.id) {
              productsToSync.push({ product, batchItem })
            } else {
              batchResults.errors++
              batchResults.errorMessages.push(`Termék: Hiányzó adatok a válaszban`)
            }
          } else {
            batchResults.errors++
            const errorMsg = batchItem.response?.body?.message || `HTTP ${statusCode}`
            batchResults.errorMessages.push(`Termék ${batchItem.uri}: ${errorMsg}`)
          }
        }

        // Process products sequentially to avoid overwhelming the API with image requests
        // The rate limiter will handle the 3 req/sec limit, but sequential processing prevents
        // too many requests from queuing up at once
        for (let productIdx = 0; productIdx < productsToSync.length; productIdx++) {
          const { product, batchItem } = productsToSync[productIdx]
          
          if (shouldStopSync(connectionId)) {
            return batchResults
          }

          // Update batch progress for UI feedback
          updateProgress(connectionId, {
            currentBatch: batchIndex + 1,
            totalBatches: batches.length,
            batchProgress: productIdx + 1
          })

          try {
            // Sync product and get the ERP UUID if available
            // Pass Product Class name map for group_name
            const productClassName = productToClassNameMap.get(product.id) || null
            const result = await syncProductToDatabase(supabase, connection, product, forceSync, apiUrl, authHeader, attributeDescriptionsMap, tenantId, attributeGroupNamesMap, productClassName)
            batchResults.synced++
            
            // Track synced product ERP UUID for post-sync optimization
            if (result && result.productId) {
              syncedProductIds.push(result.productId)
            } else {
              // Fallback: Try to find the product by shoprenter_id
              const { data: syncedProduct } = await supabase
                .from('shoprenter_products')
                .select('id')
                .eq('connection_id', connection.id)
                .eq('shoprenter_id', product.id)
                .single()
              
              if (syncedProduct) {
                syncedProductIds.push(syncedProduct.id)
              }
            }
            
            // Update progress after EACH product for real-time updates
            incrementProgress(connectionId, { synced: 1 })
          } catch (error) {
            batchResults.errors++
            const errorMsg = error instanceof Error ? error.message : 'Ismeretlen hiba'
            batchResults.errorMessages.push(`Termék ${product.sku || product.id}: ${errorMsg}`)
            // Update error count immediately
            incrementProgress(connectionId, { errors: 1 })
          }
        }
      } catch (batchError) {
        batchResults.errors += batch.length
        batchResults.errorMessages.push(`Batch ${batchIndex + 1} hiba: ${batchError instanceof Error ? batchError.message : 'Ismeretlen hiba'}`)
      }

      return batchResults
    }

    // Process batches in parallel groups
    for (let i = 0; i < batches.length; i += CONCURRENT_BATCHES) {
      // Check if sync should stop
      if (shouldStopSync(connectionId)) {
        console.log(`[SYNC] Sync stopped by user at batch group ${Math.floor(i / CONCURRENT_BATCHES) + 1}`)
        updateProgress(connectionId, {
          status: 'stopped',
          synced: syncedCount,
          current: syncedCount + errorCount,
          errors: errorCount
        })
        break
      }

      const batchGroup = batches.slice(i, i + CONCURRENT_BATCHES)
      const groupIndex = Math.floor(i / CONCURRENT_BATCHES)
      
      console.log(`[SYNC] Processing batch group ${groupIndex + 1}/${Math.ceil(batches.length / CONCURRENT_BATCHES)} (${batchGroup.length} batches in parallel)`)
      
    // Process batches in parallel, but update progress as each completes
    // This gives us both speed (parallel) and frequent progress updates
    const groupResults = { synced: 0, errors: 0, errorMessages: [] as string[] }
    
    // Create promises that update progress when each batch completes
    const batchPromises = batchGroup.map(async (batch, batchIdx) => {
      const batchIndex = i + batchIdx
      const result = await processSingleBatch(batch, batchIndex)
      
      // Update local counters for logging
      syncedCount += result.synced
      errorCount += result.errors
      errors.push(...result.errorMessages)
      
      // Progress is already updated per-product, so we don't need to increment here
      // Just get updated progress for logging
      const currentProgress = getProgress(connectionId)
      const currentSynced = currentProgress?.synced || 0
      
      console.log(`[SYNC] Batch ${batchIndex + 1} completed: ${result.synced} synced, ${result.errors} errors (Total: ${currentSynced}/${totalProducts})`)
      
      return result
    })
    
    // Wait for all batches to complete
    const batchResultsArray = await Promise.all(batchPromises)
    
    // Aggregate for logging (counters already updated above)
    groupResults.synced = batchResultsArray.reduce((sum, r) => sum + r.synced, 0)
    groupResults.errors = batchResultsArray.reduce((sum, r) => sum + r.errors, 0)
    groupResults.errorMessages = batchResultsArray.flatMap(r => r.errorMessages)
      
      console.log(`[SYNC] Batch group ${groupIndex + 1} completed: ${groupResults.synced} synced, ${groupResults.errors} errors`)
      
      // Small delay between batch groups to respect overall rate limits
      if (i + CONCURRENT_BATCHES < batches.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    // Post-sync: Update parent_product_id for products that were synced before their parent
    // OPTIMIZATION: Only process products that were actually synced, not all products
    // This reduces post-sync API calls by 90%+ for incremental syncs
    console.log(`[SYNC] Running post-sync parent-child relationship update...`)
    console.log(`[SYNC] Processing ${syncedProductIds.length} synced products (instead of all products)`)
    try {
      // Get only the products that were synced in this sync operation
      // This is much more efficient than fetching all products
      let productsToUpdate: any[] = []
      
      if (syncedProductIds.length > 0) {
        const { data: syncedProducts, error: productsError } = await supabase
          .from('shoprenter_products')
          .select('id, shoprenter_id, sku, parent_product_id')
          .eq('connection_id', connection.id)
          .in('id', syncedProductIds)
          .is('deleted_at', null)
        
        if (productsError) {
          console.error(`[SYNC] Error fetching synced products for parent update:`, productsError)
        } else if (syncedProducts) {
          productsToUpdate = syncedProducts
        }
      } else {
        // Fallback: If no synced product IDs tracked, get all products (for backward compatibility)
        console.warn(`[SYNC] No synced product IDs tracked, falling back to all products`)
        const { data: allProducts, error: productsError } = await supabase
          .from('shoprenter_products')
          .select('id, shoprenter_id, sku, parent_product_id')
          .eq('connection_id', connection.id)
          .is('deleted_at', null)
        
        if (productsError) {
          console.error(`[SYNC] Error fetching products for parent update:`, productsError)
        } else if (allProducts) {
          productsToUpdate = allProducts
        }
      }
      
      if (productsToUpdate.length > 0) {
        let updatedCount = 0
        const batchSize = 50 // Process in smaller batches to avoid timeout
        
        for (let i = 0; i < productsToUpdate.length; i += batchSize) {
          const batch = productsToUpdate.slice(i, i + batchSize)
          
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
                  
                  // For force sync, always update parent relationships to match ShopRenter exactly
                  // For non-force sync, only update if parent changed or is missing
                  const shouldUpdateParent = forceSync || 
                    (parentShopRenterId && !product.parent_product_id) ||
                    (parentShopRenterId && product.parent_product_id) // Check if current parent matches ShopRenter parent
                  
                  if (parentShopRenterId && shouldUpdateParent) {
                    // Find parent in database by ShopRenter ID
                    const { data: parentProduct } = await supabase
                      .from('shoprenter_products')
                      .select('id, sku')
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
                      
                      // Check if parent needs updating (different from current or force sync)
                      const needsUpdate = forceSync || product.parent_product_id !== parentProduct.id
                      
                      if (needsUpdate) {
                        // Update the child product with parent UUID
                        const { error: updateError } = await supabase
                          .from('shoprenter_products')
                          .update({ parent_product_id: parentProduct.id })
                          .eq('id', product.id)
                        
                        if (!updateError) {
                          updatedCount++
                          console.log(`[SYNC] Updated parent for ${product.sku}: ${parentProduct.sku} (${parentProduct.id})`)
                        } else {
                          console.error(`[SYNC] Error updating parent for ${product.sku}:`, updateError)
                        }
                      }
                    } else if (forceSync) {
                      // For force sync, if parent doesn't exist in DB, clear the parent_product_id
                      // This ensures exact match with ShopRenter (if parent doesn't exist, clear it)
                      if (product.parent_product_id) {
                        const { error: clearError } = await supabase
                          .from('shoprenter_products')
                          .update({ parent_product_id: null })
                          .eq('id', product.id)
                        
                        if (!clearError) {
                          console.log(`[SYNC] Cleared parent_product_id for ${product.sku} (parent ${parentShopRenterId} not found in database)`)
                        }
                      }
                    }
                  } else if (forceSync && !parentShopRenterId && product.parent_product_id) {
                    // For force sync, if ShopRenter says no parent but we have one, clear it
                    const { error: clearError } = await supabase
                      .from('shoprenter_products')
                      .update({ parent_product_id: null })
                      .eq('id', product.id)
                    
                    if (!clearError) {
                      console.log(`[SYNC] Cleared parent_product_id for ${product.sku} (no parent in ShopRenter)`)
                    }
                  }
                }
              }
            }
          } catch (batchError) {
            console.error(`[SYNC] Error in parent update batch ${Math.floor(i / batchSize) + 1}:`, batchError)
          }
          
          // Small delay between batches
          if (i + batchSize < productsToUpdate.length) {
            await new Promise(resolve => setTimeout(resolve, 100))
          }
        }
        
        console.log(`[SYNC] Updated ${updatedCount} parent-child relationships`)
      } else {
        console.log(`[SYNC] No products found for parent update`)
      }
    } catch (parentUpdateError) {
      console.error(`[SYNC] Error updating parent relationships (non-fatal):`, parentUpdateError)
    }


    // Mark as complete
    const syncEndTime = new Date()
    const durationSeconds = Math.floor((syncEndTime.getTime() - syncStartTime.getTime()) / 1000)
    
    updateProgress(connectionId, {
      synced: syncedCount,
      current: totalProducts,
      status: 'completed',
      errors: errorCount
    })

    // Update audit log
    if (auditLogId && tenantId) {
      try {
        const metadata: any = {
          forceSync: forceSync,
          batchSize: 200,
          totalBatches: totalBatches
        }
        
        // Include incremental stats if available
        if (incrementalStats) {
          metadata.incrementalStats = incrementalStats
        }
        
        await supabase
          .from('sync_audit_logs')
          .update({
            synced_count: syncedCount,
            error_count: errorCount,
            skipped_count: incrementalStats ? incrementalStats.skippedProducts : (totalProducts - syncedCount - errorCount),
            completed_at: syncEndTime.toISOString(),
            duration_seconds: durationSeconds,
            status: 'completed',
            metadata: metadata
          })
          .eq('id', auditLogId)
      } catch (auditUpdateError) {
        console.warn(`[SYNC] Failed to update audit log:`, auditUpdateError)
      }
    }

    // Clear progress after 30 seconds (give time for final poll)
    setTimeout(() => {
      clearProgress(connectionId)
    }, 30 * 1000)

    console.log(`[SYNC] Completed: ${syncedCount}/${totalProducts} synced, ${errorCount} errors (duration: ${durationSeconds}s)`)
  } catch (error) {
    console.error('Error in background sync:', error)
    const errorMessage = error instanceof Error ? error.message : 'Ismeretlen hiba'
    console.error(`[SYNC] Fatal error at batch ${Math.floor(syncedCount / 200) + 1}: ${errorMessage}`)
    
    const syncEndTime = new Date()
    const durationSeconds = Math.floor((syncEndTime.getTime() - syncStartTime.getTime()) / 1000)
    
    updateProgress(connectionId, {
      status: 'error',
      errors: errorCount,
      synced: syncedCount,
      current: syncedCount + errorCount
    })

    // Update audit log with error
    if (auditLogId && tenantId) {
      try {
        await supabase
          .from('sync_audit_logs')
          .update({
            synced_count: syncedCount,
            error_count: errorCount,
            skipped_count: totalProducts - syncedCount - errorCount,
            completed_at: syncEndTime.toISOString(),
            duration_seconds: durationSeconds,
            status: 'failed',
            error_message: errorMessage
          })
          .eq('id', auditLogId)
      } catch (auditUpdateError) {
        console.warn(`[SYNC] Failed to update audit log with error:`, auditUpdateError)
      }
    }
    
    // Don't throw - log the error but mark progress as error so UI can show it
    console.error(`[SYNC] Sync stopped at ${syncedCount}/${totalProducts} products due to error`)
  }
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
  productClassName?: string | null
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
                    const descResponse = await fetch(descUrl, {
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
            const relationsResponse = await fetch(relationsUrl, {
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
                        const valueResponse = await fetch(valueUrl, {
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

    // Extract brand/manufacturer from productExtend (non-blocking - won't fail sync if extraction fails)
    let brand = null
    let manufacturerId: string | null = null
    try {
      if (product.manufacturer) {
        // manufacturer can be an object with name and id properties, or just href
        if (typeof product.manufacturer === 'object') {
          if (product.manufacturer.name) {
            brand = product.manufacturer.name
          }
          if (product.manufacturer.id) {
            manufacturerId = product.manufacturer.id
          }
          console.log(`[SYNC] Extracted brand from manufacturer: "${brand}" (ID: ${manufacturerId}) for product ${product.sku}`)
        } else if (product.manufacturer.href) {
          // Extract ID from href if available
          const hrefParts = product.manufacturer.href.split('/')
          const lastPart = hrefParts[hrefParts.length - 1]
          if (lastPart && lastPart !== 'manufacturers') {
            manufacturerId = lastPart
          }
          console.log(`[SYNC] Manufacturer href found for product ${product.sku}: ${product.manufacturer.href}, extracted ID: ${manufacturerId}`)
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

    // Extract product data
    const productData: any = {
      connection_id: connection.id,
      shoprenter_id: product.id,
      shoprenter_inner_id: product.innerId || null,
      sku: product.sku || '',
      model_number: product.modelNumber || null, // Gyártói cikkszám (Manufacturer part number)
      gtin: product.gtin || null, // Vonalkód (Barcode/GTIN)
      name: null, // Will be set from description
      brand: brand, // Brand/manufacturer name from ShopRenter
      manufacturer_id: manufacturerId, // ShopRenter manufacturer ID for syncing back
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

    // Upsert product
    // IMPORTANT: Don't filter by deleted_at - we need to find soft-deleted products too
    // Use .maybeSingle() instead of .single() to handle cases where product might not exist
    const { data: existingProduct } = await supabase
      .from('shoprenter_products')
      .select('id, deleted_at, status')
      .eq('connection_id', connection.id)
      .eq('shoprenter_id', product.id)
      .maybeSingle()
    
    // If product exists and is soft-deleted, but ShopRenter has it enabled, restore it
    const isEnabledInShopRenter = product.status === '1' || product.status === 1
    if (existingProduct && existingProduct.deleted_at && isEnabledInShopRenter) {
      console.log(`[SYNC] Product ${product.sku} is soft-deleted in ERP but enabled in ShopRenter (status = ${product.status}). Restoring...`)
      productData.deleted_at = null // Clear deleted_at to restore the product
      productData.status = 1 // Ensure status is 1
    }

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

        // Use retry logic for 429 rate limit errors
        const descResponse = await retryWithBackoff(
          () => fetch(descUrl, {
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

    // Return product ID for tracking synced products
    return { productId: dbProduct.id }
  } catch (error) {
    console.error('Error in syncProductToDatabase:', error)
    throw error
  }
}
