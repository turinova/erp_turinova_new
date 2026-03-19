import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { consumeReservedAndPostOutbound } from '@/lib/order-reservation'
import { sendOrderStatusEmailNotification } from '@/lib/order-status-notification-send'

/**
 * POST /api/dispatch/pickup/mark-delivered
 * Mark orders as delivered (customer collected). Idempotent: only updates orders still in ready_for_pickup.
 * Body: { order_ids: string[] }
 * Returns: { updated: string[], already_delivered: string[] }
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
      return NextResponse.json({ updated: [], already_delivered: [] })
    }

    const now = new Date().toISOString()
    const updated: string[] = []
    const alreadyDelivered: string[] = []

    for (const id of orderIds) {
      const { data: order, error: fetchErr } = await supabase
        .from('orders')
        .select('id, status')
        .eq('id', id)
        .is('deleted_at', null)
        .single()

      if (fetchErr || !order) continue

      if (order.status === 'delivered') {
        alreadyDelivered.push(id)
        continue
      }
      if (order.status !== 'ready_for_pickup') continue

      const { error: updateErr } = await supabase
        .from('orders')
        .update({ status: 'delivered', updated_at: now })
        .eq('id', id)

      if (updateErr) continue
      updated.push(id)

      await sendOrderStatusEmailNotification(supabase, {
        orderId: id,
        previousStatus: 'ready_for_pickup',
        newStatus: 'delivered',
        actingUserId: user.id
      })

      const consumeResult = await consumeReservedAndPostOutbound(supabase, id, { createdBy: user.id })
      if (!consumeResult.ok) {
        console.error('[mark-delivered] consume stock failed for order', id, consumeResult.error)
      }
    }

    if (updated.length > 0) {
      try {
        await supabase.rpc('refresh_stock_summary')
      } catch {
        // non-fatal
      }
    }

    return NextResponse.json({ updated, already_delivered: alreadyDelivered })
  } catch (err) {
    console.error('Error in dispatch/pickup/mark-delivered:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
