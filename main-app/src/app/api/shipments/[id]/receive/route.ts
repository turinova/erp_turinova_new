import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// POST /api/shipments/[id]/receive - receive shipment
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Call the PostgreSQL function via RPC
    const { data, error } = await supabaseServer.rpc('receive_shipment', {
      p_shipment_id: id
    })

    if (error) {
      console.error('Error calling receive_shipment RPC:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a szállítmány bevételezésekor' },
        { status: 500 }
      )
    }

    // Check the result from the function
    if (!data || !data.success) {
      const errorMsg = data?.error || 'Hiba a szállítmány bevételezésekor'
      return NextResponse.json(
        { error: errorMsg },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      shipment_id: data.shipment_id,
      shipment_status: data.shipment_status,
      po_status: data.po_status,
      items_received: data.items_received
    })
  } catch (e) {
    console.error('Error in POST /api/shipments/[id]/receive', e)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

