import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { consumeReservedAndPostOutbound } from '@/lib/order-reservation'

/**
 * POST /api/dispatch/carrier/mark-shipped
 * Mark orders as shipped (handed to carrier). Idempotent: only updates orders still in awaiting_carrier.
 * Body: { order_ids: string[] }
 * Returns: { updated: string[], already_shipped: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const orderIds: string[] = Array.isArray(body.order_ids) ? body.order_ids.filter((id: unknown) => typeof id === 'string') : []

    if (orderIds.length === 0) {
      return NextResponse.json({ updated: [], already_shipped: [] })
    }

    const now = new Date().toISOString()
    const updated: string[] = []
    const alreadyShipped: string[] = []

    for (const id of orderIds) {
      const { data: order, error: fetchErr } = await supabase
        .from('orders')
        .select('id, status')
        .eq('id', id)
        .is('deleted_at', null)
        .single()

      if (fetchErr || !order) continue

      if (order.status === 'shipped') {
        alreadyShipped.push(id)
        continue
      }
      if (order.status !== 'awaiting_carrier') continue

      const { error: updateErr } = await supabase
        .from('orders')
        .update({ status: 'shipped', shipped_at: now, updated_at: now })
        .eq('id', id)

      if (updateErr) continue
      updated.push(id)

      const consumeResult = await consumeReservedAndPostOutbound(supabase, id, { createdBy: user.id })
      if (!consumeResult.ok) {
        console.error('[mark-shipped] consume stock failed for order', id, consumeResult.error)
        // Order is already marked shipped; stock can be fixed manually or retried
      }
    }

    if (updated.length > 0) {
      try {
        await supabase.rpc('refresh_stock_summary')
      } catch {
        // non-fatal
      }
    }

    return NextResponse.json({ updated, already_shipped: alreadyShipped })
  } catch (err) {
    console.error('Error in dispatch/carrier/mark-shipped:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
