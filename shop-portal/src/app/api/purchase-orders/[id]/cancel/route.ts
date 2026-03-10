import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * PUT /api/purchase-orders/[id]/cancel
 * Cancel a purchase order (sets status = 'cancelled')
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

    // Check if PO exists and get current status
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

    // Cannot cancel if status is 'received'
    if (existingPO.status === 'received') {
      return NextResponse.json(
        { error: 'A bevételezett rendelés nem törölhető' },
        { status: 400 }
      )
    }

    // Check for linked shipments
    const { data: shipments, error: shipmentsError } = await supabase
      .from('shipment_purchase_orders')
      .select('id, shipments:shipment_id(id, status)')
      .eq('purchase_order_id', id)
      .limit(1)

    if (shipments && shipments.length > 0) {
      const shipment = shipments[0] as any
      if (shipment.shipments && shipment.shipments.status !== 'cancelled') {
        return NextResponse.json(
          { error: 'A rendeléshez kapcsolódó szállítmányok miatt nem törölhető. Először törölje a szállítmányokat.' },
          { status: 400 }
        )
      }
    }

    const body = await request.json().catch(() => ({}))
    const { reason } = body

    // Update purchase order
    const { data: updatedPO, error: updateError } = await supabase
      .from('purchase_orders')
      .update({
        status: 'cancelled',
        note: reason?.trim() 
          ? `${existingPO.note || ''}\n\nTörlés oka: ${reason.trim()}`.trim()
          : existingPO.note || null
      })
      .eq('id', id)
      .select(`
        *,
        suppliers:supplier_id(id, name),
        warehouses:warehouse_id(id, name)
      `)
      .single()

    if (updateError) {
      console.error('Error cancelling purchase order:', updateError)
      return NextResponse.json(
        { error: updateError.message || 'Hiba a beszerzési rendelés törlésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ purchase_order: updatedPO })
  } catch (error) {
    console.error('Error in purchase orders cancel API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
