import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// PATCH /api/customer-order-items/[id]/note - Update megjegyzes for a customer order item
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Validate megjegyzes (can be null to clear)
    if (body.megjegyzes !== null && body.megjegyzes !== undefined && typeof body.megjegyzes !== 'string') {
      return NextResponse.json({ error: 'megjegyzes must be a string or null' }, { status: 400 })
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

    // Update megjegyzes
    const { error: updateError } = await supabaseServer
      .from('customer_order_items')
      .update({
        megjegyzes: body.megjegyzes || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (updateError) {
      console.error('Error updating megjegyzes:', updateError)
      return NextResponse.json({ error: 'Hiba a megjegyzés frissítésekor' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in PATCH /api/customer-order-items/[id]/note:', error)
    return NextResponse.json({ error: 'Szerver hiba' }, { status: 500 })
  }
}

