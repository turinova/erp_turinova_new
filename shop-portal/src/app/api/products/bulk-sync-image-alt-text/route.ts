import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getConnectionById } from '@/lib/connections-server'
import { syncImageAltText, fetchProductImages } from '@/lib/shoprenter-image-service'
import { extractShopNameFromUrl } from '@/lib/shoprenter-api'

/**
 * POST /api/products/bulk-sync-image-alt-text
 * Sync alt text to ShopRenter for multiple products' images
 */
export async function POST(request: NextRequest) {
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
    const body = await request.json()
    const { productIds } = body

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({ error: 'Product IDs required' }, { status: 400 })
    }

    const results = {
      total: 0,
      success: 0,
      failed: 0,
      errors: [] as Array<{ productId: string; error: string }>
    }

    // Process each product
    for (const productId of productIds) {
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
          results.failed++
          results.errors.push({ productId, error: 'Product not found' })
          continue
        }

        const connection = product.webshop_connections
        if (!connection || connection.connection_type !== 'shoprenter') {
          results.failed++
          results.errors.push({ productId, error: 'Invalid connection' })
          continue
        }

        // Get images with alt text
        const { data: images, error: imagesError } = await supabase
          .from('product_images')
          .select('*')
          .eq('product_id', productId)
          .not('alt_text', 'is', null)
          .in('alt_text_status', ['generated', 'manual'])

        if (imagesError || !images || images.length === 0) {
          continue // No images to sync
        }

        const shopName = extractShopNameFromUrl(connection.api_url)
        if (!shopName) {
          results.failed++
          results.errors.push({ productId, error: 'Invalid shop name' })
          continue
        }

        // Fetch ShopRenter images to get IDs if needed
        let shoprenterImages: any[] = []
        try {
          shoprenterImages = await fetchProductImages(
            {
              apiUrl: connection.api_url,
              username: connection.username,
              password: connection.password,
              shopName: shopName
            },
            product.shoprenter_id
          )
        } catch (error) {
          console.warn(`Failed to fetch ShopRenter images for product ${productId}:`, error)
        }

        // Sync each image
        for (const image of images) {
          try {
            results.total++

            let shoprenterImageId = image.shoprenter_image_id

            // If no ID, try to find it from fetched images
            if (!shoprenterImageId && shoprenterImages.length > 0) {
              const matchingImage = shoprenterImages.find(
                img => img.imagePath === image.image_path
              )
              if (matchingImage) {
                shoprenterImageId = matchingImage.id
                
                // Update database
                await supabase
                  .from('product_images')
                  .update({ shoprenter_image_id: shoprenterImageId })
                  .eq('id', image.id)
              }
            }

            if (!shoprenterImageId) {
              results.failed++
              results.errors.push({
                productId,
                error: `Image ${image.id}: ShopRenter ID not found`
              })
              continue
            }

            // Sync to ShopRenter
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
              results.failed++
              results.errors.push({
                productId,
                error: `Image ${image.id}: ${syncResult.error || 'Sync failed'}`
              })
              
              // Update status to error
              await supabase
                .from('product_images')
                .update({
                  alt_text_status: 'error',
                  updated_at: new Date().toISOString()
                })
                .eq('id', image.id)
            } else {
              results.success++
              
              // Update status to synced
              await supabase
                .from('product_images')
                .update({
                  alt_text_status: 'synced',
                  alt_text_synced_at: new Date().toISOString(),
                  shoprenter_image_id: shoprenterImageId,
                  updated_at: new Date().toISOString()
                })
                .eq('id', image.id)
            }
          } catch (error: any) {
            results.failed++
            results.errors.push({
              productId,
              error: `Image ${image.id}: ${error?.message || 'Unknown error'}`
            })
          }
        }
      } catch (error: any) {
        results.failed++
        results.errors.push({
          productId,
          error: error?.message || 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      results
    })
  } catch (error) {
    console.error('Error in bulk sync alt text:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sync alt text'
    }, { status: 500 })
  }
}
