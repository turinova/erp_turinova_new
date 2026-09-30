import type { SupabaseClient } from '@supabase/supabase-js'

import { fetchByIds } from '@/lib/supabase/fetch-all'

/** Készlet egy termékre (összes raktár vagy egy). WH esetén SQL RPC. */
export async function getAccessoryOnHand(
  supabase: SupabaseClient,
  tenantId: string,
  accessoryId: string,
  warehouseId?: string
): Promise<number> {
  if (warehouseId) {
    const { data, error } = await supabase.rpc('accessory_on_hand', {
      p_tenant_id: tenantId,
      p_accessory_id: accessoryId,
      p_warehouse_id: warehouseId
    })
    if (error) {
      console.error('getAccessoryOnHand rpc', error.message)
      throw new Error('Nem sikerült lekérdezni a készletet.')
    }
    return Number(data) || 0
  }

  const { data, error } = await supabase
    .from('stock_movements')
    .select('quantity, movement_type')
    .eq('tenant_id', tenantId)
    .eq('accessory_id', accessoryId)

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

  if (warehouseId) {
    const { data, error } = await supabase.rpc('accessories_on_hand', {
      p_tenant_id: tenantId,
      p_warehouse_id: warehouseId,
      p_accessory_ids: unique
    })
    if (error) {
      // Fallback ha migráció még nincs lefuttatva
      console.warn('accessories_on_hand rpc', error.message)
    } else {
      for (const row of (data ?? []) as Array<{
        accessory_id: string
        on_hand: number | string
      }>) {
        map.set(row.accessory_id, Number(row.on_hand) || 0)
      }
      return map
    }
  }

  const { data, error } = await fetchByIds<{
    accessory_id: string
    quantity: number | string
    movement_type: string
  }>(unique, (chunk, from, to) => {
    let query = supabase
      .from('stock_movements')
      .select('accessory_id, quantity, movement_type')
      .eq('tenant_id', tenantId)
      .in('accessory_id', chunk)
    if (warehouseId) query = query.eq('warehouse_id', warehouseId)
    return query.order('id', { ascending: true }).range(from, to)
  })

  if (error) {
    console.error('getAccessoriesOnHandMap', error)
    throw new Error('Nem sikerült lekérdezni a készletet.')
  }

  for (const row of data) {
    const id = row.accessory_id as string
    const qty = Number(row.quantity)
    const prev = map.get(id) ?? 0
    if (row.movement_type === 'in') map.set(id, prev + qty)
    else if (row.movement_type === 'out') map.set(id, prev - qty)
  }
  return map
}
