import type { SupabaseClient } from '@supabase/supabase-js'

export type EdgeMaterialListItem = {
  id: string
  type: string
  decor: string
  width_mm: number
  thickness_mm: number
  price_net: number
  active: boolean
  manufacturer_id: string
  tax_rate_id: string
  manufacturer_name: string
  tax_rate_percent: number
  updated_at: string
}

export type EdgeMaterialDetail = {
  id: string
  manufacturer_id: string
  tax_rate_id: string
  equipment_id: string
  type: string
  decor: string
  width_mm: number
  thickness_mm: number
  price_net: number
  allowance_mm: number
  favourite_priority: number | null
  active: boolean
  machine_code: string
  created_at: string
  updated_at: string
}

export type EdgeMaterialListParams = {
  tenantId: string
  q?: string
  active?: 'all' | 'active' | 'inactive'
  page?: number
  limit?: number
}

export type EdgeMaterialListResult = {
  rows: EdgeMaterialListItem[]
  total: number
  page: number
  limit: number
}

const LIST_SELECT = `
  id,
  type,
  decor,
  width_mm,
  thickness_mm,
  price_net,
  active,
  manufacturer_id,
  tax_rate_id,
  updated_at,
  manufacturers ( name ),
  tax_rates ( rate_percent )
`

function mapListRow(row: {
  id: string
  type: string
  decor: string
  width_mm: number | string
  thickness_mm: number | string
  price_net: number | string
  active: boolean
  manufacturer_id: string
  tax_rate_id: string
  updated_at: string
  manufacturers: { name: string } | { name: string }[] | null
  tax_rates: { rate_percent: number | string } | { rate_percent: number | string }[] | null
}): EdgeMaterialListItem {
  const manufacturer = Array.isArray(row.manufacturers)
    ? row.manufacturers[0]
    : row.manufacturers
  const tax = Array.isArray(row.tax_rates) ? row.tax_rates[0] : row.tax_rates

  return {
    id: row.id,
    type: row.type,
    decor: row.decor,
    width_mm: Number(row.width_mm),
    thickness_mm: Number(row.thickness_mm),
    price_net: Number(row.price_net),
    active: row.active,
    manufacturer_id: row.manufacturer_id,
    tax_rate_id: row.tax_rate_id,
    manufacturer_name: manufacturer?.name ?? '—',
    tax_rate_percent: Number(tax?.rate_percent ?? 0),
    updated_at: row.updated_at
  }
}

export async function listEdgeMaterials(
  supabase: SupabaseClient,
  params: EdgeMaterialListParams
): Promise<EdgeMaterialListResult> {
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.min(50, Math.max(1, params.limit ?? 25))
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabase
    .from('edge_materials')
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
        `type.ilike.%${safe}%,decor.ilike.%${safe}%,machine_code.ilike.%${safe}%`
      )
    }
  }

  const { data, error, count } = await query
    .order('decor', { ascending: true })
    .order('type', { ascending: true })
    .range(from, to)

  if (error) {
    console.error('listEdgeMaterials', error.message)
    throw new Error('Nem sikerült betölteni az élzárókat.')
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

export async function getEdgeMaterial(
  supabase: SupabaseClient,
  tenantId: string,
  id: string
): Promise<EdgeMaterialDetail | null> {
  const { data, error } = await supabase
    .from('edge_materials')
    .select(
      `
      id,
      manufacturer_id,
      tax_rate_id,
      equipment_id,
      type,
      decor,
      width_mm,
      thickness_mm,
      price_net,
      allowance_mm,
      favourite_priority,
      active,
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
    console.error('getEdgeMaterial', error.message)
    throw new Error('Nem sikerült betölteni az élzárót.')
  }

  if (!data) return null

  return {
    ...data,
    equipment_id: data.equipment_id as string,
    width_mm: Number(data.width_mm),
    thickness_mm: Number(data.thickness_mm),
    price_net: Number(data.price_net),
    allowance_mm: Number(data.allowance_mm),
    favourite_priority:
      data.favourite_priority === null || data.favourite_priority === undefined
        ? null
        : Number(data.favourite_priority)
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

export type EdgeMaterialExportItem = {
  manufacturer_name: string
  tax_rate_name: string
  tax_rate_percent: number
  equipment_name: string
  type: string
  decor: string
  width_mm: number
  thickness_mm: number
  price_net: number
  allowance_mm: number
  favourite_priority: number | null
  machine_code: string
  active: boolean
}

const EXPORT_SELECT = `
  type,
  decor,
  width_mm,
  thickness_mm,
  price_net,
  allowance_mm,
  favourite_priority,
  machine_code,
  active,
  manufacturers ( name ),
  tax_rates ( name, rate_percent ),
  equipment ( name )
`

export async function listEdgeMaterialsForExport(
  supabase: SupabaseClient,
  tenantId: string,
  maxRows = 2000
): Promise<EdgeMaterialExportItem[]> {
  const { data, error } = await supabase
    .from('edge_materials')
    .select(EXPORT_SELECT)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('decor', { ascending: true })
    .order('type', { ascending: true })
    .limit(maxRows)

  if (error) {
    console.error('listEdgeMaterialsForExport', error.message)
    throw new Error('Nem sikerült exportálni az élzárókat.')
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
      type: row.type,
      decor: row.decor,
      width_mm: Number(row.width_mm),
      thickness_mm: Number(row.thickness_mm),
      price_net: Number(row.price_net),
      allowance_mm: Number(row.allowance_mm),
      favourite_priority:
        row.favourite_priority === null || row.favourite_priority === undefined
          ? null
          : Number(row.favourite_priority),
      machine_code: row.machine_code,
      active: row.active
    }
  })
}
