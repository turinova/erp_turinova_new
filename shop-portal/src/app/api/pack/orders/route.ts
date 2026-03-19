import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

const RECENT_PACKED_HOURS = 48
const RECENT_PACKED_LIMIT = 100

/**
 * GET /api/pack/orders
 * scope=queue (default): picked + packing — csomagolásra váró sor.
 * scope=recent_packed: awaiting_carrier + ready_for_pickup, updated in last 48h — legutóbb lezárt csomagolások.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const scope = request.nextUrl.searchParams.get('scope') || 'queue'
    const sinceIso = new Date(Date.now() - RECENT_PACKED_HOURS * 60 * 60 * 1000).toISOString()

    let query = supabase
      .from('orders')
      .select(`
        id,
        order_number,
        status,
        customer_email,
        shipping_firstname,
        shipping_lastname,
        shipping_company,
        shipping_city,
        shipping_postcode,
        shipping_address1,
        shipping_method_id,
        shipping_method_name,
        order_date,
        updated_at
      `)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })

    if (scope === 'recent_packed') {
      query = query
        .in('status', ['awaiting_carrier', 'ready_for_pickup'])
        .gte('updated_at', sinceIso)
        .limit(RECENT_PACKED_LIMIT)
    } else {
      query = query.in('status', ['picked', 'packing'])
    }

    const { data: orders, error } = await query

    if (error) {
      console.error('Pack orders list error:', error)
      return NextResponse.json({ error: 'Hiba a lista betöltésekor' }, { status: 500 })
    }

    const list = orders || []
    const orderIds = list.map((o: { id: string }) => o.id)
    const itemCountByOrder: Record<string, number> = {}
    if (orderIds.length > 0) {
      const { data: rows } = await supabase
        .from('order_items')
        .select('order_id')
        .in('order_id', orderIds)
        .is('deleted_at', null)
      for (const r of rows || []) {
        const oid = (r as { order_id: string }).order_id
        itemCountByOrder[oid] = (itemCountByOrder[oid] || 0) + 1
      }
    }

    const ordersWithCounts = list.map((o: any) => ({
      ...o,
      item_count: itemCountByOrder[o.id] ?? 0
    }))

    return NextResponse.json({ orders: ordersWithCounts })
  } catch (err) {
    console.error('Error in pack/orders GET:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
