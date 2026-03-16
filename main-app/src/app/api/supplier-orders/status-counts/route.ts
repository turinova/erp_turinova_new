import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

/**
 * GET /api/supplier-orders/status-counts
 * Returns counts by status for the supplier orders list (same filters as list).
 * Used for status filter badges so counts are correct when total > 1000.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = (searchParams.get('search') || '').trim()
    const partnerId = searchParams.get('partner_id') || ''

    const statuses = ['open', 'ordered', 'arrived', 'handed_over', 'deleted'] as const

    const buildBaseQuery = () => {
      let q = supabaseServer
        .from('shop_order_items')
        .select('id, shop_orders!inner(id)', { count: 'exact', head: true })
        .is('shop_orders.deleted_at', null)
      if (search && search.length >= 2) {
        q = q.or(
          `product_name.ilike.%${search}%,sku.ilike.%${search}%,shop_orders.customer_name.ilike.%${search}%`
        )
      }
      if (partnerId) {
        q = q.eq('partner_id', partnerId)
      }
      return q
    }

    const [allResult, ...statusResults] = await Promise.all([
      buildBaseQuery(),
      ...statuses.map((status) => buildBaseQuery().eq('status', status))
    ])

    const all = allResult.count ?? 0
    const counts = {
      all,
      open: statusResults[0]?.count ?? 0,
      ordered: statusResults[1]?.count ?? 0,
      arrived: statusResults[2]?.count ?? 0,
      handed_over: statusResults[3]?.count ?? 0,
      deleted: statusResults[4]?.count ?? 0
    }

    return NextResponse.json(counts)
  } catch (error) {
    console.error('[status-counts]', error)
    return NextResponse.json(
      { error: 'Failed to fetch status counts' },
      { status: 500 }
    )
  }
}
