import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * PUT /api/products/[id]/suppliers/[supplierId]
 * Update a product-supplier relationship
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; supplierId: string }> }
) {
  try {
    const { id: productId, supplierId } = await params
    const supabase = await getTenantSupabase()

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      supplier_sku,
      supplier_barcode,
      default_cost,
      min_order_quantity,
      lead_time_days,
      is_preferred,
      is_active
    } = body

    // Find the product-supplier relationship
    const { data: existing, error: findError } = await supabase
      .from('product_suppliers')
      .select('id')
      .eq('product_id', productId)
      .eq('supplier_id', supplierId)
      .is('deleted_at', null)
      .single()

    if (findError || !existing) {
      return NextResponse.json(
        { error: 'Termék-beszállító kapcsolat nem található' },
        { status: 404 }
      )
    }

    // If setting as preferred, unset other preferred suppliers for this product
    if (is_preferred) {
      await supabase
        .from('product_suppliers')
        .update({ is_preferred: false })
        .eq('product_id', productId)
        .neq('id', existing.id)
        .is('deleted_at', null)
    }

    // Update the relationship
    const updateData: any = {}
    if (supplier_sku !== undefined) updateData.supplier_sku = supplier_sku || null
    if (supplier_barcode !== undefined) updateData.supplier_barcode = supplier_barcode || null
    if (default_cost !== undefined) updateData.default_cost = default_cost ? parseFloat(default_cost) : null
    if (min_order_quantity !== undefined) updateData.min_order_quantity = min_order_quantity || 1
    if (lead_time_days !== undefined) updateData.lead_time_days = lead_time_days || null
    if (is_preferred !== undefined) updateData.is_preferred = is_preferred
    if (is_active !== undefined) updateData.is_active = is_active

    const { data: productSupplier, error } = await supabase
      .from('product_suppliers')
      .update(updateData)
      .eq('id', existing.id)
      .select(`
        id,
        supplier_id,
        supplier_sku,
        supplier_barcode,
        default_cost,
        last_purchased_at,
        min_order_quantity,
        lead_time_days,
        is_preferred,
        is_active,
        created_at,
        updated_at,
        suppliers:supplier_id(id, name, email, phone, status)
      `)
      .single()

    if (error) {
      console.error('Error updating product supplier:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a beszállító frissítésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      product_supplier: productSupplier
    })
  } catch (error) {
    console.error('Error in product suppliers PUT API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/products/[id]/suppliers/[supplierId]
 * Soft delete a product-supplier relationship
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; supplierId: string }> }
) {
  try {
    const { id: productId, supplierId } = await params
    const supabase = await getTenantSupabase()

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find the product-supplier relationship
    const { data: existing, error: findError } = await supabase
      .from('product_suppliers')
      .select('id')
      .eq('product_id', productId)
      .eq('supplier_id', supplierId)
      .is('deleted_at', null)
      .single()

    if (findError || !existing) {
      return NextResponse.json(
        { error: 'Termék-beszállító kapcsolat nem található' },
        { status: 404 }
      )
    }

    // Soft delete
    const { error } = await supabase
      .from('product_suppliers')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', existing.id)

    if (error) {
      console.error('Error deleting product supplier:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a beszállító törlésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in product suppliers DELETE API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
