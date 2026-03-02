import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/products/[id]/images
 * Get all images for a product
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: productId } = await params
  
  // Get tenant-aware Supabase client - CRITICAL: No fallback to default database
  const supabase = await getTenantSupabase()

  // Get auth user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get product to verify access
    const { data: product, error: productError } = await supabase
      .from('shoprenter_products')
      .select('id, connection_id')
      .eq('id', productId)
      .single()

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Get all images for this product
    const { data: images, error: imagesError } = await supabase
      .from('product_images')
      .select('*')
      .eq('product_id', productId)
      .order('is_main_image', { ascending: false })
      .order('sort_order', { ascending: true })

    if (imagesError) {
      console.error('Error fetching images:', imagesError)
      return NextResponse.json({ error: 'Failed to fetch images' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      images: images || []
    })
  } catch (error) {
    console.error('Error in GET /api/products/[id]/images:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch images'
    }, { status: 500 })
  }
}

/**
 * PATCH /api/products/[id]/images
 * Update alt text for an image
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: productId } = await params
  
  // Get tenant-aware Supabase client - CRITICAL: No fallback to default database
  const supabase = await getTenantSupabase()

  // Get auth user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { imageId, altText } = body

    if (!imageId || altText === undefined) {
      return NextResponse.json({ error: 'imageId and altText required' }, { status: 400 })
    }

    // Verify image belongs to product
    const { data: image, error: imageError } = await supabase
      .from('product_images')
      .select('id')
      .eq('id', imageId)
      .eq('product_id', productId)
      .single()

    if (imageError || !image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    // Update alt text
    const { error: updateError } = await supabase
      .from('product_images')
      .update({
        alt_text: altText,
        alt_text_status: 'manual',
        updated_at: new Date().toISOString()
      })
      .eq('id', imageId)

    if (updateError) {
      console.error('Error updating image alt text:', updateError)
      return NextResponse.json({ error: 'Failed to update image' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Alt text updated'
    })
  } catch (error) {
    console.error('Error in PATCH /api/products/[id]/images:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update image'
    }, { status: 500 })
  }
}
