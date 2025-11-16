import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// GET /api/partners - active partners (not deleted), ordered by name
export async function GET(_request: NextRequest) {
  try {
    const { data, error } = await supabaseServer
      .from('partners')
      .select('id, name')
      .eq('status', 'active')
      .is('deleted_at', null)
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching partners:', error)
      return NextResponse.json({ error: 'Failed to fetch partners' }, { status: 500 })
    }

    return NextResponse.json({ partners: data || [] })
  } catch (e) {
    console.error('Error in GET /api/partners:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
