import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getConnectionById } from '@/lib/connections-server'
import { Buffer } from 'buffer'
import { updateProgress, clearProgress, shouldStopSync } from '@/lib/sync-progress-store'
import { getShopRenterRateLimiter } from '@/lib/shoprenter-rate-limiter'
import { getLanguageId, getShopRenterAuthHeader, extractShopNameFromUrl as extractShopNameFromUrlLib } from '@/lib/shoprenter-api'

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
 * Construct full category URL from shop name and URL alias
 */
function constructCategoryUrl(shopName: string, urlAlias: string | null | undefined): string | null {
  if (!urlAlias || !urlAlias.trim()) {
    return null
  }
  
  if (!shopName) {
    return null
  }
  
  const cleanAlias = urlAlias.trim().replace(/^\//, '')
  return `https://${shopName}.shoprenter.hu/${cleanAlias}`
}

/**
 * Extract URL alias from categoryExtend response
 */
function extractUrlAlias(category: any): { slug: string | null; id: string | null } {
  if (category.urlAliases) {
    if (typeof category.urlAliases === 'object' && category.urlAliases.urlAlias) {
      return {
        slug: category.urlAliases.urlAlias,
        id: category.urlAliases.id || null
      }
    }
    if (Array.isArray(category.urlAliases) && category.urlAliases.length > 0) {
      const firstAlias = category.urlAliases[0]
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
 * Extract parent category ID from categoryExtend response
 */
function extractParentCategoryId(category: any): string | null {
  if (!category.parentCategory) {
    return null
  }

  if (typeof category.parentCategory === 'object') {
    if (category.parentCategory.id) {
      return category.parentCategory.id
    }
    
    if (category.parentCategory.href) {
      const hrefMatch = category.parentCategory.href.match(/\/categories\/([^\/\?]+)/)
      if (hrefMatch && hrefMatch[1]) {
        return hrefMatch[1]
      }
    }
  }
  
  if (typeof category.parentCategory === 'string') {
    return category.parentCategory
  }
  
  return null
}

/**
 * Delay helper for rate limiting
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Sync category to database
 */
async function syncCategoryToDatabase(
  supabase: any,
  connection: any,
  category: any, // categoryExtend from ShopRenter
  shopName: string,
  forceSync: boolean = false,
  hungarianLanguageId?: string // Optional Hungarian language ID for name extraction
) {
  try {
    // Extract category data
    const shoprenterId = category.id
    const innerId = category.innerId || null
    const picture = category.picture || null
    const sortOrder = parseInt(category.sortOrder || '0', 10)
    const status = category.status === '1' || category.status === 1 ? 1 : 0
    const productsStatus = category.productsStatus === '1' || category.productsStatus === 1 ? 1 : 0
    
    // Extract URL alias
    const urlAliasData = extractUrlAlias(category)
    const categoryUrl = constructCategoryUrl(shopName, urlAliasData.slug)
    
    // Extract parent category ID
    const parentCategoryShopRenterId = extractParentCategoryId(category)
    
    // Get category name - PREFER HUNGARIAN (like products do)
    let categoryName = null
    if (category.categoryDescriptions && Array.isArray(category.categoryDescriptions) && category.categoryDescriptions.length > 0) {
      // First, try to find Hungarian description
      if (hungarianLanguageId) {
        const huDesc = category.categoryDescriptions.find((desc: any) => {
          const descLangId = desc.language?.id || desc.language?.href?.match(/\/languages\/([^\/\?]+)/)?.[1]
          return descLangId === hungarianLanguageId
        })
        if (huDesc && huDesc.name && huDesc.name.trim()) {
          categoryName = huDesc.name.trim()
        }
      }
      
      // If no Hungarian found, check by innerId (1 = Hungarian)
      if (!categoryName) {
        const huDesc = category.categoryDescriptions.find((desc: any) => {
          const innerId = desc.language?.innerId
          return (innerId === '1' || innerId === 1) && desc.name && desc.name.trim()
        })
        if (huDesc) {
          categoryName = huDesc.name.trim()
        }
      }
      
      // Fallback to first available name
      if (!categoryName) {
        for (const desc of category.categoryDescriptions) {
          if (desc.name && desc.name.trim()) {
            categoryName = desc.name.trim()
            break
          }
        }
      }
    }
    
    // Prepare category data
    const categoryData = {
      connection_id: connection.id,
      shoprenter_id: shoprenterId,
      shoprenter_inner_id: innerId,
      name: categoryName,
      picture: picture,
      sort_order: sortOrder,
      status: status,
      products_status: productsStatus,
      parent_category_shoprenter_id: parentCategoryShopRenterId,
      url_slug: urlAliasData.slug,
      url_alias_id: urlAliasData.id,
      category_url: categoryUrl,
      date_created: category.dateCreated || null,
      date_updated: category.dateUpdated || null,
      sync_status: 'synced',
      sync_error: null,
      last_synced_at: new Date().toISOString()
    }
    
    // Check if category exists
    const { data: existingCategory } = await supabase
      .from('shoprenter_categories')
      .select('id, parent_category_id')
      .eq('connection_id', connection.id)
      .eq('shoprenter_id', shoprenterId)
      .single()
    
    let categoryResult
    if (existingCategory) {
      // Update existing category
      const { data, error } = await supabase
        .from('shoprenter_categories')
        .update(categoryData)
        .eq('id', existingCategory.id)
        .select()
        .single()
      
      if (error) {
        // Detailed error logging
        console.error(`[CATEGORY SYNC] Failed to update category ${shoprenterId}:`, {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        })
        throw new Error(`Failed to update category: ${error.message || 'Unknown error'} (code: ${error.code || 'N/A'})`)
      }
      
      categoryResult = data
      
      // CRITICAL: Also update description name for Hungarian description
      // This ensures the UI shows the correct name even if smart sync skips description content
      if (categoryName && categoryResult) {
        // Find Hungarian description by language_id
        let huDescQuery = supabase
          .from('shoprenter_category_descriptions')
          .select('id')
          .eq('category_id', categoryResult.id)
        
        if (hungarianLanguageId) {
          huDescQuery = huDescQuery.eq('language_id', hungarianLanguageId)
        } else {
          // Fallback: try to find by checking if language_id contains 'hu' or is the Hungarian base64 ID
          // Hungarian language ID is typically: bGFuZ3VhZ2UtbGFuZ3VhZ2VfaWQ9MQ==
          huDescQuery = huDescQuery.or('language_id.eq.bGFuZ3VhZ2UtbGFuZ3VhZ2VfaWQ9MQ==,language_id.ilike.%hu%')
        }
        
        const { data: huDesc, error: huDescError } = await huDescQuery.maybeSingle()
        
        if (huDesc && !huDescError) {
          const { error: descUpdateError } = await supabase
            .from('shoprenter_category_descriptions')
            .update({ name: categoryName })
            .eq('id', huDesc.id)
          
          if (descUpdateError) {
            console.error(`[CATEGORY SYNC] Failed to update Hungarian description name for category ${shoprenterId}:`, {
              code: descUpdateError.code,
              message: descUpdateError.message,
              details: descUpdateError.details,
              hint: descUpdateError.hint
            })
            // Don't throw - this is not critical, just log it
          } else {
            console.log(`[CATEGORY SYNC] Updated Hungarian description name for category ${shoprenterId}: ${categoryName}`)
          }
        }
      }
    } else {
      // Insert new category
      const { data, error } = await supabase
        .from('shoprenter_categories')
        .insert(categoryData)
        .select()
        .single()
      
      if (error) {
        // Detailed error logging
        console.error(`[CATEGORY SYNC] Failed to insert category ${shoprenterId}:`, {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        })
        throw new Error(`Failed to insert category: ${error.message || 'Unknown error'} (code: ${error.code || 'N/A'})`)
      }
      
      categoryResult = data
    }
    
    // Sync category descriptions
    if (category.categoryDescriptions && Array.isArray(category.categoryDescriptions)) {
      await syncCategoryDescriptions(supabase, categoryResult.id, category.categoryDescriptions)
      
      // After syncing descriptions, ensure Hungarian description name matches category name
      if (categoryName && categoryResult) {
        // Find Hungarian description by language_id
        let huDescQuery = supabase
          .from('shoprenter_category_descriptions')
          .select('id')
          .eq('category_id', categoryResult.id)
        
        if (hungarianLanguageId) {
          huDescQuery = huDescQuery.eq('language_id', hungarianLanguageId)
        } else {
          // Fallback: try to find by checking if language_id contains 'hu' or is the Hungarian base64 ID
          huDescQuery = huDescQuery.or('language_id.eq.bGFuZ3VhZ2UtbGFuZ3VhZ2VfaWQ9MQ==,language_id.ilike.%hu%')
        }
        
        const { data: huDesc, error: huDescError } = await huDescQuery.maybeSingle()
        
        if (huDesc && !huDescError) {
          const { error: descUpdateError } = await supabase
            .from('shoprenter_category_descriptions')
            .update({ name: categoryName })
            .eq('id', huDesc.id)
          
          if (descUpdateError) {
            console.error(`[CATEGORY SYNC] Failed to update Hungarian description name after sync for category ${shoprenterId}:`, {
              code: descUpdateError.code,
              message: descUpdateError.message,
              details: descUpdateError.details,
              hint: descUpdateError.hint
            })
            // Don't throw - this is not critical, just log it
          } else {
            console.log(`[CATEGORY SYNC] Updated Hungarian description name after sync for category ${shoprenterId}: ${categoryName}`)
          }
        }
      }
    }
    
    // Update parent category relationship (after all categories are synced, we'll do a second pass)
    // For now, just store the parent_category_shoprenter_id
    
    return categoryResult
  } catch (error: any) {
    const categoryId = category?.id || 'unknown'
    console.error(`[CATEGORY SYNC] Error syncing category ${categoryId}:`, error)
    throw error
  }
}

/**
 * Sync category descriptions
 */
async function syncCategoryDescriptions(
  supabase: any,
  categoryId: string,
  descriptions: any[]
) {
  for (const desc of descriptions) {
    try {
      const descriptionData = {
        category_id: categoryId,
        shoprenter_id: desc.id || desc.href?.match(/\/categoryDescriptions\/([^\/\?]+)/)?.[1] || null,
        language_id: desc.language?.id || desc.language?.href?.match(/\/languages\/([^\/\?]+)/)?.[1] || null,
        name: desc.name || null,
        meta_keywords: desc.metaKeywords || null,
        meta_description: desc.metaDescription || null,
        description: desc.description || null,
        custom_title: desc.customTitle || null,
        robots_meta_tag: desc.robotsMetaTag || '0',
        footer_seo_text: desc.footerSeoText || null,
        heading: desc.heading || null,
        short_description: desc.shortDescription || null
      }
      
      if (!descriptionData.shoprenter_id || !descriptionData.language_id) {
        console.warn('[CATEGORY SYNC] Skipping description without shoprenter_id or language_id:', desc)
        continue
      }
      
      // Upsert description
      const { error } = await supabase
        .from('shoprenter_category_descriptions')
        .upsert(descriptionData, {
          onConflict: 'category_id,language_id'
        })
      
      if (error) {
        // Detailed error logging
        console.error(`[CATEGORY SYNC] Error syncing description ${descriptionData.shoprenter_id}:`, {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          descriptionData: {
            category_id: descriptionData.category_id,
            language_id: descriptionData.language_id,
            shoprenter_id: descriptionData.shoprenter_id
          }
        })
      }
    } catch (error) {
      console.error('[CATEGORY SYNC] Error processing description:', error)
    }
  }
}

/**
 * Update parent category relationships (second pass after all categories are synced)
 */
async function updateParentCategoryRelations(supabase: any, connectionId: string) {
  // Get all categories with parent_category_shoprenter_id
  const { data: categoriesWithParents } = await supabase
    .from('shoprenter_categories')
    .select('id, parent_category_shoprenter_id')
    .eq('connection_id', connectionId)
    .not('parent_category_shoprenter_id', 'is', null)
    .is('deleted_at', null)
  
  if (!categoriesWithParents || categoriesWithParents.length === 0) {
    return
  }
  
  // For each category, find its parent and update parent_category_id
  for (const category of categoriesWithParents) {
    if (!category.parent_category_shoprenter_id) continue
    
    // Find parent category
    const { data: parentCategory } = await supabase
      .from('shoprenter_categories')
      .select('id')
      .eq('connection_id', connectionId)
      .eq('shoprenter_id', category.parent_category_shoprenter_id)
      .is('deleted_at', null)
      .single()
    
    if (parentCategory) {
      // Update parent_category_id
      await supabase
        .from('shoprenter_categories')
        .update({ parent_category_id: parentCategory.id })
        .eq('id', category.id)
    }
  }
}

/**
 * POST /api/connections/[id]/sync-categories
 * Sync categories from ShopRenter to database
 * If category_id is provided in body, sync only that category
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: connectionId } = await params
  
  try {
    let category_id: string | undefined
    let forceSync = false
    try {
      const body = await request.json().catch(() => ({}))
      category_id = body?.category_id
      forceSync = body?.force === true
    } catch {
      // Body might be empty, that's OK
      category_id = undefined
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
        error: 'Authentication failed'
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

    // Use Basic Auth
    const credentials = `${connection.username}:${connection.password}`
    const base64Credentials = Buffer.from(credentials).toString('base64')
    const authHeader = `Basic ${base64Credentials}`

    let apiUrl = connection.api_url.replace(/\/$/, '')
    if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
      apiUrl = `http://${apiUrl}`
    }

    // If category_id is provided, sync only that category
    if (category_id) {
      const rateLimiter = getShopRenterRateLimiter()
      
      // Fetch category from ShopRenter
      const categoryUrl = `${apiUrl}/categoryExtend/${category_id}?full=1`
      console.log(`[CATEGORY SYNC] Pulling category from ShopRenter: ${categoryUrl}`)
      
      let response: Response
      try {
        response = await rateLimiter.execute(async () => {
          return fetch(categoryUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': authHeader
            },
            signal: AbortSignal.timeout(30000)
          })
        })
      } catch (fetchError: any) {
        console.error('[CATEGORY SYNC] Fetch error:', fetchError)
        return NextResponse.json({ 
          success: false, 
          error: `Network error: ${fetchError.message || 'Unknown error'}` 
        }, { status: 500 })
      }

      console.log(`[CATEGORY SYNC] Response status: ${response.status}`)

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        console.error(`[CATEGORY SYNC] Failed to fetch category: ${response.status} - ${errorText.substring(0, 200)}`)
        
        // Check for rate limiting (429) or blocking
        if (response.status === 429) {
          console.error('[CATEGORY SYNC] Rate limit exceeded! ShopRenter is blocking requests.')
          return NextResponse.json({ 
            success: false, 
            error: 'ShopRenter rate limit exceeded (429). Kérjük, várjon néhány percet, majd próbálja újra.' 
          }, { status: 429 })
        }
        
        // Check for other blocking status codes
        if (response.status === 403) {
          console.error('[CATEGORY SYNC] Access forbidden (403). ShopRenter may be blocking the API key or IP.')
          return NextResponse.json({ 
            success: false, 
            error: 'Access forbidden (403). ShopRenter may be blocking requests. Check API credentials.' 
          }, { status: 403 })
        }
        
        return NextResponse.json({ 
          success: false, 
          error: `Failed to fetch category: ${response.status} - ${errorText.substring(0, 200)}` 
        }, { status: response.status })
      }

      const responseText = await response.text().catch(() => '')
      console.log(`[CATEGORY SYNC] Response body length: ${responseText.length} chars`)
      
      if (!responseText || responseText.trim() === '') {
        console.error('[CATEGORY SYNC] Empty response from ShopRenter - this usually indicates authentication error')
        return NextResponse.json({ 
          success: false, 
          error: 'ShopRenter returned empty response. This usually indicates an authentication error. Please check your connection settings.' 
        }, { status: 401 })
      }
      
      let categoryData: any = null
      
      try {
        categoryData = JSON.parse(responseText)
        console.log(`[CATEGORY SYNC] Successfully parsed category data, ID: ${categoryData?.id || 'missing'}`)
      } catch (parseError: any) {
        console.error('[CATEGORY SYNC] Failed to parse response as JSON:', parseError.message)
        console.error('[CATEGORY SYNC] Response text (first 1000 chars):', responseText.substring(0, 1000))
        return NextResponse.json({ 
          success: false, 
          error: `Invalid JSON response from ShopRenter: ${parseError.message}` 
        }, { status: 400 })
      }

      if (!categoryData || !categoryData.id) {
        console.error('[CATEGORY SYNC] Missing category ID in response:', categoryData)
        console.error('[CATEGORY SYNC] Full response structure:', JSON.stringify(categoryData).substring(0, 500))
        return NextResponse.json({ 
          success: false, 
          error: 'Invalid category data received (missing ID). ShopRenter may have returned an error response.' 
        }, { status: 400 })
      }

      // Get Hungarian language ID for name extraction
      let hungarianLanguageId: string | undefined
      try {
        const { authHeader: authHeaderForLang, apiBaseUrl } = await getShopRenterAuthHeader(
          shopName,
          connection.username,
          connection.password,
          connection.api_url
        )
        hungarianLanguageId = await getLanguageId(apiBaseUrl, authHeaderForLang, 'hu')
        if (hungarianLanguageId) {
          console.log(`[CATEGORY SYNC] Hungarian language ID: ${hungarianLanguageId}`)
        } else {
          console.warn('[CATEGORY SYNC] Could not get Hungarian language ID, will use fallback logic')
        }
      } catch (langError: any) {
        console.warn('[CATEGORY SYNC] Error getting Hungarian language ID:', langError?.message)
        // Continue without it - fallback logic will handle it
      }

      // Sync the single category
      try {
        await syncCategoryToDatabase(supabase, connection, categoryData, shopName, forceSync, hungarianLanguageId)
        console.log(`[CATEGORY SYNC] Successfully synced category ${categoryData.id} to database`)
      } catch (syncError: any) {
        console.error('[CATEGORY SYNC] Error syncing category to database:', syncError)
        return NextResponse.json({ 
          success: false, 
          error: `Database sync failed: ${syncError.message || 'Unknown error'}` 
        }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: 'Category synced successfully'
      })
    }

    // Clear any previous progress
    clearProgress(`categories-${connectionId}`)

    // Start background sync process for all categories
    processSyncInBackground(
      supabase,
      connection,
      connectionId,
      apiUrl,
      authHeader,
      shopName
    ).catch(error => {
      console.error('[CATEGORY SYNC] Background process error:', error)
    })

    // Return immediately
    return NextResponse.json({
      success: true,
      message: 'Category sync started',
      connectionId: connectionId
    })
  } catch (error: any) {
    console.error('[CATEGORY SYNC] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * GET /api/connections/[id]/sync-categories
 * Get sync progress
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: connectionId } = await params
  
  const { updateProgress, getProgress } = await import('@/lib/sync-progress-store')
  const progress = getProgress(`categories-${connectionId}`)
  
  return NextResponse.json({
    progress: progress || null
  })
}

/**
 * Process sync in background
 */
async function processSyncInBackground(
  supabase: any,
  connection: any,
  connectionId: string,
  apiUrl: string,
  authHeader: string,
  shopName: string
) {
  const rateLimiter = getShopRenterRateLimiter()
  let syncedCount = 0
  let errorCount = 0
  const errors: string[] = []
  
  // Get Hungarian language ID for name extraction
  let hungarianLanguageId: string | undefined
  try {
    const { authHeader: authHeaderForLang, apiBaseUrl } = await getShopRenterAuthHeader(
      shopName,
      connection.username,
      connection.password,
      connection.api_url
    )
    hungarianLanguageId = await getLanguageId(apiBaseUrl, authHeaderForLang, 'hu')
    if (hungarianLanguageId) {
      console.log(`[CATEGORY SYNC] Hungarian language ID: ${hungarianLanguageId}`)
    } else {
      console.warn('[CATEGORY SYNC] Could not get Hungarian language ID, will use fallback logic')
    }
  } catch (langError: any) {
    console.warn('[CATEGORY SYNC] Error getting Hungarian language ID:', langError?.message)
    // Continue without it - fallback logic will handle it
  }
  
  try {
    // Step 1: Fetch all category IDs
    console.log('[CATEGORY SYNC] Fetching category IDs...')
    updateProgress(`categories-${connectionId}`, {
      total: 0,
      synced: 0,
      current: 0,
      status: 'fetching',
      errors: 0
    })
    
    const allCategoryIds: string[] = []
    let page = 0
    const limit = 200
    
    while (true) {
      if (shouldStopSync(`categories-${connectionId}`)) {
        console.log('[CATEGORY SYNC] Sync stopped by user')
        return
      }
      
      const categoriesUrl = `${apiUrl}/categories?page=${page}&limit=${limit}&full=0`
      
      const response = await rateLimiter.execute(async () => {
        return fetch(categoriesUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': authHeader
          },
          signal: AbortSignal.timeout(30000)
        })
      })
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        
        // Check for rate limiting (429) or blocking
        if (response.status === 429) {
          console.error('[CATEGORY SYNC] Rate limit exceeded while fetching category list! ShopRenter is blocking requests.')
          throw new Error(`Rate limit exceeded (429). ShopRenter is blocking requests. Please wait a few minutes before trying again.`)
        }
        
        // Check for other blocking status codes
        if (response.status === 403) {
          console.error('[CATEGORY SYNC] Access forbidden (403) while fetching category list. ShopRenter may be blocking the API key or IP.')
          throw new Error(`Access forbidden (403). ShopRenter may be blocking requests. Check API credentials.`)
        }
        
        throw new Error(`Failed to fetch categories: ${response.status} - ${errorText.substring(0, 200)}`)
      }
      
      const data = await response.json()
      const items = data.items || []
      
      if (items.length === 0) {
        break
      }
      
      // Extract category IDs
      for (const item of items) {
        if (item.id) {
          allCategoryIds.push(item.id)
        } else if (item.href) {
          const match = item.href.match(/\/categories\/([^\/\?]+)/)
          if (match && match[1]) {
            allCategoryIds.push(match[1])
          }
        }
      }
      
      // Check if there's a next page
      if (!data.next || items.length < limit) {
        break
      }
      
      page++
      await delay(400) // Rate limiting: 400ms = 2.5 req/sec (safe margin)
    }
    
    console.log(`[CATEGORY SYNC] Found ${allCategoryIds.length} categories`)
    
    updateProgress(`categories-${connectionId}`, {
      total: allCategoryIds.length,
      synced: 0,
      current: 0,
      status: 'syncing',
      errors: 0
    })
    
    // Step 2: Process categories in batches
    const batchSize = 200
    const batches: string[][] = []
    
    for (let i = 0; i < allCategoryIds.length; i += batchSize) {
      batches.push(allCategoryIds.slice(i, i + batchSize))
    }
    
    const totalBatches = batches.length
    console.log(`[CATEGORY SYNC] Processing ${totalBatches} batches`)
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      if (shouldStopSync(`categories-${connectionId}`)) {
        console.log(`[CATEGORY SYNC] Sync stopped at batch ${batchIndex + 1}/${totalBatches}`)
        updateProgress(`categories-${connectionId}`, {
          status: 'stopped',
          synced: syncedCount,
          current: syncedCount + errorCount,
          errors: errorCount
        })
        return
      }
      
      const batch = batches[batchIndex]
      
      // Build batch request - URI must be full URL
      const batchRequests = batch.map(categoryId => {
        // Ensure full URL format
        let categoryUri = `${apiUrl}/categoryExtend/${categoryId}?full=1`
        // If apiUrl doesn't start with http, add it
        if (!categoryUri.startsWith('http://') && !categoryUri.startsWith('https://')) {
          categoryUri = `http://${categoryUri}`
        }
        return {
          method: 'GET',
          uri: categoryUri
        }
      })
      
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
        errors.push(`Batch ${batchIndex + 1} error: ${batchResponse.status} - ${errorText.substring(0, 200)}`)
        errorCount += batch.length
        continue
      }
      
      // Parse batch response
      let batchData
      try {
        batchData = await batchResponse.json()
      } catch (parseError) {
        const errorText = await batchResponse.text().catch(() => 'Unknown error')
        console.error(`[CATEGORY SYNC] Failed to parse batch response:`, errorText.substring(0, 500))
        errors.push(`Batch ${batchIndex + 1} parse error: ${errorText.substring(0, 200)}`)
        errorCount += batch.length
        continue
      }
      
      // Handle different batch response structures
      let responses: any[] = []
      if (batchData.requests?.request) {
        responses = Array.isArray(batchData.requests.request) 
          ? batchData.requests.request 
          : [batchData.requests.request]
      } else if (batchData.request) {
        responses = Array.isArray(batchData.request) 
          ? batchData.request 
          : [batchData.request]
      } else if (Array.isArray(batchData)) {
        responses = batchData
      } else {
        console.error(`[CATEGORY SYNC] Unexpected batch response structure:`, JSON.stringify(batchData).substring(0, 500))
        errors.push(`Batch ${batchIndex + 1}: Unexpected response structure`)
        errorCount += batch.length
        continue
      }
      
      console.log(`[CATEGORY SYNC] Batch ${batchIndex + 1} returned ${responses.length} responses (expected ${batch.length})`)
      
      // If response count doesn't match, log the structure for debugging
      if (responses.length !== batch.length) {
        console.warn(`[CATEGORY SYNC] Response count mismatch! Expected ${batch.length}, got ${responses.length}`)
        console.log(`[CATEGORY SYNC] Batch response structure:`, JSON.stringify(batchData).substring(0, 1000))
      }
      
      // Process each category - use the minimum of responses.length and batch.length
      const itemsToProcess = Math.min(responses.length, batch.length)
      for (let i = 0; i < itemsToProcess; i++) {
        const response = responses[i]
        const categoryId = batch[i] // Get original category ID from batch
        
        try {
          // Check response structure
          const statusCode = response.response?.header?.statusCode || 
                            response.header?.statusCode || 
                            response.statusCode
          
          if (statusCode !== '200' && statusCode !== 200) {
            const errorMsg = response.response?.body?.message || 
                           response.response?.body || 
                           response.body || 
                           `HTTP ${statusCode}`
            errorCount++
            const errorMessage = `Category ${categoryId}: ${errorMsg}`
            errors.push(errorMessage)
            console.error(`[CATEGORY SYNC] ${errorMessage}`)
            continue
          }
          
          // Extract category data
          const category = response.response?.body || response.body || response
          
          if (!category || !category.id) {
            errorCount++
            const errorMessage = `Category ${categoryId}: Missing category data in response. Response structure: ${JSON.stringify(response).substring(0, 200)}`
            errors.push(errorMessage)
            console.error(`[CATEGORY SYNC] ${errorMessage}`)
            continue
          }
          
          // Sync category
          await syncCategoryToDatabase(supabase, connection, category, shopName, false, hungarianLanguageId)
          syncedCount++
          console.log(`[CATEGORY SYNC] Successfully synced category ${category.id}`)
          
        } catch (error: any) {
          errorCount++
          const errorMessage = `Category ${categoryId}: ${error.message || 'Unknown error'}`
          errors.push(errorMessage)
          console.error(`[CATEGORY SYNC] ${errorMessage}`, error)
        }
      }
      
      // Update progress
      updateProgress(`categories-${connectionId}`, {
        synced: syncedCount,
        current: syncedCount + errorCount,
        status: 'syncing',
        errors: errorCount
      })
      
      // Rate limiting delay between batches
      if (batchIndex < batches.length - 1) {
        await delay(400) // 400ms = 2.5 req/sec
      }
    }
    
    // Step 3: Update parent category relationships
    console.log('[CATEGORY SYNC] Updating parent category relationships...')
    await updateParentCategoryRelations(supabase, connectionId)
    
    // Step 4: Sync product-category relations (optional, can be done separately)
    // For now, we'll skip this to keep the sync faster
    // It can be done in a separate endpoint if needed
    
    // Final update
    updateProgress(`categories-${connectionId}`, {
      synced: syncedCount,
      current: syncedCount + errorCount,
      status: 'completed',
      errors: errorCount,
      errorMessages: errors.slice(0, 50) // Store first 50 errors for debugging
    })
    
    console.log(`[CATEGORY SYNC] Completed: ${syncedCount} synced, ${errorCount} errors`)
    if (errors.length > 0) {
      console.error(`[CATEGORY SYNC] First 10 errors:`, errors.slice(0, 10))
    }
    
  } catch (error: any) {
    console.error('[CATEGORY SYNC] Background process error:', error)
    updateProgress(`categories-${connectionId}`, {
      status: 'error',
      errors: errorCount,
      synced: syncedCount,
      current: syncedCount + errorCount
    })
  }
}
