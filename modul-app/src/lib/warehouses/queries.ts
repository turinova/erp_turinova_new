import type { SupabaseClient } from '@supabase/supabase-js'

import type { Warehouse } from '@/lib/supabase/database.types'

export type WarehouseListItem = Pick<
  Warehouse,
  | 'id'
  | 'name'
  | 'code'
  | 'is_default'
  | 'is_active'
  | 'country'
  | 'postal_code'
  | 'city'
  | 'street'
  | 'house_number'
  | 'note'
  | 'created_at'
  | 'updated_at'
>

const LIST_SELECT =
  'id, name, code, is_default, is_active, country, postal_code, city, street, house_number, note, created_at, updated_at'

export async function listWarehouses(
  supabase: SupabaseClient,
  tenantId: string
): Promise<WarehouseListItem[]> {
  const { data, error } = await supabase
    .from('warehouses')
    .select(LIST_SELECT)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('is_default', { ascending: false })
    .order('name', { ascending: true })

  if (error) {
    console.error('listWarehouses', error.message)
    throw new Error('Nem sikerült betölteni a raktárakat.')
  }

  return data ?? []
}

export async function listActiveWarehouses(
  supabase: SupabaseClient,
  tenantId: string
): Promise<Pick<Warehouse, 'id' | 'name' | 'code' | 'is_default'>[]> {
  const { data, error } = await supabase
    .from('warehouses')
    .select('id, name, code, is_default')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('is_default', { ascending: false })
    .order('name', { ascending: true })

  if (error) {
    console.error('listActiveWarehouses', error.message)
    throw new Error('Nem sikerült betölteni a raktárakat.')
  }

  return data ?? []
}

export async function getDefaultWarehouse(
  supabase: SupabaseClient,
  tenantId: string
): Promise<Pick<Warehouse, 'id' | 'name' | 'code'> | null> {
  const { data, error } = await supabase
    .from('warehouses')
    .select('id, name, code')
    .eq('tenant_id', tenantId)
    .eq('is_default', true)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    console.error('getDefaultWarehouse', error.message)
    throw new Error('Nem sikerült betölteni az alapértelmezett raktárat.')
  }

  return data
}

export async function countActiveWarehouses(
  supabase: SupabaseClient,
  tenantId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('warehouses')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .is('deleted_at', null)

  if (error) {
    console.error('countActiveWarehouses', error.message)
    throw new Error('Nem sikerült megszámolni a raktárakat.')
  }

  return count ?? 0
}

/** Ha nincs default, létrehozza a Fő raktárat (biztonsági háló seed/trigger mellett). */
export async function ensureDefaultWarehouse(
  supabase: SupabaseClient,
  tenantId: string
): Promise<Pick<Warehouse, 'id' | 'name' | 'code'>> {
  const existing = await getDefaultWarehouse(supabase, tenantId)
  if (existing) return existing

  const { data: anyAlive, error: listErr } = await supabase
    .from('warehouses')
    .select('id, name, code, is_active')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (listErr) {
    console.error('ensureDefaultWarehouse list', listErr.message)
    throw new Error('Nem sikerült ellenőrizni a raktárakat.')
  }

  if (anyAlive) {
    const { error: setErr } = await supabase
      .from('warehouses')
      .update({
        is_default: true,
        is_active: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', anyAlive.id)
      .eq('tenant_id', tenantId)

    if (setErr) {
      console.error('ensureDefaultWarehouse promote', setErr.message)
      throw new Error('Nem sikerült beállítani az alapértelmezett raktárat.')
    }

    return {
      id: anyAlive.id,
      name: anyAlive.name,
      code: anyAlive.code
    }
  }

  const { data: created, error: createErr } = await supabase
    .from('warehouses')
    .insert({
      tenant_id: tenantId,
      name: 'Fő raktár',
      code: 'FO',
      is_default: true,
      is_active: true,
      country: 'Magyarország'
    })
    .select('id, name, code')
    .single()

  if (createErr || !created) {
    console.error('ensureDefaultWarehouse create', createErr?.message)
    throw new Error('Nem sikerült létrehozni az alapértelmezett raktárat.')
  }

  return created
}
