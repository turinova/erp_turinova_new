import type { SupabaseClient } from '@supabase/supabase-js'

import type { PricingMode } from '@/lib/opti/quote-calculations'

export type CuttingFeeRow = {
  id: string
  fee_per_meter: number
  tax_rate_id: string
  tax_rate_percent: number
  tax_rate_name: string
  pricing_mode: PricingMode
  updated_at: string
}

/** Opti workspace — könnyű cutting fee snapshot. */
export type OptiCuttingFeeConfig = {
  fee_per_meter: number
  tax_rate_percent: number
  pricing_mode: PricingMode
}

export type TaxRateOption = {
  id: string
  name: string
  rate_percent: number
  is_default: boolean
}

function parsePricingMode(raw: unknown): PricingMode {
  if (
    raw === 'always_full_board' ||
    raw === 'always_panel_area' ||
    raw === 'standard'
  ) {
    return raw
  }
  return 'standard'
}

export async function getCuttingFee(
  supabase: SupabaseClient,
  tenantId: string
): Promise<CuttingFeeRow | null> {
  const { data, error } = await supabase
    .from('cutting_fees')
    .select(
      `
      id,
      fee_per_meter,
      tax_rate_id,
      pricing_mode,
      updated_at,
      tax_rates ( name, rate_percent )
    `
    )
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    console.error('getCuttingFee', error.message)
    throw new Error('Nem sikerült betölteni az Opti beállításokat.')
  }

  if (!data) return null

  const tax = Array.isArray(data.tax_rates)
    ? data.tax_rates[0]
    : data.tax_rates

  return {
    id: data.id,
    fee_per_meter: Number(data.fee_per_meter),
    tax_rate_id: data.tax_rate_id,
    tax_rate_percent: Number(tax?.rate_percent ?? 0),
    tax_rate_name: tax?.name?.trim() || 'ÁFA',
    pricing_mode: parsePricingMode(
      (data as { pricing_mode?: string }).pricing_mode
    ),
    updated_at: data.updated_at
  }
}

export function toOptiCuttingFeeConfig(
  row: CuttingFeeRow | null
): OptiCuttingFeeConfig | null {
  if (!row) return null
  return {
    fee_per_meter: row.fee_per_meter,
    tax_rate_percent: row.tax_rate_percent,
    pricing_mode: row.pricing_mode
  }
}

export async function listTaxRateOptions(
  supabase: SupabaseClient,
  tenantId: string
): Promise<TaxRateOption[]> {
  const { data, error } = await supabase
    .from('tax_rates')
    .select('id, name, rate_percent, is_default')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('rate_percent', { ascending: true })
    .order('name', { ascending: true })
    .limit(100)

  if (error) {
    console.error('listTaxRateOptions', error.message)
    throw new Error('Nem sikerült betölteni az adónemeket.')
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    rate_percent: Number(row.rate_percent),
    is_default: Boolean(row.is_default)
  }))
}
