import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    console.log('=== Fetching companies from customer portal ===')
    const supabase = await createClient()
    
    const { data: companies, error } = await supabase
      .from('companies')
      .select('id, name, slug')
      .eq('is_active', true)
      .order('name')

    if (error) {
      console.error('Supabase query error:', error)
      return NextResponse.json({ error: 'Failed to fetch companies', details: error }, { status: 500 })
    }

    return NextResponse.json(companies || [])
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error.message
    }, { status: 500 })
  }
}
