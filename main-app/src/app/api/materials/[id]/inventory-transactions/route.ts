import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

/**
 * GET /api/materials/[id]/inventory-transactions
 * Get inventory transaction history for a specific material
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const materialId = resolvedParams.id

    const { data, error } = await supabaseServer
      .from('material_inventory_transactions')
      .select('*')
      .eq('material_id', materialId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('Error fetching inventory transactions:', error)
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Inventory transactions API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

