import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { 
  fetchUrlPerformance, 
  fetchUrlQueries, 
  checkUrlIndexingStatus,
  type SearchConsoleConfig 
} from '@/lib/search-console-service'
import { getConnectionById } from '@/lib/connections-server'

/**
 * POST /api/products/[id]/search-console/sync
 * Sync Search Console data for a specific product
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params
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

    // Get product with connection
    const { data: product, error: productError } = await supabase
      .from('shoprenter_products')
      .select(`
        *,
        webshop_connections (
          id,
          search_console_property_url,
          search_console_client_email,
          search_console_private_key,
          search_console_enabled
        )
      `)
      .eq('id', productId)
      .is('deleted_at', null)
      .single()

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const connection = (product as any).webshop_connections
    if (!connection || !connection.search_console_enabled) {
      return NextResponse.json({ 
        error: 'Search Console integration is not enabled for this connection' 
      }, { status: 400 })
    }

    if (!connection.search_console_property_url || 
        !connection.search_console_client_email || 
        !connection.search_console_private_key) {
      return NextResponse.json({ 
        error: 'Search Console credentials are not configured' 
      }, { status: 400 })
    }

    if (!product.product_url) {
      return NextResponse.json({ 
        error: 'Product URL is not available. Please sync products first.' 
      }, { status: 400 })
    }

    // Get request body for date range
    const body = await request.json().catch(() => ({}))
    const days = body.days || 30 // Default to last 30 days
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]

    // Extract private key from JSON if needed
    let privateKey = connection.search_console_private_key
    try {
      // Check if it's a full JSON object
      const parsed = JSON.parse(connection.search_console_private_key)
      if (parsed.private_key) {
        privateKey = parsed.private_key
      }
    } catch {
      // Not JSON, use as-is (already just the private key)
    }

    // Normalize property URL format
    let propertyUrl = connection.search_console_property_url
    let customDomain = '' // Extract custom domain for URL normalization
    if (propertyUrl) {
      // If it's a full URL (https://domain.com), extract domain and use sc-domain: format
      // Search Console API prefers sc-domain: for domain properties
      if (propertyUrl.startsWith('http://') || propertyUrl.startsWith('https://')) {
        try {
          const url = new URL(propertyUrl)
          customDomain = url.hostname.replace(/^www\./, '')
          propertyUrl = `sc-domain:${customDomain}`
        } catch {
          // If URL parsing fails, try to extract domain manually
          customDomain = propertyUrl.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
          propertyUrl = `sc-domain:${customDomain}`
        }
      } else if (!propertyUrl.startsWith('sc-domain:')) {
        // If it's just a domain name, add sc-domain: prefix
        customDomain = propertyUrl.replace(/^sc-domain:/, '').replace(/^www\./, '')
        propertyUrl = `sc-domain:${customDomain}`
      } else {
        // Already has sc-domain: prefix, extract domain
        customDomain = propertyUrl.replace(/^sc-domain:/, '').replace(/^www\./, '')
      }
    }

    // Normalize product URL: replace .shoprenter.hu with custom domain
    let normalizedProductUrl = product.product_url
    if (normalizedProductUrl && customDomain) {
      // If product URL uses ShopRenter subdomain, replace with custom domain
      if (normalizedProductUrl.includes('.shoprenter.hu')) {
        try {
          const url = new URL(normalizedProductUrl)
          const path = url.pathname
          normalizedProductUrl = `https://${customDomain}${path}`
          console.log('[SEARCH CONSOLE SYNC] URL normalized:', {
            original: product.product_url,
            normalized: normalizedProductUrl
          })
        } catch (error) {
          console.warn('[SEARCH CONSOLE SYNC] Failed to normalize URL, using original:', error)
        }
      }
    }

    // Prepare Search Console config
    const searchConsoleConfig: SearchConsoleConfig = {
      clientEmail: connection.search_console_client_email,
      privateKey: privateKey,
      propertyUrl: propertyUrl
    }

    // Fetch all data using normalized URL
    console.log('[SEARCH CONSOLE SYNC] Starting sync for product:', productId)
    console.log('[SEARCH CONSOLE SYNC] Original Product URL:', product.product_url)
    console.log('[SEARCH CONSOLE SYNC] Normalized Product URL:', normalizedProductUrl)
    console.log('[SEARCH CONSOLE SYNC] Property URL:', searchConsoleConfig.propertyUrl)
    console.log('[SEARCH CONSOLE SYNC] Date range:', startDateStr, 'to', endDateStr)
    
    let performanceData: any[] = []
    let queriesData: any[] = []
    let indexingStatus: any = null
    
    try {
      performanceData = await fetchUrlPerformance(searchConsoleConfig, normalizedProductUrl, startDateStr, endDateStr)
      console.log('[SEARCH CONSOLE SYNC] Performance data fetched:', performanceData.length, 'records')
    } catch (error) {
      console.error('[SEARCH CONSOLE SYNC] Error fetching performance:', error)
      // Continue with other data even if performance fails
    }
    
    try {
      queriesData = await fetchUrlQueries(searchConsoleConfig, normalizedProductUrl, startDateStr, endDateStr, 100)
      console.log('[SEARCH CONSOLE SYNC] Queries data fetched:', queriesData.length, 'records')
    } catch (error) {
      console.error('[SEARCH CONSOLE SYNC] Error fetching queries:', error)
      // Continue with other data even if queries fail
    }
    
    try {
      indexingStatus = await checkUrlIndexingStatus(searchConsoleConfig, normalizedProductUrl)
      console.log('[SEARCH CONSOLE SYNC] Indexing status fetched:', indexingStatus.isIndexed)
    } catch (error) {
      console.error('[SEARCH CONSOLE SYNC] Error fetching indexing status:', error)
      // Continue even if indexing status fails
    }

    // Store performance data
    if (performanceData.length > 0) {
      const performanceInserts = performanceData.map(perf => ({
        product_id: productId,
        connection_id: connection.id,
        date: perf.date,
        impressions: perf.impressions,
        clicks: perf.clicks,
        ctr: perf.ctr,
        position: perf.position
      }))

      // Upsert performance data (update if exists, insert if new)
      for (const perf of performanceInserts) {
        await supabase
          .from('product_search_performance')
          .upsert(perf, { onConflict: 'product_id,date' })
      }
    }

    // Store query data
    if (queriesData.length > 0) {
      const queryInserts = queriesData.map(query => ({
        product_id: productId,
        connection_id: connection.id,
        query: query.query,
        date: query.date,
        impressions: query.impressions,
        clicks: query.clicks,
        ctr: query.ctr,
        position: query.position
      }))

      // Upsert query data
      for (const query of queryInserts) {
        await supabase
          .from('product_search_queries')
          .upsert(query, { onConflict: 'product_id,query,date' })
      }
    }

    // Store indexing status with enhanced data
    await supabase
      .from('product_indexing_status')
      .upsert({
        product_id: productId,
        connection_id: connection.id,
        is_indexed: indexingStatus.isIndexed,
        last_crawled: indexingStatus.lastCrawled,
        coverage_state: indexingStatus.coverageState,
        indexing_state: indexingStatus.indexingState,
        has_issues: indexingStatus.hasIssues,
        issues: indexingStatus.issues,
        // Enhanced fields
        page_fetch_state: indexingStatus.pageFetchState || null,
        page_fetch_error: indexingStatus.pageFetchError || null,
        mobile_usability_issues: indexingStatus.mobileUsabilityIssues || null,
        mobile_usability_passed: indexingStatus.mobileUsabilityPassed || false,
        core_web_vitals: indexingStatus.coreWebVitals || null,
        structured_data_issues: indexingStatus.structuredDataIssues || null,
        rich_results_eligible: indexingStatus.richResultsEligible || null,
        sitemap_status: indexingStatus.sitemapStatus || null,
        sitemap_url: indexingStatus.sitemapUrl || null,
        last_checked: new Date().toISOString(),
        check_count: 1 // Will be incremented by trigger or manually
      }, { onConflict: 'product_id' })

    // Get aggregated stats
    const totalImpressions = performanceData.reduce((sum, p) => sum + p.impressions, 0)
    const totalClicks = performanceData.reduce((sum, p) => sum + p.clicks, 0)
    const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0
    const avgPosition = performanceData.length > 0
      ? performanceData.reduce((sum, p) => sum + p.position, 0) / performanceData.length
      : 0

    return NextResponse.json({
      success: true,
      stats: {
        dateRange: { start: startDateStr, end: endDateStr },
        totalImpressions,
        totalClicks,
        avgCtr,
        avgPosition,
        uniqueQueries: queriesData.length,
        isIndexed: indexingStatus.isIndexed,
        coverageState: indexingStatus.coverageState
      },
      performanceData: performanceData.length,
      queriesData: queriesData.length,
      indexingStatus
    })

  } catch (error) {
    console.error('Error syncing Search Console data:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sync Search Console data'
    }, { status: 500 })
  }
}
