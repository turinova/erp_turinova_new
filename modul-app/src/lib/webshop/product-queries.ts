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

export const SHOP_CATALOG_FILTERS = [
  'all',
  'in_shop',
  'incomplete',
  'not_in_shop',
  'no_category',
  'no_description',
  'no_image'
] as const

export type ShopCatalogFilter = (typeof SHOP_CATALOG_FILTERS)[number]

export const SHOP_CATALOG_FILTER_LABEL: Record<ShopCatalogFilter, string> = {
  all: 'Összes',
  in_shop: 'Kint van a boltban',
  incomplete: 'Hiányos',
  not_in_shop: 'Nincs a boltban',
  no_category: 'Nincs kategória',
  no_description: 'Nincs leírás',
  no_image: 'Nincs kép'
}

export const SHOP_CATALOG_PAGE_SIZE = 25

export type ShopCatalogRow = {
  id: string
  name: string
  sku: string
  image_url: string | null
  price_gross: number
  active: boolean
  sellable: boolean
  slug: string | null
  category_name: string | null
  level: ShopReadyLevel
  score: number
  /** Első teendő szövege + melyik szerkesztő csoportba visz. */
  next_step: { label: string; group: string } | null
  issue_count: number
}

type CatalogEntry = ShopCatalogRow & {
  has_category: boolean
  has_description: boolean
  search: string
}

const CATALOG_MAX_ROWS = 20000

/** Teendő → a szerkesztő melyik csoportja javítja. */
export function groupForIssue(field: string): string {
  if (field === 'imageUrl' || field === 'priceNet' || field === 'active') return 'alap'
  if (field === 'webCategoryId' || field === 'webDescriptionLong' || field === 'webTitle') return 'alapok'
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
  Márka: { label: 'Add meg a márkát', group: 'halado' }
}

function softStep(missing: string): { label: string; group: string } {
  return SOFT_STEP[missing] ?? { label: missing, group: 'alapok' }
}

function foldText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

async function loadCatalogEntries(
  supabase: SupabaseClient,
  tenantId: string
): Promise<CatalogEntry[]> {
  const [{ data, error }, { data: cats }] = await Promise.all([
    fetchAllPages<Record<string, unknown>>(
      (from, to) =>
        supabase
          .from('accessories')
          .select(`${CORE_SELECT}, accessory_web ( ${ACCESSORY_WEB_COLUMNS} )`)
          .eq('tenant_id', tenantId)
          .is('deleted_at', null)
          .order('name', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to) as unknown as PromiseLike<{
          data: Record<string, unknown>[] | null
          error: { message: string } | null
        }>,
      CATALOG_MAX_ROWS
    ),
    supabase
      .from('web_categories')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
  ])
  if (error) {
    console.error('loadCatalogEntries', error)
    throw new Error('Nem sikerült betölteni a bolt katalógust.')
  }
  const catName = new Map((cats ?? []).map((c) => [c.id as string, c.name as string]))

  return data.map((row) => {
    const core = mapCore(row)
    const webRow = one<Record<string, unknown>>(row.accessory_web)
    const web = webRow ? mapAccessoryWebFields(webRow) : emptyWebFields()
    const categoryId = (webRow?.web_category_id as string | null | undefined) ?? null
    const ready = evaluateShopProduct(core, web, categoryId)
    const first = ready.issues[0]
    const soft = ready.missing[0]
    return {
      id: core.id,
      name: core.name,
      sku: core.sku,
      image_url: core.image_url,
      price_gross: core.price_gross,
      active: core.active,
      sellable: web.sellable_web,
      slug: web.web_slug,
      category_name: categoryId ? (catName.get(categoryId) ?? null) : web.web_product_type,
      level: ready.level,
      score: ready.score,
      next_step: first
        ? { label: first.message, group: groupForIssue(first.field) }
        : web.sellable_web && soft
          ? softStep(soft)
          : null,
      issue_count: ready.issues.length,
      has_category: Boolean(categoryId || web.web_product_type?.trim()),
      has_description: (web.web_description_long?.trim().length ?? 0) > 0,
      search: foldText(`${core.name} ${core.sku} ${core.barcode ?? ''}`)
    }
  })
}

function matchesFilter(e: CatalogEntry, f: ShopCatalogFilter): boolean {
  switch (f) {
    case 'all':
      return true
    case 'in_shop':
      return e.sellable
    case 'not_in_shop':
      return !e.sellable
    case 'incomplete':
      return e.sellable ? e.level === 'blocked' || e.level === 'indexable' : false
    case 'no_category':
      return !e.has_category
    case 'no_description':
      return !e.has_description
    case 'no_image':
      return !e.image_url
  }
}

export type ShopCatalogPage = {
  rows: ShopCatalogRow[]
  total: number
  page: number
  pageCount: number
  counts: Record<ShopCatalogFilter, number>
}

export async function listShopCatalog(
  supabase: SupabaseClient,
  tenantId: string,
  opts: { filter: ShopCatalogFilter; q: string; page: number }
): Promise<ShopCatalogPage> {
  const entries = await loadCatalogEntries(supabase, tenantId)
  const q = foldText(opts.q.trim())
  const searched = q ? entries.filter((e) => e.search.includes(q)) : entries

  const counts = Object.fromEntries(
    SHOP_CATALOG_FILTERS.map((f) => [f, searched.filter((e) => matchesFilter(e, f)).length])
  ) as Record<ShopCatalogFilter, number>

  const filtered = searched.filter((e) => matchesFilter(e, opts.filter))
  const pageCount = Math.max(1, Math.ceil(filtered.length / SHOP_CATALOG_PAGE_SIZE))
  const page = Math.min(Math.max(1, opts.page), pageCount)
  const slice = filtered.slice((page - 1) * SHOP_CATALOG_PAGE_SIZE, page * SHOP_CATALOG_PAGE_SIZE)

  return {
    rows: slice.map((e) => ({
      id: e.id,
      name: e.name,
      sku: e.sku,
      image_url: e.image_url,
      price_gross: e.price_gross,
      active: e.active,
      sellable: e.sellable,
      slug: e.slug,
      category_name: e.category_name,
      level: e.level,
      score: e.score,
      next_step: e.next_step,
      issue_count: e.issue_count
    })),
    total: filtered.length,
    page,
    pageCount,
    counts
  }
}

/** Az Excel exporthoz: a szűrés + keresés összes találata (nem csak az oldal), név szerint. */
export async function listShopCatalogIds(
  supabase: SupabaseClient,
  tenantId: string,
  opts: { filter: ShopCatalogFilter; q: string }
): Promise<string[]> {
  const entries = await loadCatalogEntries(supabase, tenantId)
  const q = foldText(opts.q.trim())
  return entries
    .filter((e) => (!q || e.search.includes(q)) && matchesFilter(e, opts.filter))
    .map((e) => e.id)
}

/** Webshop áttekintő számlálói. */
export async function listShopReadyLevels(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{ sellable_web: boolean; shop_ready_level: ShopReadyLevel }[]> {
  const entries = await loadCatalogEntries(supabase, tenantId)
  return entries.map((e) => ({ sellable_web: e.sellable, shop_ready_level: e.level }))
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
