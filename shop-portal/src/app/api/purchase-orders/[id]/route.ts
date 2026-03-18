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
      .select('id, status, supplier_id')
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
      status,
      items: bodyItems
    } = body

    // Empty string is invalid for UUID columns; normalize to null
    const uuid = (v: any) => (v === '' || v == null ? null : v)

    // Build update object
    const updateData: any = {}
    if (supplier_id !== undefined) updateData.supplier_id = uuid(supplier_id)
    if (warehouse_id !== undefined) updateData.warehouse_id = uuid(warehouse_id)
    if (order_date !== undefined) updateData.order_date = order_date
    if (expected_delivery_date !== undefined) updateData.expected_delivery_date = expected_delivery_date || null
    if (currency_id !== undefined) updateData.currency_id = uuid(currency_id)
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

    const canEditItems = existingPO.status === 'draft' || existingPO.status === 'pending_approval'
    const supplierIdForItems = updatedPO.supplier_id

    if (canEditItems && Array.isArray(bodyItems) && bodyItems.length >= 0) {
      const existingItemIds = new Set<string>()
      const { data: existingItems } = await supabase
        .from('purchase_order_items')
        .select('id')
        .eq('purchase_order_id', id)
        .is('deleted_at', null)
      if (existingItems) {
        existingItems.forEach((row: { id: string }) => existingItemIds.add(row.id))
      }

      const isValidUuid = (v: unknown) =>
        typeof v === 'string' && v.length === 36 && !v.startsWith('temp-') && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)

      for (const item of bodyItems as any[]) {
        const itemId = item.id
        const qty = parseFloat(item.quantity)
        const cost = parseFloat(item.unit_cost)
        if (qty <= 0 || Number.isNaN(qty)) {
          return NextResponse.json(
            { error: 'A mennyiségnek pozitívnak kell lennie' },
            { status: 400 }
          )
        }
        if (cost < 0 || Number.isNaN(cost)) {
          return NextResponse.json(
            { error: 'Az egységár nem lehet negatív' },
            { status: 400 }
          )
        }
        if (!item.product_id || !item.vat_id || !item.unit_id) {
          return NextResponse.json(
            { error: 'Minden tételnek kell termék, ÁFA és mértékegység' },
            { status: 400 }
          )
        }

        if (isValidUuid(itemId) && existingItemIds.has(itemId)) {
          const { error: itemUpdateError } = await supabase
            .from('purchase_order_items')
            .update({
              quantity: qty,
              unit_cost: cost,
              vat_id: item.vat_id,
              currency_id: item.currency_id || updatedPO.currency_id || null,
              unit_id: item.unit_id,
              description: item.description?.trim() || null,
              product_supplier_id: item.product_supplier_id || null
            })
            .eq('id', itemId)
            .eq('purchase_order_id', id)
          if (itemUpdateError) {
            console.error('Error updating PO item:', itemUpdateError)
            return NextResponse.json(
              { error: itemUpdateError.message || 'Hiba a tétel frissítésekor' },
              { status: 500 }
            )
          }
        } else {
          let productSupplierId: string | null = item.product_supplier_id || null
          if (productSupplierId && supplierIdForItems) {
            const { data: ps } = await supabase
              .from('product_suppliers')
              .select('id')
              .eq('id', productSupplierId)
              .eq('supplier_id', supplierIdForItems)
              .is('deleted_at', null)
              .maybeSingle()
            if (!ps) productSupplierId = null
          }
          if (!productSupplierId && item.product_id && supplierIdForItems) {
            const { data: existing } = await supabase
              .from('product_suppliers')
              .select('id')
              .eq('product_id', item.product_id)
              .eq('supplier_id', supplierIdForItems)
              .is('deleted_at', null)
              .limit(1)
              .maybeSingle()
            if (existing) {
              productSupplierId = existing.id
            } else {
              const { data: created } = await supabase
                .from('product_suppliers')
                .insert({
                  product_id: item.product_id,
                  supplier_id: supplierIdForItems,
                  default_cost: cost,
                  is_active: true
                })
                .select('id')
                .single()
              if (created) productSupplierId = created.id
            }
          }
          const insertPayload = {
            purchase_order_id: id,
            product_id: item.product_id,
            product_supplier_id: productSupplierId,
            quantity: qty,
            unit_cost: cost,
            vat_id: item.vat_id,
            currency_id: item.currency_id || updatedPO.currency_id || null,
            unit_id: item.unit_id,
            description: item.description?.trim() || null
          }
          const { error: itemInsertError } = await supabase
            .from('purchase_order_items')
            .insert(insertPayload)
          if (itemInsertError) {
            console.error('Error inserting PO item:', itemInsertError)
            return NextResponse.json(
              { error: itemInsertError.message || 'Hiba a tétel létrehozásakor' },
              { status: 500 }
            )
          }
        }
      }

      const requestItemIds = new Set(
        (bodyItems as any[])
          .filter((i: any) => isValidUuid(i.id))
          .map((i: any) => i.id)
      )
      const toSoftDelete = [...existingItemIds].filter((oid) => !requestItemIds.has(oid))
      if (toSoftDelete.length > 0) {
        const now = new Date().toISOString()
        await supabase
          .from('purchase_order_items')
          .update({ deleted_at: now })
          .eq('purchase_order_id', id)
          .in('id', toSoftDelete)
      }

      await recalculatePOTotals(supabase, id)
    }

    const { data: fullPO, error: fetchFullError } = await supabase
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

    if (fetchFullError || !fullPO) {
      return NextResponse.json({ purchase_order: updatedPO })
    }
    if (fullPO.purchase_order_items) {
      fullPO.purchase_order_items = fullPO.purchase_order_items.filter((item: any) => !item.deleted_at)
    }

    return NextResponse.json({ purchase_order: fullPO })
  } catch (error) {
    console.error('Error in purchase orders PUT API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function recalculatePOTotals(supabase: any, poId: string) {
  const { data: items } = await supabase
    .from('purchase_order_items')
    .select('quantity, unit_cost, vat_id')
    .eq('purchase_order_id', poId)
    .is('deleted_at', null)

  if (!items || items.length === 0) {
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

  const { data: vatRates } = await supabase
    .from('vat')
    .select('id, kulcs')
    .is('deleted_at', null)
  const vatMap = new Map(vatRates?.map((v: any) => [v.id, v.kulcs || 0]) || [])

  let totalNet = 0
  let totalVat = 0
  let totalGross = 0
  let totalQuantity = 0
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

  await supabase
    .from('purchase_orders')
    .update({
      total_net: totalNet,
      total_vat: totalVat,
      total_gross: totalGross,
      total_weight: 0,
      item_count: items.length,
      total_quantity: totalQuantity
    })
    .eq('id', poId)
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
