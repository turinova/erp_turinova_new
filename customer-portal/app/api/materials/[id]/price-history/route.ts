import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET /api/materials/[id]/price-history - Get price change history for a material
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    console.log(`Fetching price history for material ${id}`)

    // Fetch last 10 price changes
    const { data, error } = await supabase
      .from('material_price_history')
      .select(`
        id,
        old_price_per_sqm,
        new_price_per_sqm,
        changed_at,
        changed_by
      `)
      .eq('material_id', id)
      .order('changed_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Error fetching price history:', error)
      return NextResponse.json(
        { error: 'Failed to fetch price history', details: error.message },
        { status: 500 }
      )
    }

    console.log(`Found ${data?.length || 0} price history entries`)

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Error in price history API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

