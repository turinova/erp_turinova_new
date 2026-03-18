import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { recomputeFulfillabilityForOrdersLinkedToPOs, getOrderIdsToReserveLinkedToPOs } from '@/lib/order-fulfillability'
import { reserveStockForOrder } from '@/lib/order-reservation'

/**
 * POST /api/shipments/[id]/complete
 * Complete receiving: create stock movements, update PO statuses, complete warehouse operation
 */
export async function POST(
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

    // Verify shipment exists and get status
    const { data: shipment, error: shipmentError } = await supabase
      .from('shipments')
      .select('id, status, warehouse_id, supplier_id')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (shipmentError || !shipment) {
      return NextResponse.json(
        { error: 'Szállítmány nem található' },
        { status: 404 }
      )
    }

    // Can only complete if status is 'waiting'
    if (shipment.status !== 'waiting') {
      return NextResponse.json(
        { error: 'Csak várakozó szállítmány bevételezhető' },
        { status: 400 }
      )
    }

    // Fetch all shipment items
    const { data: items, error: itemsError } = await supabase
      .from('shipment_items')
      .select(`
        id,
        purchase_order_item_id,
        product_id,
        received_quantity,
        unit_cost,
        vat_id
      `)
      .eq('shipment_id', id)

    if (itemsError) {
      console.error('Error fetching shipment items:', itemsError)
      return NextResponse.json(
        { error: 'Hiba a tételek lekérdezésekor' },
        { status: 500 }
      )
    }

    // Validate at least one item with received_quantity > 0
    const hasReceivedItems = items && items.some((item: any) => (item.received_quantity || 0) > 0)
    if (!hasReceivedItems) {
      return NextResponse.json(
        { error: 'Legalább egy tételnél adjon meg beérkezett mennyiséget' },
        { status: 400 }
      )
    }

    // Validate unexpected items have unit_cost
    const unexpectedItems = items?.filter((item: any) => !item.purchase_order_item_id) || []
    for (const item of unexpectedItems) {
      if (!item.unit_cost || item.unit_cost <= 0) {
        return NextResponse.json(
          { error: 'Minden váratlan tételnek meg kell adni az egységárat' },
          { status: 400 }
        )
      }
    }

    // Get warehouse operation
    const { data: warehouseOp, error: woError } = await supabase
      .from('warehouse_operations')
      .select('id')
      .eq('shipment_id', id)
      .eq('status', 'waiting')
      .single()

    if (woError || !warehouseOp) {
      console.error('Error fetching warehouse operation:', woError)
      // Continue anyway, warehouse operation might not exist
    }

    // Create stock movements for items with received_quantity > 0
    const stockMovements = (items || [])
      .filter((item: any) => (item.received_quantity || 0) > 0)
      .map((item: any) => ({
        warehouse_id: shipment.warehouse_id,
        product_id: item.product_id,
        movement_type: 'in',
        quantity: item.received_quantity,
        unit_cost: item.unit_cost || null,
        source_type: 'shipment',
        source_id: shipment.id,
        warehouse_operation_id: warehouseOp?.id || null,
        created_by: user.id
      }))

    if (stockMovements.length > 0) {
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
    }

    // Update supplier last purchase price (product_suppliers.default_cost, last_purchased_at) for received items
    const receivedItems = (items || []).filter((item: any) => (item.received_quantity || 0) > 0 && item.unit_cost != null)
    const poItemIds = receivedItems
      .map((item: any) => item.purchase_order_item_id)
      .filter(Boolean)
    const poItemToProductSupplier: Map<string, string> = new Map()
    if (poItemIds.length > 0) {
      const { data: poItems } = await supabase
        .from('purchase_order_items')
        .select('id, product_supplier_id')
        .in('id', poItemIds)
        .is('deleted_at', null)
      if (poItems) {
        poItems.forEach((row: any) => {
          if (row.product_supplier_id) poItemToProductSupplier.set(row.id, row.product_supplier_id)
        })
      }
    }
    const now = new Date().toISOString()
    for (const item of receivedItems) {
      const cost = parseFloat(item.unit_cost)
      if (Number.isNaN(cost) || cost < 0) continue
      if (item.purchase_order_item_id) {
        const productSupplierId = poItemToProductSupplier.get(item.purchase_order_item_id)
        if (productSupplierId) {
          await supabase
            .from('product_suppliers')
            .update({ default_cost: cost, last_purchased_at: now })
            .eq('id', productSupplierId)
        }
      } else {
        await supabase
          .from('product_suppliers')
          .update({ default_cost: cost, last_purchased_at: now })
          .eq('product_id', item.product_id)
          .eq('supplier_id', shipment.supplier_id)
          .is('deleted_at', null)
      }
    }

    // Update warehouse operation status
    if (warehouseOp) {
      await supabase
        .from('warehouse_operations')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: user.id
        })
        .eq('id', warehouseOp.id)
    }

    // Update shipment status
    // Set actual_arrival_date to today (when bevételezés happens)
    const today = new Date().toISOString().split('T')[0] // Get date in YYYY-MM-DD format
    
    const { error: updateError } = await supabase
      .from('shipments')
      .update({
        status: 'completed',
        actual_arrival_date: today // Auto-fill when completing shipment
      })
      .eq('id', id)

    if (updateError) {
      console.error('Error updating shipment status:', updateError)
      return NextResponse.json(
        { error: updateError.message || 'Hiba a szállítmány státusz frissítésekor' },
        { status: 500 }
      )
    }

    // Update PO statuses
    // Get all linked POs
    const { data: poLinks, error: poLinksError } = await supabase
      .from('shipment_purchase_orders')
      .select('purchase_order_id')
      .eq('shipment_id', id)

    if (!poLinksError && poLinks && poLinks.length > 0) {
      const poIds = poLinks.map((link: any) => link.purchase_order_id)

      for (const poId of poIds) {
        // Get all items for this PO
        const { data: poItems, error: poItemsError } = await supabase
          .from('purchase_order_items')
          .select('id, quantity')
          .eq('purchase_order_id', poId)
          .is('deleted_at', null)

        if (poItemsError || !poItems) continue

        // Calculate total expected and received for this PO
        const totalExpected = poItems.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0)

        // Get received quantities from all completed shipments for this PO
        // First, get all shipment IDs linked to this PO
        const { data: linkedShipments, error: linkedShipmentsError } = await supabase
          .from('shipment_purchase_orders')
          .select('shipment_id')
          .eq('purchase_order_id', poId)

        let totalReceived = 0
        if (!linkedShipmentsError && linkedShipments && linkedShipments.length > 0) {
          const shipmentIds = linkedShipments.map((link: any) => link.shipment_id)

          // Get all shipment items from completed shipments for this PO
          const { data: receivedData, error: receivedError } = await supabase
            .from('shipment_items')
            .select('received_quantity, purchase_order_item_id, shipment_id')
            .in('shipment_id', shipmentIds)
            .in('purchase_order_item_id', poItems.map((item: any) => item.id))

          // Also check shipment status
          const { data: shipments, error: shipmentsError } = await supabase
            .from('shipments')
            .select('id, status')
            .in('id', shipmentIds)
            .eq('status', 'completed')
            .is('deleted_at', null)

          if (!receivedError && !shipmentsError && receivedData && shipments) {
            const completedShipmentIds = new Set(shipments.map((s: any) => s.id))
            const relevantItems = receivedData.filter((item: any) => {
              // We need to check if the item's shipment is completed
              // Since we can't join easily, we'll sum all and filter by shipment_id later
              return true // We'll filter by shipment_id in the aggregation
            })

            // Get shipment_id for each item to filter
            const { data: itemsWithShipments, error: itemsError } = await supabase
              .from('shipment_items')
              .select('id, shipment_id, received_quantity, purchase_order_item_id')
              .in('shipment_id', shipmentIds)
              .in('purchase_order_item_id', poItems.map((item: any) => item.id))

            if (!itemsError && itemsWithShipments) {
              totalReceived = itemsWithShipments
                .filter((item: any) => completedShipmentIds.has(item.shipment_id))
                .reduce((sum: number, item: any) => sum + (item.received_quantity || 0), 0)
            }
          }
        }

        // Update PO status
        let newStatus = 'approved'
        if (totalReceived >= totalExpected) {
          newStatus = 'received'
        } else if (totalReceived > 0) {
          newStatus = 'partially_received'
        }

        await supabase
          .from('purchase_orders')
          .update({ status: newStatus })
          .eq('id', poId)
      }
    }

    // Refresh stock summary view
    await supabase.rpc('refresh_stock_summary')

    // Recompute fulfillability for orders linked to the received PO(s) so "Beszerzés alatt" → "Csomagolható"
    if (!poLinksError && poLinks && poLinks.length > 0) {
      const poIds = poLinks.map((link: any) => link.purchase_order_id)
      await recomputeFulfillabilityForOrdersLinkedToPOs(supabase, poIds)
      // Reserve stock for orders that became fully_fulfillable and are not yet reserved
      const orderIdsToReserve = await getOrderIdsToReserveLinkedToPOs(supabase, poIds)
      for (const orderId of orderIdsToReserve) {
        const result = await reserveStockForOrder(supabase, orderId, { createdBy: user.id })
        if (!result.ok) {
          console.error('[shipment complete] Reserve failed for order', orderId, result.error)
        }
      }
      if (orderIdsToReserve.length > 0) {
        try {
          await supabase.rpc('refresh_stock_summary')
        } catch {
          // non-fatal
        }
      }
    }

    return NextResponse.json({
      success: true,
      items_received: stockMovements.length
    })
  } catch (error) {
    console.error('Error in shipment complete API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
