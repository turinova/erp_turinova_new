import type { SupabaseClient } from '@supabase/supabase-js'

import { grossFromNet } from '@/lib/fee-types/parse'

export type FeeTypeListItem = {
  id: string
  name: string
  tax_rate_id: string
  unit_id: string
  unit_name: string
  unit_shortform: string
  price_net: number
  active: boolean
  tax_rate_name: string
  tax_rate_percent: number
  price_gross: number
  created_at: string
  updated_at: string
}

export type FeeTypeTaxOption = {
  id: string
  name: string
  rate_percent: number
  is_default: boolean
}

export type FeeTypeUnitOption = {
  id: string
  name: string
  shortform: string
}

export async function listFeeTypes(
  supabase: SupabaseClient,
  tenantId: string
): Promise<FeeTypeListItem[]> {
  const { data, error } = await supabase
    .from('fee_types')
    .select(
      `
      id,
      name,
      tax_rate_id,
      unit_id,
      price_net,
      active,
      created_at,
      updated_at,
      tax_rates ( name, rate_percent ),
      units ( name, shortform )
    `
    )
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) {
    console.error('listFeeTypes', error.message)
    throw new Error('Nem sikerült betölteni a díj típusokat.')
  }

  return (data ?? []).map((row) => {
    const tax = Array.isArray(row.tax_rates) ? row.tax_rates[0] : row.tax_rates
    const unit = Array.isArray(row.units) ? row.units[0] : row.units
    const priceNet = Number(row.price_net)
    const taxPercent = Number(tax?.rate_percent ?? 0)
    return {
      id: row.id,
      name: row.name,
      tax_rate_id: row.tax_rate_id,
      unit_id: row.unit_id,
      unit_name: unit?.name ?? '—',
      unit_shortform: unit?.shortform ?? 'db',
      price_net: priceNet,
      active: row.active,
      tax_rate_name: tax?.name ?? '—',
      tax_rate_percent: taxPercent,
      price_gross: grossFromNet(priceNet, taxPercent),
      created_at: row.created_at,
      updated_at: row.updated_at
    }
  })
}

export async function listFeeTypeTaxOptions(
  supabase: SupabaseClient,
  tenantId: string
): Promise<FeeTypeTaxOption[]> {
  const { data, error } = await supabase
    .from('tax_rates')
    .select('id, name, rate_percent, is_default')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('rate_percent', { ascending: true })

  if (error) {
    console.error('listFeeTypeTaxOptions', error.message)
    throw new Error('Nem sikerült betölteni az adónemeket.')
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    rate_percent: Number(row.rate_percent),
    is_default: row.is_default
  }))
}

export async function listFeeTypeUnitOptions(
  supabase: SupabaseClient,
  tenantId: string
): Promise<FeeTypeUnitOption[]> {
  const { data, error } = await supabase
    .from('units')
    .select('id, name, shortform')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) {
    console.error('listFeeTypeUnitOptions', error.message)
    throw new Error('Nem sikerült betölteni az egységeket.')
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    shortform: row.shortform
  }))
}

export async function listActiveFeeTypeOptions(
  supabase: SupabaseClient,
  tenantId: string
): Promise<FeeTypeListItem[]> {
  const rows = await listFeeTypes(supabase, tenantId)
  return rows.filter((r) => r.active)
}
