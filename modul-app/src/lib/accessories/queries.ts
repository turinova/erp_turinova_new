import type { SupabaseClient } from '@supabase/supabase-js'

import { grossFromNet } from '@/lib/accessories/parse'
import { fetchAllPages } from '@/lib/supabase/fetch-all'

export type AccessoryListItem = {
  id: string
  name: string
  sku: string
  barcode: string | null
  barcode_internal: string | null
  manufacturer_id: string
  manufacturer_name: string
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

  return {
    id: String(row.id),
    name: String(row.name),
    sku: String(row.sku),
    barcode: (row.barcode as string | null) ?? null,
    barcode_internal: (row.barcode_internal as string | null) ?? null,
    manufacturer_id: String(row.manufacturer_id),
    manufacturer_name: manufacturerName,
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
  const embed = !opts.hasWebshop
    ? ''
    : web === 'web'
      ? ', sw:accessory_web!inner ( sellable_web )'
      : ', sw:accessory_web ( sellable_web )'

  let query = supabase
    .from('accessories')
    .select(`${ACCESSORY_SELECT}${embed}`, { count: 'exact' })
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)

  if (web === 'web') query = query.eq('sw.sellable_web', true)
  if (web === 'not_web') query = query.eq('sw.sellable_web', true).is('sw', null)

  const term = safeSearch(opts.q)
  if (term) {
    const { data: mfr } = await supabase
      .from('manufacturers')
      .select('id')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .ilike('name', `%${term}%`)
      .limit(50)
    const parts = [
      `name.ilike.%${term}%`,
      `sku.ilike.%${term}%`,
      `barcode.ilike.%${term}%`,
      `barcode_internal.ilike.%${term}%`
    ]
    const ids = (mfr ?? []).map((m) => m.id as string)
    if (ids.length > 0) parts.push(`manufacturer_id.in.(${ids.join(',')})`)
    query = query.or(parts.join(','))
  }

  const { data, error, count } = await query
    .order('name', { ascending: true })
    .order('id', { ascending: true })
    .range(from, from + ACCESSORY_PAGE_SIZE - 1)

  if (error) {
    // Túllapozás (pl. törlés után az utolsó oldal kiürült): üres oldal, nem hiba.
    if (error.code === 'PGRST103') {
      return { rows: [], total: count ?? 0, page, pageCount: Math.max(1, Math.ceil((count ?? 0) / ACCESSORY_PAGE_SIZE)) }
    }
    console.error('listAccessoriesPage', error.message)
    throw new Error('Nem sikerült betölteni a termékeket.')
  }

  const total = count ?? 0
  return {
    rows: (data ?? []).map((raw) => {
      const row = raw as unknown as Record<string, unknown>
      const sw = (Array.isArray(row.sw) ? row.sw[0] : row.sw) as { sellable_web?: boolean } | null | undefined
      return { ...mapAccessoryRow(row), in_shop: sw?.sellable_web === true }
    }),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / ACCESSORY_PAGE_SIZE))
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
  return mapAccessoryRow(data as unknown as Record<string, unknown>)
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

export async function listActiveAccessoryOptions(
  supabase: SupabaseClient,
  tenantId: string
): Promise<AccessoryListItem[]> {
  const rows = await listAccessories(supabase, tenantId)
  return rows.filter((r) => r.active)
}
