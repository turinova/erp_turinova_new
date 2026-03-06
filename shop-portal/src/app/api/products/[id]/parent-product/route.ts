import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/products/[id]/parent-product
 * Fetch current parent product and child products
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()

    // Get current product
    const { data: product, error: productError } = await supabase
      .from('shoprenter_products')
      .select('parent_product_id, connection_id')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    let parentProduct = null
    let childProducts: any[] = []

    // If product has a parent, fetch it
    if (product.parent_product_id) {
      const { data: parent, error: parentError } = await supabase
        .from('shoprenter_products')
        .select(`
          id,
          name,
          sku,
          shoprenter_id,
          shoprenter_product_descriptions(name)
        `)
        .eq('id', product.parent_product_id)
        .is('deleted_at', null)
        .single()

      if (!parentError && parent) {
        parentProduct = {
          id: parent.id,
          name: parent.shoprenter_product_descriptions?.[0]?.name || parent.name || parent.sku,
          sku: parent.sku,
          shoprenter_id: parent.shoprenter_id
        }
      }
    }

    // Always check if this product is a parent to other products
    const { data: children, error: childrenError } = await supabase
      .from('shoprenter_products')
      .select(`
        id,
        name,
        sku,
        shoprenter_id,
        shoprenter_product_descriptions(name)
      `)
      .eq('connection_id', product.connection_id)
      .eq('parent_product_id', id)
      .is('deleted_at', null)

    if (!childrenError && children && children.length > 0) {
      childProducts = children.map(child => ({
        id: child.id,
        name: child.shoprenter_product_descriptions?.[0]?.name || child.name || child.sku,
        sku: child.sku,
        shoprenter_id: child.shoprenter_id
      }))
    }

    return NextResponse.json({
      parentProduct, // null if no parent
      childProducts, // [] if no children
      hasParent: !!product.parent_product_id,
      isParent: childProducts.length > 0
    })
  } catch (error) {
    console.error('[API] Error in parent-product GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/products/[id]/parent-product
 * Update or remove parent product
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { parentProductId } = body // null to remove, or UUID to set

    const supabase = await getTenantSupabase()

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get product and connection
    const { data: product, error: productError } = await supabase
      .from('shoprenter_products')
      .select('connection_id, shoprenter_id, parent_product_id')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // If setting parent, validate it exists and belongs to same connection
    if (parentProductId) {
      const { data: parentProduct, error: parentError } = await supabase
        .from('shoprenter_products')
        .select('id, shoprenter_id')
        .eq('id', parentProductId)
        .eq('connection_id', product.connection_id)
        .is('deleted_at', null)
        .single()

      if (parentError || !parentProduct) {
        return NextResponse.json({ error: 'Parent product not found' }, { status: 404 })
      }

      // Prevent self-reference
      if (parentProductId === id) {
        return NextResponse.json({ error: 'Product cannot be its own parent' }, { status: 400 })
      }

      // Prevent circular reference: check if the new parent is a child of this product
      const { data: circularCheck } = await supabase
        .from('shoprenter_products')
        .select('id')
        .eq('id', parentProductId)
        .eq('parent_product_id', id)
        .is('deleted_at', null)
        .single()

      if (circularCheck) {
        return NextResponse.json({ error: 'Cannot set parent: would create circular reference' }, { status: 400 })
      }
    }

    // Update in database
    const { error: updateError } = await supabase
      .from('shoprenter_products')
      .update({
        parent_product_id: parentProductId || null,
        sync_status: 'pending',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (updateError) {
      console.error('[API] Error updating parent product:', updateError)
      return NextResponse.json({ error: 'Failed to update parent product' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] Error in parent-product PUT:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
