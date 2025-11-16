import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const ids: string[] = Array.isArray(body?.ids) ? body.ids : []
    if (ids.length === 0) {
      return NextResponse.json({ error: 'Nincs kiválasztott elem' }, { status: 400 })
    }

    const { data, error } = await supabaseServer
      .from('product_suggestions')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString()
      })
      .in('id', ids)
      .eq('status', 'pending')
      .is('accessory_id', null)
      .select('id')

    if (error) {
      console.error('Bulk reject error:', error)
      return NextResponse.json({ error: 'Elutasítás sikertelen' }, { status: 500 })
    }

    return NextResponse.json({ updated: data?.length || 0 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


