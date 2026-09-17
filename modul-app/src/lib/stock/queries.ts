import type { SupabaseClient } from '@supabase/supabase-js'

/** Készlet egy termékre (összes raktár vagy egy). */
export async function getAccessoryOnHand(
  supabase: SupabaseClient,
  tenantId: string,
  accessoryId: string,
  warehouseId?: string
): Promise<number> {
  let query = supabase
    .from('stock_movements')
    .select('quantity, movement_type')
    .eq('tenant_id', tenantId)
    .eq('accessory_id', accessoryId)

  if (warehouseId) {
    query = query.eq('warehouse_id', warehouseId)
  }

  const { data, error } = await query

  if (error) {
    console.error('getAccessoryOnHand', error.message)
    throw new Error('Nem sikerült lekérdezni a készletet.')
  }

  let total = 0
  for (const row of data ?? []) {
    const qty = Number(row.quantity)
    if (row.movement_type === 'in') total += qty
    else if (row.movement_type === 'out') total -= qty
  }
  return total
}

/** Készlet több termékre egyszerre (egy raktár opcionális). */
export async function getAccessoriesOnHandMap(
  supabase: SupabaseClient,
  tenantId: string,
  accessoryIds: string[],
  warehouseId?: string
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  const unique = [...new Set(accessoryIds.filter(Boolean))]
  for (const id of unique) map.set(id, 0)
  if (unique.length === 0) return map

  let query = supabase
    .from('stock_movements')
    .select('accessory_id, quantity, movement_type')
    .eq('tenant_id', tenantId)
    .in('accessory_id', unique)

  if (warehouseId) {
    query = query.eq('warehouse_id', warehouseId)
  }

  const { data, error } = await query

  if (error) {
    console.error('getAccessoriesOnHandMap', error.message)
    throw new Error('Nem sikerült lekérdezni a készletet.')
  }

  for (const row of data ?? []) {
    const id = row.accessory_id as string
    const qty = Number(row.quantity)
    const prev = map.get(id) ?? 0
    if (row.movement_type === 'in') map.set(id, prev + qty)
    else if (row.movement_type === 'out') map.set(id, prev - qty)
  }
  return map
}
