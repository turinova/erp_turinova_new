import type { SupabaseClient } from '@supabase/supabase-js'

import { grossFromNet } from '@/lib/accessories/parse'

export type AccessoryListItem = {
  id: string
  name: string
  sku: string
  barcode: string | null
  barcode_internal: string | null
  manufacturer_id: string
  manufacturer_name: string
  tax_rate_id: string
  tax_rate_name: string
  tax_rate_percent: number
  unit_id: string
  unit_name: string
  unit_shortform: string
  price_net: number
  price_gross: number
  active: boolean
  created_at: string
  updated_at: string
}

export type AccessoryTaxOption = {
  id: string
  name: string
  rate_percent: number
  is_default: boolean
}

export type AccessoryUnitOption = {
  id: string
  name: string
  shortform: string
}

export type AccessoryManufacturerOption = {
  id: string
  name: string
}

export async function listAccessories(
  supabase: SupabaseClient,
  tenantId: string
): Promise<AccessoryListItem[]> {
  const { data, error } = await supabase
    .from('accessories')
    .select(
      `
      id,
      name,
      sku,
      barcode,
      barcode_internal,
      manufacturer_id,
      tax_rate_id,
      unit_id,
      price_net,
      active,
      created_at,
      updated_at,
      manufacturers ( name ),
      tax_rates ( name, rate_percent ),
      units ( name, shortform )
    `
    )
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) {
    console.error('listAccessories', error.message)
    throw new Error('Nem sikerült betölteni a termékeket.')
  }

  return (data ?? []).map((row) => {
    const manufacturer = Array.isArray(row.manufacturers)
      ? row.manufacturers[0]
      : row.manufacturers
    const tax = Array.isArray(row.tax_rates) ? row.tax_rates[0] : row.tax_rates
    const unit = Array.isArray(row.units) ? row.units[0] : row.units
    const priceNet = Number(row.price_net)
    const taxPercent = Number(tax?.rate_percent ?? 0)
    return {
      id: row.id,
      name: row.name,
      sku: row.sku,
      barcode: row.barcode ?? null,
      barcode_internal: row.barcode_internal ?? null,
      manufacturer_id: row.manufacturer_id,
      manufacturer_name: manufacturer?.name ?? '—',
      tax_rate_id: row.tax_rate_id,
      tax_rate_name: tax?.name ?? '—',
      tax_rate_percent: taxPercent,
      unit_id: row.unit_id,
      unit_name: unit?.name ?? '—',
      unit_shortform: unit?.shortform ?? 'db',
      price_net: priceNet,
      price_gross: grossFromNet(priceNet, taxPercent),
      active: row.active,
      created_at: row.created_at,
      updated_at: row.updated_at
    }
  })
}

export async function getAccessory(
  supabase: SupabaseClient,
  tenantId: string,
  id: string
): Promise<AccessoryListItem | null> {
  const { data, error } = await supabase
    .from('accessories')
    .select(
      `
      id,
      name,
      sku,
      barcode,
      barcode_internal,
      manufacturer_id,
      tax_rate_id,
      unit_id,
      price_net,
      active,
      created_at,
      updated_at,
      manufacturers ( name ),
      tax_rates ( name, rate_percent ),
      units ( name, shortform )
    `
    )
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    console.error('getAccessory', error.message)
    throw new Error('Nem sikerült betölteni a terméket.')
  }
  if (!data) return null

  const manufacturer = Array.isArray(data.manufacturers)
    ? data.manufacturers[0]
    : data.manufacturers
  const tax = Array.isArray(data.tax_rates) ? data.tax_rates[0] : data.tax_rates
  const unit = Array.isArray(data.units) ? data.units[0] : data.units
  const priceNet = Number(data.price_net)
  const taxPercent = Number(tax?.rate_percent ?? 0)

  return {
    id: data.id,
    name: data.name,
    sku: data.sku,
    barcode: data.barcode ?? null,
    barcode_internal: data.barcode_internal ?? null,
    manufacturer_id: data.manufacturer_id,
    manufacturer_name: manufacturer?.name ?? '—',
    tax_rate_id: data.tax_rate_id,
    tax_rate_name: tax?.name ?? '—',
    tax_rate_percent: taxPercent,
    unit_id: data.unit_id,
    unit_name: unit?.name ?? '—',
    unit_shortform: unit?.shortform ?? 'db',
    price_net: priceNet,
    price_gross: grossFromNet(priceNet, taxPercent),
    active: data.active,
    created_at: data.created_at,
    updated_at: data.updated_at
  }
}

export async function listAccessoryTaxOptions(
  supabase: SupabaseClient,
  tenantId: string
): Promise<AccessoryTaxOption[]> {
  const { data, error } = await supabase
    .from('tax_rates')
    .select('id, name, rate_percent, is_default')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('rate_percent', { ascending: true })

  if (error) {
    console.error('listAccessoryTaxOptions', error.message)
    throw new Error('Nem sikerült betölteni az adónemeket.')
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    rate_percent: Number(row.rate_percent),
    is_default: row.is_default
  }))
}

export async function listAccessoryUnitOptions(
  supabase: SupabaseClient,
  tenantId: string
): Promise<AccessoryUnitOption[]> {
  const { data, error } = await supabase
    .from('units')
    .select('id, name, shortform')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) {
    console.error('listAccessoryUnitOptions', error.message)
    throw new Error('Nem sikerült betölteni az egységeket.')
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    shortform: row.shortform
  }))
}

export async function listAccessoryManufacturerOptions(
  supabase: SupabaseClient,
  tenantId: string
): Promise<AccessoryManufacturerOption[]> {
  const { data, error } = await supabase
    .from('manufacturers')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) {
    console.error('listAccessoryManufacturerOptions', error.message)
    throw new Error('Nem sikerült betölteni a gyártókat.')
  }

  return data ?? []
}

export async function listActiveAccessoryOptions(
  supabase: SupabaseClient,
  tenantId: string
): Promise<AccessoryListItem[]> {
  const rows = await listAccessories(supabase, tenantId)
  return rows.filter((r) => r.active)
}
