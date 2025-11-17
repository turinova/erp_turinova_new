import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// DELETE /api/shipments/bulk-delete { ids: string[] }
export async function DELETE(request: NextRequest) {
  try {
    const { ids } = await request.json()
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Nincs kiválasztott szállítmány' }, { status: 400 })
    }

    let deletedCount = 0

    for (const shipmentId of ids) {
      // 1. Check if already soft-deleted (idempotency)
      const { data: existing } = await supabaseServer
        .from('shipments')
        .select('id, deleted_at, status')
        .eq('id', shipmentId)
        .single()

      if (!existing) {
        continue // Shipment doesn't exist, skip
      }

      if (existing.deleted_at) {
        // Already soft-deleted, skip (idempotency)
        continue
      }

      // 2. Check if shipment has stock movements
      const { data: stockMovements } = await supabaseServer
        .from('stock_movements')
        .select('id')
        .eq('source_type', 'purchase_receipt')
        .eq('source_id', shipmentId)
        .limit(1)

      if (stockMovements && stockMovements.length > 0) {
        // Has stock movements → BLOCK deletion
        return NextResponse.json(
          { error: 'Ehhez a szállítmányhoz már történt bevételezés, nem törölhető.' },
          { status: 400 }
        )
      }

      // 3. Check if status is 'draft'
      if (existing.status !== 'draft') {
        return NextResponse.json(
          { error: 'Csak vázlat státuszú szállítmányok törölhetők.' },
          { status: 400 }
        )
      }

      // 4. Perform soft delete
      const now = new Date().toISOString()

      // Soft delete shipment items
      await supabaseServer
        .from('shipment_items')
        .update({ deleted_at: now })
        .eq('shipment_id', shipmentId)
        .is('deleted_at', null)

      // Soft delete shipment
      const { error: deleteError } = await supabaseServer
        .from('shipments')
        .update({ deleted_at: now })
        .eq('id', shipmentId)

      if (deleteError) {
        console.error('Error soft deleting shipment:', deleteError)
        return NextResponse.json(
          { error: 'Hiba a szállítmány törlésekor' },
          { status: 500 }
        )
      }

      deletedCount++
    }

    return NextResponse.json({ deleted_count: deletedCount })
  } catch (e) {
    console.error('Error in DELETE /api/shipments/bulk-delete', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

