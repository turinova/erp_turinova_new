import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { computeOrderFulfillabilityFromStock } from '@/lib/order-fulfillability'
import { reserveStockForOrder } from '@/lib/order-reservation'

/**
 * POST /api/orders/[id]/recheck-fulfillability
 * Recompute fulfillability from current stock and update the order.
 * Use when stock was received but the badge didn't update (e.g. "Beszerzés alatt" → "Csomagolható").
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params
    const supabase = await getTenantSupabase()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, status, stock_reserved')
      .eq('id', orderId)
      .is('deleted_at', null)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Rendelés nem található' }, { status: 404 })
    }

    if (order.status !== 'new') {
      return NextResponse.json(
        { error: 'Csak Új rendelés készletének ellenőrizhető újra' },
        { status: 400 }
      )
    }

    try {
      await supabase.rpc('refresh_stock_summary')
    } catch {
      // ignore if RPC missing or fails
    }
    const status = await computeOrderFulfillabilityFromStock(supabase, orderId, { skipRefresh: true })

    if (status == null) {
      return NextResponse.json(
        { error: 'Nem sikerült kiszámolni a készletet (nincs termék a rendelésben?)' },
        { status: 400 }
      )
    }

    await supabase
      .from('orders')
      .update({ fulfillability_status: status, updated_at: new Date().toISOString() })
      .eq('id', orderId)

    // If order became fully_fulfillable and was not yet reserved, reserve stock now
    if (status === 'fully_fulfillable' && !order.stock_reserved) {
      const reserveResult = await reserveStockForOrder(supabase, orderId, { createdBy: user.id })
      if (reserveResult.ok) {
        try {
          await supabase.rpc('refresh_stock_summary')
        } catch {
          // non-fatal
        }
      }
    }

    return NextResponse.json({ fulfillability_status: status })
  } catch (error) {
    console.error('Recheck fulfillability error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Hiba' },
      { status: 500 }
    )
  }
}
