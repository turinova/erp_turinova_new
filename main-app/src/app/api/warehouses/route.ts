import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// GET /api/warehouses - active warehouses ordered by name
export async function GET(_request: NextRequest) {
  try {
    const { data, error } = await supabaseServer
      .from('warehouses')
      .select('id, name, code, is_active')
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching warehouses:', error)
      return NextResponse.json({ error: 'Failed to fetch warehouses' }, { status: 500 })
    }

    return NextResponse.json({ warehouses: data || [] })
  } catch (e) {
    console.error('Error in GET /api/warehouses:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


