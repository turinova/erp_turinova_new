import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * GET /api/pick-batches/available-orders
 * Orders that are Csomagolható (new + fully_fulfillable) and not already in a draft/in_progress batch.
 * Optional exclude_batch_id to exclude orders already in that batch (for "add to this batch").
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const excludeBatchId = searchParams.get('exclude_batch_id') || null
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 200)

    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        customer_firstname,
        customer_lastname,
        customer_email,
        status,
        fulfillability_status,
        order_date,
        total_gross,
        currency_code
      `)
      .is('deleted_at', null)
      .eq('status', 'new')
      .eq('fulfillability_status', 'fully_fulfillable')
      .order('order_date', { ascending: false })
      .limit(limit * 2)

    if (ordersError) {
      console.error('Error fetching orders:', ordersError)
      return NextResponse.json(
        { error: ordersError.message || 'Hiba a rendelések lekérdezésekor' },
        { status: 500 }
      )
    }

    const orderIds = (orders || []).map((o: any) => o.id)
    if (orderIds.length === 0) {
      return NextResponse.json({ orders: [] })
    }

    const { data: inBatchRows } = await supabase
      .from('pick_batch_orders')
      .select('order_id, pick_batch_id')
      .in('order_id', orderIds)

    const batchIds = [...new Set((inBatchRows || []).map((r: any) => r.pick_batch_id))]
    let activeBatchIds = new Set<string>()
    if (batchIds.length > 0) {
      const { data: batches } = await supabase
        .from('pick_batches')
        .select('id')
        .in('id', batchIds)
        .in('status', ['draft', 'in_progress'])
      activeBatchIds = new Set((batches || []).map((b: any) => b.id))
    }

    const orderIdInActiveBatch = new Set(
      (inBatchRows || [])
        .filter((r: any) => activeBatchIds.has(r.pick_batch_id))
        .filter((r: any) => !excludeBatchId || r.pick_batch_id !== excludeBatchId)
        .map((r: any) => r.order_id)
    )

    const available = (orders || []).filter((o: any) => !orderIdInActiveBatch.has(o.id)).slice(0, limit)

    return NextResponse.json({ orders: available })
  } catch (err) {
    console.error('Error in pick-batches/available-orders GET:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
