import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/products/[id]/variants
 * Get parent and child product relationships for a product
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    // Get tenant-aware Supabase client - CRITICAL: No fallback to default database
    const supabase = await getTenantSupabase()

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the product
    const { data: product, error: productError } = await supabase
      .from('shoprenter_products')
      .select('id, sku, name, model_number, parent_product_id')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    let parent: any = null
    let children: any[] = []

    // If this product has a parent, fetch the parent
    if (product.parent_product_id) {
      const { data: parentData, error: parentError } = await supabase
        .from('shoprenter_products')
        .select('id, sku, name, model_number, product_url, url_slug')
        .eq('id', product.parent_product_id)
        .is('deleted_at', null)
        .single()

      if (!parentError && parentData) {
        parent = parentData
      }
    }

    // Check if this product has children (is a parent)
    const { data: childrenData, error: childrenError } = await supabase
      .from('shoprenter_products')
      .select('id, sku, name, model_number, price, product_url, url_slug, product_attributes, status')
      .eq('parent_product_id', id)
      .is('deleted_at', null)
      .order('sku', { ascending: true })

    if (!childrenError && childrenData) {
      children = childrenData
    }

    return NextResponse.json({
      success: true,
      isParent: children.length > 0,
      isChild: !!product.parent_product_id,
      parent,
      children,
      childCount: children.length
    })
  } catch (error) {
    console.error('Error fetching product variants:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
