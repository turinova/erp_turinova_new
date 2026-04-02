import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase, getTenantFromSession } from '@/lib/tenant-supabase'
import { getConnectionById } from '@/lib/connections-server'
import { Buffer } from 'buffer'
import { updateProgress, clearProgress, shouldStopSync, getProgress, incrementProgress } from '@/lib/sync-progress-store'
import {
  maybeFlushSyncJobProgress,
  finalizeSyncJob,
  reconcileStaleRunningSyncJob,
  isSyncJobStopped,
} from '@/lib/sync-job-db'
import { retryWithBackoff } from '@/lib/retry-with-backoff'
import { batchFetchAttributeDescriptions, batchFetchAttributeWidgetDescriptions } from '@/lib/shoprenter-attribute-sync'
import { extractShopNameFromUrl, extractParentProductId } from '@/lib/shoprenter-product-sync-helpers'
import { syncProductToDatabase, ensureManufacturerExists } from './sync-product-db'
import { syncSingleProductFromShopRenter } from '@/lib/sync-single-shoprenter-product'

/** Vercel Pro: allow long product sync batches (ShopRenter batch + DB writes). Hobby plan caps lower. */
export const maxDuration = 300

/** Max UUIDs per Supabase `.in('id', …)` — avoids proxy 414 URI Too Long on large syncs. */
const SUPABASE_ID_IN_CHUNK_SIZE = 150

/**
 * Fetch rows from shoprenter_products by ERP UUID list in chunks (avoids 414 on huge `.in()` queries).
 */
async function fetchShoprenterProductsByIdsChunked(
  supabase: any,
  connectionId: string,
  ids: string[]
): Promise<{ data: any[]; error: any }> {
  const unique = [...new Set(ids.filter(Boolean))]
  if (unique.length === 0) {
    return { data: [], error: null }
  }
  const rows: any[] = []
  for (let i = 0; i < unique.length; i += SUPABASE_ID_IN_CHUNK_SIZE) {
    const chunk = unique.slice(i, i + SUPABASE_ID_IN_CHUNK_SIZE)
    const { data, error } = await supabase
      .from('shoprenter_products')
      .select('id, shoprenter_id, sku, parent_product_id')
      .eq('connection_id', connectionId)
      .in('id', chunk)
      .is('deleted_at', null)
    if (error) {
      return { data: rows, error }
    }
    if (data?.length) {
      rows.push(...data)
    }
  }
  return { data: rows, error: null }
}

function inferAttributeTypeFromHref(
  href: string | undefined,
  attr: any
): 'LIST' | 'INTEGER' | 'FLOAT' | 'TEXT' {
  if (href) {
    if (href.includes('/listAttributes')) return 'LIST'
    if (href.includes('/textAttributes')) return 'TEXT'
    if (href.includes('/numberAttributes')) return 'INTEGER'
  }
  const t = attr?.type
  if (t === 'LIST' || t === 'INTEGER' || t === 'FLOAT' || t === 'TEXT') return t
  return 'TEXT'
}

function dedupeAttributeRequests(
  arr: Array<{ attributeId: string; attributeType: 'LIST' | 'INTEGER' | 'FLOAT' | 'TEXT' }>
): Array<{ attributeId: string; attributeType: 'LIST' | 'INTEGER' | 'FLOAT' | 'TEXT' }> {
  const seen = new Set<string>()
  const out: Array<{ attributeId: string; attributeType: 'LIST' | 'INTEGER' | 'FLOAT' | 'TEXT' }> = []
  for (const r of arr) {
    const key = `${r.attributeId}\0${r.attributeType}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(r)
  }
  return out
}

/**
 * Serialize async work (e.g. shared attribute-description cache across concurrent batches).
 */
function createSerializedQueue() {
  let chain: Promise<void> = Promise.resolve()
  return async function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    let result!: T
    const next = chain.then(async () => {
      result = await fn()
    })
    chain = next.then(
      () => {},
      () => {}
    )
    await next
    return result
  }
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

    // Reconcile stale DB jobs (server restart / timeout), then block concurrent syncs
    const activeDbJob = await reconcileStaleRunningSyncJob(supabase, connectionId)

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

    if (activeDbJob) {
      console.log(`[SYNC] Sync already running (DB) for connection ${connectionId}: job ${activeDbJob.id}`)
      return NextResponse.json({
        success: false,
        error: 'Szinkronizálás már folyamatban van erre a kapcsolatra.',
        details: `Jelenleg ${activeDbJob.synced_units}/${activeDbJob.total_units} termék szinkronizálva. Kérjük, várja meg a befejezését vagy állítsa le az előző szinkronizálást.`,
        existingProgress: {
          synced: activeDbJob.synced_units,
          total: activeDbJob.total_units,
          status: 'syncing',
        },
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
      const single = await syncSingleProductFromShopRenter({
        supabase,
        connection,
        shoprenterProductId: product_id,
        forceSync,
        tenantId,
        apiUrl,
        authHeader,
      })
      if (single.ok === false) {
        return NextResponse.json(
          { success: false, error: single.error },
          { status: single.status ?? 500 }
        )
      }
      return NextResponse.json({ success: true, synced: 1 })
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
    /** Skips solely because list API omitted dateUpdated (heuristic may hide real webshop changes). */
    let skippedMissingDateUpdated = 0

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
                skippedMissingDateUpdated++
                
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
                skippedMissingDateUpdated++
                
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
      if (skippedMissingDateUpdated > 0) {
        console.warn(
          `[SYNC] Incremental: ${skippedMissingDateUpdated} termék kimaradt, mert a ShopRenter terméklistában nem volt dateUpdated (heurisztika). Ha a webshop és az ERP eltér, futtasson teljes szinkront.`
        )
      }
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
  let syncJobId: string | null = null
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

  // Durable progress for UI polling across serverless instances — must not depend on audit log insert.
  // (Audit log can fail when tenant context is missing; users still need sync_jobs for navbar / refresh.)
  if (userId) {
    try {
      const { data: sj, error: sjErr } = await supabase
        .from('sync_jobs')
        .insert({
          connection_id: connectionId,
          audit_log_id: auditLogId,
          user_id: userId,
          sync_mode: forceSync ? 'full' : 'incremental',
          sync_direction: 'from_shoprenter',
          status: 'running',
          total_units: totalProducts,
          synced_units: 0,
          error_units: 0,
          total_batches: totalBatches,
          metadata: {
            totalProductsEvaluated,
            incrementalStats: incrementalStats || null,
          },
        })
        .select('id')
        .single()
      if (!sjErr && sj?.id) {
        syncJobId = sj.id
        console.log(`[SYNC] Created sync_jobs row: ${syncJobId}`)
      } else {
        console.warn('[SYNC] sync_jobs insert failed (non-fatal):', sjErr)
      }
    } catch (syncJobErr) {
      console.warn('[SYNC] sync_jobs insert error (non-fatal):', syncJobErr)
    }
  }

  /** Cross-batch cache + serial queue so parallel batches don't duplicate attributeDescription API work */
  const attributeDescriptionCache = new Map<
    string,
    { display_name: string | null; prefix: string | null; postfix: string | null }
  >()
  const runExclusive = createSerializedQueue()

  const flushProgress = async (force = false) => {
    if (!syncJobId) return
    await maybeFlushSyncJobProgress(
      supabase,
      syncJobId,
      () => {
        const p = getProgress(connectionId)
        return {
          synced: p?.synced ?? 0,
          total: p?.total ?? 0,
          errors: p?.errors ?? 0,
          status: p?.status ?? 'syncing',
          currentBatch: p?.currentBatch,
          totalBatches: p?.totalBatches,
          batchProgress: p?.batchProgress,
        }
      },
      force
    )
  }

  const bumpSynced = (n: number) => {
    incrementProgress(connectionId, { synced: n })
    void flushProgress()
  }
  const bumpErrors = (n: number) => {
    incrementProgress(connectionId, { errors: n })
    void flushProgress()
  }
  const trackProgress = (updates: Parameters<typeof updateProgress>[1]) => {
    updateProgress(connectionId, updates)
    void flushProgress(false)
  }

  /** Memory flag (same instance) + durable sync_jobs row (any instance / Stop button). */
  const checkShouldStopSync = async (): Promise<boolean> => {
    if (shouldStopSync(connectionId)) return true
    if (syncJobId) {
      const stopped = await isSyncJobStopped(supabase, syncJobId)
      if (stopped) {
        updateProgress(connectionId, { shouldStop: true, status: 'stopped' })
      }
      return stopped
    }
    return false
  }

  try {
    // Ensure progress is initialized at the start of background process
    // This is a safety check in case the main handler didn't set it
    // Clear any previous stop flag when starting a new sync
    trackProgress({
      total: allProductIds.length,
      synced: 0,
      current: 0,
      status: 'syncing',
      errors: 0,
      shouldStop: false, // Clear any previous stop flag
      ...(syncJobId ? { syncJobId } : {}),
    })
    void flushProgress(true)

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
        
      // Check if sync should stop (memory + DB for multi-instance)
      if (await checkShouldStopSync()) {
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
        const batchResponse = await retryWithBackoff(
          () => fetch(`${apiUrl}/batch`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': authHeader
            },
            body: JSON.stringify(batchPayload),
            signal: AbortSignal.timeout(600000) // 10 minutes
          }),
          {
            maxRetries: 3,
            initialDelayMs: 1500,
            maxDelayMs: 20000,
          }
        )

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
        
        // Collect Manufacturer IDs from products (for erp_manufacturer_id)
        const manufacturerIds = new Set<string>()
        const productToManufacturerMap = new Map<string, string>() // productId -> manufacturerId

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
              
              // Extract Manufacturer ID (for batch fetching manufacturer names)
              if (product.manufacturer) {
                let manufacturerId: string | null = null
                if (typeof product.manufacturer === 'object' && product.manufacturer.id) {
                  manufacturerId = product.manufacturer.id
                } else if (product.manufacturer.href) {
                  // Extract ID from href like: "http://shopname.api.myshoprenter.hu/manufacturers/..."
                  const hrefParts = product.manufacturer.href.split('/')
                  const lastPart = hrefParts[hrefParts.length - 1]
                  if (lastPart && lastPart !== 'manufacturers') {
                    manufacturerId = lastPart
                  }
                }
                
                if (manufacturerId) {
                  manufacturerIds.add(manufacturerId)
                  productToManufacturerMap.set(product.id, manufacturerId)
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
                      attributeType: inferAttributeTypeFromHref(attr.href, attr)
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

        // Batch fetch Manufacturer details to get names (for erp_manufacturer_id)
        const manufacturerNamesMap = new Map<string, string | null>()
        if (manufacturerIds.size > 0 && apiUrl && authHeader) {
          console.log(`[SYNC] Batch fetching ${manufacturerIds.size} Manufacturer details for batch ${batchIndex + 1}`)
          try {
            const manufacturerArray = Array.from(manufacturerIds)
            const BATCH_SIZE = 200
            
            for (let i = 0; i < manufacturerArray.length; i += BATCH_SIZE) {
              const batch = manufacturerArray.slice(i, i + BATCH_SIZE)
              const batchRequests = batch.map(manufacturerId => ({
                method: 'GET',
                uri: `${apiUrl}/manufacturers/${manufacturerId}?full=1`
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
                  const manufacturerId = batch[j]
                  const statusCode = parseInt(batchItem.response?.header?.statusCode || '0', 10)
                  
                  if (statusCode >= 200 && statusCode < 300) {
                    const manufacturer = batchItem.response?.body
                    const manufacturerName = manufacturer?.name || null
                    manufacturerNamesMap.set(manufacturerId, manufacturerName)
                    if (manufacturerName) {
                      console.log(`[SYNC] Found Manufacturer name "${manufacturerName}" for ID ${manufacturerId}`)
                      // Auto-create manufacturer in ERP if it doesn't exist
                      await ensureManufacturerExists(supabase, manufacturerName)
                    }
                  } else {
                    manufacturerNamesMap.set(manufacturerId, null)
                    console.warn(`[SYNC] Failed to fetch Manufacturer ${manufacturerId}: status ${statusCode}`)
                  }
                }
              } else {
                console.warn(`[SYNC] Failed to fetch Manufacturers batch: ${batchResponse.status}`)
                // Set all to null on batch failure
                batch.forEach(manufacturerId => manufacturerNamesMap.set(manufacturerId, null))
              }
            }
            
            console.log(`[SYNC] Fetched ${manufacturerNamesMap.size} Manufacturer names`)
          } catch (error) {
            console.warn(`[SYNC] Error fetching Manufacturers:`, error)
            // Set all to null on error
            manufacturerIds.forEach(manufacturerId => manufacturerNamesMap.set(manufacturerId, null))
          }
        }

        // Batch fetch attribute descriptions (deduped; shared cache across concurrent batches)
        let attributeDescriptionsMap = new Map<string, { display_name: string | null; prefix: string | null; postfix: string | null }>()
        if (attributeRequests.length > 0 && apiUrl && authHeader) {
          const deduped = dedupeAttributeRequests(attributeRequests)
          console.log(
            `[SYNC] Attribute descriptions for batch ${batchIndex + 1}: ${attributeRequests.length} refs → ${deduped.length} unique`
          )
          attributeDescriptionsMap = await runExclusive(async () => {
            const missing = deduped.filter(r => !attributeDescriptionCache.has(r.attributeId))
            if (missing.length > 0) {
              const fetched = await batchFetchAttributeDescriptions(apiUrl, authHeader, missing, { tenantId })
              for (const [k, v] of fetched) {
                attributeDescriptionCache.set(k, v)
              }
            }
            return new Map(attributeDescriptionCache)
          })
          console.log(`[SYNC] Attribute description map size (job cache): ${attributeDescriptionsMap.size}`)
        }

        // Create map: productId -> productClassId -> productClassName (for group_name)
        // This will be used in syncProductToDatabase to set group_name for all attributes
        const productToClassNameMap = new Map<string, string | null>()
        productToClassMap.forEach((classId, productId) => {
          const className = productClassNamesMap.get(classId) || null
          productToClassNameMap.set(productId, className)
        })

        // Create map: productId -> manufacturerId -> manufacturerName (for erp_manufacturer_id)
        // This will be used in syncProductToDatabase to set erp_manufacturer_id
        const productToManufacturerNameMap = new Map<string, string | null>()
        productToManufacturerMap.forEach((manufacturerId, productId) => {
          const manufacturerName = manufacturerNamesMap.get(manufacturerId) || null
          productToManufacturerNameMap.set(productId, manufacturerName)
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
                  widgetRequests.map(w => ({ widgetId: w.widgetId, widgetType: w.widgetType })),
                  { tenantId }
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
        for (let idx = 0; idx < batchResponses.length; idx++) {
          const batchItem = batchResponses[idx]
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
            // Retry single product fetch for recoverable partial failures in batch responses
            const productId = batch[idx]
            if (productId && [429, 500, 502, 503, 504].includes(statusCode)) {
              try {
                const singleResponse = await retryWithBackoff(
                  () => fetch(`${apiUrl}/productExtend/${productId}?full=1`, {
                    method: 'GET',
                    headers: {
                      'Content-Type': 'application/json',
                      'Accept': 'application/json',
                      'Authorization': authHeader
                    },
                    signal: AbortSignal.timeout(120000)
                  }),
                  {
                    maxRetries: 2,
                    initialDelayMs: 1200,
                    maxDelayMs: 10000,
                  }
                )
                if (singleResponse.ok) {
                  const recoveredProduct = await singleResponse.json()
                  if (recoveredProduct?.id) {
                    productsToSync.push({ product: recoveredProduct, batchItem })
                    continue
                  }
                }
              } catch (singleRetryError) {
                console.warn(`[SYNC] Single-product retry failed for ${productId}:`, singleRetryError)
              }
            }
            batchResults.errors++
            const errorMsg = batchItem.response?.body?.message || `HTTP ${statusCode}`
            batchResults.errorMessages.push(`Termék ${batchItem.uri || productId || 'ismeretlen'}: ${errorMsg}`)
          }
        }

        // Process products sequentially to avoid overwhelming the API with image requests
        // The rate limiter will handle the 3 req/sec limit, but sequential processing prevents
        // too many requests from queuing up at once
        for (let productIdx = 0; productIdx < productsToSync.length; productIdx++) {
          const { product, batchItem } = productsToSync[productIdx]
          
          if (await checkShouldStopSync()) {
            return batchResults
          }

          // Update batch progress for UI feedback
          trackProgress({
            currentBatch: batchIndex + 1,
            totalBatches: batches.length,
            batchProgress: productIdx + 1
          })

          try {
            // Sync product and get the ERP UUID if available
            // Pass Product Class name map for group_name and Manufacturer name map for erp_manufacturer_id
            const productClassName = productToClassNameMap.get(product.id) || null
            const manufacturerName = productToManufacturerNameMap.get(product.id) || null
            const result = await syncProductToDatabase(supabase, connection, product, forceSync, apiUrl, authHeader, attributeDescriptionsMap, tenantId, attributeGroupNamesMap, productClassName, manufacturerName)
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
            bumpSynced(1)
          } catch (error) {
            batchResults.errors++
            const errorMsg = error instanceof Error ? error.message : 'Ismeretlen hiba'
            batchResults.errorMessages.push(`Termék ${product.sku || product.id}: ${errorMsg}`)
            // Update error count immediately
            bumpErrors(1)
          }
        }
      } catch (batchError) {
        batchResults.errors += batch.length
        batchResults.errorMessages.push(`Batch ${batchIndex + 1} hiba: ${batchError instanceof Error ? batchError.message : 'Ismeretlen hiba'}`)
      }

      return batchResults
    }

    // Process batches in parallel groups
    let userRequestedStop = false
    for (let i = 0; i < batches.length; i += CONCURRENT_BATCHES) {
      // Check if sync should stop
      if (await checkShouldStopSync()) {
        console.log(`[SYNC] Sync stopped by user at batch group ${Math.floor(i / CONCURRENT_BATCHES) + 1}`)
        userRequestedStop = true
        trackProgress({
          status: 'stopped',
          synced: syncedCount,
          current: syncedCount + errorCount,
          errors: errorCount
        })
        void flushProgress(true)
        if (syncJobId) {
          const p = getProgress(connectionId)
          await finalizeSyncJob(supabase, syncJobId, 'stopped', {
            synced: p?.synced ?? syncedCount,
            errors: p?.errors ?? errorCount,
            total: p?.total ?? totalProducts,
            errorMessage: null,
          })
        }
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

    // Last batch group may exit without re-entering the loop; DB stop must still be honored
    if (!userRequestedStop && (await checkShouldStopSync())) {
      userRequestedStop = true
      const p = getProgress(connectionId)
      const syncedVal = p?.synced ?? syncedCount
      const errVal = p?.errors ?? errorCount
      console.log(`[SYNC] Sync stopped by user after batch loop (edge case)`)
      trackProgress({
        status: 'stopped',
        synced: syncedVal,
        current: syncedVal + errVal,
        errors: errVal
      })
      void flushProgress(true)
      if (syncJobId) {
        await finalizeSyncJob(supabase, syncJobId, 'stopped', {
          synced: syncedVal,
          errors: errVal,
          total: p?.total ?? totalProducts,
          errorMessage: null,
        })
      }
    }

    if (userRequestedStop) {
      const syncEndTime = new Date()
      const durationSeconds = Math.floor((syncEndTime.getTime() - syncStartTime.getTime()) / 1000)
      if (auditLogId && tenantId) {
        try {
          await supabase
            .from('sync_audit_logs')
            .update({
              synced_count: syncedCount,
              error_count: errorCount,
              skipped_count: incrementalStats
                ? incrementalStats.skippedProducts
                : Math.max(0, totalProducts - syncedCount - errorCount),
              completed_at: syncEndTime.toISOString(),
              duration_seconds: durationSeconds,
              status: 'stopped'
            })
            .eq('id', auditLogId)
        } catch (auditStopErr) {
          console.warn('[SYNC] Failed to update audit log (stopped):', auditStopErr)
        }
      }
      setTimeout(() => {
        clearProgress(connectionId)
      }, 30 * 1000)
      console.log(`[SYNC] User stopped: ${syncedCount}/${totalProducts} synced (post-sync skipped)`)
      return
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
        const uniqueIds = [...new Set(syncedProductIds)]
        const { data: syncedProducts, error: productsError } = await fetchShoprenterProductsByIdsChunked(
          supabase,
          connection.id,
          uniqueIds
        )

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
    
    trackProgress({
      synced: syncedCount,
      current: totalProducts,
      status: 'completed',
      errors: errorCount
    })
    void flushProgress(true)
    if (syncJobId) {
      await finalizeSyncJob(supabase, syncJobId, 'completed', {
        synced: syncedCount,
        errors: errorCount,
        total: totalProducts,
      })
    }

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
    
    trackProgress({
      status: 'error',
      errors: errorCount,
      synced: syncedCount,
      current: syncedCount + errorCount
    })
    void flushProgress(true)
    if (syncJobId) {
      await finalizeSyncJob(supabase, syncJobId, 'failed', {
        synced: syncedCount,
        errors: errorCount,
        total: totalProducts,
        errorMessage: errorMessage,
      })
    }

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

