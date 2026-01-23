import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

/**
 * GET /api/materials/[id]/inventory-summary
 * Get inventory summary for a specific material
 * Uses current_stock view (same as edit page) for consistency
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const materialId = resolvedParams.id

    // Query current_stock view (same as getMaterialCurrentStock function)
    // This ensures consistency with the edit page
    const { data: stockData, error } = await supabaseServer
      .from('current_stock')
      .select('quantity_on_hand, last_movement_at, stock_value')
      .eq('product_type', 'material')
      .eq('material_id', materialId)

    if (error) {
      console.error('Error fetching inventory summary:', error)
      return NextResponse.json({ error: 'Failed to fetch inventory summary' }, { status: 500 })
    }

    // If no stock data, return null (material has no inventory)
    if (!stockData || stockData.length === 0) {
      return NextResponse.json(null)
    }

    // Sum quantities and stock values across all warehouses (same logic as getMaterialCurrentStock)
    const quantityOnHand = stockData.reduce((sum, item) => {
      return sum + Number(item.quantity_on_hand || 0)
    }, 0)

    const stockValue = stockData.reduce((sum, item) => {
      return sum + Number(item.stock_value || 0)
    }, 0)

    // Get the most recent movement date
    const lastMovementAt = stockData
      .map(item => item.last_movement_at)
      .filter(Boolean)
      .sort()
      .reverse()[0] || null

    // Return format compatible with frontend expectations
    return NextResponse.json({
      quantity_on_hand: quantityOnHand,
      total_inventory_value: stockValue, // Frontend expects this field name
      stock_value: stockValue, // Also include for consistency
      last_movement_at: lastMovementAt
    })
  } catch (error) {
    console.error('Inventory summary API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

