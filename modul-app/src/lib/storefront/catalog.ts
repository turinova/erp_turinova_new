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
import {
  formatSpecNumber,
  resolveCategoryTemplate,
  sortTemplate
} from '@/lib/webshop/key-specs'
import type { CategoryTemplateItem } from '@/lib/webshop/types'

export { CATALOG_PAGE_SIZE }

const MAX_CATEGORY_SCAN = 1000
const MAX_FACETS = 6
const MAX_SPEC_LINE = 2
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
  const { data, error } = await admin
    .from('product_reviews')
    .select('accessory_id, rating')
    .eq('tenant_id', tenantId)
    .eq('status', 'approved')
    .is('deleted_at', null)
    .in('accessory_id', ids)
    .limit(10000)
  if (error) {
    console.error('listCategoryProducts reviews', error.message)
    return out
  }
  for (const r of (data ?? []) as { accessory_id: string; rating: number }[]) {
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
}

type Filters = {
  attrs: Map<string, string>
  inStock: boolean
  priceMin: number | null
  priceMax: number | null
}

type Skip = { attr?: string; inStock?: boolean; price?: boolean }

export type CatalogRelax = { label: string; count: number; patch: CatalogParams }

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
  relax: []
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
  opts: { reviewsEnabled: boolean }
): Promise<CategoryListing> {
  const catIds = descendantIds(categories, category.id)
  const { data, error } = await admin
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
    .limit(MAX_CATEGORY_SCAN)
  if (error) {
    console.error('listCategoryProducts', error.message)
    return EMPTY_LISTING
  }
  const rows = (data ?? []) as unknown as Record<string, unknown>[]
  const ids = rows.map((r) => String(r.id))

  const groupCodes = rows
    .map((r) => (typeof r.web_group_id === 'string' ? r.web_group_id : ''))
    .filter(Boolean)
  const [stock, { items: template, attrs }, reviews, groupPrefs] = await Promise.all([
    getAccessoriesOnHandMap(admin, tenantId, ids).catch((e) => {
      console.error('listCategoryProducts stock', e)
      return new Map<string, number>()
    }),
    loadTemplateAttrs(admin, tenantId, categories, category.id),
    opts.reviewsEnabled
      ? loadReviewStats(admin, tenantId, ids)
      : Promise.resolve(new Map<string, { count: number; sum: number }>()),
    loadVariantGroupPrefs(admin, tenantId, groupCodes)
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
      groupKey: typeof r.web_group_id === 'string' && r.web_group_id ? r.web_group_id : id
    }
  })

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
      admin
        .from('accessory_attribute_inputs')
        .select('accessory_id, attribute_id, value_num')
        .eq('tenant_id', tenantId)
        .in('accessory_id', ids)
        .in('attribute_id', attrIds),
      admin
        .from('accessory_attribute_values')
        .select('accessory_id, attribute_values ( id, attribute_id, label, sort_order, deleted_at )')
        .eq('tenant_id', tenantId)
        .in('accessory_id', ids)
    ])
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
        rep,
        newest: Math.max(...g.map((m) => m.createdAt)),
        rating: ratingOf(g)
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
        return inStockFirst(a, b) || byTitle(a, b)
    }
  })

  const specLineOf = (rep: Member, group: Member[]) => {
    const parts: string[] = []
    for (const attrId of specAttrIds) {
      if (parts.length >= MAX_SPEC_LINE) break
      const own = values.get(rep.id)?.get(attrId)
      if (!own || own.size === 0) continue
      const key = [...own][0]!
      if (group.some((m) => !values.get(m.id)?.get(attrId)?.has(key))) continue
      const label = labels.get(attrId)?.get(key)?.label
      if (label) parts.push(label)
    }
    return parts.length > 0 ? parts.join(' · ') : null
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

  const safePage = Math.max(1, page)
  const items: StorefrontCard[] = matched
    .slice(0, safePage * CATALOG_PAGE_SIZE)
    .map(({ rep, group, rating, newest }) => ({
      id: rep.id,
      slug: rep.slug,
      title: rep.title,
      imageUrl: rep.imageUrl,
      priceGross: rep.priceGross,
      inStock: rep.qty > 0,
      stockQty: rep.qty,
      specLine: specLineOf(rep, group),
      variantLabel: variantLabelOf(group),
      rating,
      badge: showNew && newest >= newSince ? 'Új' : null,
      unitPrice: rep.unitPrice
    }))

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
    relax: relax.filter((r) => r.count > 0).sort((a, b) => b.count - a.count)
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
    const { data: inputs } = await admin
      .from('accessory_attribute_inputs')
      .select('accessory_id, value_num')
      .eq('tenant_id', tenantId)
      .eq('attribute_id', opts.primaryAttributeId)
      .in('accessory_id', ids)
    const dist = new Map<string, number>()
    for (const r of (inputs ?? []) as { accessory_id: string; value_num: number | null }[]) {
      if (r.value_num == null) continue
      dist.set(r.accessory_id, Math.abs(Number(r.value_num) - opts.primaryValue))
    }
    ids = [...ids].sort(
      (a, b) => (dist.get(a) ?? Infinity) - (dist.get(b) ?? Infinity)
    )
  }
  return loadCards(admin, tenantId, ids.slice(0, opts.limit ?? 4))
}
