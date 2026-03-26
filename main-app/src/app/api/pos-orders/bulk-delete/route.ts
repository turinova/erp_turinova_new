import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const orderIds = Array.isArray(body?.order_ids) ? body.order_ids : []

    if (orderIds.length === 0) {
      return NextResponse.json({ error: 'Nincs kijelolt rendelés' }, { status: 400 })
    }

    const { data, error } = await supabaseServer.rpc('bulk_soft_delete_pos_orders', {
      p_order_ids: orderIds
    })

    if (error) {
      console.error('Error bulk deleting POS orders:', error)
      return NextResponse.json(
        { error: error.message || 'Hiba a rendelesek torlese kozben' },
        { status: 500 }
      )
    }

    return NextResponse.json(data || { success: true })
  } catch (error: any) {
    console.error('Error in POST /api/pos-orders/bulk-delete', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

