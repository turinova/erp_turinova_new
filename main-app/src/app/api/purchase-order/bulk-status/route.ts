import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// PATCH /api/purchase-order/bulk-status { ids: string[], new_status: 'sent' }
export async function PATCH(request: NextRequest) {
  try {
    const { ids, new_status } = await request.json()
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Nincs kiválasztott PO' }, { status: 400 })
    }
    if (new_status !== 'sent') {
      return NextResponse.json({ error: 'Csak draft -> sent engedélyezett ezen a végponton' }, { status: 400 })
    }

    // Only update draft
    const { data, error } = await supabaseServer
      .from('purchase_orders')
      .update({ status: 'sent' })
      .in('id', ids)
      .eq('status', 'draft')
      .is('deleted_at', null)
      .select('id')

    if (error) {
      console.error('Error bulk status update:', error)
      return NextResponse.json({ error: 'Hiba a státusz frissítéskor' }, { status: 500 })
    }
    return NextResponse.json({ updated_count: data?.length || 0 })
  } catch (e) {
    console.error('Error in PATCH /api/purchase-order/bulk-status', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


