/**
 * Order stock reservation and release.
 * Used at buffer takeover (reserve when fully fulfillable) and on cancel/delete (release).
 * See docs/ORDER_RESERVATION_AND_DELETE.md.
 */

/**
 * Get the first active warehouse id (default for reservation).
 */
export async function getDefaultWarehouseId(
  supabase: { from: (table: string) => any }
): Promise<string | null> {
  const { data, error } = await supabase
    .from('warehouses')
    .select('id')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()
  if (error || !data?.id) return null
  return data.id as string
}

/**
 * Reserve stock for an order when it is fully fulfillable (e.g. at buffer takeover).
 * Inserts stock_movements (reserved), sets orders.stock_reserved and order_items.reserved_quantity.
 * Call refresh_stock_summary after.
 */
export async function reserveStockForOrder(
  supabase: { from: (table: string) => any },
  orderId: string,
  options?: { warehouseId?: string | null; createdBy?: string | null }
): Promise<{ ok: boolean; error?: string }> {
  const warehouseId = options?.warehouseId ?? (await getDefaultWarehouseId(supabase))
  if (!warehouseId) {
    return { ok: false, error: 'No warehouse available for reservation' }
  }

  const { data: items, error: itemsErr } = await supabase
    .from('order_items')
    .select('id, product_id, quantity')
    .eq('order_id', orderId)
    .is('deleted_at', null)
    .not('product_id', 'is', null)

  if (itemsErr || !items?.length) {
    return { ok: true }
  }

  const movements = (items as { id: string; product_id: string; quantity: number }[]).map(
    (item) => ({
      warehouse_id: warehouseId,
      product_id: item.product_id,
      movement_type: 'reserved',
      quantity: Math.abs(parseInt(String(item.quantity), 10) || 0),
      source_type: 'order',
      source_id: orderId,
      created_by: options?.createdBy ?? null
    })
  ).filter((m) => m.quantity > 0)

  if (movements.length === 0) {
    return { ok: true }
  }

  const { error: insertErr } = await supabase
    .from('stock_movements')
    .insert(movements)
    .select()

  if (insertErr) {
    return { ok: false, error: insertErr.message }
  }

  await supabase
    .from('orders')
    .update({ stock_reserved: true, updated_at: new Date().toISOString() })
    .eq('id', orderId)

  for (const item of items as { id: string; product_id: string; quantity: number }[]) {
    const qty = Math.abs(parseInt(String(item.quantity), 10) || 0)
    if (qty > 0) {
      await supabase
        .from('order_items')
        .update({ reserved_quantity: qty, status: 'reserved', updated_at: new Date().toISOString() })
        .eq('id', item.id)
    }
  }

  return { ok: true }
}

/**
 * Release all reserved stock for an order (on cancel or soft delete).
 * Finds stock_movements with source_type='order', source_id=orderId, movement_type='reserved',
 * inserts matching 'released' rows, then clears orders.stock_reserved and order_items.reserved_quantity.
 */
export async function releaseReservedStockForOrder(
  supabase: { from: (table: string) => any },
  orderId: string
): Promise<{ ok: boolean; released: number; error?: string }> {
  const { data: reservedRows, error: fetchErr } = await supabase
    .from('stock_movements')
    .select('warehouse_id, product_id, quantity')
    .eq('source_type', 'order')
    .eq('source_id', orderId)
    .eq('movement_type', 'reserved')

  if (fetchErr) {
    return { ok: false, released: 0, error: fetchErr.message }
  }

  if (!reservedRows?.length) {
    await supabase
      .from('orders')
      .update({ stock_reserved: false, updated_at: new Date().toISOString() })
      .eq('id', orderId)
    await supabase
      .from('order_items')
      .update({ reserved_quantity: 0, updated_at: new Date().toISOString() })
      .eq('order_id', orderId)
    return { ok: true, released: 0 }
  }

  const released = (reservedRows as { warehouse_id: string; product_id: string; quantity: number }[]).map(
    (r) => ({
      warehouse_id: r.warehouse_id,
      product_id: r.product_id,
      movement_type: 'released',
      quantity: Math.abs(parseFloat(String(r.quantity)) || 0),
      source_type: 'order',
      source_id: orderId
    })
  ).filter((r) => r.quantity > 0)

  const { error: insertErr } = await supabase
    .from('stock_movements')
    .insert(released)
    .select()

  if (insertErr) {
    return { ok: false, released: 0, error: insertErr.message }
  }

  await supabase
    .from('orders')
    .update({ stock_reserved: false, updated_at: new Date().toISOString() })
    .eq('id', orderId)

  await supabase
    .from('order_items')
    .update({ reserved_quantity: 0, updated_at: new Date().toISOString() })
    .eq('order_id', orderId)

  const totalReleased = released.reduce((s, r) => s + r.quantity, 0)
  return { ok: true, released: totalReleased }
}
