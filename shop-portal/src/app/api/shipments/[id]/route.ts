import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/shipments/[id]
 * Get a single shipment with all items
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

    // Fetch shipment with all relationships
    const { data: shipment, error } = await supabase
      .from('shipments')
      .select(`
        *,
        suppliers:supplier_id(id, name),
        warehouses:warehouse_id(id, name, code),
        currencies:currency_id(id, name, code, symbol),
        shipment_purchase_orders(
          purchase_orders:purchase_order_id(id, po_number, status, order_date, expected_delivery_date)
        )
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error || !shipment) {
      return NextResponse.json(
        { error: 'Szállítmány nem található' },
        { status: 404 }
      )
    }

    return NextResponse.json({ shipment })
  } catch (error) {
    console.error('Error in shipments GET API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/shipments/[id]
 * Update shipment header (dates, note)
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

    // Check if shipment exists and get status
    const { data: existingShipment, error: fetchError } = await supabase
      .from('shipments')
      .select('id, status')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (fetchError || !existingShipment) {
      return NextResponse.json(
        { error: 'Szállítmány nem található' },
        { status: 404 }
      )
    }

    // Can only edit if status is 'waiting'
    if (existingShipment.status !== 'waiting') {
      return NextResponse.json(
        { error: 'Csak várakozó szállítmány szerkeszthető' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const {
      expected_arrival_date,
      actual_arrival_date,
      purchased_date,
      note
    } = body

    // Build update object
    const updateData: any = {}
    if (expected_arrival_date !== undefined) updateData.expected_arrival_date = expected_arrival_date || null
    if (actual_arrival_date !== undefined) updateData.actual_arrival_date = actual_arrival_date || null
    if (purchased_date !== undefined) updateData.purchased_date = purchased_date || null
    if (note !== undefined) updateData.note = note?.trim() || null

    // Update shipment
    const { data: updatedShipment, error: updateError } = await supabase
      .from('shipments')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating shipment:', updateError)
      return NextResponse.json(
        { error: updateError.message || 'Hiba a szállítmány frissítésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ shipment: updatedShipment })
  } catch (error) {
    console.error('Error in shipments PUT API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/shipments/[id]
 * Soft delete a shipment
 * Only 'waiting' and 'cancelled' statuses can be deleted, NOT 'completed'
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

    // Check if shipment exists and get status
    const { data: shipment, error: fetchError } = await supabase
      .from('shipments')
      .select('id, status, shipment_number')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (fetchError || !shipment) {
      return NextResponse.json(
        { error: 'Szállítmány nem található' },
        { status: 404 }
      )
    }

    // Cannot delete completed shipments
    if (shipment.status === 'completed') {
      return NextResponse.json(
        { error: 'Bevételezett szállítmány nem törölhető' },
        { status: 400 }
      )
    }

    // Check if shipment has stock movements (safety check)
    const { data: stockMovements } = await supabase
      .from('stock_movements')
      .select('id')
      .eq('source_type', 'shipment')
      .eq('source_id', id)
      .limit(1)

    if (stockMovements && stockMovements.length > 0) {
      return NextResponse.json(
        { error: 'Ehhez a szállítmányhoz már történt bevételezés, nem törölhető' },
        { status: 400 }
      )
    }

    // Perform soft delete
    const now = new Date().toISOString()

    // Soft delete shipment items first
    const { error: itemsError } = await supabase
      .from('shipment_items')
      .update({ deleted_at: now })
      .eq('shipment_id', id)

    if (itemsError) {
      console.error('Error soft deleting shipment items:', itemsError)
      return NextResponse.json(
        { error: 'Hiba a szállítmány tételek törlésekor' },
        { status: 500 }
      )
    }

    // Soft delete shipment
    const { error: deleteError } = await supabase
      .from('shipments')
      .update({ deleted_at: now })
      .eq('id', id)

    if (deleteError) {
      console.error('Error soft deleting shipment:', deleteError)
      return NextResponse.json(
        { error: 'Hiba a szállítmány törlésekor' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in shipments DELETE API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
