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

    console.log(`[CATEGORY SYNC] Using ${useOAuth ? 'OAuth' : 'Basic Auth'} for ${shopName}`)
    console.log(`[CATEGORY SYNC] API Base URL: ${apiBaseUrl}`)

    // Validate authentication by testing a simple API call
    const testUrl = `${apiBaseUrl}/categories?limit=1`
    console.log(`[CATEGORY SYNC] Testing authentication: ${testUrl}`)
    try {
      const testResponse = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader
        },
        signal: AbortSignal.timeout(10000)
      })
      
      if (!testResponse.ok) {
        const testErrorText = await testResponse.text().catch(() => '')
        console.error(`[CATEGORY SYNC] Authentication test failed: ${testResponse.status} - ${testErrorText.substring(0, 200)}`)
        
        if (testResponse.status === 401 || testResponse.status === 403) {
          await supabase
            .from('shoprenter_categories')
            .update({
              sync_status: 'error',
              sync_error: `Hitelesítési hiba: ${testResponse.status}`,
              last_synced_at: new Date().toISOString()
            })
            .eq('id', categoryId)
          
          return NextResponse.json({ 
            success: false, 
            error: `Hitelesítési hiba a ShopRenter API-val (${testResponse.status}). Ellenőrizze a kapcsolat beállításait (felhasználónév, jelszó, API URL).` 
          }, { status: 401 })
        }
      } else {
        console.log(`[CATEGORY SYNC] Authentication test successful`)
      }
    } catch (testError: any) {
      console.error('[CATEGORY SYNC] Authentication test error:', testError)
      // Continue - might be network issue, but log it
    }

    // Get language ID
    const languageId = await getLanguageId(apiBaseUrl, authHeader, 'hu')
    if (!languageId) {
      console.error('[CATEGORY SYNC] Failed to get language ID - this might indicate authentication issues')
      return NextResponse.json({ 
        success: false, 
        error: 'Nem sikerült meghatározni a nyelv azonosítóját. Lehet, hogy hitelesítési probléma van.' 
      }, { status: 500 })
    }
    
    console.log(`[CATEGORY SYNC] Language ID: ${languageId}`)

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
    let categoryUpdateSuccess = true
    if (Object.keys(categoryPayload).length > 0) {
      const categoryUpdateUrl = `${apiBaseUrl}/categories/${category.shoprenter_id}`
      console.log(`[CATEGORY SYNC] Updating category data: PUT ${categoryUpdateUrl}`)
      console.log(`[CATEGORY SYNC] Category payload:`, JSON.stringify(categoryPayload))
      
      let categoryUpdateResponse: Response
      try {
        categoryUpdateResponse = await rateLimiter.execute(async () => {
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
      } catch (fetchError: any) {
        console.error('[CATEGORY SYNC] Fetch error during category update:', fetchError)
        categoryUpdateSuccess = false
        return NextResponse.json({ 
          success: false, 
          error: `Hálózati hiba a kategória frissítésekor: ${fetchError.message || 'Ismeretlen hiba'}` 
        }, { status: 500 })
      }

      const categoryResponseText = await categoryUpdateResponse.text().catch(() => '')
      console.log(`[CATEGORY SYNC] Category update response status: ${categoryUpdateResponse.status}`)
      console.log(`[CATEGORY SYNC] Category update response body length: ${categoryResponseText.length} chars`)
      
      if (!categoryUpdateResponse.ok) {
        const errorText = categoryResponseText || 'Unknown error'
        console.error(`[CATEGORY SYNC] Category data update failed: ${categoryUpdateResponse.status} - ${errorText.substring(0, 500)}`)
        categoryUpdateSuccess = false
        return NextResponse.json({ 
          success: false, 
          error: `ShopRenter API hiba a kategória frissítésekor (${categoryUpdateResponse.status}): ${errorText.substring(0, 200)}` 
        }, { status: categoryUpdateResponse.status })
      }
      
      // Validate response - ShopRenter should return something even if empty
      if (categoryResponseText && categoryResponseText.trim() !== '') {
        try {
          const categoryResult = JSON.parse(categoryResponseText)
          console.log(`[CATEGORY SYNC] Category data updated successfully, response:`, JSON.stringify(categoryResult).substring(0, 200))
        } catch (parseError) {
          console.warn('[CATEGORY SYNC] Category update response is not valid JSON, but status was OK')
        }
      } else {
        console.warn('[CATEGORY SYNC] Category update returned empty response (status OK, but no data)')
        // This might be OK for PUT requests, but log it
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
    // NOTE: shortDescription and heading are NOT valid fields for categoryDescriptions API
    // They only appear in categoryExtend responses but cannot be set via POST/PUT
    const payload: any = {
      name: huDescription.name || category.name || '',
      metaKeywords: huDescription.meta_keywords || null,
      metaDescription: huDescription.meta_description || null,
      description: huDescription.description || null,
      customTitle: huDescription.custom_title || null,
      robotsMetaTag: huDescription.robots_meta_tag || '0',
      footerSeoText: huDescription.footer_seo_text || null,
      category: {
        id: category.shoprenter_id
      },
      language: {
        id: languageId
      }
    }

    // Remove null values (but keep empty strings and required fields)
    Object.keys(payload).forEach(key => {
      if (payload[key] === null) {
        delete payload[key]
      }
    })

    // Ensure we have at least name and required fields
    if (!payload.name && !payload.category?.id) {
      console.error('[CATEGORY SYNC] Payload is missing required fields:', payload)
      return NextResponse.json({ 
        success: false, 
        error: 'Hiányzó kötelező mezők a szinkronizáláshoz' 
      }, { status: 400 })
    }

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
    console.log(`[CATEGORY SYNC] Payload:`, JSON.stringify(payload, null, 2))
    console.log(`[CATEGORY SYNC] Description ID: ${descriptionId || 'none (will create new)'}`)

    // Push to ShopRenter
    let pushResponse: Response
    try {
      pushResponse = await rateLimiter.execute(async () => {
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
    } catch (fetchError: any) {
      console.error('[CATEGORY SYNC] Fetch error during push:', fetchError)
      return NextResponse.json({ 
        success: false, 
        error: `Hálózati hiba: ${fetchError.message || 'Ismeretlen hiba'}` 
      }, { status: 500 })
    }

    const responseText = await pushResponse.text().catch(() => '')
    console.log(`[CATEGORY SYNC] Push response status: ${pushResponse.status}`)
    console.log(`[CATEGORY SYNC] Push response body length: ${responseText.length} chars`)
    console.log(`[CATEGORY SYNC] Push response body: ${responseText.substring(0, 500)}`)

    if (!pushResponse.ok) {
      console.error(`[CATEGORY SYNC] Push failed: ${pushResponse.status} - ${responseText}`)
      
      // Check for rate limiting (429) or blocking
      if (pushResponse.status === 429) {
        console.error('[CATEGORY SYNC] Rate limit exceeded! ShopRenter is blocking requests.')
        await supabase
          .from('shoprenter_categories')
          .update({
            sync_status: 'error',
            sync_error: `Rate limit exceeded (429). ShopRenter is blocking requests. Please wait a few minutes before trying again.`,
            last_synced_at: new Date().toISOString()
          })
          .eq('id', categoryId)
        
        return NextResponse.json({ 
          success: false, 
          error: 'ShopRenter rate limit exceeded (429). Kérjük, várjon néhány percet, majd próbálja újra.' 
        }, { status: 429 })
      }
      
      // Check for other blocking status codes
      if (pushResponse.status === 403) {
        console.error('[CATEGORY SYNC] Access forbidden (403). ShopRenter may be blocking the API key or IP.')
        await supabase
          .from('shoprenter_categories')
          .update({
            sync_status: 'error',
            sync_error: `Access forbidden (403). ShopRenter may be blocking requests. Check API credentials.`,
            last_synced_at: new Date().toISOString()
          })
          .eq('id', categoryId)
      }
      
      // Update category sync status
      await supabase
        .from('shoprenter_categories')
        .update({
          sync_status: 'error',
          sync_error: `Push failed: ${pushResponse.status} - ${responseText.substring(0, 200)}`,
          last_synced_at: new Date().toISOString()
        })
        .eq('id', categoryId)

      return NextResponse.json({ 
        success: false, 
        error: `ShopRenter API hiba (${pushResponse.status}): ${responseText.substring(0, 200)}` 
      }, { status: pushResponse.status })
    }

    // Validate response - ShopRenter should return data for POST/PUT
    if (!responseText || responseText.trim() === '') {
      console.error('[CATEGORY SYNC] Push response body is EMPTY - ShopRenter may have rejected the request silently')
      console.error('[CATEGORY SYNC] This usually indicates an authentication or validation error')
      
      // Update category sync status
      await supabase
        .from('shoprenter_categories')
        .update({
          sync_status: 'error',
          sync_error: 'ShopRenter returned empty response (possible auth/validation error)',
          last_synced_at: new Date().toISOString()
        })
        .eq('id', categoryId)
      
      return NextResponse.json({ 
        success: false, 
        error: 'ShopRenter üres választ adott. Lehet, hogy hitelesítési vagy validációs hiba történt. Ellenőrizze a kapcsolat beállításait.' 
      }, { status: 500 })
    }

    // Parse response
    let pushResult: any = null
    try {
      pushResult = JSON.parse(responseText)
      console.log(`[CATEGORY SYNC] Successfully parsed push response`)
      
      // Check if ShopRenter returned an error in the JSON
      if (pushResult.error || pushResult.message?.toLowerCase().includes('error')) {
        console.error('[CATEGORY SYNC] ShopRenter returned error in response:', pushResult)
        await supabase
          .from('shoprenter_categories')
          .update({
            sync_status: 'error',
            sync_error: `ShopRenter error: ${JSON.stringify(pushResult).substring(0, 200)}`,
            last_synced_at: new Date().toISOString()
          })
          .eq('id', categoryId)
        
        return NextResponse.json({ 
          success: false, 
          error: `ShopRenter hiba: ${pushResult.error || pushResult.message || 'Ismeretlen hiba'}` 
        }, { status: 500 })
      }
    } catch (parseError: any) {
      console.error('[CATEGORY SYNC] Failed to parse push response as JSON:', parseError.message)
      console.error('[CATEGORY SYNC] Response text (first 1000 chars):', responseText.substring(0, 1000))
      
      // If we can't parse the response, it's likely an error
      await supabase
        .from('shoprenter_categories')
        .update({
          sync_status: 'error',
          sync_error: `Invalid response from ShopRenter: ${responseText.substring(0, 200)}`,
          last_synced_at: new Date().toISOString()
        })
        .eq('id', categoryId)
      
      return NextResponse.json({ 
        success: false, 
        error: `ShopRenter érvénytelen választ adott. Ellenőrizze a kapcsolat beállításait.` 
      }, { status: 500 })
    }

    // Extract description ID from response if we created it
    let finalDescriptionId = descriptionId
    if (!finalDescriptionId && pushResult?.id) {
      finalDescriptionId = pushResult.id
      console.log(`[CATEGORY SYNC] Got new description ID from response: ${finalDescriptionId}`)
    } else if (!finalDescriptionId && pushResult?.href) {
      const parts = pushResult.href.split('/')
      finalDescriptionId = parts[parts.length - 1]
      console.log(`[CATEGORY SYNC] Extracted description ID from href: ${finalDescriptionId}`)
    }
    
    if (finalDescriptionId) {
      console.log(`[CATEGORY SYNC] Using description ID: ${finalDescriptionId}`)
    } else {
      console.warn('[CATEGORY SYNC] No description ID available (may cause issues)')
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
    console.log(`[CATEGORY SYNC] Pulling back from ShopRenter to verify: ${pullUrl}`)
    
    // Use rate limiter for pull request too
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

    console.log(`[CATEGORY SYNC] Pull response status: ${pullResponse.status}`)

    // Check for rate limiting or blocking on pull
    if (pullResponse.status === 429) {
      console.error('[CATEGORY SYNC] Rate limit exceeded on pull! ShopRenter is blocking requests.')
      console.warn('[CATEGORY SYNC] Push was successful, but pull verification failed due to rate limiting.')
      // Don't fail the entire sync, but log it
    } else if (pullResponse.status === 403) {
      console.error('[CATEGORY SYNC] Access forbidden (403) on pull. ShopRenter may be blocking the API key or IP.')
      console.warn('[CATEGORY SYNC] Push was successful, but pull verification failed due to access forbidden.')
    }

    if (pullResponse.ok) {
      const pullData = await pullResponse.json().catch(() => null)
      
      if (pullData) {
        console.log('[CATEGORY SYNC] Successfully pulled category data from ShopRenter, updating database...')
        // Update local database with pulled data (sync from ShopRenter)
        // This ensures local DB matches what's in ShopRenter
        // Forward cookies from original request for authentication (same as products sync)
        const cookieHeader = request.headers.get('cookie') || ''
        const syncResponse = await fetch(`${request.nextUrl.origin}/api/connections/${connection.id}/sync-categories`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': cookieHeader
          },
          body: JSON.stringify({
            category_id: category.shoprenter_id
          })
        })

        // Don't fail if pull sync fails, we already pushed successfully
        if (!syncResponse.ok) {
          const errorText = await syncResponse.text().catch(() => 'Unknown error')
          console.error(`[CATEGORY SYNC] Pull verification failed (${syncResponse.status}): ${errorText.substring(0, 500)}`)
          console.error(`[CATEGORY SYNC] This means the push succeeded but the database update failed`)
        } else {
          console.log('[CATEGORY SYNC] Pull verification and database update successful')
        }
      } else {
        console.warn('[CATEGORY SYNC] Pull response data was null or empty')
      }
    } else {
      const errorText = await pullResponse.text().catch(() => 'Unknown error')
      console.error(`[CATEGORY SYNC] Pull verification failed: ${pullResponse.status} - ${errorText.substring(0, 200)}`)
      console.warn('[CATEGORY SYNC] Push was successful, but pull verification failed. Database may not be updated.')
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
