/**
 * Storefront katalógus: kártyák, keresés, kategória lista kulcsadat-szűrőkkel,
 * „Hasonló” és „Kell hozzá” (doc 40).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { effectiveWebTitle } from '@/lib/accessories/web-shop'
import { grossFromNet } from '@/lib/sheet-materials/parse'
import {
  CATALOG_PAGE_SIZE,
  CATALOG_PARAM,
  parseCatalogSort,
  parsePriceParam,
  type CatalogParams,
  type CatalogSort
} from '@/lib/storefront/catalog-params'
import { descendantIds, type StorefrontCategory } from '@/lib/storefront/shell'
import { netContentOf, unitPriceLabel } from '@/lib/storefront/unit-price'
import { slugifyHu } from '@/lib/storefront/url'
import { loadVariantGroupPrefs } from '@/lib/storefront/variant-groups'
import { getAccessoriesOnHandMap } from '@/lib/stock/queries'
import { swatchColor } from '@/lib/storefront/color-swatch'
import { loadExpectedArrivals } from '@/lib/storefront/expected-arrival'
import { fetchAllPages, fetchByIds } from '@/lib/supabase/fetch-all'
import {
  formatSpecNumber,
  resolveCategoryTemplate,
  sortTemplate
} from '@/lib/webshop/key-specs'
import type { CategoryTemplateItem } from '@/lib/webshop/types'

export { CATALOG_PAGE_SIZE }

/** PostgREST kérésenként max. 1000 sort ad — a kategória lapozva töltődik eddig. */
const MAX_CATEGORY_SCAN = 10000
const MAX_FACETS = 6
const MAX_SPEC_LINE = 2
const SWATCH_MAX = 5
/** Ennyi érték fér ki felsorolva a kártyán („96 · 128 · 160 mm”), felette tartomány. */
const SPEC_LIST_MAX = 4
/** „Népszerű”: a legtöbbet rendelt csoportok (legalább ennyi rendelés, elég nagy listában). */
const POPULAR_TOP = 3
const POPULAR_MIN_ORDERS = 2
const POPULAR_MIN_GROUPS = 8
/** Név alapján tartozék — csak ha a lista kisebbik része (különben ez a kategória fő terméke). */
const PART_NAME_RE =
  /(^|[\s,(/-])(sablon|r[oö]gz[ií]t[oő]|v[eé]gz[aá]r[oó]|csavar|al[aá]t[eé]t|t[aá]vtart[oó]|takar[oó]sapka|fed[oő]sapka|adapter|tartoz[eé]k|kieg[eé]sz[ií]t[oő])/i
const PART_NAME_MAX_SHARE = 0.25
const NEW_BADGE_DAYS = 30
/** storefront_search RPC belső plafonja (20260543). */
const SEARCH_RPC_MAX = 50

export type StorefrontCard = {
  id: string
  slug: string
  title: string
  imageUrl: string | null
  priceGross: number
  inStock: boolean
  stockQty?: number
  /** Kártyán: 1–2 kulcsadat, pl. „160 mm · matt fekete”. */
  specLine?: string | null
  /** Variánscsoport mérete (>1 → „4 szín”). */
  variantLabel?: string | null
  rating?: { average: number; count: number } | null
  /** Legfeljebb egy, igaz címke (pl. „Új”). */
  badge?: string | null
  /** Kötelező egységár, pl. „3 725 Ft/l”. */
  unitPrice?: string | null
  /** A csoport tagjainak ára eltér → „1 124 Ft-tól” (priceGross a legkisebb). */
  priceFrom?: boolean
  /** A csoport színei (felismert nevek), legfeljebb SWATCH_MAX. */
  swatches?: { label: string; color: string }[]
  /** Ennyi további szín van („+3”). */
  swatchMore?: number
  /** Elfogyott, de nyitott beszállítói rendelés van: várható nap (YYYY-MM-DD). */
  arrival?: string | null
}

export type CatalogFacetValue = {
  value: string
  label: string
  count: number
  selected: boolean
}

export type CatalogFacet = {
  param: string
  name: string
  values: CatalogFacetValue[]
}

const CARD_SELECT = `
  id,
  name,
  web_title,
  web_slug,
  image_url,
  price_net,
  web_net_quantity,
  web_net_unit,
  web_multipack,
  tax_rates ( rate_percent )
`

function unitPriceOf(row: Record<string, unknown>, priceGross: number): string | null {
  return unitPriceLabel(priceGross, netContentOf(row.web_net_quantity, row.web_net_unit, row.web_multipack))
}

function vatOf(row: Record<string, unknown>): number {
  const tax = Array.isArray(row.tax_rates) ? row.tax_rates[0] : row.tax_rates
  return Number((tax as { rate_percent?: number } | null)?.rate_percent ?? 0)
}

function imageOf(row: Record<string, unknown>): string | null {
  return typeof row.image_url === 'string' && row.image_url.trim()
    ? row.image_url.trim()
    : null
}

function titleOf(row: Record<string, unknown>): string {
  return effectiveWebTitle({
    web_title: (row.web_title as string | null) ?? null,
    name: String(row.name ?? '')
  })
}

/** Sorrend megtartva; nem közzétett / törölt kimarad. */
export async function loadCards(
  admin: SupabaseClient,
  tenantId: string,
  ids: string[]
): Promise<StorefrontCard[]> {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return []
  const [{ data, error }, stock] = await Promise.all([
    admin
      .from('storefront_products')
      .select(CARD_SELECT)
      .eq('tenant_id', tenantId)
      .in('id', unique)
      .eq('sellable_web', true)
      .eq('active', true)
      .is('deleted_at', null)
      .not('web_slug', 'is', null),
    getAccessoriesOnHandMap(admin, tenantId, unique).catch((e) => {
      console.error('loadCards stock', e)
      return new Map<string, number>()
    })
  ])
  if (error) {
    console.error('loadCards', error.message)
    return []
  }
  const byId = new Map<string, StorefrontCard>()
  for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
    const id = String(row.id)
    const qty = stock.get(id) ?? 0
    const priceGross = grossFromNet(Number(row.price_net), vatOf(row))
    byId.set(id, {
      id,
      slug: String(row.web_slug).trim().toLowerCase(),
      title: titleOf(row),
      imageUrl: imageOf(row),
      priceGross,
      inStock: qty > 0,
      stockQty: qty,
      unitPrice: unitPriceOf(row, priceGross)
    })
  }
  return unique.map((id) => byId.get(id)).filter((c): c is StorefrontCard => c != null)
}

// ---------------------------------------------------------------------------
// Keresés
// ---------------------------------------------------------------------------

export async function searchCatalog(
  admin: SupabaseClient,
  tenantId: string,
  q: string,
  opts: { limit?: number; offset?: number } = {}
): Promise<{ items: StorefrontCard[]; total: number }> {
  const term = q.trim().slice(0, 120)
  if (!term) return { items: [], total: 0 }
  const limit = opts.limit ?? CATALOG_PAGE_SIZE
  const offset = opts.offset ?? 0
  const chunks: { offset: number; limit: number }[] = []
  for (let o = 0; o < limit; o += SEARCH_RPC_MAX) {
    chunks.push({ offset: offset + o, limit: Math.min(SEARCH_RPC_MAX, limit - o) })
  }
  const results = await Promise.all(
    chunks.map((c) =>
      admin.rpc('storefront_search', {
        p_tenant_id: tenantId,
        p_q: term,
        p_limit: c.limit,
        p_offset: c.offset
      })
    )
  )
  const failed = results.find((r) => r.error)
  if (failed?.error) {
    console.error('searchCatalog', failed.error.message)
    return { items: [], total: 0 }
  }
  const rows = results.flatMap(
    (r) => (r.data ?? []) as { accessory_id: string; total_count: number }[]
  )
  const items = await loadCards(
    admin,
    tenantId,
    rows.map((r) => r.accessory_id)
  )
  return { items, total: Number(rows[0]?.total_count ?? 0) }
}

// ---------------------------------------------------------------------------
// Kategória lista + szűrők
// ---------------------------------------------------------------------------

type AttrMeta = {
  id: string
  name: string
  code: string
  valueType: string
  unit: string | null
}

function facetParam(attr: AttrMeta): string {
  return slugifyHu(attr.code || attr.name) || attr.id.slice(0, 8)
}

function numKey(n: number): string {
  return String(Math.round(n * 1000) / 1000)
}

async function loadTemplateAttrs(
  admin: SupabaseClient,
  tenantId: string,
  categories: StorefrontCategory[],
  categoryId: string
): Promise<{ items: CategoryTemplateItem[]; attrs: Map<string, AttrMeta> }> {
  const [tplRes, attrRes, catRes] = await Promise.all([
    admin
      .from('web_category_attributes')
      .select('category_id, attribute_id, role, sort_order')
      .eq('tenant_id', tenantId),
    admin
      .from('product_attributes')
      .select('id, name, code, value_type, unit')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .is('deleted_at', null),
    admin
      .from('web_categories')
      .select('id, measure_image_url')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
  ])
  if (tplRes.error) console.error('loadTemplateAttrs tpl', tplRes.error.message)
  if (attrRes.error) console.error('loadTemplateAttrs attrs', attrRes.error.message)

  const byCat = new Map<string, CategoryTemplateItem[]>()
  for (const t of (tplRes.data ?? []) as Record<string, unknown>[]) {
    const list = byCat.get(String(t.category_id)) ?? []
    list.push({
      attributeId: String(t.attribute_id),
      role: t.role === 'spec' ? 'spec' : 'key',
      sortOrder: Number(t.sort_order ?? 100)
    })
    byCat.set(String(t.category_id), list)
  }
  const measure = new Map(
    ((catRes.data ?? []) as { id: string; measure_image_url: string | null }[]).map(
      (c) => [c.id, c.measure_image_url]
    )
  )
  const resolved = resolveCategoryTemplate(
    categories.map((c) => ({
      id: c.id,
      name: c.name,
      parentId: c.parentId,
      measureImageUrl: measure.get(c.id) ?? null,
      template: byCat.get(c.id) ?? []
    })),
    categoryId
  )

  const attrs = new Map<string, AttrMeta>()
  for (const a of (attrRes.data ?? []) as Record<string, unknown>[]) {
    attrs.set(String(a.id), {
      id: String(a.id),
      name: String(a.name),
      code: String(a.code ?? ''),
      valueType: String(a.value_type ?? 'list'),
      unit: (a.unit as string | null) ?? null
    })
  }
  return { items: sortTemplate(resolved.items), attrs }
}

async function loadReviewStats(
  admin: SupabaseClient,
  tenantId: string,
  ids: string[]
): Promise<Map<string, { count: number; sum: number }>> {
  const out = new Map<string, { count: number; sum: number }>()
  if (ids.length === 0) return out
  const { data, error } = await fetchByIds<{ accessory_id: string; rating: number }>(
    ids,
    (chunk, from, to) =>
      admin
        .from('product_reviews')
        .select('accessory_id, rating')
        .eq('tenant_id', tenantId)
        .eq('status', 'approved')
        .is('deleted_at', null)
        .in('accessory_id', chunk)
        .order('id', { ascending: true })
        .range(from, to),
    10000
  )
  if (error) {
    console.error('listCategoryProducts reviews', error)
    return out
  }
  for (const r of data) {
    const s = out.get(r.accessory_id) ?? { count: 0, sum: 0 }
    s.count += 1
    s.sum += Number(r.rating)
    out.set(r.accessory_id, s)
  }
  return out
}

type Member = {
  id: string
  slug: string
  title: string
  imageUrl: string | null
  priceGross: number
  unitPrice: string | null
  qty: number
  createdAt: number
  groupKey: string
  isPart: boolean
}

type Filters = {
  attrs: Map<string, string>
  inStock: boolean
  priceMin: number | null
  priceMax: number | null
}

type Skip = { attr?: string; inStock?: boolean; price?: boolean }

export type CatalogRelax = { label: string; count: number; patch: CatalogParams }

/** A szűrt (vagy teljes) lista tényei — ténymondat, GYIK, meta leírás (doc 40 §3h). */
export type CategorySummary = {
  total: number
  inStock: number
  priceMin: number | null
  priceMax: number | null
  facets: {
    param: string
    name: string
    values: { value: string; label: string; count: number }[]
  }[]
}

/** Két fő jellemző metszete (pl. Méret × Szín): hány termékcsoport van az adott párosban. */
export type CategoryMatrix = {
  row: { param: string; name: string; values: { value: string; label: string }[] }
  col: { param: string; name: string; values: { value: string; label: string }[] }
  cells: Record<string, number>
}

/** Útvonalas szűrőoldal (/bolt/k/<kategória>/<érték>). */
export type CatalogPreset = { param: string; value: string; name: string; label: string }

/** Egyértékű szűrőoldal csak ennyi termékcsoporttól indexelhető. */
export const FACET_PAGE_MIN = 6
const MATRIX_MAX_ROWS = 24
const MATRIX_MAX_COLS = 8

export type CategoryListing = {
  items: StorefrontCard[]
  /** Szűrés utáni termékcsoportok száma. */
  total: number
  facets: CatalogFacet[]
  sort: CatalogSort
  sortOptions: CatalogSort[]
  inStockOnly: boolean
  priceMin: number | null
  priceMax: number | null
  priceBounds: { min: number; max: number } | null
  activeCount: number
  /** Üres találatnál: melyik szűrő elhagyása hoz a legtöbb terméket. */
  relax: CatalogRelax[]
  summary: CategorySummary
  matrix: CategoryMatrix | null
  /** Az útvonalból jövő szűrő (ha érvényes). */
  preset: CatalogPreset | null
}

const EMPTY_LISTING: CategoryListing = {
  items: [],
  total: 0,
  facets: [],
  sort: 'ajanlott',
  sortOptions: ['ajanlott'],
  inStockOnly: false,
  priceMin: null,
  priceMax: null,
  priceBounds: null,
  activeCount: 0,
  relax: [],
  summary: { total: 0, inStock: 0, priceMin: null, priceMax: null, facets: [] },
  matrix: null,
  preset: null
}

async function loadOrderCounts(
  admin: SupabaseClient,
  tenantId: string,
  ids: string[]
): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  if (ids.length === 0) return out
  const { data, error } = await admin.rpc('storefront_order_counts', {
    p_tenant: tenantId,
    p_ids: ids,
    p_days: 180
  })
  if (error) {
    // A 20260550 migráció előtt nincs ilyen függvény — ilyenkor név szerinti sorrend.
    console.error('listCategoryProducts orders', error.message)
    return out
  }
  for (const r of (data ?? []) as { accessory_id: string; order_count: number }[]) {
    out.set(r.accessory_id, Number(r.order_count))
  }
  return out
}

/** Más termék „Tartozék” / „Kell hozzá” kapcsolatában szereplő termékek (a listán hátra kerülnek). */
async function loadRelatedPartIds(
  admin: SupabaseClient,
  tenantId: string,
  ids: string[]
): Promise<Set<string>> {
  const { data, error } = await fetchByIds<{ related_id: string }>(ids, (chunk, from, to) =>
    admin
      .from('accessory_related')
      .select('related_id')
      .eq('tenant_id', tenantId)
      .in('related_id', chunk)
      .in('kind', ['accessory', 'required'])
      .order('related_id', { ascending: true })
      .range(from, to)
  )
  if (error) console.error('listCategoryProducts parts', error)
  return new Set(data.map((r) => r.related_id))
}

/** A csoport közös név-eleje vesszőig: „RiexTouch XH35 fogantyú, 96 mm, fekete” → „RiexTouch XH35 fogantyú”. */
function modelTitle(group: { title: string }[]): string | null {
  if (group.length < 2) return null
  const split = group.map((m) => m.title.split(/,\s*/))
  const first = split[0]!
  let n = 0
  while (n < first.length - 1 && split.every((s) => s.length > n + 1 && s[n] === first[n])) n++
  return n > 0 ? first.slice(0, n).join(', ') : null
}

/** „96 mm”, „128 mm” … → „96 · 128 · 160 mm”; sok értéknél „96–1120 mm”. */
function valueListLabel(labels: string[]): string {
  const unit = /^[\d.,\s]+\s+(\S+)$/.exec(labels[0] ?? '')?.[1]
  const sameUnit = unit != null && labels.every((l) => l.endsWith(` ${unit}`) && /^[\d.,\s]+\s/.test(l))
  const bare = sameUnit ? labels.map((l) => l.slice(0, -(unit!.length + 1)).trim()) : labels
  if (labels.length > SPEC_LIST_MAX) {
    return sameUnit
      ? `${bare[0]}–${bare[bare.length - 1]} ${unit}`
      : `${labels.length} féle`
  }
  return sameUnit ? `${bare.join(' · ')} ${unit}` : bare.join(' · ')
}

/**
 * Egy variánscsoport (web_group_id) = egy kártya; a képviselő a szűrőknek
 * megfelelő, raktáron lévő, legolcsóbb tag. `page` kumulatív (első page×24).
 */
export async function listCategoryProducts(
  admin: SupabaseClient,
  tenantId: string,
  categories: StorefrontCategory[],
  category: StorefrontCategory,
  params: CatalogParams,
  page: number,
  opts: {
    reviewsEnabled: boolean
    /** Útvonalas szűrőérték (bármelyik szűrő értékkulcsa, pl. „128-mm”). */
    facetValue?: string | null
    /** „Ajánlott” sorrend rendelésszámmal (a darabszám-API-nak nem kell). */
    withOrders?: boolean
  }
): Promise<CategoryListing> {
  const catIds = descendantIds(categories, category.id)
  const { data, error } = await fetchAllPages<Record<string, unknown>>(
    (from, to) =>
      admin
        .from('storefront_products')
        .select(
          'id, name, web_title, web_slug, web_group_id, image_url, price_net, created_at, web_net_quantity, web_net_unit, web_multipack, tax_rates ( rate_percent )'
        )
        .eq('tenant_id', tenantId)
        .in('web_category_id', catIds)
        .eq('sellable_web', true)
        .eq('active', true)
        .is('deleted_at', null)
        .not('web_slug', 'is', null)
        .order('id', { ascending: true })
        .range(from, to),
    MAX_CATEGORY_SCAN,
    3
  )
  if (error) {
    console.error('listCategoryProducts', error)
    if (data.length === 0) return EMPTY_LISTING
  }
  const rows = data
  const ids = rows.map((r) => String(r.id))

  const groupCodes = rows
    .map((r) => (typeof r.web_group_id === 'string' ? r.web_group_id : ''))
    .filter(Boolean)
  const [stock, { items: template, attrs }, reviews, groupPrefs, orders, relatedParts] = await Promise.all([
    getAccessoriesOnHandMap(admin, tenantId, ids).catch((e) => {
      console.error('listCategoryProducts stock', e)
      return new Map<string, number>()
    }),
    loadTemplateAttrs(admin, tenantId, categories, category.id),
    opts.reviewsEnabled
      ? loadReviewStats(admin, tenantId, ids)
      : Promise.resolve(new Map<string, { count: number; sum: number }>()),
    loadVariantGroupPrefs(admin, tenantId, groupCodes),
    opts.withOrders ? loadOrderCounts(admin, tenantId, ids) : Promise.resolve(new Map<string, number>()),
    loadRelatedPartIds(admin, tenantId, ids)
  ])

  const members: Member[] = rows.map((r) => {
    const id = String(r.id)
    const created = Date.parse(String(r.created_at ?? ''))
    const priceGross = grossFromNet(Number(r.price_net), vatOf(r))
    return {
      id,
      slug: String(r.web_slug).trim().toLowerCase(),
      title: titleOf(r),
      imageUrl: imageOf(r),
      priceGross,
      unitPrice: unitPriceOf(r, priceGross),
      qty: stock.get(id) ?? 0,
      createdAt: Number.isFinite(created) ? created : 0,
      groupKey: typeof r.web_group_id === 'string' && r.web_group_id ? r.web_group_id : id,
      isPart: relatedParts.has(id)
    }
  })
  const byName = members.filter((m) => PART_NAME_RE.test(m.title))
  if (byName.length > 0 && byName.length <= members.length * PART_NAME_MAX_SHARE) {
    for (const m of byName) m.isPart = true
  }

  const facetAttrs = template
    .map((t) => attrs.get(t.attributeId))
    .filter(
      (a): a is AttrMeta =>
        a != null && (a.valueType === 'number' || a.valueType === 'list')
    )
    .slice(0, MAX_FACETS)
  const facetIds = new Set(facetAttrs.map((a) => a.id))
  const specAttrIds = template
    .filter((t) => t.role === 'key' && facetIds.has(t.attributeId))
    .map((t) => t.attributeId)

  const values = new Map<string, Map<string, Set<string>>>()
  const labels = new Map<string, Map<string, { label: string; sort: number }>>()
  if (facetAttrs.length > 0 && ids.length > 0) {
    const attrIds = facetAttrs.map((a) => a.id)
    const [inputsRes, linksRes] = await Promise.all([
      fetchByIds<Record<string, unknown>>(ids, (chunk, from, to) =>
        admin
          .from('accessory_attribute_inputs')
          .select('accessory_id, attribute_id, value_num')
          .eq('tenant_id', tenantId)
          .in('accessory_id', chunk)
          .in('attribute_id', attrIds)
          .order('accessory_id', { ascending: true })
          .order('attribute_id', { ascending: true })
          .range(from, to)
      ),
      fetchByIds<Record<string, unknown>>(ids, (chunk, from, to) =>
        admin
          .from('accessory_attribute_values')
          .select('accessory_id, attribute_values ( id, attribute_id, label, sort_order, deleted_at )')
          .eq('tenant_id', tenantId)
          .in('accessory_id', chunk)
          .order('accessory_id', { ascending: true })
          .order('attribute_value_id', { ascending: true })
          .range(from, to)
      )
    ])
    if (inputsRes.error || linksRes.error) {
      console.error('listCategoryProducts facets', inputsRes.error ?? linksRes.error)
    }
    const put = (accId: string, attrId: string, key: string) => {
      const m = values.get(accId) ?? new Map<string, Set<string>>()
      const s = m.get(attrId) ?? new Set<string>()
      s.add(key)
      m.set(attrId, s)
      values.set(accId, m)
    }
    for (const r of (inputsRes.data ?? []) as Record<string, unknown>[]) {
      if (r.value_num == null) continue
      const n = Number(r.value_num)
      if (!Number.isFinite(n)) continue
      const attrId = String(r.attribute_id)
      const key = numKey(n)
      put(String(r.accessory_id), attrId, key)
      const lm = labels.get(attrId) ?? new Map()
      lm.set(key, {
        label: formatSpecNumber(n, attrs.get(attrId)?.unit ?? null),
        sort: n
      })
      labels.set(attrId, lm)
    }
    for (const r of (linksRes.data ?? []) as Record<string, unknown>[]) {
      const av = (Array.isArray(r.attribute_values)
        ? r.attribute_values[0]
        : r.attribute_values) as {
        attribute_id?: string
        label?: string
        sort_order?: number
        deleted_at?: string | null
      } | null
      if (!av?.attribute_id || !av.label || av.deleted_at) continue
      if (!facetIds.has(av.attribute_id)) continue
      const key = slugifyHu(av.label)
      put(String(r.accessory_id), av.attribute_id, key)
      const lm = labels.get(av.attribute_id) ?? new Map()
      lm.set(key, { label: av.label, sort: Number(av.sort_order ?? 100) })
      labels.set(av.attribute_id, lm)
    }
  }

  const filters: Filters = {
    attrs: new Map(),
    inStock: params[CATALOG_PARAM.inStock] === '1',
    priceMin: parsePriceParam(params[CATALOG_PARAM.priceMin]),
    priceMax: parsePriceParam(params[CATALOG_PARAM.priceMax])
  }
  for (const a of facetAttrs) {
    const v = params[facetParam(a)]?.trim()
    if (v) filters.attrs.set(a.id, v)
  }
  let preset: CatalogPreset | null = null
  const wanted = opts.facetValue?.trim().toLowerCase()
  if (wanted) {
    const a = facetAttrs.find((x) => labels.get(x.id)?.has(wanted))
    if (a) {
      filters.attrs.set(a.id, wanted)
      preset = {
        param: facetParam(a),
        value: wanted,
        name: a.name,
        label: labels.get(a.id)!.get(wanted)!.label
      }
    }
  }

  const memberOk = (m: Member, skip: Skip = {}) => {
    if (filters.inStock && !skip.inStock && m.qty <= 0) return false
    if (!skip.price) {
      if (filters.priceMin != null && m.priceGross < filters.priceMin) return false
      if (filters.priceMax != null && m.priceGross > filters.priceMax) return false
    }
    for (const [attrId, want] of filters.attrs) {
      if (attrId === skip.attr) continue
      if (!values.get(m.id)?.get(attrId)?.has(want)) return false
    }
    return true
  }

  const groups = new Map<string, Member[]>()
  for (const m of members) {
    const list = groups.get(m.groupKey) ?? []
    list.push(m)
    groups.set(m.groupKey, list)
  }
  const groupList = [...groups.values()]
  const countGroups = (skip: Skip) =>
    groupList.reduce((n, g) => (g.some((m) => memberOk(m, skip)) ? n + 1 : n), 0)

  const facets: CatalogFacet[] = facetAttrs
    .map((a) => {
      const counts = new Map<string, number>()
      for (const g of groupList) {
        const keys = new Set<string>()
        for (const m of g) {
          if (!memberOk(m, { attr: a.id })) continue
          for (const key of values.get(m.id)?.get(a.id) ?? []) keys.add(key)
        }
        for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1)
      }
      const lm = labels.get(a.id) ?? new Map<string, { label: string; sort: number }>()
      return {
        param: facetParam(a),
        name: a.name,
        values: [...lm.entries()]
          .map(([value, meta]) => ({
            value,
            label: meta.label,
            count: counts.get(value) ?? 0,
            selected: filters.attrs.get(a.id) === value,
            sort: meta.sort
          }))
          .sort((x, y) => x.sort - y.sort || x.label.localeCompare(y.label, 'hu'))
          .map(({ value, label, count, selected }) => ({ value, label, count, selected }))
      }
    })
    .filter((f) => f.values.length > 1 || f.values.some((v) => v.selected))

  const ratingOf = (g: Member[]) => {
    let count = 0
    let sum = 0
    for (const m of g) {
      const s = reviews.get(m.id)
      if (s) {
        count += s.count
        sum += s.sum
      }
    }
    return count > 0 ? { average: sum / count, count } : null
  }

  const matched = groupList
    .map((g) => {
      const ok = g.filter((m) => memberOk(m))
      if (ok.length === 0) return null
      const mainId = groupPrefs.get(g[0]!.groupKey.toLowerCase())?.mainAccessoryId
      const main = mainId ? ok.find((m) => m.id === mainId && m.qty > 0) : undefined
      const rep = main ?? [...ok].sort(
        (a, b) =>
          Number(b.qty > 0) - Number(a.qty > 0) ||
          a.priceGross - b.priceGross ||
          a.title.localeCompare(b.title, 'hu')
      )[0]!
      return {
        group: g,
        ok,
        rep,
        newest: Math.max(...g.map((m) => m.createdAt)),
        rating: ratingOf(g),
        orders: g.reduce((n, m) => n + (orders.get(m.id) ?? 0), 0),
        isPart: g.every((m) => m.isPart)
      }
    })
    .filter((x): x is NonNullable<typeof x> => x != null)

  const hasReviews = matched.some((m) => m.rating != null)
  const sortOptions: CatalogSort[] = ['ajanlott', 'ar-nov', 'ar-csokk', 'uj']
  if (hasReviews) sortOptions.push('ertekeles')
  const requested = parseCatalogSort(params[CATALOG_PARAM.sort])
  const sort = sortOptions.includes(requested) ? requested : 'ajanlott'

  const byTitle = (a: (typeof matched)[number], b: (typeof matched)[number]) =>
    a.rep.title.localeCompare(b.rep.title, 'hu')
  const inStockFirst = (a: (typeof matched)[number], b: (typeof matched)[number]) =>
    Number(b.rep.qty > 0) - Number(a.rep.qty > 0)
  matched.sort((a, b) => {
    switch (sort) {
      case 'ar-nov':
        return a.rep.priceGross - b.rep.priceGross || byTitle(a, b)
      case 'ar-csokk':
        return b.rep.priceGross - a.rep.priceGross || byTitle(a, b)
      case 'uj':
        return b.newest - a.newest || byTitle(a, b)
      case 'ertekeles':
        return (
          (b.rating?.average ?? 0) - (a.rating?.average ?? 0) ||
          (b.rating?.count ?? 0) - (a.rating?.count ?? 0) ||
          inStockFirst(a, b) ||
          byTitle(a, b)
        )
      default:
        return (
          Number(a.isPart) - Number(b.isPart) ||
          inStockFirst(a, b) ||
          b.orders - a.orders ||
          byTitle(a, b)
        )
    }
  })

  const summaryFacets: CategorySummary['facets'] = facetAttrs
    .map((a) => {
      const counts = new Map<string, number>()
      for (const x of matched) {
        const keys = new Set<string>()
        for (const m of x.ok) for (const key of values.get(m.id)?.get(a.id) ?? []) keys.add(key)
        for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1)
      }
      const lm = labels.get(a.id) ?? new Map<string, { label: string; sort: number }>()
      return {
        param: facetParam(a),
        name: a.name,
        values: [...counts.entries()]
          .map(([value, count]) => ({ value, count, label: lm.get(value)?.label ?? value, sort: lm.get(value)?.sort ?? 0 }))
          .sort((x, y) => x.sort - y.sort || x.label.localeCompare(y.label, 'hu'))
          .map(({ value, label, count }) => ({ value, label, count }))
      }
    })
    .filter((f) => f.values.length > 0)
  const mainMatched = matched.some((x) => !x.isPart) ? matched.filter((x) => !x.isPart) : matched
  const okPrices = mainMatched.flatMap((x) => x.ok.map((m) => m.priceGross))
  const summary: CategorySummary = {
    total: matched.length,
    inStock: matched.filter((x) => x.ok.some((m) => m.qty > 0)).length,
    priceMin: okPrices.length > 0 ? Math.min(...okPrices) : null,
    priceMax: okPrices.length > 0 ? Math.max(...okPrices) : null,
    facets: summaryFacets
  }

  let matrix: CategoryMatrix | null = null
  const axes = summaryFacets.filter((f) => f.values.length >= 2)
  const rowF = axes[0]
  const colF = axes[1]
  if (rowF && colF && rowF.values.length <= MATRIX_MAX_ROWS && colF.values.length <= MATRIX_MAX_COLS) {
    const rowAttr = facetAttrs.find((a) => facetParam(a) === rowF.param)!
    const colAttr = facetAttrs.find((a) => facetParam(a) === colF.param)!
    const cells: Record<string, number> = {}
    for (const x of matched) {
      const pairs = new Set<string>()
      for (const m of x.ok) {
        for (const r of values.get(m.id)?.get(rowAttr.id) ?? []) {
          for (const c of values.get(m.id)?.get(colAttr.id) ?? []) pairs.add(`${r}|${c}`)
        }
      }
      for (const p of pairs) cells[p] = (cells[p] ?? 0) + 1
    }
    const strip = (f: CategorySummary['facets'][number]) => ({
      param: f.param,
      name: f.name,
      values: f.values.map(({ value, label }) => ({ value, label }))
    })
    matrix = { row: strip(rowF), col: strip(colF), cells }
  }

  const colorAttr =
    facetAttrs.find((a) => a.code.toLowerCase() === 'color' || slugifyHu(a.name) === 'szin') ?? null

  /** A csoport értékei egy jellemzőre, sablon-sorrendben. */
  const groupLabels = (group: Member[], attrId: string): string[] => {
    const keys = new Set<string>()
    for (const m of group) for (const k of values.get(m.id)?.get(attrId) ?? []) keys.add(k)
    const lm = labels.get(attrId)
    return [...keys]
      .map((k) => lm?.get(k) ?? { label: k, sort: 0 })
      .sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label, 'hu'))
      .map((x) => x.label)
  }

  const swatchesOf = (group: Member[]) => {
    if (!colorAttr) return null
    const names = groupLabels(group, colorAttr.id)
    if (names.length < 2) return null
    const all = names.map((label) => ({ label, color: swatchColor(label) }))
    if (all.some((s) => s.color == null)) return null
    return {
      swatches: all.slice(0, SWATCH_MAX) as { label: string; color: string }[],
      more: Math.max(0, all.length - SWATCH_MAX)
    }
  }

  /** 1–2 kulcsadat: közös érték („matt fekete”) vagy a csoport kínálata („96 · 128 · 160 mm”). */
  const specLineOf = (group: Member[], skipAttr: string | null) => {
    const parts: string[] = []
    let varies = false
    for (const attrId of specAttrIds) {
      if (parts.length >= MAX_SPEC_LINE) break
      if (attrId === skipAttr) continue
      const list = groupLabels(group, attrId)
      if (list.length === 0) continue
      if (list.length === 1) {
        if (group.every((m) => (values.get(m.id)?.get(attrId)?.size ?? 0) > 0)) parts.push(list[0]!)
        continue
      }
      varies = true
      parts.push(valueListLabel(list))
    }
    return { line: parts.length > 0 ? parts.join(' · ') : null, varies }
  }

  const variantLabelOf = (group: Member[]) => {
    if (group.length < 2) return null
    const axes = facetAttrs.filter((a) => {
      const seen = new Set(group.map((m) => [...(values.get(m.id)?.get(a.id) ?? [])].join('|')))
      return seen.size > 1
    })
    const axis = axes.length === 1 ? axes[0]!.name.trim().toLowerCase() : ''
    return axis && axis.length <= 12 ? `${group.length} ${axis}` : `${group.length} változat`
  }

  const newSince = Date.now() - NEW_BADGE_DAYS * 86_400_000
  const newCount = matched.filter((m) => m.newest >= newSince).length
  const showNew = newCount > 0 && newCount <= matched.length / 3
  const popular = new Set(
    matched.length >= POPULAR_MIN_GROUPS
      ? [...matched]
          .filter((x) => x.orders >= POPULAR_MIN_ORDERS && !x.isPart)
          .sort((a, b) => b.orders - a.orders)
          .slice(0, POPULAR_TOP)
          .map((x) => x.rep.id)
      : []
  )

  const safePage = Math.max(1, page)
  const items: StorefrontCard[] = matched
    .slice(0, safePage * CATALOG_PAGE_SIZE)
    .map(({ rep, group, ok, rating, newest }) => {
      const sw = swatchesOf(group)
      const spec = specLineOf(group, sw ? colorAttr!.id : null)
      const cheapest = ok.reduce((a, b) => (b.priceGross < a.priceGross ? b : a), ok[0]!)
      const priceFrom = ok.some((m) => m.priceGross !== cheapest.priceGross)
      return {
        id: rep.id,
        slug: rep.slug,
        title: modelTitle(group) ?? rep.title,
        imageUrl: rep.imageUrl,
        priceGross: priceFrom ? cheapest.priceGross : rep.priceGross,
        priceFrom,
        inStock: rep.qty > 0,
        stockQty: rep.qty,
        specLine: spec.line,
        variantLabel: sw || spec.varies ? null : variantLabelOf(group),
        swatches: sw?.swatches,
        swatchMore: sw?.more,
        rating,
        badge: popular.has(rep.id) ? 'Népszerű' : showNew && newest >= newSince ? 'Új' : null,
        unitPrice: priceFrom ? cheapest.unitPrice : rep.unitPrice
      }
    })

  if (opts.withOrders) {
    const soldOut = items.filter((c) => !c.inStock).map((c) => c.id)
    const arrivals = await loadExpectedArrivals(admin, tenantId, soldOut)
    for (const c of items) if (!c.inStock) c.arrival = arrivals.get(c.id) ?? null
  }

  const priced = members.filter((m) => memberOk(m, { price: true })).map((m) => m.priceGross)
  const priceBounds =
    priced.length > 0
      ? { min: Math.floor(Math.min(...priced)), max: Math.ceil(Math.max(...priced)) }
      : null

  const facetById = new Map(facetAttrs.map((a) => [a.id, a]))
  const relax: CatalogRelax[] = []
  for (const [attrId, value] of filters.attrs) {
    const a = facetById.get(attrId)
    if (!a) continue
    relax.push({
      label: `${a.name}: ${labels.get(attrId)?.get(value)?.label ?? value}`,
      count: countGroups({ attr: attrId }),
      patch: { [facetParam(a)]: undefined }
    })
  }
  if (filters.inStock) {
    relax.push({
      label: 'Csak raktáron',
      count: countGroups({ inStock: true }),
      patch: { [CATALOG_PARAM.inStock]: undefined }
    })
  }
  if (filters.priceMin != null || filters.priceMax != null) {
    relax.push({
      label: 'Ár',
      count: countGroups({ price: true }),
      patch: { [CATALOG_PARAM.priceMin]: undefined, [CATALOG_PARAM.priceMax]: undefined }
    })
  }

  return {
    items,
    total: matched.length,
    facets,
    sort,
    sortOptions,
    inStockOnly: filters.inStock,
    priceMin: filters.priceMin,
    priceMax: filters.priceMax,
    priceBounds,
    activeCount: relax.length,
    relax: relax.filter((r) => r.count > 0).sort((a, b) => b.count - a.count),
    summary,
    matrix,
    preset
  }
}

// ---------------------------------------------------------------------------
// PDP: kapcsolódó termékek és „Hasonló”
// ---------------------------------------------------------------------------

export type RelatedCards = {
  required: StorefrontCard[]
  accessory: StorefrontCard[]
  alternative: StorefrontCard[]
  largerPack: StorefrontCard[]
  /** Fordított irány: termékek, amelyeknek ez tartozéka / kelléke. */
  accessoryOf: StorefrontCard[]
}

export const EMPTY_RELATED_CARDS: RelatedCards = {
  required: [],
  accessory: [],
  alternative: [],
  largerPack: [],
  accessoryOf: []
}

const RELATED_PER_KIND = 8

export async function loadRelatedCards(
  admin: SupabaseClient,
  tenantId: string,
  accessoryId: string
): Promise<RelatedCards> {
  const [out, inc] = await Promise.all([
    admin
      .from('accessory_related')
      .select('related_id, kind, sort_order')
      .eq('tenant_id', tenantId)
      .eq('accessory_id', accessoryId)
      .order('sort_order', { ascending: true })
      .limit(RELATED_PER_KIND * 4),
    admin
      .from('accessory_related')
      .select('accessory_id')
      .eq('tenant_id', tenantId)
      .eq('related_id', accessoryId)
      .in('kind', ['accessory', 'required'])
      .limit(RELATED_PER_KIND)
  ])
  if (out.error || inc.error) {
    console.error('loadRelatedCards', out.error?.message ?? inc.error?.message)
    return EMPTY_RELATED_CARDS
  }
  const outRows = (out.data ?? []) as { related_id: string; kind: string }[]
  const incIds = ((inc.data ?? []) as { accessory_id: string }[]).map((r) => r.accessory_id)
  const cards = await loadCards(admin, tenantId, [...outRows.map((r) => r.related_id), ...incIds])
  const byId = new Map(cards.map((c) => [c.id, c]))
  const pick = (kind: string) =>
    outRows
      .filter((r) => r.kind === kind)
      .map((r) => byId.get(r.related_id))
      .filter((c): c is StorefrontCard => c != null)
      .slice(0, RELATED_PER_KIND)
  return {
    required: pick('required'),
    accessory: pick('accessory'),
    alternative: pick('alternative'),
    largerPack: pick('larger_pack'),
    accessoryOf: incIds.map((id) => byId.get(id)).filter((c): c is StorefrontCard => c != null)
  }
}

/** Azonos kategória; ha van fő kulcsadat (szám), a legközelebbi értékek elöl. */
export async function loadSimilarCards(
  admin: SupabaseClient,
  tenantId: string,
  opts: {
    categoryId: string | null
    excludeIds: string[]
    primaryAttributeId: string | null
    primaryValue: number | null
    limit?: number
  }
): Promise<StorefrontCard[]> {
  if (!opts.categoryId) return []
  const { data, error } = await admin
    .from('storefront_products')
    .select('id, web_group_id')
    .eq('tenant_id', tenantId)
    .eq('web_category_id', opts.categoryId)
    .eq('sellable_web', true)
    .eq('active', true)
    .is('deleted_at', null)
    .not('web_slug', 'is', null)
    .limit(200)
  if (error) {
    console.error('loadSimilarCards', error.message)
    return []
  }
  const exclude = new Set(opts.excludeIds)
  let ids = ((data ?? []) as { id: string }[])
    .map((r) => r.id)
    .filter((id) => !exclude.has(id))

  if (opts.primaryAttributeId && opts.primaryValue != null && ids.length > 0) {
    const attributeId = opts.primaryAttributeId
    const { data: inputs } = await fetchByIds<{ accessory_id: string; value_num: number | null }>(
      ids,
      (chunk, from, to) =>
        admin
          .from('accessory_attribute_inputs')
          .select('accessory_id, value_num')
          .eq('tenant_id', tenantId)
          .eq('attribute_id', attributeId)
          .in('accessory_id', chunk)
          .order('accessory_id', { ascending: true })
          .range(from, to)
    )
    const dist = new Map<string, number>()
    for (const r of inputs) {
      if (r.value_num == null) continue
      dist.set(r.accessory_id, Math.abs(Number(r.value_num) - opts.primaryValue))
    }
    ids = [...ids].sort(
      (a, b) => (dist.get(a) ?? Infinity) - (dist.get(b) ?? Infinity)
    )
  }
  return loadCards(admin, tenantId, ids.slice(0, opts.limit ?? 4))
}
