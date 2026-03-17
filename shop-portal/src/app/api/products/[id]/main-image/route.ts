import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/products/[id]/main-image
 * Proxies the product's main image so the browser loads it from our domain.
 * Use this when external image URLs are blocked by referrer/CORS (e.g. on pick page).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params
    const supabase = await getTenantSupabase()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: product, error: productError } = await supabase
      .from('shoprenter_products')
      .select('id')
      .eq('id', productId)
      .is('deleted_at', null)
      .single()

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const { data: images, error: imagesError } = await supabase
      .from('product_images')
      .select('image_url, is_main_image, sort_order')
      .eq('product_id', productId)
      .order('is_main_image', { ascending: false })
      .order('sort_order', { ascending: true })
      .limit(1)

    if (imagesError || !images?.length || !images[0].image_url) {
      return NextResponse.json({ error: 'No image' }, { status: 404 })
    }

    const imageUrl = images[0].image_url
    const res = await fetch(imageUrl, {
      headers: { Accept: 'image/*' },
      cache: 'force-cache',
      next: { revalidate: 3600 }
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'Image fetch failed' }, { status: 502 })
    }

    const contentType = res.headers.get('content-type') || 'image/jpeg'
    const body = await res.arrayBuffer()

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600, s-maxage=3600'
      }
    })
  } catch (err) {
    console.error('Error in main-image GET:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
