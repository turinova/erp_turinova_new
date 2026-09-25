/**
 * Storefront katalógus: kártyák, keresés, kategória lista kulcsadat-szűrőkkel,
 * „Hasonló” és „Kell hozzá” (doc 40).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { effectiveWebTitle } from '@/lib/accessories/web-shop'
import { grossFromNet } from '@/lib/sheet-materials/parse'
import { descendantIds, type StorefrontCategory } from '@/lib/storefront/shell'
import { slugifyHu } from '@/lib/storefront/url'
import { getAccessoriesOnHandMap } from '@/lib/stock/queries'
import {
  formatSpecNumber,
  resolveCategoryTemplate,
  sortTemplate
} from '@/lib/webshop/key-specs'
import type { CategoryTemplateItem } from '@/lib/webshop/types'

export const CATALOG_PAGE_SIZE = 25
const MAX_CATEGORY_SCAN = 1000

export type StorefrontCard = {
  id: string
  slug: string
  title: string
  imageUrl: string | null
  priceGross: number
  inStock: boolean
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
  tax_rates ( rate_percent )
`

function vatOf(row: Record<string, unknown>): number {
  const tax = Array.isArray(row.tax_rates) ? row.tax_rates[0] : row.tax_rates
  return Number((tax as { rate_percent?: number } | null)?.rate_percent ?? 0)
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
      .from('accessories')
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
    byId.set(id, {
      id,
      slug: String(row.web_slug).trim().toLowerCase(),
      title: effectiveWebTitle({
        web_title: (row.web_title as string | null) ?? null,
        name: String(row.name ?? '')
      }),
      imageUrl:
        typeof row.image_url === 'string' && row.image_url.trim()
          ? row.image_url.trim()
          : null,
      priceGross: grossFromNet(Number(row.price_net), vatOf(row)),
      inStock: (stock.get(id) ?? 0) > 0
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
  const { data, error } = await admin.rpc('storefront_search', {
    p_tenant_id: tenantId,
    p_q: term,
    p_limit: opts.limit ?? CATALOG_PAGE_SIZE,
    p_offset: opts.offset ?? 0
  })
  if (error) {
    console.error('searchCatalog', error.message)
    return { items: [], total: 0 }
  }
  const rows = (data ?? []) as { accessory_id: string; total_count: number }[]
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

type ProductFacetValues = Map<string, Set<string>>

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

export async function listCategoryProducts(
  admin: SupabaseClient,
  tenantId: string,
  categories: StorefrontCategory[],
  category: StorefrontCategory,
  params: Record<string, string | undefined>,
  page: number
): Promise<{ items: StorefrontCard[]; total: number; facets: CatalogFacet[] }> {
  const catIds = descendantIds(categories, category.id)
  const { data, error } = await admin
    .from('accessories')
    .select('id, name, web_title')
    .eq('tenant_id', tenantId)
    .in('web_category_id', catIds)
    .eq('sellable_web', true)
    .eq('active', true)
    .is('deleted_at', null)
    .not('web_slug', 'is', null)
    .limit(MAX_CATEGORY_SCAN)
  if (error) {
    console.error('listCategoryProducts', error.message)
    return { items: [], total: 0, facets: [] }
  }

  const products = ((data ?? []) as Record<string, unknown>[])
    .map((r) => ({
      id: String(r.id),
      title: effectiveWebTitle({
        web_title: (r.web_title as string | null) ?? null,
        name: String(r.name ?? '')
      })
    }))
    .sort((a, b) => a.title.localeCompare(b.title, 'hu'))
  const ids = products.map((p) => p.id)

  const { items: template, attrs } = await loadTemplateAttrs(
    admin,
    tenantId,
    categories,
    category.id
  )
  const facetAttrs = template
    .map((t) => attrs.get(t.attributeId))
    .filter(
      (a): a is AttrMeta =>
        a != null && (a.valueType === 'number' || a.valueType === 'list')
    )
    .slice(0, 6)

  const values = new Map<string, ProductFacetValues>()
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
      if (!attrIds.includes(av.attribute_id)) continue
      const key = slugifyHu(av.label)
      put(String(r.accessory_id), av.attribute_id, key)
      const lm = labels.get(av.attribute_id) ?? new Map()
      lm.set(key, { label: av.label, sort: Number(av.sort_order ?? 100) })
      labels.set(av.attribute_id, lm)
    }
  }

  const selected = new Map<string, string>()
  for (const a of facetAttrs) {
    const v = params[facetParam(a)]?.trim()
    if (v) selected.set(a.id, v)
  }

  const matches = (accId: string, skipAttr?: string) => {
    for (const [attrId, want] of selected) {
      if (attrId === skipAttr) continue
      if (!values.get(accId)?.get(attrId)?.has(want)) return false
    }
    return true
  }

  const facets: CatalogFacet[] = facetAttrs
    .map((a) => {
      const counts = new Map<string, number>()
      for (const id of ids) {
        if (!matches(id, a.id)) continue
        for (const key of values.get(id)?.get(a.id) ?? []) {
          counts.set(key, (counts.get(key) ?? 0) + 1)
        }
      }
      const lm = labels.get(a.id) ?? new Map()
      return {
        param: facetParam(a),
        name: a.name,
        values: [...counts.entries()]
          .map(([value, count]) => ({
            value,
            label: lm.get(value)?.label ?? value,
            count,
            selected: selected.get(a.id) === value,
            sort: lm.get(value)?.sort ?? 0
          }))
          .sort((x, y) => x.sort - y.sort || x.label.localeCompare(y.label, 'hu'))
          .map(({ value, label, count, selected }) => ({ value, label, count, selected }))
      }
    })
    .filter((f) => f.values.length > 1 || f.values.some((v) => v.selected))

  const filtered = ids.filter((id) => matches(id))
  const safePage = Math.max(1, page)
  const pageIds = filtered.slice(
    (safePage - 1) * CATALOG_PAGE_SIZE,
    safePage * CATALOG_PAGE_SIZE
  )
  const items = await loadCards(admin, tenantId, pageIds)
  return { items, total: filtered.length, facets }
}

// ---------------------------------------------------------------------------
// PDP: „Kell hozzá” és „Hasonló”
// ---------------------------------------------------------------------------

export async function loadRequiredCards(
  admin: SupabaseClient,
  tenantId: string,
  accessoryId: string
): Promise<StorefrontCard[]> {
  const { data, error } = await admin
    .from('accessory_related')
    .select('related_id, sort_order')
    .eq('tenant_id', tenantId)
    .eq('accessory_id', accessoryId)
    .order('sort_order', { ascending: true })
    .limit(8)
  if (error) {
    console.error('loadRequiredCards', error.message)
    return []
  }
  return loadCards(
    admin,
    tenantId,
    ((data ?? []) as { related_id: string }[]).map((r) => r.related_id)
  )
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
    .from('accessories')
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
