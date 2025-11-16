import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// DELETE /api/purchase-order/bulk-delete { ids: string[] } - soft delete
export async function DELETE(request: NextRequest) {
  try {
    const { ids } = await request.json()
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Nincs kiválasztott PO' }, { status: 400 })
    }
    const { data, error } = await supabaseServer
      .from('purchase_orders')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', ids)
      .is('deleted_at', null)
      .select('id')
    if (error) {
      console.error('Error bulk delete PO:', error)
      return NextResponse.json({ error: 'Hiba a törléskor' }, { status: 500 })
    }
    return NextResponse.json({ deleted_count: data?.length || 0 })
  } catch (e) {
    console.error('Error in DELETE /api/purchase-order/bulk-delete', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


