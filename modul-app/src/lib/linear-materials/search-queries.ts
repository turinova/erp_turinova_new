import type { SupabaseClient } from '@supabase/supabase-js'

import {
  LINEAR_MATERIAL_TYPE_LABELS,
  formatHuNumber,
  formatMoneyFt,
  grossFromNet,
  isLinearMaterialType,
  parseLinearMaterialTypeLabel,
  type LinearMaterialType
} from '@/lib/linear-materials/parse'

export type LinearMaterialSearchItem = {
  id: string
  name: string
  manufacturer_name: string
  material_type: LinearMaterialType
  material_type_label: string
  length_mm: number
  width_mm: number
  thickness_mm: number
  on_stock: boolean
  price_net: number
  tax_rate_percent: number
  price_gross_per_m: number
  price_gross_piece: number
}

export type SearchLinearMaterialsParams = {
  tenantId: string
  q: string
  page?: number
  limit?: number
}

export type SearchLinearMaterialsResult = {
  rows: LinearMaterialSearchItem[]
  total: number
  page: number
  limit: number
}

function formatThickness(mm: number): string {
  return formatHuNumber(mm, 2)
}

export function formatLinearSizeLabel(
  lengthMm: number,
  widthMm: number,
  thicknessMm: number
): string {
  return `${lengthMm}×${widthMm}×${formatThickness(thicknessMm)}`
}

export function formatLinearSearchPrice(value: number): string {
  return formatMoneyFt(value)
}

/** Bruttó Ft / egész szál = bruttó Ft/m × hossz (m). */
export function priceGrossPiece(
  priceGrossPerM: number,
  lengthMm: number
): number {
  return Math.round(priceGrossPerM * (lengthMm / 1000))
}

export async function searchLinearMaterials(
  supabase: SupabaseClient,
  params: SearchLinearMaterialsParams
): Promise<SearchLinearMaterialsResult> {
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

  const { data: manufacturerMatches } = await supabase
    .from('manufacturers')
    .select('id')
    .eq('tenant_id', params.tenantId)
    .is('deleted_at', null)
    .ilike('name', `%${safe}%`)
    .limit(50)

  const manufacturerIds = (manufacturerMatches ?? []).map((m) => m.id)
  const orParts = [`name.ilike.%${safe}%`]

  const typeFromLabel = parseLinearMaterialTypeLabel(safe)
  if (typeFromLabel) {
    orParts.push(`material_type.eq.${typeFromLabel}`)
  } else if (isLinearMaterialType(safe.toLowerCase())) {
    orParts.push(`material_type.eq.${safe.toLowerCase()}`)
  }

  if (manufacturerIds.length > 0) {
    orParts.push(`manufacturer_id.in.(${manufacturerIds.join(',')})`)
  }

  const { data, error, count } = await supabase
    .from('linear_materials')
    .select(
      `
      id,
      name,
      material_type,
      length_mm,
      width_mm,
      thickness_mm,
      price_net,
      on_stock,
      manufacturers ( name ),
      tax_rates ( rate_percent )
    `,
      { count: 'exact' }
    )
    .eq('tenant_id', params.tenantId)
    .eq('active', true)
    .is('deleted_at', null)
    .or(orParts.join(','))
    .order('name', { ascending: true })
    .range(from, to)

  if (error) {
    console.error('searchLinearMaterials', error.message)
    throw new Error('Nem sikerült keresni a szálas anyagok között.')
  }

  const rows: LinearMaterialSearchItem[] = (data ?? []).map((row) => {
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
    const materialType = row.material_type as LinearMaterialType
    const priceGrossPerM = grossFromNet(priceNet, taxPercent)

    return {
      id: row.id,
      name: row.name,
      manufacturer_name: manufacturer?.name ?? '—',
      material_type: materialType,
      material_type_label:
        LINEAR_MATERIAL_TYPE_LABELS[materialType] ?? materialType,
      length_mm: lengthMm,
      width_mm: Number(row.width_mm),
      thickness_mm: Number(row.thickness_mm),
      on_stock: Boolean(row.on_stock),
      price_net: priceNet,
      tax_rate_percent: taxPercent,
      price_gross_per_m: priceGrossPerM,
      price_gross_piece: priceGrossPiece(priceGrossPerM, lengthMm)
    }
  })

  return { rows, total: count ?? 0, page, limit }
}
