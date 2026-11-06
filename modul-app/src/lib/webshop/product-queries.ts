import type { SupabaseClient } from '@supabase/supabase-js'

import { grossFromNet } from '@/lib/accessories/parse'
import {
  ACCESSORY_WEB_COLUMNS,
  emptyWebFields,
  evaluateShopReady,
  mapAccessoryWebFields,
  type AccessoryWebFields,
  type ShopReadyLevel
} from '@/lib/accessories/web-shop'
import { fetchAllPages } from '@/lib/supabase/fetch-all'
import { shopRequirementIssues, type ShopRequirementIssue } from '@/lib/webshop/product-parse'
import { listAccessoryAttributeInputs } from '@/lib/webshop/queries'
import type { AttributeInput } from '@/lib/webshop/types'

/** Az alap termék adatai, amiket a bolt szerkesztő csak mutat (szerkeszteni az alapadatoknál lehet). */
export type ShopProductCore = {
  id: string
  name: string
  sku: string
  barcode: string | null
  image_url: string | null
  gallery: string[]
  price_net: number
  price_gross: number
  active: boolean
  manufacturer_name: string | null
  unit_shortform: string
}

export type ShopProductDetail = {
  core: ShopProductCore
  /** false = még sosem volt bekapcsolva, nincs bolt adat. */
  exists: boolean
  web: AccessoryWebFields
  web_category_id: string | null
  attribute_value_ids: string[]
  attribute_inputs: AttributeInput[]
}

export type ShopReady = {
  level: ShopReadyLevel
  score: number
  missing: string[]
  agentTop: boolean
  issues: ShopRequirementIssue[]
}

const CORE_SELECT = `
  id,
  name,
  sku,
  barcode,
  image_url,
  web_gallery,
  price_net,
  active,
  manufacturers ( name ),
  tax_rates ( rate_percent ),
  units ( shortform )
`

function one<T>(value: unknown): T | null {
  return ((Array.isArray(value) ? value[0] : value) ?? null) as T | null
}

function mapCore(row: Record<string, unknown>): ShopProductCore {
  const manufacturer = one<{ name?: string }>(row.manufacturers)
  const tax = one<{ rate_percent?: number }>(row.tax_rates)
  const unit = one<{ shortform?: string }>(row.units)
  const priceNet = Number(row.price_net ?? 0)
  const primary = (row.image_url as string | null)?.trim() || null
  const gallery = Array.isArray(row.web_gallery)
    ? (row.web_gallery as unknown[])
        .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
        .filter((u) => u !== primary)
    : []
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    sku: String(row.sku ?? ''),
    barcode: (row.barcode as string | null) ?? null,
    image_url: primary,
    gallery,
    price_net: priceNet,
    price_gross: grossFromNet(priceNet, Number(tax?.rate_percent ?? 0)),
    active: row.active === true,
    manufacturer_name: manufacturer?.name?.trim() || null,
    unit_shortform: unit?.shortform ?? 'db'
  }
}

export function evaluateShopProduct(
  core: ShopProductCore,
  web: AccessoryWebFields,
  webCategoryId: string | null
): ShopReady {
  const ready = evaluateShopReady({
    ...web,
    web_gallery: core.gallery,
    name: core.name,
    image_url: core.image_url,
    barcode: core.barcode,
    manufacturer_name: core.manufacturer_name,
    price_net: core.price_net,
    active: core.active
  })
  const issues = shopRequirementIssues(
    {
      webSlug: web.web_slug,
      webTitle: web.web_title,
      webDescriptionLong: web.web_description_long,
      webDescriptionShort: web.web_description_short,
      webCategoryId,
      webProductType: web.web_product_type
    },
    { name: core.name, imageUrl: core.image_url, priceNet: core.price_net, active: core.active }
  )
  return { ...ready, issues }
}

export async function getShopProduct(
  supabase: SupabaseClient,
  tenantId: string,
  accessoryId: string
): Promise<ShopProductDetail | null> {
  const [{ data: coreRow, error: coreError }, { data: webRow, error: webError }, { data: links }, inputs] =
    await Promise.all([
      supabase
        .from('accessories')
        .select(CORE_SELECT)
        .eq('tenant_id', tenantId)
        .eq('id', accessoryId)
        .is('deleted_at', null)
        .maybeSingle(),
      supabase
        .from('accessory_web')
        .select(ACCESSORY_WEB_COLUMNS)
        .eq('tenant_id', tenantId)
        .eq('accessory_id', accessoryId)
        .maybeSingle(),
      supabase
        .from('accessory_attribute_values')
        .select('attribute_value_id')
        .eq('tenant_id', tenantId)
        .eq('accessory_id', accessoryId),
      listAccessoryAttributeInputs(supabase, tenantId, accessoryId)
    ])

  if (coreError || webError) {
    console.error('getShopProduct', coreError?.message ?? webError?.message)
    throw new Error('Nem sikerült betölteni a termék bolt adatait.')
  }
  if (!coreRow) return null

  const core = mapCore(coreRow as unknown as Record<string, unknown>)
  const web = webRow
    ? mapAccessoryWebFields(webRow as unknown as Record<string, unknown>)
    : emptyWebFields()
  return {
    core,
    exists: Boolean(webRow),
    web: { ...web, web_gallery: core.gallery },
    web_category_id: ((webRow as { web_category_id?: string | null } | null)?.web_category_id ?? null),
    attribute_value_ids: (links ?? []).map((r) => r.attribute_value_id as string),
    attribute_inputs: inputs
  }
}

export type ShopCardStatus = {
  exists: boolean
  sellable: boolean
  slug: string | null
  ready: ShopReady
}

/** Az alap termékoldal „Online bolt” kártyájához — egy sor, nincs attribútum lekérés. */
export async function getShopCardStatus(
  supabase: SupabaseClient,
  tenantId: string,
  accessoryId: string
): Promise<ShopCardStatus | null> {
  const [{ data: coreRow }, { data: webRow, error }] = await Promise.all([
    supabase
      .from('accessories')
      .select(CORE_SELECT)
      .eq('tenant_id', tenantId)
      .eq('id', accessoryId)
      .is('deleted_at', null)
      .maybeSingle(),
    supabase
      .from('accessory_web')
      .select(ACCESSORY_WEB_COLUMNS)
      .eq('tenant_id', tenantId)
      .eq('accessory_id', accessoryId)
      .maybeSingle()
  ])
  if (error) {
    console.error('getShopCardStatus', error.message)
    return null
  }
  if (!coreRow) return null
  const core = mapCore(coreRow as unknown as Record<string, unknown>)
  const web = webRow
    ? mapAccessoryWebFields(webRow as unknown as Record<string, unknown>)
    : emptyWebFields()
  const categoryId = (webRow as { web_category_id?: string | null } | null)?.web_category_id ?? null
  return {
    exists: Boolean(webRow),
    sellable: web.sellable_web,
    slug: web.web_slug,
    ready: evaluateShopProduct(core, web, categoryId)
  }
}

/**
 * Bolt munkalista szűrők — csak `accessory_web` tagok.
 * Legacy alias: `in_shop`→`live`, `not_in_shop`→`draft`.
 */
export const SHOP_CATALOG_FILTERS = [
  'live',
  'draft',
  'all',
  'incomplete',
  'agent_ok',
  'no_category',
  'no_description',
  'no_image',
  /** @deprecated use live */
  'in_shop',
  /** @deprecated use draft */
  'not_in_shop'
] as const

export type ShopCatalogFilter = (typeof SHOP_CATALOG_FILTERS)[number]

export const SHOP_CATALOG_DEFAULT_FILTER: ShopCatalogFilter = 'live'

/** Fő chip sáv — Square lean. */
export const SHOP_CATALOG_PRIMARY_FILTERS: ShopCatalogFilter[] = [
  'live',
  'draft',
  'incomplete',
  'agent_ok'
]

export const SHOP_CATALOG_FILTER_LABEL: Record<ShopCatalogFilter, string> = {
  live: 'Live',
  draft: 'Készül',
  all: 'Összes a boltban',
  incomplete: 'Agent hiányos',
  agent_ok: 'Agent kész',
  no_category: 'Nincs kategória',
  no_description: 'Nincs leírás',
  no_image: 'Nincs kép',
  in_shop: 'Live',
  not_in_shop: 'Készül'
}

export const SHOP_CATALOG_PAGE_SIZE = 25

/** Régi URL / Excel filter → kanonikus. */
export function normalizeShopCatalogFilter(
  raw: string | null | undefined
): ShopCatalogFilter {
  if (raw === 'in_shop') return 'live'
  if (raw === 'not_in_shop') return 'draft'
  if (raw && (SHOP_CATALOG_FILTERS as readonly string[]).includes(raw)) {
    return raw as ShopCatalogFilter
  }
  return SHOP_CATALOG_DEFAULT_FILTER
}

export type ShopCatalogRow = {
  id: string
  name: string
  sku: string
  image_url: string | null
  price_gross: number
  active: boolean
  sellable: boolean
  /** W1 Agent Top közelítés (márka + leírás) — lista oszlop. */
  agent_top: boolean
  slug: string | null
  category_name: string | null
  level: ShopReadyLevel
  score: number
  /** Első teendő szövege + melyik szerkesztő csoportba visz. */
  next_step: { label: string; group: string } | null
  issue_count: number
}

const CATALOG_MAX_ROWS = 20000

/** Teendő → a szerkesztő melyik csoportja javítja. */
export function groupForIssue(field: string): string {
  if (field === 'imageUrl' || field === 'priceNet' || field === 'active') return 'alap'
  if (field === 'webCategoryId' || field === 'webTitle') return 'alapok'
  if (field === 'webDescriptionLong' || field === 'webBrand') return 'agent'
  return 'halado'
}

const SOFT_STEP: Record<string, { label: string; group: string }> = {
  'GTIN vagy márka+MPN': { label: 'Add meg a vonalkódot vagy a gyártói cikkszámot', group: 'halado' },
  'Legalább 3 galéria kép': { label: 'Tölts fel legalább 3 képet', group: 'alap' },
  'Legalább 4 attribútum/spec': { label: 'Töltsd ki a kulcsadatokat', group: 'jellemzok' },
  'Google kategória': { label: 'Válassz Google kategóriát', group: 'halado' },
  'Csomag súly': { label: 'Add meg a csomag súlyát', group: 'meretek' },
  'FAQ vagy felhasználási eset': { label: 'Írd le, mire jó', group: 'kerdesek' },
  'Kereső szinonimák': { label: 'Adj meg más keresőszavakat', group: 'halado' },
  Márka: { label: 'Add meg a márkát', group: 'agent' }
}

function softStep(missing: string): { label: string; group: string } {
  return SOFT_STEP[missing] ?? { label: missing, group: 'alapok' }
}

function safeCatalogSearch(q: string): string {
  return q.trim().replace(/[%_,()"\\*]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
}

function emptyCounts(): Record<ShopCatalogFilter, number> {
  return {
    live: 0,
    draft: 0,
    all: 0,
    incomplete: 0,
    agent_ok: 0,
    no_category: 0,
    no_description: 0,
    no_image: 0,
    in_shop: 0,
    not_in_shop: 0
  }
}

function rpcRowToCatalogRow(row: Record<string, unknown>): ShopCatalogRow {
  const gallery = Array.isArray(row.web_gallery)
    ? (row.web_gallery as unknown[]).filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
    : []
  const core: ShopProductCore = {
    id: String(row.id),
    name: String(row.name ?? ''),
    sku: String(row.sku ?? ''),
    barcode: (row.barcode as string | null) ?? null,
    image_url: (row.image_url as string | null)?.trim() || null,
    gallery,
    price_net: Number(row.price_net ?? 0),
    price_gross: Number(row.price_gross ?? 0),
    active: row.active === true,
    manufacturer_name: (row.manufacturer_name as string | null)?.trim() || null,
    unit_shortform: 'db'
  }
  const web = {
    ...emptyWebFields(),
    sellable_web: row.sellable_web === true,
    web_slug: (row.web_slug as string | null) ?? null,
    web_title: (row.web_title as string | null) ?? null,
    web_description_short: (row.web_description_short as string | null) ?? null,
    web_description_long: (row.web_description_long as string | null) ?? null,
    web_brand: (row.web_brand as string | null) ?? null,
    web_gtin: (row.web_gtin as string | null) ?? null,
    web_mpn: (row.web_mpn as string | null) ?? null,
    web_product_type: (row.web_product_type as string | null) ?? null,
    web_google_category: (row.web_google_category as string | null) ?? null,
    web_identifier_exists: row.web_identifier_exists !== false,
    shipping_weight_kg:
      row.shipping_weight_kg != null ? Number(row.shipping_weight_kg) : null,
    web_color: (row.web_color as string | null) ?? null,
    web_size: (row.web_size as string | null) ?? null,
    web_material: (row.web_material as string | null) ?? null,
    web_search_aliases: Array.isArray(row.web_search_aliases)
      ? (row.web_search_aliases as string[])
      : [],
    web_use_cases: Array.isArray(row.web_use_cases) ? (row.web_use_cases as string[]) : [],
    web_gallery: gallery
  }
  const categoryId = (row.web_category_id as string | null) ?? null
  const ready = evaluateShopProduct(core, web, categoryId)
  const first = ready.issues[0]
  const soft = ready.missing[0]
  const agentTop = ready.agentTop || row.agent_top === true
  return {
    id: core.id,
    name: core.name,
    sku: core.sku,
    image_url: core.image_url,
    price_gross: core.price_gross,
    active: core.active,
    sellable: web.sellable_web,
    agent_top: agentTop,
    slug: web.web_slug,
    category_name:
      (row.category_name as string | null)?.trim() ||
      web.web_product_type ||
      null,
    level: ready.level,
    score: ready.score,
    next_step: first
      ? { label: first.message, group: groupForIssue(first.field) }
      : web.sellable_web && !agentTop
        ? soft?.includes('Márka')
          ? { label: 'Add meg a márkát (Agent Top)', group: 'agent' }
          : soft?.includes('Leírás')
            ? { label: 'Írj leírást az Agent Tophoz', group: 'agent' }
            : { label: 'Agent Top: márka és leírás', group: 'agent' }
        : web.sellable_web && soft
          ? softStep(soft)
          : null,
    issue_count: ready.issues.length
  }
}

export type ShopCatalogPage = {
  rows: ShopCatalogRow[]
  total: number
  page: number
  pageCount: number
  counts: Record<ShopCatalogFilter, number>
}

/**
 * Bolt katalógus — `search_shop_catalog_page` RPC (mint a Termékek lista).
 * Nincs full dump; keresés / lapozás DB-ben, max 8s.
 */
export async function listShopCatalog(
  supabase: SupabaseClient,
  tenantId: string,
  opts: { filter: ShopCatalogFilter; q: string; page: number }
): Promise<ShopCatalogPage> {
  const filter = normalizeShopCatalogFilter(opts.filter)
  const term = safeCatalogSearch(opts.q)
  const page = Math.max(1, opts.page)
  const from = (page - 1) * SHOP_CATALOG_PAGE_SIZE

  const { data, error } = await supabase.rpc('search_shop_catalog_page', {
    p_tenant_id: tenantId,
    p_q: term,
    p_filter: filter,
    p_limit: SHOP_CATALOG_PAGE_SIZE,
    p_offset: from
  })

  if (error) {
    console.error('listShopCatalog rpc', error.message, error.code)
    throw new Error(
      /Could not find the function|PGRST202/i.test(error.message)
        ? 'A bolt katalógus kereső RPC nincs telepítve (search_shop_catalog_page). Futtasd a 20260636 migrációt.'
        : /timeout|canceling statement/i.test(error.message)
          ? 'A katalógus lekérdezés időtúllépés miatt megszakadt. Próbáld újra.'
          : 'Nem sikerült betölteni a bolt katalógust.'
    )
  }

  const raw = (data ?? []) as Record<string, unknown>[]
  const meta = raw[0]
  const counts = emptyCounts()
  if (meta) {
    counts.live = Number(meta.count_live ?? 0)
    counts.draft = Number(meta.count_draft ?? 0)
    counts.incomplete = Number(meta.count_incomplete ?? 0)
    counts.agent_ok = Number(meta.count_agent_ok ?? 0)
    counts.all = Number(meta.count_all ?? 0)
    counts.in_shop = counts.live
    counts.not_in_shop = counts.draft
  }

  const rows = raw.filter((r) => r.id != null).map((r) => rpcRowToCatalogRow(r))
  let total = meta ? Number(meta.total_count ?? 0) : 0

  if (rows.length === 0 && from > 0) {
    const { data: recount } = await supabase.rpc('search_shop_catalog_page', {
      p_tenant_id: tenantId,
      p_q: term,
      p_filter: filter,
      p_limit: 1,
      p_offset: 0
    })
    const first = (recount ?? [])[0] as Record<string, unknown> | undefined
    total = Number(first?.total_count ?? 0)
  }

  return {
    rows,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / SHOP_CATALOG_PAGE_SIZE)),
    counts
  }
}

/** Az Excel exporthoz: a szűrés + keresés összes id-ja (RPC lapozva). */
export async function listShopCatalogIds(
  supabase: SupabaseClient,
  tenantId: string,
  opts: { filter: ShopCatalogFilter; q: string }
): Promise<string[]> {
  const filter = normalizeShopCatalogFilter(opts.filter)
  const term = safeCatalogSearch(opts.q)
  const ids: string[] = []
  const pageSize = 100
  let offset = 0
  for (;;) {
    const { data, error } = await supabase.rpc('search_shop_catalog_page', {
      p_tenant_id: tenantId,
      p_q: term,
      p_filter: filter,
      p_limit: pageSize,
      p_offset: offset
    })
    if (error) {
      console.error('listShopCatalogIds rpc', error.message)
      throw new Error('Nem sikerült betölteni a katalógus azonosítókat.')
    }
    const raw = (data ?? []) as Record<string, unknown>[]
    const batch = raw.filter((r) => r.id != null).map((r) => String(r.id))
    ids.push(...batch)
    const total = Number(raw[0]?.total_count ?? 0)
    offset += pageSize
    if (batch.length === 0 || ids.length >= total || ids.length >= CATALOG_MAX_ROWS) break
  }
  return ids
}

/** Webshop áttekintő — lean count a katalógus RPC-ből (nincs full dump). */
export async function listShopReadyLevels(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{ sellable_web: boolean; shop_ready_level: ShopReadyLevel; agent_top: boolean }[]> {
  const { data, error } = await supabase.rpc('search_shop_catalog_page', {
    p_tenant_id: tenantId,
    p_q: '',
    p_filter: 'all',
    p_limit: 1,
    p_offset: 0
  })
  if (error) {
    console.error('listShopReadyLevels rpc', error.message)
    return []
  }
  const meta = ((data ?? []) as Record<string, unknown>[])[0]
  if (!meta) return []
  const live = Number(meta.count_live ?? 0)
  const draft = Number(meta.count_draft ?? 0)
  const agentOk = Number(meta.count_agent_ok ?? 0)
  const incomplete = Number(meta.count_incomplete ?? 0)
  const out: { sellable_web: boolean; shop_ready_level: ShopReadyLevel; agent_top: boolean }[] =
    []
  for (let i = 0; i < agentOk; i++) {
    out.push({ sellable_web: true, shop_ready_level: 'competitive', agent_top: true })
  }
  for (let i = 0; i < incomplete; i++) {
    out.push({ sellable_web: true, shop_ready_level: 'indexable', agent_top: false })
  }
  for (let i = 0; i < draft; i++) {
    out.push({ sellable_web: false, shop_ready_level: 'off', agent_top: false })
  }
  // live = agentOk + incomplete (+ esetleges blocked Live) — ha eltérés, padding
  const liveAccounted = agentOk + incomplete
  for (let i = liveAccounted; i < live; i++) {
    out.push({ sellable_web: true, shop_ready_level: 'indexable', agent_top: false })
  }
  return out
}

/** Az alap terméklista „Boltban” oszlopához: mely termékek vannak kint. */
export async function listSellableAccessoryIds(
  supabase: SupabaseClient,
  tenantId: string
): Promise<string[]> {
  const { data, error } = await fetchAllPages<{ accessory_id: string }>(
    (from, to) =>
      supabase
        .from('accessory_web')
        .select('accessory_id')
        .eq('tenant_id', tenantId)
        .eq('sellable_web', true)
        .order('accessory_id', { ascending: true })
        .range(from, to),
    CATALOG_MAX_ROWS
  )
  if (error) {
    console.error('listSellableAccessoryIds', error)
    return []
  }
  return data.map((r) => r.accessory_id)
}
