import type { SupabaseClient } from '@supabase/supabase-js'

import type { PricingMode } from '@/lib/opti/quote-calculations'

export type CuttingFeeRow = {
  id: string
  fee_per_meter: number
  fee_per_meter_gross: number
  duplungolas_fee_per_sqm: number
  duplungolas_fee_per_sqm_gross: number
  szogvagas_fee_per_panel: number
  szogvagas_fee_per_panel_gross: number
  panthelyfuras_fee_per_hole: number
  panthelyfuras_fee_per_hole_gross: number
  tax_rate_id: string
  tax_rate_percent: number
  tax_rate_name: string
  pricing_mode: PricingMode
  updated_at: string
}

/** Opti workspace — könnyű cutting fee snapshot. */
export type OptiCuttingFeeConfig = {
  fee_per_meter: number
  fee_per_meter_gross: number
  duplungolas_fee_per_sqm: number
  duplungolas_fee_per_sqm_gross: number
  szogvagas_fee_per_panel: number
  szogvagas_fee_per_panel_gross: number
  panthelyfuras_fee_per_hole: number
  panthelyfuras_fee_per_hole_gross: number
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
      fee_per_meter_gross,
      duplungolas_fee_per_sqm,
      duplungolas_fee_per_sqm_gross,
      szogvagas_fee_per_panel,
      szogvagas_fee_per_panel_gross,
      panthelyfuras_fee_per_hole,
      panthelyfuras_fee_per_hole_gross,
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

  const row = data as {
    id: string
    fee_per_meter: number
    fee_per_meter_gross?: number | null
    duplungolas_fee_per_sqm?: number | null
    duplungolas_fee_per_sqm_gross?: number | null
    szogvagas_fee_per_panel?: number | null
    szogvagas_fee_per_panel_gross?: number | null
    panthelyfuras_fee_per_hole?: number | null
    panthelyfuras_fee_per_hole_gross?: number | null
    tax_rate_id: string
    pricing_mode?: string
    updated_at: string
  }

  const rate = Number(tax?.rate_percent ?? 0)
  const feeNet = Number(row.fee_per_meter)
  const duplungNet = Number(row.duplungolas_fee_per_sqm ?? 0)
  const szogNet = Number(row.szogvagas_fee_per_panel ?? 0)
  const panthelyNet = Number(row.panthelyfuras_fee_per_hole ?? 0)

  return {
    id: row.id,
    fee_per_meter: feeNet,
    fee_per_meter_gross:
      row.fee_per_meter_gross != null
        ? Math.round(Number(row.fee_per_meter_gross))
        : Math.round(feeNet * (1 + rate / 100)),
    duplungolas_fee_per_sqm: duplungNet,
    duplungolas_fee_per_sqm_gross:
      row.duplungolas_fee_per_sqm_gross != null
        ? Math.round(Number(row.duplungolas_fee_per_sqm_gross))
        : Math.round(duplungNet * (1 + rate / 100)),
    szogvagas_fee_per_panel: szogNet,
    szogvagas_fee_per_panel_gross:
      row.szogvagas_fee_per_panel_gross != null
        ? Math.round(Number(row.szogvagas_fee_per_panel_gross))
        : Math.round(szogNet * (1 + rate / 100)),
    panthelyfuras_fee_per_hole: panthelyNet,
    panthelyfuras_fee_per_hole_gross:
      row.panthelyfuras_fee_per_hole_gross != null
        ? Math.round(Number(row.panthelyfuras_fee_per_hole_gross))
        : Math.round(panthelyNet * (1 + rate / 100)),
    tax_rate_id: row.tax_rate_id,
    tax_rate_percent: rate,
    tax_rate_name: tax?.name?.trim() || 'ÁFA',
    pricing_mode: parsePricingMode(row.pricing_mode),
    updated_at: row.updated_at
  }
}

export function toOptiCuttingFeeConfig(
  row: CuttingFeeRow | null
): OptiCuttingFeeConfig | null {
  if (!row) return null
  return {
    fee_per_meter: row.fee_per_meter,
    fee_per_meter_gross: row.fee_per_meter_gross,
    duplungolas_fee_per_sqm: row.duplungolas_fee_per_sqm,
    duplungolas_fee_per_sqm_gross: row.duplungolas_fee_per_sqm_gross,
    szogvagas_fee_per_panel: row.szogvagas_fee_per_panel,
    szogvagas_fee_per_panel_gross: row.szogvagas_fee_per_panel_gross,
    panthelyfuras_fee_per_hole: row.panthelyfuras_fee_per_hole,
    panthelyfuras_fee_per_hole_gross: row.panthelyfuras_fee_per_hole_gross,
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
