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
        issues: null
      }
    }

    const indexStatus = inspectionResult.indexStatusResult
    const coverageState = indexStatus?.coverageState || null
    const indexingState = indexStatus?.indexingState || null
    const lastCrawlTime = indexStatus?.lastCrawlTime || null

    // Determine if indexed
    const isIndexed = coverageState === 'Submitted and indexed' || 
                     coverageState === 'Indexed, not submitted in sitemap'

    // Check for issues
    const issues = indexStatus?.pageFetchState === 'SUCCESS' ? null : [
      {
        state: indexStatus?.pageFetchState,
        verdict: indexStatus?.verdict,
        details: indexStatus?.details
      }
    ]

    return {
      isIndexed,
      lastCrawled: lastCrawlTime || null,
      coverageState,
      indexingState,
      hasIssues: issues !== null && issues.length > 0,
      issues
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
      issues: null
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
