import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getConnectionById } from '@/lib/connections-server'
import { syncImageAltText, fetchProductImages } from '@/lib/shoprenter-image-service'
import { extractShopNameFromUrl, getShopRenterAuthHeader } from '@/lib/shoprenter-api'

/**
 * POST /api/products/[id]/images/[imageId]/sync-alt-text
 * Sync alt text to ShopRenter for a specific image
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  const { id: productId, imageId } = await params
  
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

  try {
    // Get product with connection
    const { data: product, error: productError } = await supabase
      .from('shoprenter_products')
      .select(`
        *,
        webshop_connections(*)
      `)
      .eq('id', productId)
      .single()

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const connection = product.webshop_connections
    if (!connection || connection.connection_type !== 'shoprenter') {
      return NextResponse.json({ error: 'Invalid connection' }, { status: 400 })
    }

    // Get image
    const { data: image, error: imageError } = await supabase
      .from('product_images')
      .select('*')
      .eq('id', imageId)
      .eq('product_id', productId)
      .single()

    if (imageError || !image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    if (!image.alt_text) {
      return NextResponse.json({ error: 'No alt text to sync' }, { status: 400 })
    }

    // Handle main image separately - it uses productExtend.imageAlt, not productImages
    if (image.is_main_image) {
      const shopName = extractShopNameFromUrl(connection.api_url)
      if (!shopName) {
        return NextResponse.json({ error: 'Invalid shop name' }, { status: 400 })
      }

      const { authHeader, apiBaseUrl } = await getShopRenterAuthHeader(
        shopName,
        connection.username,
        connection.password,
        connection.api_url
      )

      try {
        // Get current product data
        // Note: ShopRenter IDs are base64 and should be used directly in URLs (not encoded)
        const getResponse = await fetch(
          `${apiBaseUrl}/productExtend/${product.shoprenter_id}?full=1`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': authHeader
            },
            signal: AbortSignal.timeout(30000)
          }
        )

        if (!getResponse.ok) {
          const errorText = await getResponse.text().catch(() => 'Unknown error')
          throw new Error(`Failed to fetch product data: ${getResponse.status} - ${errorText}`)
        }

        const productData = await getResponse.json()

        // Build minimal PUT payload - only include essential fields for updating imageAlt
        // Based on ShopRenter API docs, we need to include basic product fields
        const updatePayload: any = {
          sku: productData.sku,
          price: productData.price,
          stock1: productData.stock1 || '0',
          stock2: productData.stock2 || '0',
          stock3: productData.stock3 || '0',
          stock4: productData.stock4 || '0',
          status: productData.status || '1',
          mainPicture: productData.mainPicture || '',
          imageAlt: image.alt_text // This is what we're updating
        }

        // Include optional fields if they exist
        if (productData.modelNumber) updatePayload.modelNumber = productData.modelNumber
        if (productData.multiplier !== undefined) updatePayload.multiplier = productData.multiplier
        if (productData.multiplierLock !== undefined) updatePayload.multiplierLock = productData.multiplierLock

        const putResponse = await fetch(
          `${apiBaseUrl}/productExtend/${product.shoprenter_id}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': authHeader
            },
            body: JSON.stringify(updatePayload),
            signal: AbortSignal.timeout(30000)
          }
        )

        if (!putResponse.ok) {
          const errorText = await putResponse.text().catch(() => 'Unknown error')
          throw new Error(`Failed to sync main image alt text: ${putResponse.status} - ${errorText}`)
        }

        // Update status to synced
        await supabase
          .from('product_images')
          .update({
            alt_text_status: 'synced',
            alt_text_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', imageId)

        console.log(`[SYNC ALT TEXT] Successfully synced main image alt text to productExtend`)

        return NextResponse.json({
          success: true,
          message: 'Main image alt text synced successfully'
        })
      } catch (error: any) {
        console.error('[SYNC ALT TEXT] Failed to sync main image alt text:', error)
        await supabase
          .from('product_images')
          .update({
            alt_text_status: 'error',
            updated_at: new Date().toISOString()
          })
          .eq('id', imageId)

        return NextResponse.json({
          success: false,
          error: error?.message || 'Failed to sync main image alt text'
        }, { status: 500 })
      }
    }

    // For non-main images, use productImages API
    // If we don't have ShopRenter image ID, fetch it first
    let shoprenterImageId = image.shoprenter_image_id
    
    if (!shoprenterImageId) {
      // Fetch images from ShopRenter to get the ID
      const shopName = extractShopNameFromUrl(connection.api_url)
      if (!shopName) {
        return NextResponse.json({ error: 'Invalid shop name' }, { status: 400 })
      }

      const shoprenterImages = await fetchProductImages(
        {
          apiUrl: connection.api_url,
          username: connection.username,
          password: connection.password,
          shopName: shopName
        },
        product.shoprenter_id
      )

      // Find matching image by path using flexible matching
      const normalizePath = (path: string) => {
        if (!path) return ''
        // Remove leading "data/" if present, normalize slashes
        return path.replace(/^data\//, '').replace(/\\/g, '/').toLowerCase()
      }

      // Extract filename from path for matching
      const getFilename = (path: string) => {
        if (!path) return ''
        const normalized = normalizePath(path)
        const parts = normalized.split('/')
        return parts[parts.length - 1] || normalized
      }

      const imageFilename = getFilename(image.image_path)
      const normalizedImagePath = normalizePath(image.image_path)
      
      const matchingImage = shoprenterImages.find((img: any) => {
        const normalizedShopRenterPath = normalizePath(img.imagePath)
        const shopRenterFilename = getFilename(img.imagePath)
        
        // Try multiple matching strategies:
        // 1. Exact normalized path match
        // 2. Filename match (most reliable when paths differ)
        // 3. Path ends match
        return normalizedImagePath === normalizedShopRenterPath ||
               imageFilename === shopRenterFilename ||
               normalizedImagePath.endsWith(normalizedShopRenterPath) ||
               normalizedShopRenterPath.endsWith(normalizedImagePath) ||
               normalizedImagePath.includes(shopRenterFilename) ||
               normalizedShopRenterPath.includes(imageFilename)
      })

      if (matchingImage) {
        shoprenterImageId = matchingImage.id
        
        // Update database with ShopRenter ID
        await supabase
          .from('product_images')
          .update({ shoprenter_image_id: shoprenterImageId })
          .eq('id', imageId)
        
        console.log(`[SYNC ALT TEXT] Found matching ShopRenter image: ${shoprenterImageId} for path: ${image.image_path}`)
      } else {
        console.error(`[SYNC ALT TEXT] No matching ShopRenter image found for path: ${image.image_path}`)
        console.error(`[SYNC ALT TEXT] Available ShopRenter images:`, shoprenterImages.map(img => img.imagePath))
        return NextResponse.json({ 
          error: `Image not found in ShopRenter. Searched for: ${image.image_path}. Please sync the product first.` 
        }, { status: 404 })
      }
    }

    // Sync alt text to ShopRenter
    const shopName = extractShopNameFromUrl(connection.api_url)
    if (!shopName) {
      return NextResponse.json({ error: 'Invalid shop name' }, { status: 400 })
    }

    console.log(`[SYNC ALT TEXT] Syncing alt text to ShopRenter for image ${shoprenterImageId}: "${image.alt_text}"`)
    
    const syncResult = await syncImageAltText(
      {
        apiUrl: connection.api_url,
        username: connection.username,
        password: connection.password,
        shopName: shopName
      },
      shoprenterImageId,
      image.alt_text
    )

    if (!syncResult.success) {
      console.error(`[SYNC ALT TEXT] Failed to sync: ${syncResult.error}`)
      // Update status to error
      await supabase
        .from('product_images')
        .update({
          alt_text_status: 'error',
          updated_at: new Date().toISOString()
        })
        .eq('id', imageId)

      return NextResponse.json({
        success: false,
        error: syncResult.error || 'Failed to sync alt text'
      }, { status: 500 })
    }

    console.log(`[SYNC ALT TEXT] Successfully synced alt text to ShopRenter`)

    // Update status to synced
    await supabase
      .from('product_images')
      .update({
        alt_text_status: 'synced',
        alt_text_synced_at: new Date().toISOString(),
        shoprenter_image_id: shoprenterImageId,
        updated_at: new Date().toISOString()
      })
      .eq('id', imageId)

    return NextResponse.json({
      success: true,
      message: 'Alt text synced successfully'
    })
  } catch (error) {
    console.error('Error syncing alt text:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sync alt text'
    }, { status: 500 })
  }
}
