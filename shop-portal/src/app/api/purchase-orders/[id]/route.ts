import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/purchase-orders/[id]
 * Get a single purchase order with all items
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch purchase order with all relationships
    const { data: purchaseOrder, error } = await supabase
      .from('purchase_orders')
      .select(`
        *,
        suppliers:supplier_id(id, name, email, phone),
        warehouses:warehouse_id(id, name, code),
        currencies:currency_id(id, name, code, symbol),
        approved_by_user:approved_by(id, email, full_name),
        purchase_order_items(
          *,
          products:product_id(id, name, sku, gtin, internal_barcode),
          product_suppliers:product_supplier_id(id, supplier_sku, supplier_barcode),
          vat:vat_id(id, name, kulcs),
          currencies:currency_id(id, name, code, symbol),
          units:unit_id(id, name, shortform)
        )
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error || !purchaseOrder) {
      return NextResponse.json(
        { error: 'Beszerzési rendelés nem található' },
        { status: 404 }
      )
    }

    // Filter out soft-deleted items
    if (purchaseOrder.purchase_order_items) {
      purchaseOrder.purchase_order_items = purchaseOrder.purchase_order_items.filter(
        (item: any) => !item.deleted_at
      )
    }

    return NextResponse.json({ purchase_order: purchaseOrder })
  } catch (error) {
    console.error('Error in purchase orders GET API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/purchase-orders/[id]
 * Update purchase order header (supplier, warehouse, dates, note, status)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if PO exists
    const { data: existingPO, error: fetchError } = await supabase
      .from('purchase_orders')
      .select('id, status')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (fetchError || !existingPO) {
      return NextResponse.json(
        { error: 'Beszerzési rendelés nem található' },
        { status: 404 }
      )
    }

    // Cannot edit if status is 'received'
    if (existingPO.status === 'received') {
      return NextResponse.json(
        { error: 'A bevételezett rendelés nem szerkeszthető' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const {
      supplier_id,
      warehouse_id,
      order_date,
      expected_delivery_date,
      currency_id,
      note,
      status
    } = body

    // Build update object
    const updateData: any = {}
    if (supplier_id !== undefined) updateData.supplier_id = supplier_id
    if (warehouse_id !== undefined) updateData.warehouse_id = warehouse_id
    if (order_date !== undefined) updateData.order_date = order_date
    if (expected_delivery_date !== undefined) updateData.expected_delivery_date = expected_delivery_date
    if (currency_id !== undefined) updateData.currency_id = currency_id
    if (note !== undefined) updateData.note = note?.trim() || null

    // Handle status change (but use dedicated endpoints for approve/cancel)
    if (status && status !== existingPO.status) {
      // Only allow specific transitions
      const validTransitions: Record<string, string[]> = {
        'draft': ['pending_approval', 'cancelled'],
        'pending_approval': ['draft', 'approved', 'cancelled'],
        'approved': ['cancelled'], // Use /approve endpoint instead
        'partially_received': [], // Auto-updated
        'received': [] // Cannot change
      }

      const allowedStatuses = validTransitions[existingPO.status] || []
      if (!allowedStatuses.includes(status)) {
        return NextResponse.json(
          { error: `Nem lehet ${existingPO.status} státuszról ${status} státuszra váltani` },
          { status: 400 }
        )
      }

      updateData.status = status
    }

    // Validate supplier if provided
    if (supplier_id) {
      const { data: supplier } = await supabase
        .from('suppliers')
        .select('id')
        .eq('id', supplier_id)
        .is('deleted_at', null)
        .single()

      if (!supplier) {
        return NextResponse.json(
          { error: 'Beszállító nem található' },
          { status: 404 }
        )
      }
    }

    // Validate warehouse if provided
    if (warehouse_id) {
      const { data: warehouse } = await supabase
        .from('warehouses')
        .select('id')
        .eq('id', warehouse_id)
        .single()

      if (!warehouse) {
        return NextResponse.json(
          { error: 'Raktár nem található' },
          { status: 404 }
        )
      }
    }

    // Update purchase order
    const { data: updatedPO, error: updateError } = await supabase
      .from('purchase_orders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating purchase order:', updateError)
      return NextResponse.json(
        { error: updateError.message || 'Hiba a beszerzési rendelés frissítésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ purchase_order: updatedPO })
  } catch (error) {
    console.error('Error in purchase orders PUT API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/purchase-orders/[id]
 * Soft delete a purchase order
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if PO exists and get status
    const { data: existingPO, error: fetchError } = await supabase
      .from('purchase_orders')
      .select('id, status')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (fetchError || !existingPO) {
      return NextResponse.json(
        { error: 'Beszerzési rendelés nem található' },
        { status: 404 }
      )
    }

    // Cannot delete if status is 'received'
    if (existingPO.status === 'received') {
      return NextResponse.json(
        { error: 'A bevételezett rendelés nem törölhető' },
        { status: 400 }
      )
    }

    // Check for linked shipments
    const { data: shipments, error: shipmentsError } = await supabase
      .from('shipment_purchase_orders')
      .select('id')
      .eq('purchase_order_id', id)
      .limit(1)

    if (shipments && shipments.length > 0) {
      return NextResponse.json(
        { error: 'A rendeléshez kapcsolódó szállítmányok miatt nem törölhető' },
        { status: 400 }
      )
    }

    // Soft delete
    const { error: deleteError } = await supabase
      .from('purchase_orders')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    if (deleteError) {
      console.error('Error deleting purchase order:', deleteError)
      return NextResponse.json(
        { error: deleteError.message || 'Hiba a beszerzési rendelés törlésekor' },
        { status: 500 }
      )
    }

    // Also soft delete all items
    await supabase
      .from('purchase_order_items')
      .update({ deleted_at: new Date().toISOString() })
      .eq('purchase_order_id', id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in purchase orders DELETE API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
