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
 * Reserved rows that are not yet cancelled by a released row (reversed_movement_id on released points to reserved.id).
 * Historical reserved rows stay in the table; without pairing, release would duplicate Felszabadított movements.
 */
export async function fetchUnpairedReservedRowsForOrder(
  supabase: { from: (table: string) => any },
  orderId: string
): Promise<{ id: string; warehouse_id: string; product_id: string; quantity: number }[]> {
  const { data: reservedRows, error: fetchErr } = await supabase
    .from('stock_movements')
    .select('id, warehouse_id, product_id, quantity')
    .eq('source_type', 'order')
    .eq('source_id', orderId)
    .eq('movement_type', 'reserved')

  if (fetchErr || !reservedRows?.length) {
    return []
  }

  const ids = (reservedRows as { id: string }[]).map((r) => r.id)
  if (ids.length === 0) return []

  const { data: pairedReleased, error: pairErr } = await supabase
    .from('stock_movements')
    .select('reversed_movement_id')
    .eq('movement_type', 'released')
    .in('reversed_movement_id', ids)

  if (pairErr) {
    return reservedRows as { id: string; warehouse_id: string; product_id: string; quantity: number }[]
  }

  const paired = new Set(
    (pairedReleased || [])
      .map((r: { reversed_movement_id: string | null }) => r.reversed_movement_id)
      .filter(Boolean) as string[]
  )

  return (reservedRows as { id: string; warehouse_id: string; product_id: string; quantity: number }[]).filter(
    (row) => !paired.has(row.id)
  )
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
  const reservedRows = await fetchUnpairedReservedRowsForOrder(supabase, orderId)

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

  const released = (reservedRows as { id: string; warehouse_id: string; product_id: string; quantity: number }[]).map(
    (r) => ({
      warehouse_id: r.warehouse_id,
      product_id: r.product_id,
      movement_type: 'released',
      quantity: Math.abs(parseFloat(String(r.quantity)) || 0),
      source_type: 'order',
      source_id: orderId,
      reversed_movement_id: r.id
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

/**
 * Consume reserved stock and post outbound when order is shipped or delivered.
 * Idempotent: if out movements already exist for this order, skips.
 * - Inserts 'released' for each reserved movement; inserts 'out' from order_items (source of truth).
 * - Uses warehouse from reserved row per product, else default warehouse.
 * - Clears orders.stock_reserved and order_items.reserved_quantity.
 * Call refresh_stock_summary after (e.g. once per request if processing multiple orders).
 */
export async function consumeReservedAndPostOutbound(
  supabase: { from: (table: string) => any; rpc: (name: string) => any },
  orderId: string,
  options?: { createdBy?: string | null }
): Promise<{ ok: boolean; consumed: boolean; error?: string }> {
  // Idempotency: already consumed if any 'out' exists for this order
  const { data: existingOut, error: outCheckErr } = await supabase
    .from('stock_movements')
    .select('id')
    .eq('source_type', 'order')
    .eq('source_id', orderId)
    .eq('movement_type', 'out')
    .limit(1)

  if (outCheckErr) {
    return { ok: false, consumed: false, error: outCheckErr.message }
  }
  if (existingOut?.length) {
    return { ok: true, consumed: false }
  }

  const defaultWarehouseId = await getDefaultWarehouseId(supabase)

  const reserved = await fetchUnpairedReservedRowsForOrder(supabase, orderId)
  const warehouseByProduct: Record<string, string> = {}
  for (const r of reserved) {
    if (r.product_id && !warehouseByProduct[r.product_id]) {
      warehouseByProduct[r.product_id] = r.warehouse_id
    }
  }

  // Order items with product_id (source of truth for outbound qty)
  const { data: items, error: itemsErr } = await supabase
    .from('order_items')
    .select('id, product_id, quantity')
    .eq('order_id', orderId)
    .is('deleted_at', null)
    .not('product_id', 'is', null)

  if (itemsErr) {
    return { ok: false, consumed: false, error: itemsErr.message }
  }

  const orderItems = (items || []) as { id: string; product_id: string; quantity: number }[]
  const outRows: { warehouse_id: string; product_id: string; quantity: number; source_type: string; source_id: string; created_by?: string | null }[] = []

  for (const item of orderItems) {
    const qty = Math.abs(parseFloat(String(item.quantity)) || 0)
    if (qty <= 0) continue
    const warehouseId = warehouseByProduct[item.product_id] ?? defaultWarehouseId
    if (!warehouseId) {
      return { ok: false, consumed: false, error: 'No warehouse available for outbound' }
    }
    outRows.push({
      warehouse_id: warehouseId,
      product_id: item.product_id,
      quantity: qty,
      source_type: 'order',
      source_id: orderId,
      created_by: options?.createdBy ?? null
    })
  }

  // 1) Insert 'released' for each unpaired reserved row (links via reversed_movement_id)
  if (reserved.length > 0) {
    const released = reserved
      .filter((r) => (Math.abs(parseFloat(String(r.quantity)) || 0) > 0))
      .map((r) => ({
        warehouse_id: r.warehouse_id,
        product_id: r.product_id,
        movement_type: 'released' as const,
        quantity: Math.abs(parseFloat(String(r.quantity)) || 0),
        source_type: 'order' as const,
        source_id: orderId,
        reversed_movement_id: r.id
      }))
    if (released.length > 0) {
      const { error: relErr } = await supabase.from('stock_movements').insert(released).select()
      if (relErr) {
        return { ok: false, consumed: false, error: relErr.message }
      }
    }
  }

  // 2) Insert 'out' for each order item (positive quantity so stock_summary subtracts it)
  if (outRows.length > 0) {
    const outMovements = outRows.map((row) => ({
      warehouse_id: row.warehouse_id,
      product_id: row.product_id,
      movement_type: 'out' as const,
      quantity: row.quantity,
      source_type: row.source_type,
      source_id: row.source_id,
      created_by: row.created_by ?? null
    }))
    const { error: outErr } = await supabase.from('stock_movements').insert(outMovements).select()
    if (outErr) {
      return { ok: false, consumed: false, error: outErr.message }
    }
  }

  // 3) Clear reservation flags
  await supabase
    .from('orders')
    .update({ stock_reserved: false, updated_at: new Date().toISOString() })
    .eq('id', orderId)
  await supabase
    .from('order_items')
    .update({ reserved_quantity: 0, updated_at: new Date().toISOString() })
    .eq('order_id', orderId)

  return { ok: true, consumed: true }
}
