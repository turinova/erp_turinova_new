import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * DELETE /api/shipments/[id]/items/[itemId]
 * Delete a shipment item (only unexpected items)
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

    // Verify shipment exists and get status
    const { data: shipment, error: shipmentError } = await supabase
      .from('shipments')
      .select('id, status')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (shipmentError || !shipment) {
      return NextResponse.json(
        { error: 'Szállítmány nem található' },
        { status: 404 }
      )
    }

    // Can only delete items if status is 'waiting'
    if (shipment.status !== 'waiting') {
      return NextResponse.json(
        { error: 'Csak várakozó szállítmány tételei törölhetők' },
        { status: 400 }
      )
    }

    // Verify item exists and is unexpected
    const { data: item, error: itemError } = await supabase
      .from('shipment_items')
      .select('id, is_unexpected')
      .eq('id', itemId)
      .eq('shipment_id', id)
      .single()

    if (itemError || !item) {
      return NextResponse.json(
        { error: 'Szállítmány tétel nem található' },
        { status: 404 }
      )
    }

    // Can only delete unexpected items
    if (!item.is_unexpected) {
      return NextResponse.json(
        { error: 'A beszerzési rendelésből származó tételek nem törölhetők' },
        { status: 400 }
      )
    }

    // Delete item
    const { error: deleteError } = await supabase
      .from('shipment_items')
      .delete()
      .eq('id', itemId)
      .eq('shipment_id', id)

    if (deleteError) {
      console.error('Error deleting shipment item:', deleteError)
      return NextResponse.json(
        { error: deleteError.message || 'Hiba a tétel törlésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in shipment item DELETE API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
