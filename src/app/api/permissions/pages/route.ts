import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    
    // Skip auth check for now - we'll handle it in the frontend

    // Get all active pages
    const { data: pages, error } = await supabase
      .from('pages')
      .select('*')
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching pages:', error)
      return NextResponse.json({ error: 'Failed to fetch pages' }, { status: 500 })
    }

    return NextResponse.json({ pages })
  } catch (error) {
    console.error('Error in pages API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
