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

    // Enrich transactions with order_number for Bevételezés (shop_order_item references)
    const enrichedData = await Promise.all((data || []).map(async (transaction: any) => {
      if (transaction.reference_type === 'shop_order_item') {
        // Fetch shop_order_item to get order_id
        const { data: itemData } = await supabaseServer
          .from('shop_order_items')
          .select('order_id, shop_orders!inner(order_number)')
          .eq('id', transaction.reference_id)
          .single()

        if (itemData) {
          return {
            ...transaction,
            order_number: (itemData.shop_orders as any)?.order_number || null
          }
        }
      }
      return {
        ...transaction,
        order_number: null
      }
    }))

    return NextResponse.json(enrichedData)
  } catch (error) {
    console.error('Inventory transactions API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

