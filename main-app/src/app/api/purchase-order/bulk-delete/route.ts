import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// DELETE /api/purchase-order/bulk-delete { ids: string[] }
export async function DELETE(request: NextRequest) {
  try {
    const { ids } = await request.json()
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Nincs kiválasztott PO' }, { status: 400 })
    }

    const results = []
    
    for (const poId of ids) {
      // 1. Check if PO has stock_movements (via shipments)
      const { data: shipments } = await supabaseServer
        .from('shipments')
        .select('id')
        .eq('purchase_order_id', poId)
        .is('deleted_at', null)

      const shipmentIds = (shipments || []).map((s: any) => s.id)
      
      if (shipmentIds.length > 0) {
        const { data: stockMovements } = await supabaseServer
          .from('stock_movements')
          .select('id')
          .eq('source_type', 'purchase_receipt')
          .in('source_id', shipmentIds)
          .limit(1)

        if (stockMovements && stockMovements.length > 0) {
          // Case 1: Has stock_movement → 400 error
          return NextResponse.json(
            { error: 'Ehhez a rendeléshez már történt bevételezés, nem törölhető.' },
            { status: 400 }
          )
        }

        // Case 2: Has shipment (draft) but no stock_movement
        // Check if any shipment is draft
        const { data: draftShipments } = await supabaseServer
          .from('shipments')
          .select('id')
          .eq('purchase_order_id', poId)
          .eq('status', 'draft')
          .is('deleted_at', null)
          .limit(1)

        if (draftShipments && draftShipments.length > 0) {
          // Set PO.status to 'cancelled'
          await supabaseServer
            .from('purchase_orders')
            .update({ status: 'cancelled' })
            .eq('id', poId)

          // Soft delete shipments + shipment_items
          await supabaseServer
            .from('shipments')
            .update({ deleted_at: new Date().toISOString() })
            .eq('purchase_order_id', poId)
            .is('deleted_at', null)

          await supabaseServer
            .from('shipment_items')
            .update({ deleted_at: new Date().toISOString() })
            .in('shipment_id', shipmentIds)
            .is('deleted_at', null)

          results.push({ id: poId, action: 'cancelled' })
          continue
        }
      }

      // Case 3: No shipment and no stock_movement
      const { data: po } = await supabaseServer
        .from('purchase_orders')
        .select('status')
        .eq('id', poId)
        .is('deleted_at', null)
        .single()

      if (!po) {
        results.push({ id: poId, action: 'not_found' })
        continue
      }

      if (po.status === 'draft') {
        // Soft delete PO + PO items
        await supabaseServer
          .from('purchase_orders')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', poId)

        await supabaseServer
          .from('purchase_order_items')
          .update({ deleted_at: new Date().toISOString() })
          .eq('purchase_order_id', poId)
          .is('deleted_at', null)

        results.push({ id: poId, action: 'deleted' })
      } else if (po.status === 'confirmed') {
        // Set status to 'cancelled'
        await supabaseServer
          .from('purchase_orders')
          .update({ status: 'cancelled' })
          .eq('id', poId)

        results.push({ id: poId, action: 'cancelled' })
      } else {
        results.push({ id: poId, action: 'skipped', reason: `Status: ${po.status}` })
      }
    }

    const deletedCount = results.filter(r => r.action === 'deleted').length
    const cancelledCount = results.filter(r => r.action === 'cancelled').length

    return NextResponse.json({
      deleted_count: deletedCount,
      cancelled_count: cancelledCount,
      total_processed: results.length,
      results
    })
  } catch (e) {
    console.error('Error in DELETE /api/purchase-order/bulk-delete', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


