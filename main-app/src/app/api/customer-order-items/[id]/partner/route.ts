import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// PATCH /api/customer-order-items/[id]/partner - Update partner_id for a customer order item
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Validate partner_id (can be null to clear)
    if (body.partner_id !== null && body.partner_id !== undefined && typeof body.partner_id !== 'string') {
      return NextResponse.json({ error: 'partner_id must be a string or null' }, { status: 400 })
    }

    // Check item exists and status is 'open'
    const { data: item, error: itemError } = await supabaseServer
      .from('customer_order_items')
      .select('id, status')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (itemError || !item) {
      return NextResponse.json({ error: 'Tétel nem található' }, { status: 404 })
    }

    if (item.status !== 'open') {
      return NextResponse.json({ error: 'Csak nyitott státuszú tételek módosíthatók' }, { status: 400 })
    }

    // Update partner_id
    const { error: updateError } = await supabaseServer
      .from('customer_order_items')
      .update({
        partner_id: body.partner_id || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (updateError) {
      console.error('Error updating partner_id:', updateError)
      return NextResponse.json({ error: 'Hiba a beszállító frissítésekor' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in PATCH /api/customer-order-items/[id]/partner:', error)
    return NextResponse.json({ error: 'Szerver hiba' }, { status: 500 })
  }
}

