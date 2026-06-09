/**
 * Link order_items.product_id from product_sku when products arrive after buffer takeover.
 */

type SupabaseLike = { from: (table: string) => any }

async function findProductIdBySku(
  supabase: SupabaseLike,
  connectionId: string,
  sku: string
): Promise<string | null> {
  const trimmed = sku.trim()
  if (!trimmed) return null

  const { data: products, error } = await supabase
    .from('shoprenter_products')
    .select('id')
    .eq('connection_id', connectionId)
    .eq('sku', trimmed)
    .is('deleted_at', null)
    .limit(1)

  if (error || !products?.length) return null
  return (products[0] as { id: string }).id ?? null
}

/**
 * Set product_id on order lines that only have product_sku (same connection as the order).
 */
export async function relinkOrderItemsBySku(
  supabase: SupabaseLike,
  orderId: string
): Promise<{ linked: number }> {
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('connection_id')
    .eq('id', orderId)
    .is('deleted_at', null)
    .maybeSingle()

  if (orderErr || !order?.connection_id) {
    return { linked: 0 }
  }

  const connectionId = order.connection_id as string

  const { data: items, error: itemsErr } = await supabase
    .from('order_items')
    .select('id, product_sku')
    .eq('order_id', orderId)
    .is('deleted_at', null)
    .is('product_id', null)

  if (itemsErr || !items?.length) {
    return { linked: 0 }
  }

  let linked = 0
  const now = new Date().toISOString()

  for (const row of items as { id: string; product_sku: string | null }[]) {
    const productId = await findProductIdBySku(supabase, connectionId, String(row.product_sku ?? ''))
    if (!productId) continue

    const { error: updErr } = await supabase
      .from('order_items')
      .update({ product_id: productId, updated_at: now })
      .eq('id', row.id)

    if (!updErr) linked += 1
  }

  return { linked }
}

/**
 * Relink unmapped lines for all orders on a connection (e.g. after product catalog sync).
 */
export async function relinkUnlinkedOrderItemsForConnection(
  supabase: SupabaseLike,
  connectionId: string
): Promise<{ linked: number; orderIds: string[] }> {
  const { data: orders, error: ordersErr } = await supabase
    .from('orders')
    .select('id')
    .eq('connection_id', connectionId)
    .eq('status', 'new')
    .is('deleted_at', null)

  if (ordersErr || !orders?.length) {
    return { linked: 0, orderIds: [] }
  }

  const touchedOrderIds = new Set<string>()
  let linked = 0

  for (const order of orders as { id: string }[]) {
    const result = await relinkOrderItemsBySku(supabase, order.id)
    if (result.linked > 0) {
      linked += result.linked
      touchedOrderIds.add(order.id)
    }
  }

  return { linked, orderIds: [...touchedOrderIds] }
}
