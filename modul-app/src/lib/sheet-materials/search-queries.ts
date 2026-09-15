import type { SupabaseClient } from '@supabase/supabase-js'

import {
  formatHuNumber,
  formatMoneyFt,
  grossFromNet,
  squareMeters
} from '@/lib/sheet-materials/parse'

export type SheetMaterialSearchItem = {
  id: string
  name: string
  manufacturer_name: string
  length_mm: number
  width_mm: number
  thickness_mm: number
  on_stock: boolean
  price_net: number
  tax_rate_percent: number
  price_gross_sqm: number
  price_gross_sheet: number
}

export type SearchSheetMaterialsParams = {
  tenantId: string
  q: string
  page?: number
  limit?: number
  /** Ha megadott: nincs külön manufacturers query. */
  manufacturerIds?: string[]
}

export type SearchSheetMaterialsResult = {
  rows: SheetMaterialSearchItem[]
  total: number
  page: number
  limit: number
}

function formatThickness(mm: number): string {
  return formatHuNumber(mm, 2)
}

export function formatSheetSizeLabel(
  lengthMm: number,
  widthMm: number,
  thicknessMm: number
): string {
  return `${lengthMm}×${widthMm}×${formatThickness(thicknessMm)}`
}

export function formatSearchPrice(value: number): string {
  return formatMoneyFt(value)
}

export async function searchSheetMaterials(
  supabase: SupabaseClient,
  params: SearchSheetMaterialsParams
): Promise<SearchSheetMaterialsResult> {
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.min(50, Math.max(1, params.limit ?? 25))
  const from = (page - 1) * limit
  const to = from + limit - 1
  const q = params.q.trim()

  if (!q) {
    return { rows: [], total: 0, page, limit }
  }

  const safe = q.replace(/[%_,]/g, '')
  if (!safe) {
    return { rows: [], total: 0, page, limit }
  }

  let manufacturerIds = params.manufacturerIds
  if (manufacturerIds === undefined) {
    const { data: manufacturerMatches } = await supabase
      .from('manufacturers')
      .select('id')
      .eq('tenant_id', params.tenantId)
      .is('deleted_at', null)
      .ilike('name', `%${safe}%`)
      .limit(50)
    manufacturerIds = (manufacturerMatches ?? []).map((m) => m.id)
  }

  const orParts = [`name.ilike.%${safe}%`, `machine_code.ilike.%${safe}%`]
  if (manufacturerIds.length > 0) {
    orParts.push(`manufacturer_id.in.(${manufacturerIds.join(',')})`)
  }

  const { data, error, count } = await supabase
    .from('sheet_materials')
    .select(
      `
      id,
      name,
      length_mm,
      width_mm,
      thickness_mm,
      price_net,
      on_stock,
      manufacturers ( name ),
      tax_rates ( rate_percent )
    `,
      { count: 'estimated' }
    )
    .eq('tenant_id', params.tenantId)
    .eq('active', true)
    .is('deleted_at', null)
    .or(orParts.join(','))
    .order('name', { ascending: true })
    .range(from, to)

  if (error) {
    console.error('searchSheetMaterials', error.message)
    throw new Error('Nem sikerült keresni a táblás anyagok között.')
  }

  const rows: SheetMaterialSearchItem[] = (data ?? []).map((row) => {
    const manufacturers = row.manufacturers as
      | { name: string }
      | { name: string }[]
      | null
    const manufacturer = Array.isArray(manufacturers)
      ? manufacturers[0]
      : manufacturers
    const taxRates = row.tax_rates as
      | { rate_percent: number | string }
      | { rate_percent: number | string }[]
      | null
    const tax = Array.isArray(taxRates) ? taxRates[0] : taxRates
    const priceNet = Number(row.price_net) || 0
    const taxPercent = Number(tax?.rate_percent ?? 0)
    const lengthMm = Number(row.length_mm)
    const widthMm = Number(row.width_mm)
    const priceGrossSqm = grossFromNet(priceNet, taxPercent)
    const priceGrossSheet = Math.round(
      priceGrossSqm * squareMeters(lengthMm, widthMm)
    )

    return {
      id: row.id,
      name: row.name,
      manufacturer_name: manufacturer?.name ?? '—',
      length_mm: lengthMm,
      width_mm: widthMm,
      thickness_mm: Number(row.thickness_mm),
      on_stock: Boolean(row.on_stock),
      price_net: priceNet,
      tax_rate_percent: taxPercent,
      price_gross_sqm: priceGrossSqm,
      price_gross_sheet: priceGrossSheet
    }
  })

  return { rows, total: count ?? rows.length, page, limit }
}
