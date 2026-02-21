import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getCategoryById } from '@/lib/categories-server'
import { getConnectionById } from '@/lib/connections-server'
import { Buffer } from 'buffer'
import { extractShopNameFromUrl } from '@/lib/shoprenter-api'
import { getShopRenterRateLimiter } from '@/lib/shoprenter-rate-limiter'

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
        console.error(`[CATEGORY SYNC] Error syncing description ${descriptionData.shoprenter_id}:`, error)
      }
    } catch (error) {
      console.error('[CATEGORY SYNC] Error processing description:', error)
    }
  }
}

/**
 * POST /api/categories/[id]/sync
 * Sync single category from ShopRenter
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: categoryId } = await params
    
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

    // Get category
    const category = await getCategoryById(categoryId)
    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    // Get connection
    const connection = await getConnectionById(category.connection_id)
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

    const rateLimiter = getShopRenterRateLimiter()

    // Fetch category from ShopRenter
    const categoryUrl = `${apiUrl}/categoryExtend/${category.shoprenter_id}?full=1`
    
    const response = await rateLimiter.execute(async () => {
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

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      return NextResponse.json({ 
        success: false, 
        error: `API error: ${response.status} - ${errorText.substring(0, 200)}` 
      }, { status: response.status })
    }

    const categoryData = await response.json().catch(() => null)
    if (!categoryData || !categoryData.id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid category data received' 
      }, { status: 400 })
    }

    // Extract category data
    const innerId = categoryData.innerId || null
    const picture = categoryData.picture || null
    const sortOrder = parseInt(categoryData.sortOrder || '0', 10)
    const status = categoryData.status === '1' || categoryData.status === 1 ? 1 : 0
    const productsStatus = categoryData.productsStatus === '1' || categoryData.productsStatus === 1 ? 1 : 0
    
    // Extract URL alias
    const urlAliasData = extractUrlAlias(categoryData)
    const categoryUrlFull = constructCategoryUrl(shopName, urlAliasData.slug)
    
    // Extract parent category ID
    const parentCategoryShopRenterId = extractParentCategoryId(categoryData)
    
    // Get category name from first description
    let categoryName = null
    if (categoryData.categoryDescriptions && Array.isArray(categoryData.categoryDescriptions) && categoryData.categoryDescriptions.length > 0) {
      categoryName = categoryData.categoryDescriptions[0].name || null
    }
    
    // Find parent category if exists
    let parentCategoryId = null
    if (parentCategoryShopRenterId) {
      const { data: parentCategory } = await supabase
        .from('shoprenter_categories')
        .select('id')
        .eq('connection_id', connection.id)
        .eq('shoprenter_id', parentCategoryShopRenterId)
        .is('deleted_at', null)
        .single()
      
      if (parentCategory) {
        parentCategoryId = parentCategory.id
      }
    }
    
    // Update category
    const updateData = {
      shoprenter_inner_id: innerId,
      name: categoryName,
      picture: picture,
      sort_order: sortOrder,
      status: status,
      products_status: productsStatus,
      parent_category_id: parentCategoryId,
      parent_category_shoprenter_id: parentCategoryShopRenterId,
      url_slug: urlAliasData.slug,
      url_alias_id: urlAliasData.id,
      category_url: categoryUrlFull,
      date_created: categoryData.dateCreated || null,
      date_updated: categoryData.dateUpdated || null,
      sync_status: 'synced',
      sync_error: null,
      last_synced_at: new Date().toISOString()
    }
    
    const { data: updatedCategory, error: updateError } = await supabase
      .from('shoprenter_categories')
      .update(updateData)
      .eq('id', categoryId)
      .select()
      .single()
    
    if (updateError) {
      return NextResponse.json({ 
        success: false, 
        error: `Failed to update category: ${updateError.message}` 
      }, { status: 500 })
    }
    
    // Sync category descriptions
    if (categoryData.categoryDescriptions && Array.isArray(categoryData.categoryDescriptions)) {
      await syncCategoryDescriptions(supabase, categoryId, categoryData.categoryDescriptions)
    }
    
    return NextResponse.json({
      success: true,
      category: updatedCategory
    })
  } catch (error: any) {
    console.error('[CATEGORY SYNC] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 })
  }
}
