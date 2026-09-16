import type { SupabaseClient } from '@supabase/supabase-js'

import {
  LINEAR_MATERIAL_TYPE_LABELS,
  type LinearMaterialType
} from '@/lib/linear-materials/parse'

export type LinearMaterialListItem = {
  id: string
  name: string
  material_type: LinearMaterialType
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

export type LinearMaterialDetail = {
  id: string
  manufacturer_id: string
  tax_rate_id: string
  name: string
  material_type: LinearMaterialType
  length_mm: number
  width_mm: number
  thickness_mm: number
  on_stock: boolean
  active: boolean
  image_url: string | null
  price_net: number
  created_at: string
  updated_at: string
}

export type LinearMaterialListParams = {
  tenantId: string
  q?: string
  active?: 'all' | 'active' | 'inactive'
  page?: number
  limit?: number
}

export type LinearMaterialListResult = {
  rows: LinearMaterialListItem[]
  total: number
  page: number
  limit: number
}

const LIST_SELECT = `
  id,
  name,
  material_type,
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
  material_type: string
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
}): LinearMaterialListItem {
  const manufacturer = Array.isArray(row.manufacturers)
    ? row.manufacturers[0]
    : row.manufacturers
  const tax = Array.isArray(row.tax_rates) ? row.tax_rates[0] : row.tax_rates

  return {
    id: row.id,
    name: row.name,
    material_type: row.material_type as LinearMaterialType,
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

export function materialTypeLabel(type: LinearMaterialType): string {
  return LINEAR_MATERIAL_TYPE_LABELS[type]
}

export async function listLinearMaterials(
  supabase: SupabaseClient,
  params: LinearMaterialListParams
): Promise<LinearMaterialListResult> {
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.min(50, Math.max(1, params.limit ?? 25))
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabase
    .from('linear_materials')
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
      query = query.ilike('name', `%${safe}%`)
    }
  }

  const { data, error, count } = await query
    .order('name', { ascending: true })
    .range(from, to)

  if (error) {
    console.error('listLinearMaterials', error.message)
    throw new Error('Nem sikerült betölteni a szálas anyagokat.')
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

export async function getLinearMaterial(
  supabase: SupabaseClient,
  tenantId: string,
  id: string
): Promise<LinearMaterialDetail | null> {
  const { data, error } = await supabase
    .from('linear_materials')
    .select(
      `
      id,
      manufacturer_id,
      tax_rate_id,
      name,
      material_type,
      length_mm,
      width_mm,
      thickness_mm,
      on_stock,
      active,
      image_url,
      price_net,
      created_at,
      updated_at
    `
    )
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    console.error('getLinearMaterial', error.message)
    throw new Error('Nem sikerült betölteni a szálas anyagot.')
  }

  if (!data) return null

  return {
    ...data,
    material_type: data.material_type as LinearMaterialType,
    length_mm: Number(data.length_mm),
    width_mm: Number(data.width_mm),
    thickness_mm: Number(data.thickness_mm),
    price_net: Number(data.price_net),
    image_url: data.image_url ?? null
  }
}

export {
  listManufacturerOptions,
  listTaxRateOptions
} from '@/lib/sheet-materials/queries'

export type LinearMaterialExportItem = {
  manufacturer_name: string
  tax_rate_name: string
  tax_rate_percent: number
  name: string
  material_type: LinearMaterialType
  length_mm: number
  width_mm: number
  thickness_mm: number
  price_net: number
  on_stock: boolean
  active: boolean
  image_url: string | null
}

const EXPORT_SELECT = `
  name,
  material_type,
  length_mm,
  width_mm,
  thickness_mm,
  price_net,
  on_stock,
  active,
  image_url,
  manufacturers ( name ),
  tax_rates ( name, rate_percent )
`

export async function listLinearMaterialsForExport(
  supabase: SupabaseClient,
  tenantId: string,
  maxRows = 2000
): Promise<LinearMaterialExportItem[]> {
  const { data, error } = await supabase
    .from('linear_materials')
    .select(EXPORT_SELECT)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('name', { ascending: true })
    .limit(maxRows)

  if (error) {
    console.error('listLinearMaterialsForExport', error.message)
    throw new Error('Nem sikerült exportálni a szálas anyagokat.')
  }

  return (data ?? []).map((row) => {
    const manufacturer = Array.isArray(row.manufacturers)
      ? row.manufacturers[0]
      : row.manufacturers
    const tax = Array.isArray(row.tax_rates) ? row.tax_rates[0] : row.tax_rates

    return {
      manufacturer_name: manufacturer?.name ?? '',
      tax_rate_name: tax?.name ?? '',
      tax_rate_percent: Number(tax?.rate_percent ?? 0),
      name: row.name,
      material_type: row.material_type as LinearMaterialType,
      length_mm: Number(row.length_mm),
      width_mm: Number(row.width_mm),
      thickness_mm: Number(row.thickness_mm),
      price_net: Number(row.price_net),
      on_stock: row.on_stock,
      active: row.active,
      image_url: row.image_url ?? null
    }
  })
}
