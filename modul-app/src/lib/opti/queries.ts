import type { SupabaseClient } from '@supabase/supabase-js'

/** Opti form — aktív táblás anyag (nincs lapozás). */
export type OptiSheetMaterialOption = {
  id: string
  name: string
  length_mm: number
  width_mm: number
  thickness_mm: number
  on_stock: boolean
  image_url: string | null
  grain_direction: boolean
  rotatable: boolean
  kerf_mm: number
  trim_top_mm: number
  trim_right_mm: number
  trim_bottom_mm: number
  trim_left_mm: number
  manufacturer_name: string
  /** Quote */
  price_net: number
  usage_limit: number
  waste_multi: number
  vat_rate_percent: number
}

/** Opti form — aktív élzáró (kedvencekkel). */
export type OptiEdgeMaterialOption = {
  id: string
  type: string
  decor: string
  width_mm: number
  thickness_mm: number
  favourite_priority: number | null
  manufacturer_name: string
  /** Quote */
  price_net: number
  allowance_mm: number
  vat_rate_percent: number
}

const SHEET_SELECT = `
  id,
  name,
  length_mm,
  width_mm,
  thickness_mm,
  on_stock,
  image_url,
  grain_direction,
  rotatable,
  kerf_mm,
  trim_top_mm,
  trim_right_mm,
  trim_bottom_mm,
  trim_left_mm,
  price_net,
  usage_limit,
  waste_multi,
  manufacturers ( name ),
  tax_rates ( rate_percent )
`

const EDGE_SELECT = `
  id,
  type,
  decor,
  width_mm,
  thickness_mm,
  favourite_priority,
  price_net,
  allowance_mm,
  manufacturers ( name ),
  tax_rates ( rate_percent )
`

function manufacturerName(
  manufacturers: { name: string } | { name: string }[] | null
): string {
  const row = Array.isArray(manufacturers) ? manufacturers[0] : manufacturers
  return row?.name?.trim() || 'Ismeretlen'
}

function taxPercent(
  taxRates:
    | { rate_percent: number | string }
    | { rate_percent: number | string }[]
    | null
): number {
  const row = Array.isArray(taxRates) ? taxRates[0] : taxRates
  return Number(row?.rate_percent ?? 0)
}

export function formatEdgeMaterialLabel(
  edge: Pick<
    OptiEdgeMaterialOption,
    'type' | 'width_mm' | 'thickness_mm' | 'decor'
  >
): string {
  return `${edge.type}-${edge.width_mm}/${edge.thickness_mm}-${edge.decor}`
}

/** Max szálirány = tábla hossz − bal/jobb szélezés. */
export function maxGrainMm(material: OptiSheetMaterialOption): number {
  return Math.max(
    0,
    material.length_mm - material.trim_left_mm - material.trim_right_mm
  )
}

/** Max keresztirány = tábla szélesség − felső/alsó szélezés. */
export function maxCrossMm(material: OptiSheetMaterialOption): number {
  return Math.max(
    0,
    material.width_mm - material.trim_top_mm - material.trim_bottom_mm
  )
}

export function formatTrimLabel(material: OptiSheetMaterialOption): string {
  return `Szélezés: HF${material.trim_top_mm} RB${material.trim_bottom_mm} HA${material.trim_left_mm} RJ${material.trim_right_mm}mm`
}

export async function listOptiSheetMaterials(
  supabase: SupabaseClient,
  tenantId: string
): Promise<OptiSheetMaterialOption[]> {
  const { data, error } = await supabase
    .from('sheet_materials')
    .select(SHEET_SELECT)
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .is('deleted_at', null)
    .order('name', { ascending: true })
    .limit(500)

  if (error) {
    console.error('listOptiSheetMaterials', error.message)
    throw new Error('Nem sikerült betölteni a táblás anyagokat.')
  }

  const rows = (data ?? []).map((row) => {
    const r = row as {
      id: string
      name: string
      length_mm: number | string
      width_mm: number | string
      thickness_mm: number | string
      on_stock: boolean
      image_url: string | null
      grain_direction: boolean
      rotatable: boolean
      kerf_mm: number | string
      trim_top_mm: number | string
      trim_right_mm: number | string
      trim_bottom_mm: number | string
      trim_left_mm: number | string
      price_net: number | string
      usage_limit: number | string
      waste_multi: number | string
      manufacturers: { name: string } | { name: string }[] | null
      tax_rates:
        | { rate_percent: number | string }
        | { rate_percent: number | string }[]
        | null
    }

    return {
      id: r.id,
      name: r.name,
      length_mm: Number(r.length_mm),
      width_mm: Number(r.width_mm),
      thickness_mm: Number(r.thickness_mm),
      on_stock: r.on_stock,
      image_url: r.image_url ?? null,
      grain_direction: Boolean(r.grain_direction),
      rotatable: r.rotatable !== false,
      kerf_mm: Number(r.kerf_mm ?? 3),
      trim_top_mm: Number(r.trim_top_mm),
      trim_right_mm: Number(r.trim_right_mm),
      trim_bottom_mm: Number(r.trim_bottom_mm),
      trim_left_mm: Number(r.trim_left_mm),
      manufacturer_name: manufacturerName(r.manufacturers),
      price_net: Number(r.price_net),
      usage_limit: Number(r.usage_limit),
      waste_multi: Number(r.waste_multi),
      vat_rate_percent: taxPercent(r.tax_rates)
    } satisfies OptiSheetMaterialOption
  })

  return rows.sort((a, b) => {
    const byMfr = a.manufacturer_name.localeCompare(b.manufacturer_name, 'hu')
    if (byMfr !== 0) return byMfr
    return a.name.localeCompare(b.name, 'hu')
  })
}

export async function listOptiEdgeMaterials(
  supabase: SupabaseClient,
  tenantId: string
): Promise<OptiEdgeMaterialOption[]> {
  const { data, error } = await supabase
    .from('edge_materials')
    .select(EDGE_SELECT)
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .is('deleted_at', null)
    .order('type', { ascending: true })
    .limit(500)

  if (error) {
    console.error('listOptiEdgeMaterials', error.message)
    throw new Error('Nem sikerült betölteni az élzárókat.')
  }

  const rows = (data ?? []).map((row) => {
    const r = row as {
      id: string
      type: string
      decor: string
      width_mm: number | string
      thickness_mm: number | string
      favourite_priority: number | string | null
      price_net: number | string
      allowance_mm: number | string
      manufacturers: { name: string } | { name: string }[] | null
      tax_rates:
        | { rate_percent: number | string }
        | { rate_percent: number | string }[]
        | null
    }

    return {
      id: r.id,
      type: r.type,
      decor: r.decor,
      width_mm: Number(r.width_mm),
      thickness_mm: Number(r.thickness_mm),
      favourite_priority:
        r.favourite_priority === null || r.favourite_priority === undefined
          ? null
          : Number(r.favourite_priority),
      manufacturer_name: manufacturerName(r.manufacturers),
      price_net: Number(r.price_net),
      allowance_mm: Number(r.allowance_mm ?? 0),
      vat_rate_percent: taxPercent(r.tax_rates)
    } satisfies OptiEdgeMaterialOption
  })

  return rows.sort((a, b) => {
    const aFav = a.favourite_priority
    const bFav = b.favourite_priority
    const aHas = aFav !== null
    const bHas = bFav !== null
    if (aHas && !bHas) return -1
    if (!aHas && bHas) return 1
    if (aHas && bHas && aFav !== bFav) return (aFav as number) - (bFav as number)
    const byType = a.type.localeCompare(b.type, 'hu')
    if (byType !== 0) return byType
    return a.decor.localeCompare(b.decor, 'hu')
  })
}
