import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getConnectionById } from '@/lib/connections-server'
import {
  extractShopNameFromUrl,
  getShopRenterAuthHeader,
  getLanguageId,
  getProductDescriptionId
} from '@/lib/shoprenter-api'

/**
 * POST /api/products/[id]/sync
 * Sync product TO ShopRenter (push local changes) and then pull back to verify
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    // Get product with description
    const { data: product, error: productError } = await supabase
      .from('shoprenter_products')
      .select(`
        *,
        webshop_connections(*),
        shoprenter_product_descriptions(*)
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const connection = product.webshop_connections
    if (!connection || connection.connection_type !== 'shoprenter') {
      return NextResponse.json({ error: 'Invalid connection' }, { status: 400 })
    }

    // Get Hungarian description (or first available)
    const descriptions = product.shoprenter_product_descriptions || []
    const huDescription = descriptions.find((d: any) => d.language_code === 'hu') || descriptions[0]
    
    if (!huDescription) {
      return NextResponse.json({ 
        success: false, 
        error: 'Nincs leírás a termékhez. Kérjük, mentse el a leírást először.' 
      }, { status: 400 })
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

    // Get product description ID
    const descriptionId = await getProductDescriptionId(
      apiBaseUrl,
      authHeader,
      product.shoprenter_id,
      languageId,
      huDescription.shoprenter_id
    )

    // Prepare payload for ShopRenter
    const payload: any = {
      name: huDescription.name || product.name || '',
      metaTitle: huDescription.meta_title || null,
      metaKeywords: huDescription.meta_keywords || null,
      metaDescription: huDescription.meta_description || null,
      shortDescription: huDescription.short_description || null,
      description: huDescription.description || null,
      product: {
        id: product.shoprenter_id
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
      updateUrl = `${apiBaseUrl}/productDescriptions/${descriptionId}`
      method = 'PUT'
    } else {
      // Create new description
      updateUrl = `${apiBaseUrl}/productDescriptions`
      method = 'POST'
    }

    console.log(`[SYNC] ${method} ${updateUrl}`)
    console.log(`[SYNC] Payload:`, JSON.stringify(payload, null, 2).substring(0, 500))

    // Push to ShopRenter
    const pushResponse = await fetch(updateUrl, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000)
    })

    if (!pushResponse.ok) {
      const errorText = await pushResponse.text().catch(() => 'Unknown error')
      console.error(`[SYNC] Push failed: ${pushResponse.status} - ${errorText}`)
      
      // Update product sync status
      await supabase
        .from('shoprenter_products')
        .update({
          sync_status: 'error',
          sync_error: `Push failed: ${pushResponse.status} - ${errorText.substring(0, 200)}`,
          last_synced_at: new Date().toISOString()
        })
        .eq('id', id)

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
        .from('shoprenter_product_descriptions')
        .update({ shoprenter_id: finalDescriptionId })
        .eq('id', huDescription.id)
    }

    // Now pull back from ShopRenter to verify
    const pullUrl = useOAuth 
      ? `${apiBaseUrl}/productExtend/${product.shoprenter_id}?full=1`
      : `${apiBaseUrl}/productExtend/${product.shoprenter_id}?full=1`
    
    const pullResponse = await fetch(pullUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': authHeader
      },
      signal: AbortSignal.timeout(30000)
    })

    if (pullResponse.ok) {
      const pullData = await pullResponse.json().catch(() => null)
      
      if (pullData) {
        // Update local database with pulled data (sync from ShopRenter)
        // This ensures local DB matches what's in ShopRenter
        const syncResponse = await fetch(`${request.nextUrl.origin}/api/connections/${connection.id}/sync-products`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            product_id: product.shoprenter_id
          })
        })

        // Don't fail if pull sync fails, we already pushed successfully
        if (!syncResponse.ok) {
          console.warn('[SYNC] Pull verification failed, but push was successful')
        }
      }
    }

    // Update product sync status
    await supabase
      .from('shoprenter_products')
      .update({
        sync_status: 'synced',
        sync_error: null,
        last_synced_at: new Date().toISOString()
      })
      .eq('id', id)

    return NextResponse.json({ 
      success: true,
      message: 'Termék sikeresen szinkronizálva a webshopba'
    })
  } catch (error) {
    console.error('Error syncing product:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
