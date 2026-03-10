import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * PUT /api/purchase-orders/[id]/items/[itemId]
 * Update a purchase order item
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id, itemId } = await params
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify PO exists and get status
    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .select('id, status')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (poError || !po) {
      return NextResponse.json(
        { error: 'Beszerzési rendelés nem található' },
        { status: 404 }
      )
    }

    // Cannot edit items if status is 'approved' or 'received'
    if (po.status === 'approved' || po.status === 'received') {
      return NextResponse.json(
        { error: 'A jóváhagyott vagy bevételezett rendelés tételei nem szerkeszthetők' },
        { status: 400 }
      )
    }

    // Verify item exists
    const { data: existingItem, error: itemError } = await supabase
      .from('purchase_order_items')
      .select('id, purchase_order_id')
      .eq('id', itemId)
      .eq('purchase_order_id', id)
      .is('deleted_at', null)
      .single()

    if (itemError || !existingItem) {
      return NextResponse.json(
        { error: 'Rendelési tétel nem található' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const {
      quantity,
      unit_cost,
      vat_id,
      currency_id,
      unit_id,
      description,
      shelf_location,
      note
    } = body

    // Build update object
    const updateData: any = {}
    if (quantity !== undefined) {
      const qty = parseFloat(quantity)
      if (qty <= 0) {
        return NextResponse.json(
          { error: 'A mennyiségnek pozitívnak kell lennie' },
          { status: 400 }
        )
      }
      updateData.quantity = qty
    }
    if (unit_cost !== undefined) {
      const cost = parseFloat(unit_cost)
      if (cost < 0) {
        return NextResponse.json(
          { error: 'Az egységár nem lehet negatív' },
          { status: 400 }
        )
      }
      updateData.unit_cost = cost
    }
    if (vat_id !== undefined) updateData.vat_id = vat_id
    if (currency_id !== undefined) updateData.currency_id = currency_id
    if (unit_id !== undefined) updateData.unit_id = unit_id
    if (description !== undefined) updateData.description = description?.trim() || null
    if (shelf_location !== undefined) updateData.shelf_location = shelf_location?.trim() || null
    if (note !== undefined) updateData.note = note?.trim() || null

    // Update item
    const { data: updatedItem, error: updateError } = await supabase
      .from('purchase_order_items')
      .update(updateData)
      .eq('id', itemId)
      .select(`
        *,
        products:product_id(id, name, sku),
        vat:vat_id(id, name, kulcs),
        units:unit_id(id, name, shortform)
      `)
      .single()

    if (updateError) {
      console.error('Error updating purchase order item:', updateError)
      return NextResponse.json(
        { error: updateError.message || 'Hiba a rendelési tétel frissítésekor' },
        { status: 500 }
      )
    }

    // Recalculate PO totals
    await recalculatePOTotals(supabase, id)

    return NextResponse.json({ item: updatedItem })
  } catch (error) {
    console.error('Error in purchase order items PUT API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/purchase-orders/[id]/items/[itemId]
 * Remove an item from a purchase order (soft delete)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id, itemId } = await params
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify PO exists and get status
    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .select('id, status')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (poError || !po) {
      return NextResponse.json(
        { error: 'Beszerzési rendelés nem található' },
        { status: 404 }
      )
    }

    // Cannot delete items if status is 'approved' or 'received'
    if (po.status === 'approved' || po.status === 'received') {
      return NextResponse.json(
        { error: 'A jóváhagyott vagy bevételezett rendelés tételei nem törölhetők' },
        { status: 400 }
      )
    }

    // Verify item exists
    const { data: existingItem, error: itemError } = await supabase
      .from('purchase_order_items')
      .select('id, purchase_order_id')
      .eq('id', itemId)
      .eq('purchase_order_id', id)
      .is('deleted_at', null)
      .single()

    if (itemError || !existingItem) {
      return NextResponse.json(
        { error: 'Rendelési tétel nem található' },
        { status: 404 }
      )
    }

    // Soft delete item
    const { error: deleteError } = await supabase
      .from('purchase_order_items')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', itemId)

    if (deleteError) {
      console.error('Error deleting purchase order item:', deleteError)
      return NextResponse.json(
        { error: deleteError.message || 'Hiba a rendelési tétel törlésekor' },
        { status: 500 }
      )
    }

    // Recalculate PO totals
    await recalculatePOTotals(supabase, id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in purchase order items DELETE API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Helper function to recalculate PO totals
 */
async function recalculatePOTotals(supabase: any, poId: string) {
  // Get all active items
  const { data: items } = await supabase
    .from('purchase_order_items')
    .select('quantity, unit_cost, vat_id')
    .eq('purchase_order_id', poId)
    .is('deleted_at', null)

  if (!items || items.length === 0) {
    // No items, reset totals
    await supabase
      .from('purchase_orders')
      .update({
        total_net: 0,
        total_vat: 0,
        total_gross: 0,
        total_weight: 0,
        item_count: 0,
        total_quantity: 0
      })
      .eq('id', poId)
    return
  }

  // Get VAT rates
  const { data: vatRates } = await supabase
    .from('vat')
    .select('id, kulcs')
    .is('deleted_at', null)

  const vatMap = new Map(vatRates?.map((v: any) => [v.id, v.kulcs || 0]) || [])

  // Calculate totals
  let totalNet = 0
  let totalVat = 0
  let totalGross = 0
  let totalQuantity = 0
  const itemCount = items.length

  for (const item of items) {
    const quantity = parseFloat(item.quantity) || 0
    const unitCost = parseFloat(item.unit_cost) || 0
    const vatRate = vatMap.get(item.vat_id) || 0

    const lineNet = Math.round(unitCost * quantity)
    const lineVat = Math.round(lineNet * vatRate / 100)
    const lineGross = lineNet + lineVat

    totalNet += lineNet
    totalVat += lineVat
    totalGross += lineGross
    totalQuantity += quantity
  }

  // Update PO totals
  await supabase
    .from('purchase_orders')
    .update({
      total_net: totalNet,
      total_vat: totalVat,
      total_gross: totalGross,
      total_weight: 0, // Would need product weight data
      item_count: itemCount,
      total_quantity: totalQuantity
    })
    .eq('id', poId)
}
