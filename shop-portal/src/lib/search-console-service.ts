// Google Search Console API Service
// Handles fetching performance data, indexing status, and queries

import { google } from 'googleapis'

const searchconsole = google.searchconsole('v1')

export interface SearchConsoleConfig {
  clientEmail: string // Service account email
  privateKey: string // Service account private key
  propertyUrl: string // Search Console property URL (e.g., https://vasalatmester.hu)
}

export interface SearchPerformanceData {
  date: string
  impressions: number
  clicks: number
  ctr: number
  position: number
}

export interface SearchQueryData {
  query: string
  impressions: number
  clicks: number
  ctr: number
  position: number
  date: string
}

export interface IndexingStatus {
  isIndexed: boolean
  lastCrawled: string | null
  coverageState: string | null
  indexingState: string | null
  hasIssues: boolean
  issues: any[] | null
  // Enhanced fields from URL Inspection API
  pageFetchState?: string | null
  pageFetchError?: string | null
  mobileUsabilityIssues?: Array<{
    issue: string
    severity: 'ERROR' | 'WARNING'
    description: string
  }> | null
  mobileUsabilityPassed?: boolean
  coreWebVitals?: {
    lcp?: number | null // Largest Contentful Paint (seconds)
    inp?: number | null // Interaction to Next Paint (milliseconds)
    cls?: number | null // Cumulative Layout Shift
  } | null
  structuredDataIssues?: Array<{
    type: string
    severity: 'ERROR' | 'WARNING'
    message: string
  }> | null
  richResultsEligible?: string[] | null
  sitemapStatus?: string | null
  sitemapUrl?: string | null
}

/**
 * Initialize Google Search Console API client
 */
function getSearchConsoleClient(config: SearchConsoleConfig) {
  const auth = new google.auth.JWT({
    email: config.clientEmail,
    key: config.privateKey.replace(/\\n/g, '\n'), // Handle escaped newlines
    scopes: [
      'https://www.googleapis.com/auth/webmasters.readonly',
      'https://www.googleapis.com/auth/webmasters'
    ]
  })

  return { auth, searchconsole }
}

/**
 * Fetch search performance data for a specific URL
 */
export async function fetchUrlPerformance(
  config: SearchConsoleConfig,
  url: string,
  startDate: string, // YYYY-MM-DD
  endDate: string   // YYYY-MM-DD
): Promise<SearchPerformanceData[]> {
  try {
    const { auth } = getSearchConsoleClient(config)

    // Get access token first to verify authentication
    await auth.getAccessToken()

    const response = await searchconsole.searchanalytics.query({
      auth,
      siteUrl: config.propertyUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['date'],
        dimensionFilterGroups: [
          {
            filters: [
              {
                dimension: 'page',
                expression: url,
                operator: 'equals'
              }
            ]
          }
        ],
        rowLimit: 1000
      }
    })

    if (!response.data.rows) {
      return []
    }

    return response.data.rows.map(row => ({
      date: row.keys?.[0] || '',
      impressions: row.impressions || 0,
      clicks: row.clicks || 0,
      ctr: row.ctr || 0,
      position: row.position || 0
    }))
  } catch (error: any) {
    console.error('Error fetching URL performance:', error)
    
    // Provide more helpful error messages
    if (error?.code === 401 || error?.message?.includes('unauthorized')) {
      throw new Error('Search Console authentication failed. Please verify the Service Account credentials and ensure it has access to the Search Console property.')
    }
    if (error?.code === 403 || error?.message?.includes('forbidden')) {
      throw new Error('Service Account does not have access to this Search Console property. Please add the Service Account email as a user in Search Console.')
    }
    if (error?.code === 404 || error?.message?.includes('not found')) {
      throw new Error(`Search Console property not found: ${config.propertyUrl}. Please verify the property URL is correct.`)
    }
    if (error?.message?.includes('API has not been used') || error?.message?.includes('API not enabled')) {
      throw new Error('Search Console API is not enabled. Please enable it in Google Cloud Console: https://console.cloud.google.com/apis/library/searchconsole.googleapis.com')
    }
    
    throw new Error(`Failed to fetch Search Console performance: ${error?.message || 'Unknown error'}`)
  }
}

/**
 * Fetch search queries for a specific URL
 */
export async function fetchUrlQueries(
  config: SearchConsoleConfig,
  url: string,
  startDate: string,
  endDate: string,
  limit: number = 100
): Promise<SearchQueryData[]> {
  try {
    const { auth } = getSearchConsoleClient(config)

    // Get access token first to verify authentication
    await auth.getAccessToken()

    const response = await searchconsole.searchanalytics.query({
      auth,
      siteUrl: config.propertyUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['query', 'date'],
        dimensionFilterGroups: [
          {
            filters: [
              {
                dimension: 'page',
                expression: url,
                operator: 'equals'
              }
            ]
          }
        ],
        rowLimit: limit
      }
    })

    if (!response.data.rows) {
      return []
    }

    return response.data.rows.map(row => ({
      query: row.keys?.[0] || '', // Query
      date: row.keys?.[1] || startDate, // Date
      impressions: row.impressions || 0,
      clicks: row.clicks || 0,
      ctr: row.ctr || 0,
      position: row.position || 0
    }))
  } catch (error: any) {
    console.error('Error fetching URL queries:', error)
    
    // Provide more helpful error messages
    if (error?.code === 401 || error?.message?.includes('unauthorized')) {
      throw new Error('Search Console authentication failed. Please verify the Service Account credentials.')
    }
    if (error?.code === 403 || error?.message?.includes('forbidden')) {
      throw new Error('Service Account does not have access to this Search Console property.')
    }
    if (error?.message?.includes('API has not been used') || error?.message?.includes('API not enabled')) {
      throw new Error('Search Console API is not enabled. Please enable it in Google Cloud Console: https://console.cloud.google.com/apis/library/searchconsole.googleapis.com')
    }
    
    throw new Error(`Failed to fetch Search Console queries: ${error?.message || 'Unknown error'}`)
  }
}

/**
 * Check indexing status for a specific URL using URL Inspection API
 */
export async function checkUrlIndexingStatus(
  config: SearchConsoleConfig,
  url: string
): Promise<IndexingStatus> {
  try {
    const { auth } = getSearchConsoleClient(config)

    // Get access token first to verify authentication
    await auth.getAccessToken()

    const response = await searchconsole.urlInspection.index.inspect({
      auth,
      requestBody: {
        inspectionUrl: url,
        siteUrl: config.propertyUrl
      }
    })

    const inspectionResult = response.data.inspectionResult
    if (!inspectionResult) {
      return {
        isIndexed: false,
        lastCrawled: null,
        coverageState: null,
        indexingState: null,
        hasIssues: false,
        issues: null,
        pageFetchState: null,
        pageFetchError: null,
        mobileUsabilityIssues: null,
        mobileUsabilityPassed: false,
        coreWebVitals: null,
        structuredDataIssues: null,
        richResultsEligible: null,
        sitemapStatus: null,
        sitemapUrl: null
      }
    }

    const indexStatus = inspectionResult.indexStatusResult
    const coverageState = indexStatus?.coverageState || null
    const indexingState = indexStatus?.indexingState || null
    const lastCrawlTime = indexStatus?.lastCrawlTime || null
    const pageFetchState = indexStatus?.pageFetchState || null

    // Determine if indexed - check multiple indicators
    let isIndexed = false

    // Method 1: Check coverageState (primary indicator)
    if (coverageState) {
      const coverageLower = coverageState.toLowerCase()
      isIndexed = coverageLower.includes('indexed') || 
                  coverageLower === 'submitted and indexed' ||
                  coverageLower === 'indexed, not submitted in sitemap'
    }

    // Method 2: Check indexingState + lastCrawlTime (secondary indicator)
    // If indexing is allowed and page was crawled, it's likely indexed
    if (!isIndexed && indexingState === 'INDEXING_ALLOWED' && lastCrawlTime) {
      isIndexed = true
    }

    // Method 3: Check pageFetchState + lastCrawlTime (fallback indicator)
    // If page was successfully fetched and crawled, it's likely indexed
    if (!isIndexed && pageFetchState && lastCrawlTime) {
      const fetchStateLower = pageFetchState.toLowerCase()
      if (fetchStateLower === 'success' || fetchStateLower === 'pass') {
        isIndexed = true
      }
    }

    // Log indexing determination for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log('[SEARCH CONSOLE] Indexing status determination:', {
        coverageState,
        indexingState,
        pageFetchState,
        lastCrawlTime: lastCrawlTime ? 'present' : 'missing',
        isIndexed,
        method: isIndexed 
          ? (coverageState?.toLowerCase().includes('indexed') ? 'coverageState' 
             : indexingState === 'INDEXING_ALLOWED' ? 'indexingState' 
             : 'pageFetchState')
          : 'none'
      })
    }

    // Extract page fetch error
    // Only treat as error if it's an actual error state (not SUCCESS or PASS)
    const successStates = ['SUCCESS', 'PASS']
    let pageFetchError: string | null = null
    if (pageFetchState && !successStates.includes(pageFetchState)) {
      pageFetchError = indexStatus?.pageFetchState || null
      // Try to get more details from verdict or details
      if (indexStatus?.verdict) {
        pageFetchError = indexStatus.verdict
      }
    }

    // Extract mobile usability issues
    const mobileUsabilityResult = inspectionResult.mobileUsabilityResult
    let mobileUsabilityIssues: IndexingStatus['mobileUsabilityIssues'] = null
    let mobileUsabilityPassed = false
    
    if (mobileUsabilityResult) {
      mobileUsabilityPassed = mobileUsabilityResult.mobileUsabilityState === 'MOBILE_FRIENDLY'
      
      if (mobileUsabilityResult.issues && mobileUsabilityResult.issues.length > 0) {
        mobileUsabilityIssues = mobileUsabilityResult.issues.map((issue: any) => ({
          issue: issue.issue || 'Unknown issue',
          severity: issue.severity || 'WARNING',
          description: issue.issueMessage || ''
        }))
      }
    }

    // Extract Core Web Vitals (if available in inspection result)
    // Note: CWV might not always be available in URL Inspection API
    // It's more commonly available in PageSpeed Insights API
    let coreWebVitals: IndexingStatus['coreWebVitals'] = null
    // The URL Inspection API doesn't directly provide CWV, but we can check if it's mentioned
    // For now, we'll leave this null and can enhance later with PageSpeed Insights API if needed

    // Extract structured data issues
    const richResultsResult = inspectionResult.richResultsResult
    let structuredDataIssues: IndexingStatus['structuredDataIssues'] = null
    let richResultsEligible: string[] | null = null

    if (richResultsResult) {
      // Get detected items (rich result types)
      if (richResultsResult.detectedItems && richResultsResult.detectedItems.length > 0) {
        richResultsEligible = richResultsResult.detectedItems.map((item: any) => 
          item.richResultType || item.richResultItem?.richResultType || 'Unknown'
        ).filter((type: string) => type !== 'Unknown')
      }

      // Get issues
      if (richResultsResult.issues && richResultsResult.issues.length > 0) {
        structuredDataIssues = richResultsResult.issues.map((issue: any) => ({
          type: issue.richResultType || 'Unknown',
          severity: issue.severity || 'WARNING',
          message: issue.issueMessage || issue.message || ''
        }))
      }
    }

    // Extract sitemap information
    // Note: Sitemap info might be in indexStatus.sitemap or inspectionResult.sitemap
    const sitemapInfo = indexStatus?.sitemap || inspectionResult?.sitemap || null
    let sitemapStatus: string | null = null
    let sitemapUrl: string | null = null
    
    if (sitemapInfo) {
      sitemapStatus = 'IN_SITEMAP'
      if (typeof sitemapInfo === 'string') {
        sitemapUrl = sitemapInfo
      } else if (sitemapInfo.url) {
        sitemapUrl = sitemapInfo.url
      } else if (Array.isArray(sitemapInfo) && sitemapInfo.length > 0) {
        // If it's an array, take the first sitemap URL
        sitemapUrl = typeof sitemapInfo[0] === 'string' ? sitemapInfo[0] : sitemapInfo[0]?.url || null
      }
    } else {
      sitemapStatus = 'NOT_IN_SITEMAP'
    }

    // Check for issues (combine all issue types)
    const allIssues: any[] = []
    
    if (pageFetchState && pageFetchState !== 'SUCCESS') {
      allIssues.push({
        type: 'page_fetch',
        severity: 'ERROR',
        state: pageFetchState,
        verdict: indexStatus?.verdict,
        details: indexStatus?.details
      })
    }

    if (mobileUsabilityIssues && mobileUsabilityIssues.length > 0) {
      allIssues.push(...mobileUsabilityIssues.map(issue => ({
        type: 'mobile_usability',
        ...issue
      })))
    }

    if (structuredDataIssues && structuredDataIssues.length > 0) {
      allIssues.push(...structuredDataIssues.map(issue => ({
        type: 'structured_data',
        ...issue
      })))
    }

    return {
      isIndexed,
      lastCrawled: lastCrawlTime || null,
      coverageState,
      indexingState,
      hasIssues: allIssues.length > 0,
      issues: allIssues.length > 0 ? allIssues : null,
      pageFetchState,
      pageFetchError,
      mobileUsabilityIssues,
      mobileUsabilityPassed,
      coreWebVitals,
      structuredDataIssues,
      richResultsEligible,
      sitemapStatus,
      sitemapUrl
    }
  } catch (error: any) {
    console.error('Error checking indexing status:', error)
    
    // Don't throw for indexing status - just return default
    // This is a less critical operation and we don't want to break the whole sync
    if (error?.code === 401 || error?.message?.includes('unauthorized')) {
      console.warn('Search Console authentication failed for indexing check')
    }
    
    // Return default status on error
    return {
      isIndexed: false,
      lastCrawled: null,
      coverageState: null,
      indexingState: null,
      hasIssues: false,
      issues: null,
      pageFetchState: null,
      pageFetchError: null,
      mobileUsabilityIssues: null,
      mobileUsabilityPassed: false,
      coreWebVitals: null,
      structuredDataIssues: null,
      richResultsEligible: null,
      sitemapStatus: null,
      sitemapUrl: null
    }
  }
}

/**
 * Fetch aggregated performance data for multiple URLs (batch)
 */
export async function fetchBatchUrlPerformance(
  config: SearchConsoleConfig,
  urls: string[],
  startDate: string,
  endDate: string
): Promise<Map<string, SearchPerformanceData[]>> {
  const results = new Map<string, SearchPerformanceData[]>()

  // Process URLs in batches to avoid rate limits
  const batchSize = 10
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize)
    
    await Promise.all(
      batch.map(async (url) => {
        try {
          const data = await fetchUrlPerformance(config, url, startDate, endDate)
          results.set(url, data)
        } catch (error) {
          console.error(`Error fetching performance for ${url}:`, error)
          results.set(url, [])
        }
      })
    )

    // Small delay between batches
    if (i + batchSize < urls.length) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  return results
}
