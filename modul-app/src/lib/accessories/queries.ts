import type { SupabaseClient } from '@supabase/supabase-js'

import { grossFromNet } from '@/lib/accessories/parse'
import { fetchAllPages } from '@/lib/supabase/fetch-all'

export type AccessoryListItem = {
  id: string
  name: string
  sku: string
  barcode: string | null
  barcode_internal: string | null
  manufacturer_id: string | null
  manufacturer_name: string
  supplier_ids: string[]
  tax_rate_id: string
  tax_rate_name: string
  tax_rate_percent: number
  unit_id: string
  unit_name: string
  unit_shortform: string
  price_net: number
  price_gross: number
  purchase_price_net: number | null
  margin_factor: number | null
  image_url: string | null
  active: boolean
  sellable_pos: boolean
  created_at: string
  updated_at: string
  /** Képek kártya galériája (DB: web_gallery, történeti név). */
  web_gallery: string[]
}

export type AccessorySupplierOption = {
  id: string
  name: string
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

const ACCESSORY_SELECT = `
  id,
  name,
  sku,
  barcode,
  barcode_internal,
  manufacturer_id,
  tax_rate_id,
  unit_id,
  price_net,
  purchase_price_net,
  margin_factor,
  image_url,
  active,
  sellable_pos,
  created_at,
  updated_at,
  web_gallery,
  manufacturers ( name ),
  tax_rates ( name, rate_percent ),
  units ( name, shortform )
`

/** Lista: nincs web_gallery (nagy JSON), detail/export használja a teljes selectet. */
const ACCESSORY_LIST_SELECT = `
  id,
  name,
  sku,
  barcode,
  barcode_internal,
  manufacturer_id,
  tax_rate_id,
  unit_id,
  price_net,
  purchase_price_net,
  margin_factor,
  image_url,
  active,
  sellable_pos,
  created_at,
  updated_at,
  manufacturers ( name ),
  tax_rates ( name, rate_percent ),
  units ( name, shortform )
`

function mapAccessoryRow(row: Record<string, unknown>): AccessoryListItem {
  const manufacturer = Array.isArray(row.manufacturers)
    ? row.manufacturers[0]
    : row.manufacturers
  const tax = Array.isArray(row.tax_rates) ? row.tax_rates[0] : row.tax_rates
  const unit = Array.isArray(row.units) ? row.units[0] : row.units
  const priceNet = Number(row.price_net)
  const taxPercent = Number(
    (tax as { rate_percent?: number } | null)?.rate_percent ?? 0
  )
  const manufacturerName =
    (manufacturer as { name?: string } | null)?.name ?? '—'
  const manufacturerId =
    row.manufacturer_id == null || row.manufacturer_id === ''
      ? null
      : String(row.manufacturer_id)

  return {
    id: String(row.id),
    name: String(row.name),
    sku: String(row.sku),
    barcode: (row.barcode as string | null) ?? null,
    barcode_internal: (row.barcode_internal as string | null) ?? null,
    manufacturer_id: manufacturerId,
    manufacturer_name: manufacturerName,
    supplier_ids: [],
    tax_rate_id: String(row.tax_rate_id),
    tax_rate_name: (tax as { name?: string } | null)?.name ?? '—',
    tax_rate_percent: taxPercent,
    unit_id: String(row.unit_id),
    unit_name: (unit as { name?: string } | null)?.name ?? '—',
    unit_shortform: (unit as { shortform?: string } | null)?.shortform ?? 'db',
    price_net: priceNet,
    price_gross: grossFromNet(priceNet, taxPercent),
    purchase_price_net:
      row.purchase_price_net == null ? null : Number(row.purchase_price_net),
    margin_factor:
      row.margin_factor == null ? null : Number(row.margin_factor),
    image_url: (row.image_url as string | null) ?? null,
    active: row.active === true,
    sellable_pos: row.sellable_pos !== false,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    web_gallery: Array.isArray(row.web_gallery)
      ? (row.web_gallery as unknown[]).filter((u): u is string => typeof u === 'string')
      : []
  }
}

const LIST_ALL_MAX = 50000

/** Minden élő termék, lapozva (a PostgREST kérésenként max 1000 sort ad). Exporthoz. */
export async function listAccessories(
  supabase: SupabaseClient,
  tenantId: string
): Promise<AccessoryListItem[]> {
  const { data, error } = await fetchAllPages<Record<string, unknown>>(
    (from, to) =>
      supabase
        .from('accessories')
        .select(ACCESSORY_SELECT)
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .order('name', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to) as unknown as PromiseLike<{
        data: Record<string, unknown>[] | null
        error: { message: string } | null
      }>,
    LIST_ALL_MAX
  )

  if (error) {
    console.error('listAccessories', error)
    throw new Error('Nem sikerült betölteni a termékeket.')
  }

  return data.map((row) => mapAccessoryRow(row))
}

export const ACCESSORY_PAGE_SIZE = 25
export const ACCESSORY_WEB_FILTERS = ['all', 'web', 'not_web'] as const
export type AccessoryWebFilter = (typeof ACCESSORY_WEB_FILTERS)[number]

export type AccessoryListPage = {
  rows: (AccessoryListItem & { in_shop: boolean })[]
  total: number
  page: number
  pageCount: number
}

/** A PostgREST `or()` szintaxisát megtörő karakterek nélkül. */
function safeSearch(q: string): string {
  return q.trim().replace(/[%_,()"\\*]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
}

export async function listAccessoriesPage(
  supabase: SupabaseClient,
  tenantId: string,
  opts: { q: string; page: number; web: AccessoryWebFilter; hasWebshop: boolean }
): Promise<AccessoryListPage> {
  const page = Math.max(1, opts.page)
  const from = (page - 1) * ACCESSORY_PAGE_SIZE
  const web = opts.hasWebshop ? opts.web : 'all'
  const term = safeSearch(opts.q)

  // Alap lista + kereső: RPC (30k+ timeout-mentes). Webshop szűrő: legacy PostgREST.
  if (web === 'all') {
    const { data, error } = await supabase.rpc('search_accessories_page', {
      p_tenant_id: tenantId,
      p_q: term,
      p_limit: ACCESSORY_PAGE_SIZE,
      p_offset: from
    })

    if (error) {
      console.error('listAccessoriesPage rpc', error.message)
      throw new Error('Nem sikerült betölteni a termékeket.')
    }

    const rowsRaw = (data ?? []) as Record<string, unknown>[]
    let resolvedTotal =
      rowsRaw.length > 0 ? Number(rowsRaw[0].total_count ?? 0) : 0

    if (rowsRaw.length === 0 && from > 0) {
      const { data: recount } = await supabase.rpc('search_accessories_page', {
        p_tenant_id: tenantId,
        p_q: term,
        p_limit: 1,
        p_offset: 0
      })
      const first = (recount ?? [])[0] as { total_count?: number } | undefined
      resolvedTotal = Number(first?.total_count ?? 0)
    }

    return {
      rows: rowsRaw.map((row) => mapRpcAccessoryRow(row)),
      total: resolvedTotal,
      page,
      pageCount: Math.max(1, Math.ceil(resolvedTotal / ACCESSORY_PAGE_SIZE))
    }
  }

  const embed =
    web === 'web'
      ? ', sw:accessory_web!inner ( sellable_web )'
      : ', sw:accessory_web ( sellable_web )'

  let manufacturerIds: string[] = []
  if (term) {
    const { data: mfr } = await supabase
      .from('manufacturers')
      .select('id')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .ilike('name', `%${term}%`)
      .limit(50)
    manufacturerIds = (mfr ?? []).map((m) => m.id as string)
  }

  const orFilter = term
    ? [
        `name.ilike.%${term}%`,
        `sku.ilike.%${term}%`,
        `barcode.ilike.%${term}%`,
        `barcode_internal.ilike.%${term}%`,
        ...(manufacturerIds.length > 0
          ? [`manufacturer_id.in.(${manufacturerIds.join(',')})`]
          : [])
      ].join(',')
    : null

  let countQuery = supabase.from('accessories').select(
    web === 'web'
      ? 'id, sw:accessory_web!inner(sellable_web)'
      : 'id, sw:accessory_web(sellable_web)',
    { count: 'exact', head: true }
  )
  countQuery = countQuery.eq('tenant_id', tenantId).is('deleted_at', null)
  if (web === 'web') countQuery = countQuery.eq('sw.sellable_web', true)
  if (web === 'not_web') {
    countQuery = countQuery.eq('sw.sellable_web', true).is('sw', null)
  }
  if (orFilter) countQuery = countQuery.or(orFilter)

  let dataQuery = supabase
    .from('accessories')
    .select(`${ACCESSORY_LIST_SELECT}${embed}`)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
  if (web === 'web') dataQuery = dataQuery.eq('sw.sellable_web', true)
  if (web === 'not_web') {
    dataQuery = dataQuery.eq('sw.sellable_web', true).is('sw', null)
  }
  if (orFilter) dataQuery = dataQuery.or(orFilter)

  const [countRes, dataRes] = await Promise.all([
    countQuery,
    dataQuery
      .order('name', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + ACCESSORY_PAGE_SIZE - 1)
  ])

  if (dataRes.error) {
    if (dataRes.error.code === 'PGRST103') {
      const total = countRes.count ?? 0
      return {
        rows: [],
        total,
        page,
        pageCount: Math.max(1, Math.ceil(total / ACCESSORY_PAGE_SIZE))
      }
    }
    console.error('listAccessoriesPage', dataRes.error.message)
    throw new Error('Nem sikerült betölteni a termékeket.')
  }

  if (countRes.error) {
    console.error('listAccessoriesPage count', countRes.error.message)
  }

  const total = countRes.count ?? 0
  return {
    rows: (dataRes.data ?? []).map((raw) => {
      const row = raw as unknown as Record<string, unknown>
      const sw = (Array.isArray(row.sw) ? row.sw[0] : row.sw) as
        | { sellable_web?: boolean }
        | null
        | undefined
      return { ...mapAccessoryRow(row), in_shop: sw?.sellable_web === true }
    }),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / ACCESSORY_PAGE_SIZE))
  }
}

function mapRpcAccessoryRow(
  row: Record<string, unknown>
): AccessoryListItem & { in_shop: boolean } {
  const priceNet = Number(row.price_net ?? 0)
  const taxPercent = Number(row.tax_rate_percent ?? 0)
  const priceGross =
    row.price_gross != null
      ? Number(row.price_gross)
      : grossFromNet(priceNet, taxPercent)

  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    sku: String(row.sku ?? ''),
    barcode: (row.barcode as string | null) ?? null,
    barcode_internal: (row.barcode_internal as string | null) ?? null,
    manufacturer_id:
      row.manufacturer_id == null || row.manufacturer_id === ''
        ? null
        : String(row.manufacturer_id),
    manufacturer_name: String(row.manufacturer_name ?? '—'),
    supplier_ids: [],
    tax_rate_id: String(row.tax_rate_id ?? ''),
    tax_rate_name: String(row.tax_rate_name ?? '—'),
    tax_rate_percent: taxPercent,
    unit_id: String(row.unit_id ?? ''),
    unit_name: String(row.unit_name ?? '—'),
    unit_shortform: String(row.unit_shortform ?? 'db'),
    price_net: priceNet,
    price_gross: priceGross,
    purchase_price_net:
      row.purchase_price_net == null ? null : Number(row.purchase_price_net),
    margin_factor: row.margin_factor == null ? null : Number(row.margin_factor),
    image_url: (row.image_url as string | null) ?? null,
    active: row.active === true,
    sellable_pos: row.sellable_pos !== false,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
    web_gallery: [],
    in_shop: false
  }
}

export async function getAccessory(
  supabase: SupabaseClient,
  tenantId: string,
  id: string
): Promise<AccessoryListItem | null> {
  const { data, error } = await supabase
    .from('accessories')
    .select(ACCESSORY_SELECT)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    console.error('getAccessory', error.message)
    throw new Error('Nem sikerült betölteni a terméket.')
  }
  if (!data) return null

  const item = mapAccessoryRow(data as unknown as Record<string, unknown>)

  const { data: links, error: linkError } = await supabase
    .from('accessory_suppliers')
    .select('supplier_id, is_primary, sort_order')
    .eq('tenant_id', tenantId)
    .eq('accessory_id', id)
    .order('sort_order', { ascending: true })

  if (linkError) {
    console.error('getAccessory suppliers', linkError.message)
  } else {
    const sorted = [...(links ?? [])].sort((a, b) => {
      if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1
      return Number(a.sort_order) - Number(b.sort_order)
    })
    item.supplier_ids = sorted.map((r) => String(r.supplier_id))
  }

  return item
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
  const { data, error } = await fetchAllPages<AccessoryManufacturerOption>(
    (from, to) =>
      supabase
        .from('manufacturers')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .order('name', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to),
    LIST_ALL_MAX
  )

  if (error) {
    console.error('listAccessoryManufacturerOptions', error)
    throw new Error('Nem sikerült betölteni a gyártókat.')
  }

  return data
}

export async function listAccessorySupplierOptions(
  supabase: SupabaseClient,
  tenantId: string
): Promise<AccessorySupplierOption[]> {
  const { data, error } = await fetchAllPages<AccessorySupplierOption>(
    (from, to) =>
      supabase
        .from('suppliers')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('name', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to),
    LIST_ALL_MAX
  )

  if (error) {
    console.error('listAccessorySupplierOptions', error)
    throw new Error('Nem sikerült betölteni a beszállítókat.')
  }

  return data
}

export async function listActiveAccessoryOptions(
  supabase: SupabaseClient,
  tenantId: string
): Promise<AccessoryListItem[]> {
  const rows = await listAccessories(supabase, tenantId)
  return rows.filter((r) => r.active)
}
