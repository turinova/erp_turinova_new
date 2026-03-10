import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * PUT /api/warehouse-operations/[id]/complete
 * Complete a warehouse operation (receiving) - creates stock movements
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

    // Get warehouse operation
    const { data: warehouseOp, error: woError } = await supabase
      .from('warehouse_operations')
      .select('id, shipment_id, warehouse_id, operation_type, status')
      .eq('id', id)
      .single()

    if (woError || !warehouseOp) {
      return NextResponse.json(
        { error: 'Raktári művelet nem található' },
        { status: 404 }
      )
    }

    if (warehouseOp.status === 'completed') {
      return NextResponse.json(
        { error: 'A művelet már befejezve' },
        { status: 400 }
      )
    }

    if (warehouseOp.status !== 'in_progress') {
      return NextResponse.json(
        { error: 'Csak folyamatban lévő művelet fejezhető be' },
        { status: 400 }
      )
    }

    // Get shipment items with accepted quantities
    let shipmentItems: any[] = []
    if (warehouseOp.shipment_id) {
      const { data: items, error: itemsError } = await supabase
        .from('shipment_items')
        .select('product_id, accepted_quantity, unit_cost, shelf_location')
        .eq('shipment_id', warehouseOp.shipment_id)
        .gt('accepted_quantity', 0)

      if (itemsError) {
        console.error('Error fetching shipment items:', itemsError)
        return NextResponse.json(
          { error: 'Hiba a szállítmány tételek lekérdezésekor' },
          { status: 500 }
        )
      }

      shipmentItems = items || []
    }

    // Create stock movements for all accepted items
    if (shipmentItems.length > 0) {
      const stockMovements = shipmentItems.map((item: any) => ({
        warehouse_id: warehouseOp.warehouse_id,
        product_id: item.product_id,
        movement_type: 'in',
        quantity: parseFloat(item.accepted_quantity),
        unit_cost: item.unit_cost ? parseFloat(item.unit_cost) : null,
        shelf_location: item.shelf_location || null,
        source_type: 'shipment',
        source_id: warehouseOp.shipment_id,
        warehouse_operation_id: id,
        created_by: user.id
      }))

      const { error: movementsError } = await supabase
        .from('stock_movements')
        .insert(stockMovements)

      if (movementsError) {
        console.error('Error creating stock movements:', movementsError)
        return NextResponse.json(
          { error: movementsError.message || 'Hiba a készletmozgások létrehozásakor' },
          { status: 500 }
        )
      }

      // Update PO items received_quantity
      if (warehouseOp.shipment_id) {
        const { data: shipmentPOs } = await supabase
          .from('shipment_purchase_orders')
          .select('purchase_order_id')
          .eq('shipment_id', warehouseOp.shipment_id)

        if (shipmentPOs && shipmentPOs.length > 0) {
          const poIds = shipmentPOs.map((spo: any) => spo.purchase_order_id)

          // Get shipment items with PO item references
          const { data: itemsWithPO } = await supabase
            .from('shipment_items')
            .select('purchase_order_item_id, accepted_quantity')
            .eq('shipment_id', warehouseOp.shipment_id)
            .not('purchase_order_item_id', 'is', null)
            .gt('accepted_quantity', 0)

          if (itemsWithPO) {
            // Update each PO item's received_quantity
            for (const item of itemsWithPO) {
              await supabase.rpc('increment_po_item_received', {
                po_item_id: item.purchase_order_item_id,
                quantity: parseFloat(item.accepted_quantity)
              }).catch(() => {
                // If RPC doesn't exist, do manual update
                const { data: currentItem } = await supabase
                  .from('purchase_order_items')
                  .select('received_quantity')
                  .eq('id', item.purchase_order_item_id)
                  .single()

                if (currentItem) {
                  const newReceived = (parseFloat(currentItem.received_quantity) || 0) + parseFloat(item.accepted_quantity)
                  await supabase
                    .from('purchase_order_items')
                    .update({ received_quantity: newReceived })
                    .eq('id', item.purchase_order_item_id)
                }
              })
            }

            // Update PO status based on received quantities
            for (const poId of poIds) {
              const { data: poItems } = await supabase
                .from('purchase_order_items')
                .select('quantity, received_quantity')
                .eq('purchase_order_id', poId)
                .is('deleted_at', null)

              if (poItems) {
                const allReceived = poItems.every((item: any) => 
                  parseFloat(item.received_quantity || 0) >= parseFloat(item.quantity || 0)
                )
                const someReceived = poItems.some((item: any) => 
                  parseFloat(item.received_quantity || 0) > 0
                )

                if (allReceived) {
                  await supabase
                    .from('purchase_orders')
                    .update({ status: 'received' })
                    .eq('id', poId)
                } else if (someReceived) {
                  await supabase
                    .from('purchase_orders')
                    .update({ status: 'partially_received' })
                    .eq('id', poId)
                }
              }
            }
          }
        }
      }
    }

    // Update shipment status to 'completed'
    if (warehouseOp.shipment_id) {
      await supabase
        .from('shipments')
        .update({ status: 'completed' })
        .eq('id', warehouseOp.shipment_id)
    }

    // Update warehouse operation
    const { data: updatedWO, error: updateError } = await supabase
      .from('warehouse_operations')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completed_by: user.id
      })
      .eq('id', id)
      .select(`
        *,
        shipments:shipment_id(id, shipment_number),
        warehouses:warehouse_id(id, name),
        completed_by_user:completed_by(id, email, full_name)
      `)
      .single()

    if (updateError) {
      console.error('Error completing warehouse operation:', updateError)
      return NextResponse.json(
        { error: updateError.message || 'Hiba a raktári művelet befejezésekor' },
        { status: 500 }
      )
    }

    // Refresh stock summary view
    await supabase.rpc('refresh_stock_summary').catch(() => {
      // If function doesn't exist, that's okay - it will be refreshed later
    })

    return NextResponse.json({ 
      warehouse_operation: updatedWO,
      stock_movements_created: shipmentItems.length
    })
  } catch (error) {
    console.error('Error in warehouse operations complete API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
