/**
 * After order line items are saved: release prior reservations, recompute fulfillability,
 * reserve again when fully fulfillable. See docs/ORDER_RESERVATION_AND_DELETE.md.
 */

import { computeOrderFulfillabilityFromStock } from '@/lib/order-fulfillability'
import { releaseReservedStockForOrder, reserveStockForOrder } from '@/lib/order-reservation'

type SupabaseLike = {
  from: (table: string) => any
  rpc: (name: string, args?: object) => Promise<{ error: unknown }>
}

export type OrderItemsStockReconcileResult = {
  ok: true
  fulfillability_status: string
  stock_reserved: boolean
} | {
  ok: false
  error: string
}

/**
 * Call after persisted order_items + order totals. Idempotent for orders with no reservation.
 */
export async function reconcileOrderStockAfterLineItemsSave(
  supabase: SupabaseLike,
  orderId: string,
  options?: { createdBy?: string | null }
): Promise<OrderItemsStockReconcileResult> {
  try {
    await supabase.rpc('refresh_stock_summary')
  } catch {
    // non-fatal
  }

  const releaseResult = await releaseReservedStockForOrder(supabase, orderId)
  if (!releaseResult.ok) {
    return { ok: false, error: releaseResult.error || 'Foglalás feloldása sikertelen' }
  }

  try {
    await supabase.rpc('refresh_stock_summary')
  } catch {
    // non-fatal
  }

  const fulfillStatus = await computeOrderFulfillabilityFromStock(supabase, orderId, {
    skipRefresh: true
  })

  const fulfillability_status =
    fulfillStatus === null || fulfillStatus === undefined ? 'unknown' : fulfillStatus

  const { error: updErr } = await supabase
    .from('orders')
    .update({ fulfillability_status, updated_at: new Date().toISOString() })
    .eq('id', orderId)

  if (updErr) {
    return { ok: false, error: updErr.message || 'Teljesíthetőség mentése sikertelen' }
  }

  if (fulfillability_status === 'fully_fulfillable') {
    const reserveResult = await reserveStockForOrder(supabase, orderId, {
      createdBy: options?.createdBy ?? null
    })
    if (!reserveResult.ok) {
      return { ok: false, error: reserveResult.error || 'Készletfoglalás sikertelen' }
    }
  }

  try {
    await supabase.rpc('refresh_stock_summary')
  } catch {
    // non-fatal
  }

  const { data: row, error: fetchErr } = await supabase
    .from('orders')
    .select('fulfillability_status, stock_reserved')
    .eq('id', orderId)
    .single()

  if (fetchErr || !row) {
    return {
      ok: true,
      fulfillability_status,
      stock_reserved: fulfillability_status === 'fully_fulfillable'
    }
  }

  return {
    ok: true,
    fulfillability_status: String((row as any).fulfillability_status ?? fulfillability_status),
    stock_reserved: (row as any).stock_reserved === true
  }
}
