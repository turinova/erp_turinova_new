/**
 * Order fulfillability: compute and update based on current stock.
 * Used when order is created from buffer and when stock is received (PO/shipment complete).
 */

export type FulfillabilityStatus =
  | 'fully_fulfillable'
  | 'partially_fulfillable'
  | 'not_fulfillable'
  | null

/**
 * Compute order fulfillability from stock_summary.
 * Returns 'fully_fulfillable' | 'partially_fulfillable' | 'not_fulfillable' | null (keep unknown).
 * Caller should have refreshed stock_summary first when used after stock changes.
 */
export async function computeOrderFulfillabilityFromStock(
  supabase: { from: (table: string) => any; rpc: (name: string, args?: object) => Promise<{ error: any }> },
  orderId: string,
  options?: { skipRefresh?: boolean }
): Promise<FulfillabilityStatus> {
  const { data: items, error: itemsErr } = await supabase
    .from('order_items')
    .select('product_id, quantity')
    .eq('order_id', orderId)
    .is('deleted_at', null)

  if (itemsErr || !items?.length) return null

  const linesWithProduct = (items as { product_id: string | null; quantity: number }[]).filter(
    (r) => r.product_id != null
  )
  if (linesWithProduct.length === 0) return null

  if (!options?.skipRefresh) {
    try {
      await supabase.rpc('refresh_stock_summary').catch(() => {})
    } catch {
      // ignore
    }
  }

  const productIds = [...new Set(linesWithProduct.map((r) => r.product_id!))]
  const { data: stockRows, error: stockErr } = await supabase
    .from('stock_summary')
    .select('product_id, quantity_available')
    .in('product_id', productIds)

  const availableByProduct: Record<string, number> = {}
  if (!stockErr && stockRows) {
    for (const r of stockRows as { product_id: string; quantity_available: number }[]) {
      const pid = r.product_id
      const q = parseFloat(String(r.quantity_available)) || 0
      availableByProduct[pid] = (availableByProduct[pid] ?? 0) + q
    }
  }

  let linesOk = 0
  let linesShort = 0
  for (const line of linesWithProduct) {
    const need = parseInt(String(line.quantity), 10) || 0
    const available = availableByProduct[line.product_id!] ?? 0
    if (available >= need) linesOk += 1
    else linesShort += 1
  }

  if (linesShort === 0) return 'fully_fulfillable'
  if (linesOk === 0) return 'not_fulfillable'
  return 'partially_fulfillable'
}

/**
 * Get distinct order_ids that have at least one order_item linked to one of the given PO ids.
 */
export async function getOrderIdsLinkedToPOs(
  supabase: { from: (table: string) => any },
  poIds: string[]
): Promise<string[]> {
  if (poIds.length === 0) return []
  const { data: rows, error } = await supabase
    .from('order_items')
    .select('order_id')
    .in('purchase_order_id', poIds)
    .not('purchase_order_id', 'is', null)
  if (error || !rows?.length) return []
  const orderIds = [...new Set((rows as { order_id: string }[]).map((r) => r.order_id))]
  return orderIds
}

/** Order statuses that allow reservation (still in pipeline, not shipped/cancelled). */
const RESERVABLE_ORDER_STATUSES = ['new', 'picking', 'picked', 'verifying', 'packing']

/**
 * After recomputeFulfillabilityForOrdersLinkedToPOs, get order IDs that are now fully_fulfillable,
 * not yet reserved, and in a reservable status. Call reserveStockForOrder for each.
 */
export async function getOrderIdsToReserveLinkedToPOs(
  supabase: { from: (table: string) => any },
  poIds: string[]
): Promise<string[]> {
  if (poIds.length === 0) return []
  const orderIds = await getOrderIdsLinkedToPOs(supabase, poIds)
  if (orderIds.length === 0) return []
  const { data: rows, error } = await supabase
    .from('orders')
    .select('id')
    .in('id', orderIds)
    .eq('fulfillability_status', 'fully_fulfillable')
    .eq('stock_reserved', false)
    .in('status', RESERVABLE_ORDER_STATUSES)
    .is('deleted_at', null)
  if (error || !rows?.length) return []
  return (rows as { id: string }[]).map((r) => r.id)
}

/**
 * Recompute fulfillability for orders linked to the given POs and update their fulfillability_status.
 * Call after refresh_stock_summary() when stock has been received for these POs.
 */
export async function recomputeFulfillabilityForOrdersLinkedToPOs(
  supabase: any,
  poIds: string[]
): Promise<void> {
  const orderIds = await getOrderIdsLinkedToPOs(supabase, poIds)
  for (const orderId of orderIds) {
    const status = await computeOrderFulfillabilityFromStock(supabase, orderId, { skipRefresh: true })
    if (status == null) continue
    await supabase
      .from('orders')
      .update({ fulfillability_status: status, updated_at: new Date().toISOString() })
      .eq('id', orderId)
  }
}
