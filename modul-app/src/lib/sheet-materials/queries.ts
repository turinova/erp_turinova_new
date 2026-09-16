import type { SupabaseClient } from '@supabase/supabase-js'

export type SheetMaterialListItem = {
  id: string
  name: string
  length_mm: number
  width_mm: number
  thickness_mm: number
  price_net: number
  active: boolean
  on_stock: boolean
  image_url: string | null
  manufacturer_id: string
  tax_rate_id: string
  manufacturer_name: string
  tax_rate_percent: number
  updated_at: string
}

export type SheetMaterialDetail = {
  id: string
  manufacturer_id: string
  tax_rate_id: string
  equipment_id: string
  name: string
  length_mm: number
  width_mm: number
  thickness_mm: number
  on_stock: boolean
  active: boolean
  image_url: string | null
  trim_top_mm: number
  trim_right_mm: number
  trim_bottom_mm: number
  trim_left_mm: number
  kerf_mm: number
  waste_multi: number
  usage_limit: number
  grain_direction: boolean
  rotatable: boolean
  price_net: number
  purchase_price_net: number | null
  margin_factor: number | null
  machine_code: string
  created_at: string
  updated_at: string
}

export type SheetMaterialListParams = {
  tenantId: string
  q?: string
  active?: 'all' | 'active' | 'inactive'
  page?: number
  limit?: number
}

export type SheetMaterialListResult = {
  rows: SheetMaterialListItem[]
  total: number
  page: number
  limit: number
}

const LIST_SELECT = `
  id,
  name,
  length_mm,
  width_mm,
  thickness_mm,
  price_net,
  active,
  on_stock,
  image_url,
  manufacturer_id,
  tax_rate_id,
  updated_at,
  manufacturers ( name ),
  tax_rates ( rate_percent )
`

function mapListRow(row: {
  id: string
  name: string
  length_mm: number | string
  width_mm: number | string
  thickness_mm: number | string
  price_net: number | string
  active: boolean
  on_stock: boolean
  image_url: string | null
  manufacturer_id: string
  tax_rate_id: string
  updated_at: string
  manufacturers: { name: string } | { name: string }[] | null
  tax_rates:
    | { rate_percent: number | string }
    | { rate_percent: number | string }[]
    | null
}): SheetMaterialListItem {
  const manufacturer = Array.isArray(row.manufacturers)
    ? row.manufacturers[0]
    : row.manufacturers
  const tax = Array.isArray(row.tax_rates) ? row.tax_rates[0] : row.tax_rates

  return {
    id: row.id,
    name: row.name,
    length_mm: Number(row.length_mm),
    width_mm: Number(row.width_mm),
    thickness_mm: Number(row.thickness_mm),
    price_net: Number(row.price_net),
    active: row.active,
    on_stock: row.on_stock,
    image_url: row.image_url,
    manufacturer_id: row.manufacturer_id,
    tax_rate_id: row.tax_rate_id,
    manufacturer_name: manufacturer?.name ?? '—',
    tax_rate_percent: Number(tax?.rate_percent ?? 0),
    updated_at: row.updated_at
  }
}

export async function listSheetMaterials(
  supabase: SupabaseClient,
  params: SheetMaterialListParams
): Promise<SheetMaterialListResult> {
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.min(50, Math.max(1, params.limit ?? 25))
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabase
    .from('sheet_materials')
    .select(LIST_SELECT, { count: 'exact' })
    .eq('tenant_id', params.tenantId)
    .is('deleted_at', null)

  if (params.active === 'active') {
    query = query.eq('active', true)
  } else if (params.active === 'inactive') {
    query = query.eq('active', false)
  }

  const q = params.q?.trim()
  if (q) {
    const safe = q.replace(/[%_,]/g, '')
    if (safe) {
      query = query.or(
        `name.ilike.%${safe}%,machine_code.ilike.%${safe}%`
      )
    }
  }

  const { data, error, count } = await query
    .order('name', { ascending: true })
    .range(from, to)

  if (error) {
    console.error('listSheetMaterials', error.message)
    throw new Error('Nem sikerült betölteni a táblás anyagokat.')
  }

  return {
    rows: (data ?? []).map((row) =>
      mapListRow(row as Parameters<typeof mapListRow>[0])
    ),
    total: count ?? 0,
    page,
    limit
  }
}

export async function getSheetMaterial(
  supabase: SupabaseClient,
  tenantId: string,
  id: string
): Promise<SheetMaterialDetail | null> {
  const { data, error } = await supabase
    .from('sheet_materials')
    .select(
      `
      id,
      manufacturer_id,
      tax_rate_id,
      equipment_id,
      name,
      length_mm,
      width_mm,
      thickness_mm,
      on_stock,
      active,
      image_url,
      trim_top_mm,
      trim_right_mm,
      trim_bottom_mm,
      trim_left_mm,
      kerf_mm,
      waste_multi,
      usage_limit,
      grain_direction,
      rotatable,
      price_net,
      purchase_price_net,
      margin_factor,
      machine_code,
      created_at,
      updated_at
    `
    )
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    console.error('getSheetMaterial', error.message)
    throw new Error('Nem sikerült betölteni a táblás anyagot.')
  }

  if (!data) return null

  return {
    ...data,
    length_mm: Number(data.length_mm),
    width_mm: Number(data.width_mm),
    thickness_mm: Number(data.thickness_mm),
    price_net: Number(data.price_net),
    purchase_price_net:
      data.purchase_price_net == null ? null : Number(data.purchase_price_net),
    margin_factor:
      data.margin_factor == null ? null : Number(data.margin_factor),
    trim_top_mm: Number(data.trim_top_mm),
    trim_right_mm: Number(data.trim_right_mm),
    trim_bottom_mm: Number(data.trim_bottom_mm),
    trim_left_mm: Number(data.trim_left_mm),
    kerf_mm: Number(data.kerf_mm),
    waste_multi: Number(data.waste_multi),
    usage_limit: Number(data.usage_limit),
    image_url: data.image_url ?? null
  }
}

export async function listManufacturerOptions(
  supabase: SupabaseClient,
  tenantId: string
) {
  const { data, error } = await supabase
    .from('manufacturers')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) {
    console.error('listManufacturerOptions', error.message)
    throw new Error('Nem sikerült betölteni a gyártókat.')
  }

  return data ?? []
}

export async function listEquipmentOptions(
  supabase: SupabaseClient,
  tenantId: string
) {
  const { data, error } = await supabase
    .from('equipment')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) {
    console.error('listEquipmentOptions', error.message)
    throw new Error('Nem sikerült betölteni a berendezéseket.')
  }

  return data ?? []
}

export async function listTaxRateOptions(
  supabase: SupabaseClient,
  tenantId: string
) {
  const { data, error } = await supabase
    .from('tax_rates')
    .select('id, name, rate_percent, is_default')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('rate_percent', { ascending: true })

  if (error) {
    console.error('listTaxRateOptions', error.message)
    throw new Error('Nem sikerült betölteni az adónemeket.')
  }

  return (data ?? []).map((row) => ({
    ...row,
    rate_percent: Number(row.rate_percent)
  }))
}

export type SheetMaterialExportItem = {
  manufacturer_name: string
  tax_rate_name: string
  tax_rate_percent: number
  equipment_name: string
  name: string
  length_mm: number
  width_mm: number
  thickness_mm: number
  price_net: number
  purchase_price_net: number | null
  margin_factor: number | null
  machine_code: string
  on_stock: boolean
  active: boolean
  trim_top_mm: number
  trim_right_mm: number
  trim_bottom_mm: number
  trim_left_mm: number
  kerf_mm: number
  waste_multi: number
  usage_limit: number
  grain_direction: boolean
  rotatable: boolean
  image_url: string | null
}

const EXPORT_SELECT = `
  name,
  length_mm,
  width_mm,
  thickness_mm,
  price_net,
  purchase_price_net,
  margin_factor,
  machine_code,
  on_stock,
  active,
  trim_top_mm,
  trim_right_mm,
  trim_bottom_mm,
  trim_left_mm,
  kerf_mm,
  waste_multi,
  usage_limit,
  grain_direction,
  rotatable,
  image_url,
  manufacturers ( name ),
  tax_rates ( name, rate_percent ),
  equipment ( name )
`

export async function listSheetMaterialsForExport(
  supabase: SupabaseClient,
  tenantId: string,
  maxRows = 2000
): Promise<SheetMaterialExportItem[]> {
  const { data, error } = await supabase
    .from('sheet_materials')
    .select(EXPORT_SELECT)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('name', { ascending: true })
    .limit(maxRows)

  if (error) {
    console.error('listSheetMaterialsForExport', error.message)
    throw new Error('Nem sikerült exportálni a táblás anyagokat.')
  }

  return (data ?? []).map((row) => {
    const manufacturer = Array.isArray(row.manufacturers)
      ? row.manufacturers[0]
      : row.manufacturers
    const tax = Array.isArray(row.tax_rates) ? row.tax_rates[0] : row.tax_rates
    const equipment = Array.isArray(row.equipment)
      ? row.equipment[0]
      : row.equipment

    return {
      manufacturer_name: manufacturer?.name ?? '',
      tax_rate_name: tax?.name ?? '',
      tax_rate_percent: Number(tax?.rate_percent ?? 0),
      equipment_name: equipment?.name ?? '',
      name: row.name,
      length_mm: Number(row.length_mm),
      width_mm: Number(row.width_mm),
      thickness_mm: Number(row.thickness_mm),
      price_net: Number(row.price_net),
      purchase_price_net:
        row.purchase_price_net == null ? null : Number(row.purchase_price_net),
      margin_factor:
        row.margin_factor == null ? null : Number(row.margin_factor),
      machine_code: row.machine_code,
      on_stock: row.on_stock,
      active: row.active,
      trim_top_mm: Number(row.trim_top_mm),
      trim_right_mm: Number(row.trim_right_mm),
      trim_bottom_mm: Number(row.trim_bottom_mm),
      trim_left_mm: Number(row.trim_left_mm),
      kerf_mm: Number(row.kerf_mm),
      waste_multi: Number(row.waste_multi),
      usage_limit: Number(row.usage_limit),
      grain_direction: row.grain_direction,
      rotatable: row.rotatable,
      image_url: row.image_url ?? null
    }
  })
}
