import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getCategoryById, getCategoryWithDescriptions } from '@/lib/categories-server'
import { getConnectionById } from '@/lib/connections-server'
import {
  extractShopNameFromUrl,
  getShopRenterAuthHeader,
  getLanguageId,
  getCategoryDescriptionId
} from '@/lib/shoprenter-api'
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
 * Sync category TO ShopRenter (push local changes) and then pull back to verify
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

    // Get category with descriptions
    const category = await getCategoryWithDescriptions(categoryId)
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

    // Get authentication
    const { authHeader, apiBaseUrl, useOAuth } = await getShopRenterAuthHeader(
      shopName,
      connection.username,
      connection.password,
      connection.api_url
    )

    // Get language ID
    const languageId = await getLanguageId(apiBaseUrl, authHeader, 'hu')
    if (!languageId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Nem sikerült meghatározni a nyelv azonosítóját' 
      }, { status: 500 })
    }

    // Get Hungarian description (or first available)
    const descriptions = category.shoprenter_category_descriptions || []
    const huDescription = descriptions.find((d: any) => d.language_id === languageId) || descriptions[0]
    
    if (!huDescription) {
      return NextResponse.json({ 
        success: false, 
        error: 'Nincs leírás a kategóriához. Kérjük, mentse el a leírást először.' 
      }, { status: 400 })
    }

    const rateLimiter = getShopRenterRateLimiter()

    // First, update category basic data (status, sortOrder, etc.) if changed
    const categoryPayload: any = {}
    
    // Add status if exists
    if (category.status !== null && category.status !== undefined) {
      categoryPayload.status = String(category.status)
    }
    
    // Add sortOrder if exists
    if (category.sort_order !== null && category.sort_order !== undefined) {
      categoryPayload.sortOrder = String(category.sort_order)
    }
    
    // Add productsStatus if exists
    if (category.products_status !== null && category.products_status !== undefined) {
      categoryPayload.productsStatus = String(category.products_status)
    }
    
    // Add picture if exists
    if (category.picture !== null && category.picture !== undefined) {
      categoryPayload.picture = category.picture
    }
    
    // Add parent category if exists
    if (category.parent_category_shoprenter_id) {
      categoryPayload.parentCategory = {
        id: category.parent_category_shoprenter_id
      }
    }
    
    // Only update if there's something to update
    if (Object.keys(categoryPayload).length > 0) {
      const categoryUpdateUrl = `${apiBaseUrl}/categories/${category.shoprenter_id}`
      console.log(`[CATEGORY SYNC] Updating category data: PUT ${categoryUpdateUrl}`)
      console.log(`[CATEGORY SYNC] Category payload:`, JSON.stringify(categoryPayload))
      
      const categoryUpdateResponse = await rateLimiter.execute(async () => {
        return fetch(categoryUpdateUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': authHeader
          },
          body: JSON.stringify(categoryPayload),
          signal: AbortSignal.timeout(30000)
        })
      })

      if (!categoryUpdateResponse.ok) {
        const errorText = await categoryUpdateResponse.text().catch(() => 'Unknown error')
        console.warn(`[CATEGORY SYNC] Category data update failed: ${categoryUpdateResponse.status} - ${errorText.substring(0, 200)}`)
        // Continue with description sync even if category update fails
      } else {
        console.log(`[CATEGORY SYNC] Category data updated successfully`)
      }
    }

    // Get category description ID
    const descriptionId = await getCategoryDescriptionId(
      apiBaseUrl,
      authHeader,
      category.shoprenter_id,
      languageId,
      huDescription.shoprenter_id
    )

    // Prepare payload for ShopRenter
    const payload: any = {
      name: huDescription.name || category.name || '',
      metaKeywords: huDescription.meta_keywords || null,
      metaDescription: huDescription.meta_description || null,
      description: huDescription.description || null,
      customTitle: huDescription.custom_title || null,
      robotsMetaTag: huDescription.robots_meta_tag || '0',
      footerSeoText: huDescription.footer_seo_text || null,
      heading: huDescription.heading || null,
      shortDescription: huDescription.short_description || null,
      category: {
        id: category.shoprenter_id
      },
      language: {
        id: languageId
      }
    }

    // Remove null values
    Object.keys(payload).forEach(key => {
      if (payload[key] === null) {
        delete payload[key]
      }
    })

    // Determine endpoint - use PUT if we have description ID, POST if not
    let updateUrl: string
    let method: string

    if (descriptionId) {
      // Update existing description
      updateUrl = `${apiBaseUrl}/categoryDescriptions/${descriptionId}`
      method = 'PUT'
    } else {
      // Create new description
      updateUrl = `${apiBaseUrl}/categoryDescriptions`
      method = 'POST'
    }

    console.log(`[CATEGORY SYNC] ${method} ${updateUrl}`)
    console.log(`[CATEGORY SYNC] Payload:`, JSON.stringify(payload, null, 2).substring(0, 500))

    // Push to ShopRenter
    const pushResponse = await rateLimiter.execute(async () => {
      return fetch(updateUrl, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000)
      })
    })

    if (!pushResponse.ok) {
      const errorText = await pushResponse.text().catch(() => 'Unknown error')
      console.error(`[CATEGORY SYNC] Push failed: ${pushResponse.status} - ${errorText}`)
      
      // Update category sync status
      await supabase
        .from('shoprenter_categories')
        .update({
          sync_status: 'error',
          sync_error: `Push failed: ${pushResponse.status} - ${errorText.substring(0, 200)}`,
          last_synced_at: new Date().toISOString()
        })
        .eq('id', categoryId)

      return NextResponse.json({ 
        success: false, 
        error: `ShopRenter API hiba (${pushResponse.status}): ${errorText.substring(0, 200)}` 
      }, { status: pushResponse.status })
    }

    const pushResult = await pushResponse.json().catch(() => null)
    
    // Extract description ID from response if we created it
    let finalDescriptionId = descriptionId
    if (!finalDescriptionId && pushResult?.id) {
      finalDescriptionId = pushResult.id
    } else if (!finalDescriptionId && pushResult?.href) {
      const parts = pushResult.href.split('/')
      finalDescriptionId = parts[parts.length - 1]
    }

    // Update local database with ShopRenter description ID if we got it
    if (finalDescriptionId && !huDescription.shoprenter_id) {
      await supabase
        .from('shoprenter_category_descriptions')
        .update({ shoprenter_id: finalDescriptionId })
        .eq('id', huDescription.id)
    }

    // Now pull back from ShopRenter to verify
    const pullUrl = `${apiBaseUrl}/categoryExtend/${category.shoprenter_id}?full=1`
    
    const pullResponse = await rateLimiter.execute(async () => {
      return fetch(pullUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader
        },
        signal: AbortSignal.timeout(30000)
      })
    })

    if (pullResponse.ok) {
      const pullData = await pullResponse.json().catch(() => null)
      
      if (pullData && pullData.id) {
        // Extract category data from pulled response
        const innerId = pullData.innerId || null
        const picture = pullData.picture || null
        const sortOrder = parseInt(pullData.sortOrder || '0', 10)
        const status = pullData.status === '1' || pullData.status === 1 ? 1 : 0
        const productsStatus = pullData.productsStatus === '1' || pullData.productsStatus === 1 ? 1 : 0
        
        // Extract URL alias
        const urlAliasData = extractUrlAlias(pullData)
        const categoryUrlFull = constructCategoryUrl(shopName, urlAliasData.slug)
        
        // Extract parent category ID
        const parentCategoryShopRenterId = extractParentCategoryId(pullData)
        
        // Get category name from first description
        let categoryName = null
        if (pullData.categoryDescriptions && Array.isArray(pullData.categoryDescriptions) && pullData.categoryDescriptions.length > 0) {
          categoryName = pullData.categoryDescriptions[0].name || null
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
        
        // Update category with pulled data
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
          date_created: pullData.dateCreated || null,
          date_updated: pullData.dateUpdated || null,
          sync_status: 'synced',
          sync_error: null,
          last_synced_at: new Date().toISOString()
        }
        
        await supabase
          .from('shoprenter_categories')
          .update(updateData)
          .eq('id', categoryId)
        
        // Sync category descriptions
        if (pullData.categoryDescriptions && Array.isArray(pullData.categoryDescriptions)) {
          await syncCategoryDescriptions(supabase, categoryId, pullData.categoryDescriptions)
        }
      }
    } else {
      console.warn('[CATEGORY SYNC] Pull verification failed, but push was successful')
    }

    // Update category sync status
    await supabase
      .from('shoprenter_categories')
      .update({
        sync_status: 'synced',
        sync_error: null,
        last_synced_at: new Date().toISOString()
      })
      .eq('id', categoryId)

    return NextResponse.json({ 
      success: true,
      message: 'Kategória sikeresen szinkronizálva a webshopba'
    })
  } catch (error: any) {
    console.error('[CATEGORY SYNC] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 })
  }
}
