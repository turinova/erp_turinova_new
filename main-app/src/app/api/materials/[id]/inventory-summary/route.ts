import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

/**
 * GET /api/materials/[id]/inventory-summary
 * Get inventory summary for a specific material
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const materialId = resolvedParams.id

    const { data, error } = await supabaseServer
      .from('material_inventory_summary')
      .select('*')
      .eq('material_id', materialId)
      .single()

    if (error) {
      // Material might not have inventory yet, return null
      if (error.code === 'PGRST116') {
        return NextResponse.json(null)
      }
      console.error('Error fetching inventory summary:', error)
      return NextResponse.json({ error: 'Failed to fetch inventory summary' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Inventory summary API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

