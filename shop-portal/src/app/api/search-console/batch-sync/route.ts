import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { 
  fetchUrlPerformance, 
  fetchUrlQueries, 
  checkUrlIndexingStatus,
  type SearchConsoleConfig 
} from '@/lib/search-console-service'

/**
 * POST /api/search-console/batch-sync
 * Sync Search Console data for multiple products
 */
export async function POST(request: NextRequest) {
  try {
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

    // Get request body
    const body = await request.json()
    const { productIds, days = 30 } = body

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({ error: 'Product IDs are required' }, { status: 400 })
    }

    // Limit batch size
    if (productIds.length > 50) {
      return NextResponse.json({ 
        error: 'Maximum 50 products per batch' 
      }, { status: 400 })
    }

    // Date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]

    // Get products with their connections
    const { data: products, error: productsError } = await supabase
      .from('shoprenter_products')
      .select(`
        id,
        product_url,
        connection_id,
        webshop_connections (
          id,
          search_console_property_url,
          search_console_client_email,
          search_console_private_key,
          search_console_enabled
        )
      `)
      .in('id', productIds)
      .is('deleted_at', null)

    if (productsError) {
      return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
    }

    if (!products || products.length === 0) {
      return NextResponse.json({ error: 'No products found' }, { status: 404 })
    }

    // Group products by connection
    const productsByConnection = new Map<string, typeof products>()
    for (const product of products) {
      const connection = (product as any).webshop_connections
      if (!connection || !connection.search_console_enabled) continue
      
      const connectionId = connection.id
      if (!productsByConnection.has(connectionId)) {
        productsByConnection.set(connectionId, [])
      }
      productsByConnection.get(connectionId)!.push(product)
    }

    const results: Array<{
      productId: string
      success: boolean
      isIndexed?: boolean
      error?: string
    }> = []

    // Process each connection's products
    for (const [connectionId, connectionProducts] of productsByConnection) {
      const connection = (connectionProducts[0] as any).webshop_connections

      // Validate connection credentials
      if (!connection.search_console_property_url || 
          !connection.search_console_client_email || 
          !connection.search_console_private_key) {
        for (const product of connectionProducts) {
          results.push({
            productId: product.id,
            success: false,
            error: 'Search Console credentials not configured'
          })
        }
        continue
      }

      // Extract private key
      let privateKey = connection.search_console_private_key
      try {
        const parsed = JSON.parse(connection.search_console_private_key)
        if (parsed.private_key) {
          privateKey = parsed.private_key
        }
      } catch {
        // Not JSON, use as-is
      }

      // Normalize property URL
      let propertyUrl = connection.search_console_property_url
      let customDomain = ''
      if (propertyUrl) {
        if (propertyUrl.startsWith('http://') || propertyUrl.startsWith('https://')) {
          try {
            const url = new URL(propertyUrl)
            customDomain = url.hostname.replace(/^www\./, '')
            propertyUrl = `sc-domain:${customDomain}`
          } catch {
            customDomain = propertyUrl.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
            propertyUrl = `sc-domain:${customDomain}`
          }
        } else if (!propertyUrl.startsWith('sc-domain:')) {
          customDomain = propertyUrl.replace(/^sc-domain:/, '').replace(/^www\./, '')
          propertyUrl = `sc-domain:${customDomain}`
        } else {
          customDomain = propertyUrl.replace(/^sc-domain:/, '').replace(/^www\./, '')
        }
      }

      const searchConsoleConfig: SearchConsoleConfig = {
        clientEmail: connection.search_console_client_email,
        privateKey: privateKey,
        propertyUrl: propertyUrl
      }

      // Process each product
      for (const product of connectionProducts) {
        if (!product.product_url) {
          results.push({
            productId: product.id,
            success: false,
            error: 'Product URL not available'
          })
          continue
        }

        // Normalize product URL
        let normalizedProductUrl = product.product_url
        if (normalizedProductUrl && customDomain) {
          if (normalizedProductUrl.includes('.shoprenter.hu')) {
            try {
              const url = new URL(normalizedProductUrl)
              const path = url.pathname
              normalizedProductUrl = `https://${customDomain}${path}`
            } catch {
              // Keep original URL
            }
          }
        }

        try {
          // Fetch indexing status (prioritize this for speed)
          let indexingStatus = { isIndexed: false, lastCrawled: null, coverageState: 'Unknown', indexingState: null, hasIssues: false, issues: null }
          try {
            indexingStatus = await checkUrlIndexingStatus(searchConsoleConfig, normalizedProductUrl)
          } catch (error) {
            console.error(`[BATCH SYNC] Error fetching indexing status for ${product.id}:`, error)
          }

          // Store indexing status
          await supabase
            .from('product_indexing_status')
            .upsert({
              product_id: product.id,
              connection_id: connection.id,
              is_indexed: indexingStatus.isIndexed,
              last_crawled: indexingStatus.lastCrawled,
              coverage_state: indexingStatus.coverageState,
              indexing_state: indexingStatus.indexingState,
              has_issues: indexingStatus.hasIssues,
              issues: indexingStatus.issues,
              last_checked: new Date().toISOString(),
              check_count: 1
            }, { onConflict: 'product_id' })

          // Optionally fetch performance and query data (slower, can be skipped for bulk ops)
          let performanceData: any[] = []
          let queriesData: any[] = []
          
          try {
            performanceData = await fetchUrlPerformance(searchConsoleConfig, normalizedProductUrl, startDateStr, endDateStr)
          } catch (error) {
            // Performance data is optional for bulk sync
          }

          try {
            queriesData = await fetchUrlQueries(searchConsoleConfig, normalizedProductUrl, startDateStr, endDateStr, 20) // Limit to 20 queries for speed
          } catch (error) {
            // Query data is optional for bulk sync
          }

          // Store performance data
          if (performanceData.length > 0) {
            const performanceInserts = performanceData.map(perf => ({
              product_id: product.id,
              connection_id: connection.id,
              date: perf.date,
              impressions: perf.impressions,
              clicks: perf.clicks,
              ctr: perf.ctr,
              position: perf.position
            }))

            for (const perf of performanceInserts) {
              await supabase
                .from('product_search_performance')
                .upsert(perf, { onConflict: 'product_id,date' })
            }
          }

          // Store query data
          if (queriesData.length > 0) {
            const queryInserts = queriesData.map(query => ({
              product_id: product.id,
              connection_id: connection.id,
              query: query.query,
              date: query.date,
              impressions: query.impressions,
              clicks: query.clicks,
              ctr: query.ctr,
              position: query.position
            }))

            for (const query of queryInserts) {
              await supabase
                .from('product_search_queries')
                .upsert(query, { onConflict: 'product_id,query,date' })
            }
          }

          results.push({
            productId: product.id,
            success: true,
            isIndexed: indexingStatus.isIndexed
          })

          // Add small delay between products to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200))

        } catch (error) {
          console.error(`[BATCH SYNC] Error processing product ${product.id}:`, error)
          results.push({
            productId: product.id,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }
    }

    // Check for products without connections
    const processedIds = new Set(results.map(r => r.productId))
    for (const productId of productIds) {
      if (!processedIds.has(productId)) {
        results.push({
          productId,
          success: false,
          error: 'Search Console not enabled for this connection'
        })
      }
    }

    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length
    const indexed = results.filter(r => r.isIndexed).length

    return NextResponse.json({
      success: true,
      stats: {
        total: results.length,
        successful,
        failed,
        indexed
      },
      results
    })

  } catch (error) {
    console.error('Error in batch Search Console sync:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sync Search Console data'
    }, { status: 500 })
  }
}
