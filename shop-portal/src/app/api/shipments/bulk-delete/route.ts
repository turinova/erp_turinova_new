import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * DELETE /api/shipments/bulk-delete
 * Bulk delete shipments (soft delete)
 * Only 'waiting' and 'cancelled' statuses can be deleted, NOT 'completed'
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { ids } = await request.json()

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'Nincs kiválasztott szállítmány' },
        { status: 400 }
      )
    }

    // Fetch all shipments to check their statuses
    const { data: shipments, error: fetchError } = await supabase
      .from('shipments')
      .select('id, status')
      .in('id', ids)
      .is('deleted_at', null)

    if (fetchError) {
      console.error('Error fetching shipments:', fetchError)
      return NextResponse.json(
        { error: 'Hiba a szállítmányok lekérdezésekor' },
        { status: 500 }
      )
    }

    if (!shipments || shipments.length === 0) {
      return NextResponse.json(
        { error: 'Nem található szállítmány a megadott ID-kkel' },
        { status: 404 }
      )
    }

    // Check if any shipment is completed (cannot be deleted)
    const completedShipments = shipments.filter(s => s.status === 'completed')
    if (completedShipments.length > 0) {
      return NextResponse.json(
        { error: 'Bevételezett szállítmányok nem törölhetők' },
        { status: 400 }
      )
    }

    // Check if any shipment has stock movements (safety check)
    const shipmentIds = shipments.map(s => s.id)
    const { data: stockMovements } = await supabase
      .from('stock_movements')
      .select('source_id')
      .eq('source_type', 'shipment')
      .in('source_id', shipmentIds)
      .limit(1)

    if (stockMovements && stockMovements.length > 0) {
      return NextResponse.json(
        { error: 'Egy vagy több szállítmányhoz már történt bevételezés, nem törölhetők' },
        { status: 400 }
      )
    }

    // Perform soft delete
    const now = new Date().toISOString()

    // Soft delete shipment items first
    const { error: itemsError } = await supabase
      .from('shipment_items')
      .update({ deleted_at: now })
      .in('shipment_id', shipmentIds)

    if (itemsError) {
      console.error('Error soft deleting shipment items:', itemsError)
      return NextResponse.json(
        { error: 'Hiba a szállítmány tételek törlésekor' },
        { status: 500 }
      )
    }

    // Soft delete shipments
    const { error: deleteError } = await supabase
      .from('shipments')
      .update({ deleted_at: now })
      .in('id', shipmentIds)

    if (deleteError) {
      console.error('Error soft deleting shipments:', deleteError)
      return NextResponse.json(
        { error: 'Hiba a szállítmányok törlésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      deletedCount: shipments.length
    })
  } catch (error) {
    console.error('Error in bulk delete shipments API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
