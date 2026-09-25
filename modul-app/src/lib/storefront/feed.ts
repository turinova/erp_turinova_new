/**
 * Közös termék-feed forrás: Google Merchant XML + OpenAI (ChatGPT) JSONL.
 * Csak az AI-kapun átmenő termékek kerülnek ki (ai-readiness blokkolók nélkül).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import {
  effectiveWebBrand,
  effectiveWebTitle,
  mapAccessoryWebFields,
  WEB_SELECT_COLUMNS
} from '@/lib/accessories/web-shop'
import { grossFromNet } from '@/lib/sheet-materials/parse'
import { categoryChain, type StorefrontShell } from '@/lib/storefront/shell'
import { productPath, siteUrl, STOREFRONT_HOME } from '@/lib/storefront/url'
import { getAccessoriesOnHandMap } from '@/lib/stock/queries'
import { loadExpectedArrivals } from '@/lib/storefront/expected-arrival'
import {
  googleUnitPricing,
  netContentLabel,
  netContentOf
} from '@/lib/storefront/unit-price'
import { fetchAllPages } from '@/lib/supabase/fetch-all'
import { evaluateAiReadiness } from '@/lib/webshop/ai-readiness'
import { formatAttributeValue, resolveCategoryTemplate } from '@/lib/webshop/key-specs'
import { asValueType, mapAttributeInputRow } from '@/lib/webshop/queries'
import type { AttributeInput, CategoryTemplateItem, ProductAttributeRow } from '@/lib/webshop/types'
import { STATUTORY_RETURN_DAYS } from '@/lib/webshop/settings'

const FEED_MAX = 5000
/** Tenant-szintű attribútum sorok felső korlátja (termék × attribútum). */
const ATTR_ROWS_MAX = 100_000

const HIGHLIGHT_MAX = 10
const HIGHLIGHT_LEN = 150
const DETAIL_MAX = 30
const DETAIL_NAME_LEN = 140
const DETAIL_VALUE_LEN = 1000
const DETAIL_SECTION = 'Jellemzők'

export type FeedDetail = { section: string; name: string; value: string }

export type FeedItem = {
  id: string
  title: string
  description: string
  url: string
  brand: string
  imageUrl: string
  additionalImageUrls: string[]
  inStock: boolean
  priceGross: number
  gtin: string | null
  mpn: string | null
  identifierExists: boolean
  groupId: string | null
  hasVariations: boolean
  color: string | null
  size: string | null
  material: string | null
  productCategory: string | null
  googleCategory: string | null
  dimensionsCm: { length: number; width: number; height: number } | null
  weightKg: number | null
  shippingWeightKg: number | null
  shippingDimensionsCm: { length: number; width: number; height: number } | null
  /** Nincs készlet, de van jövőbeli beszállítói dátum (YYYY-MM-DD). */
  availabilityDate: string | null
  highlights: string[]
  details: FeedDetail[]
  multipack: number | null
  isBundle: boolean
  countryOfOrigin: string | null
  unitPricing: { measure: string; base: string } | null
  reviewCount: number
  starRating: number | null
  updatedAt: string | null
}

export type FeedContext = {
  sellerName: string
  sellerUrl: string
  termsUrl: string | null
  privacyUrl: string | null
  returnDays: number
  shippingFeeGross: number | null
  freeShippingThresholdGross: number | null
}

export type FeedResult = {
  ctx: FeedContext
  items: FeedItem[]
  excluded: { id: string; title: string; reasons: string[] }[]
}

const FEED_SELECT = `
  id, name, sku, barcode, image_url, price_net, web_category_id, updated_at,
  ${WEB_SELECT_COLUMNS},
  manufacturers ( name ),
  tax_rates ( rate_percent )
`

function vatOf(row: Record<string, unknown>): number {
  const tax = Array.isArray(row.tax_rates) ? row.tax_rates[0] : row.tax_rates
  return Number((tax as { rate_percent?: number } | null)?.rate_percent ?? 0)
}

function one<T>(v: unknown): T | null {
  return (Array.isArray(v) ? v[0] : v) as T | null
}

type CoverageAttr = Pick<ProductAttributeRow, 'id' | 'name' | 'unit' | 'valueType' | 'sortOrder'>

async function loadKeySpecCoverage(
  admin: SupabaseClient,
  shell: StorefrontShell
): Promise<{
  keyItemsFor: (categoryId: string | null) => CategoryTemplateItem[]
  measureFor: (categoryId: string | null) => string | null
  filled: Map<string, Set<string>>
  numbers: Map<string, Map<string, number>>
  attrMeta: Map<string, CoverageAttr>
  /** Formázott strukturált jellemzők termékenként, attribútum-sorrendben. */
  detailsFor: (accessoryId: string) => { name: string; value: string }[]
}> {
  const tenantId = shell.tenant.id
  const [tplRes, catRes, attrRes, inputsRes, linksRes] = await Promise.all([
    fetchAllPages<Record<string, unknown>>(
      (from, to) =>
        admin
          .from('web_category_attributes')
          .select('category_id, attribute_id, role, sort_order')
          .eq('tenant_id', tenantId)
          .order('category_id', { ascending: true })
          .order('attribute_id', { ascending: true })
          .range(from, to),
      ATTR_ROWS_MAX
    ),
    fetchAllPages<{ id: string; measure_image_url: string | null }>(
      (from, to) =>
        admin
          .from('web_categories')
          .select('id, measure_image_url')
          .eq('tenant_id', tenantId)
          .is('deleted_at', null)
          .order('id', { ascending: true })
          .range(from, to),
      ATTR_ROWS_MAX
    ),
    fetchAllPages<Record<string, unknown>>(
      (from, to) =>
        admin
          .from('product_attributes')
          .select('id, name, unit, value_type, sort_order')
          .eq('tenant_id', tenantId)
          .eq('active', true)
          .is('deleted_at', null)
          .order('id', { ascending: true })
          .range(from, to),
      ATTR_ROWS_MAX
    ),
    fetchAllPages<Record<string, unknown>>(
      (from, to) =>
        admin
          .from('accessory_attribute_inputs')
          .select('accessory_id, attribute_id, value_num, value_max, value_bool')
          .eq('tenant_id', tenantId)
          .order('accessory_id', { ascending: true })
          .order('attribute_id', { ascending: true })
          .range(from, to),
      ATTR_ROWS_MAX
    ),
    fetchAllPages<Record<string, unknown>>(
      (from, to) =>
        admin
          .from('accessory_attribute_values')
          .select('accessory_id, attribute_value_id, attribute_values ( attribute_id, label, sort_order, deleted_at )')
          .eq('tenant_id', tenantId)
          .order('accessory_id', { ascending: true })
          .order('attribute_value_id', { ascending: true })
          .range(from, to),
      ATTR_ROWS_MAX
    )
  ])
  for (const [label, res] of [
    ['tpl', tplRes],
    ['cats', catRes],
    ['attrs', attrRes],
    ['inputs', inputsRes],
    ['links', linksRes]
  ] as const) {
    if (res.error) console.error(`loadKeySpecCoverage ${label}`, res.error)
  }

  const byCat = new Map<string, CategoryTemplateItem[]>()
  for (const t of tplRes.data) {
    const list = byCat.get(String(t.category_id)) ?? []
    list.push({
      attributeId: String(t.attribute_id),
      role: t.role === 'spec' ? 'spec' : 'key',
      sortOrder: Number(t.sort_order ?? 100)
    })
    byCat.set(String(t.category_id), list)
  }
  const measure = new Map(catRes.data.map((c) => [c.id, c.measure_image_url]))
  const nodes = shell.categories.map((c) => ({
    id: c.id,
    name: c.name,
    parentId: c.parentId,
    measureImageUrl: measure.get(c.id) ?? null,
    template: byCat.get(c.id) ?? []
  }))
  const resolved = new Map<string, ReturnType<typeof resolveCategoryTemplate>>()
  const resolve = (id: string | null) => {
    if (!id) return null
    if (!resolved.has(id)) resolved.set(id, resolveCategoryTemplate(nodes, id))
    return resolved.get(id)!
  }

  const attrMeta = new Map<string, CoverageAttr>(
    attrRes.data.map((a) => [
      String(a.id),
      {
        id: String(a.id),
        name: String(a.name),
        unit: (a.unit as string | null) ?? null,
        valueType: asValueType(a.value_type),
        sortOrder: Number(a.sort_order ?? 100)
      }
    ])
  )

  const filled = new Map<string, Set<string>>()
  const numbers = new Map<string, Map<string, number>>()
  const inputs = new Map<string, Map<string, AttributeInput>>()
  const labels = new Map<string, Map<string, { label: string; sort: number }[]>>()
  const mark = (acc: string, attr: string) => {
    const s = filled.get(acc) ?? new Set<string>()
    s.add(attr)
    filled.set(acc, s)
  }
  for (const r of inputsRes.data) {
    if (r.value_num == null && r.value_max == null && r.value_bool == null) continue
    const acc = String(r.accessory_id)
    const input = mapAttributeInputRow(r)
    mark(acc, input.attributeId)
    const byAttr = inputs.get(acc) ?? new Map<string, AttributeInput>()
    byAttr.set(input.attributeId, input)
    inputs.set(acc, byAttr)
    if (input.valueNum != null) {
      const m = numbers.get(acc) ?? new Map<string, number>()
      m.set(input.attributeId, input.valueNum)
      numbers.set(acc, m)
    }
  }
  for (const r of linksRes.data) {
    const av = one<{ attribute_id?: string; label?: string; sort_order?: number; deleted_at?: string | null }>(
      r.attribute_values
    )
    if (!av?.attribute_id || av.deleted_at) continue
    const acc = String(r.accessory_id)
    mark(acc, av.attribute_id)
    if (!av.label?.trim()) continue
    const byAttr = labels.get(acc) ?? new Map<string, { label: string; sort: number }[]>()
    const list = byAttr.get(av.attribute_id) ?? []
    list.push({ label: av.label.trim(), sort: Number(av.sort_order ?? 100) })
    byAttr.set(av.attribute_id, list)
    labels.set(acc, byAttr)
  }

  return {
    keyItemsFor: (id) =>
      (resolve(id)?.items ?? [])
        .filter((i) => i.role === 'key')
        .sort((a, b) => a.sortOrder - b.sortOrder),
    measureFor: (id) => resolve(id)?.measureImageUrl ?? null,
    filled,
    numbers,
    attrMeta,
    detailsFor: (acc) => {
      const ids = filled.get(acc)
      if (!ids) return []
      return [...ids]
        .map((attrId) => attrMeta.get(attrId))
        .filter((a): a is CoverageAttr => a != null)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((a) => {
          const lbl = (labels.get(acc)?.get(a.id) ?? []).sort((x, y) => x.sort - y.sort)
          const value = formatAttributeValue(
            a,
            inputs.get(acc)?.get(a.id) ?? null,
            lbl.map((l) => l.label)
          )
          return value ? { name: a.name, value } : null
        })
        .filter((d): d is { name: string; value: string } => d != null)
    }
  }
}

function clip(v: string, max: number): string {
  const t = v.trim()
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

async function loadReviewStats(
  admin: SupabaseClient,
  tenantId: string
): Promise<Map<string, { count: number; sum: number }>> {
  const { data, error } = await fetchAllPages<{ id: string; accessory_id: string; rating: number }>(
    (from, to) =>
      admin
        .from('product_reviews')
        .select('id, accessory_id, rating')
        .eq('tenant_id', tenantId)
        .eq('status', 'approved')
        .is('deleted_at', null)
        .order('id', { ascending: true })
        .range(from, to),
    ATTR_ROWS_MAX
  )
  if (error) console.error('loadReviewStats', error)
  const out = new Map<string, { count: number; sum: number }>()
  for (const r of data) {
    const s = out.get(r.accessory_id) ?? { count: 0, sum: 0 }
    s.count += 1
    s.sum += Number(r.rating)
    out.set(r.accessory_id, s)
  }
  return out
}

export async function buildFeed(shell: StorefrontShell): Promise<FeedResult> {
  const { admin, tenant, seller, settings, categories } = shell
  const ctx: FeedContext = {
    sellerName: seller.name,
    sellerUrl: siteUrl(tenant.base, STOREFRONT_HOME),
    termsUrl: settings.termsUrl,
    privacyUrl: settings.privacyUrl,
    returnDays: Math.max(settings.returnDays ?? STATUTORY_RETURN_DAYS, STATUTORY_RETURN_DAYS),
    shippingFeeGross: settings.shippingFeeGross,
    freeShippingThresholdGross: settings.freeShippingThresholdGross
  }

  const { data: rows, error } = await fetchAllPages<Record<string, unknown>>(
    (from, to) =>
      admin
        .from('storefront_products')
        .select(FEED_SELECT)
        .eq('tenant_id', tenant.id)
        .eq('sellable_web', true)
        .eq('active', true)
        .is('deleted_at', null)
        .not('web_slug', 'is', null)
        .order('id', { ascending: true })
        .range(from, to) as unknown as PromiseLike<{
        data: Record<string, unknown>[] | null
        error: { message: string } | null
      }>,
    FEED_MAX
  )
  if (error) {
    console.error('buildFeed', error)
    return { ctx, items: [], excluded: [] }
  }
  const ids = rows.map((r) => String(r.id))

  const [stock, coverage, reviews] = await Promise.all([
    getAccessoriesOnHandMap(admin, tenant.id, ids).catch(() => new Map<string, number>()),
    loadKeySpecCoverage(admin, shell),
    loadReviewStats(admin, tenant.id)
  ])
  const arrivals = await loadExpectedArrivals(
    admin,
    tenant.id,
    ids.filter((id) => (stock.get(id) ?? 0) <= 0)
  )

  const groupSize = new Map<string, number>()
  for (const r of rows) {
    const g = (r.web_group_id as string | null)?.trim()
    if (g) groupSize.set(g, (groupSize.get(g) ?? 0) + 1)
  }

  const items: FeedItem[] = []
  const excluded: FeedResult['excluded'] = []

  for (const row of rows) {
    const id = String(row.id)
    const web = mapAccessoryWebFields(row)
    const title = effectiveWebTitle({ web_title: web.web_title, name: String(row.name ?? '') })
    const brand = effectiveWebBrand({
      web_brand: web.web_brand,
      manufacturer_name: one<{ name?: string }>(row.manufacturers)?.name ?? null
    })
    const primaryImage = (row.image_url as string | null)?.trim() || null
    const gallery = (web.web_gallery ?? []).filter((u) => u && u !== primaryImage)
    const images = primaryImage ? [primaryImage, ...gallery] : gallery
    const gtin = web.web_gtin || (row.barcode as string | null) || null
    const categoryId = (row.web_category_id as string | null) ?? null
    const keyItems = coverage.keyItemsFor(categoryId)
    const filledSet = coverage.filled.get(id) ?? new Set<string>()
    const primaryKey = keyItems[0]
    const primaryMeta = primaryKey ? coverage.attrMeta.get(primaryKey.attributeId) : undefined
    const description = web.web_description_long || web.web_description_short || ''

    const readiness = evaluateAiReadiness({
      title,
      description: description || null,
      brand: brand || null,
      gtin,
      mpn: web.web_mpn,
      identifierExists: web.web_identifier_exists,
      imageCount: images.length,
      imagesWithAlt: images.filter((u) => web.web_image_alts[u]).length,
      keySpecsTotal: keyItems.length,
      keySpecsFilled: keyItems.filter((k) => filledSet.has(k.attributeId)).length,
      hasMeasureImage: Boolean(web.web_dimension_image_url || coverage.measureFor(categoryId)),
      hasProductDimensions: Boolean(
        web.product_length_cm || web.product_width_cm || web.product_height_cm
      ),
      hasCategory: Boolean(categoryId),
      primarySpec:
        primaryKey && primaryMeta
          ? {
              name: primaryMeta.name,
              value: coverage.numbers.get(id)?.get(primaryKey.attributeId) ?? null,
              unit: primaryMeta.unit
            }
          : null
    })

    const priceNet = Number(row.price_net)
    if (!readiness.feedEligible || !(priceNet > 0) || !description) {
      excluded.push({
        id,
        title,
        reasons: [
          ...readiness.blockers.map((b) => b.label),
          ...(priceNet > 0 ? [] : ['Ár']),
          ...(description ? [] : ['Leírás'])
        ]
      })
      continue
    }

    const vat = vatOf(row)
    const chain = categoryChain(categories, categoryId)
    const leaf = chain[chain.length - 1]
    const groupId = web.web_group_id?.trim() || null
    const priceGross = grossFromNet(priceNet, vat)
    const l = web.product_length_cm
    const w = web.product_width_cm
    const h = web.product_height_cm
    const rs = reviews.get(id)
    const inStock = (stock.get(id) ?? 0) > 0
    const sl = web.shipping_length_cm
    const sw = web.shipping_width_cm
    const sh = web.shipping_height_cm
    const netContent = netContentOf(web.web_net_quantity, web.web_net_unit, web.web_multipack)

    const details: FeedDetail[] = []
    const seenDetail = new Set<string>()
    const pushDetail = (name: string, value: string) => {
      const key = name.trim().toLocaleLowerCase('hu')
      if (!key || !value.trim() || seenDetail.has(key) || details.length >= DETAIL_MAX) return
      seenDetail.add(key)
      details.push({
        section: DETAIL_SECTION,
        name: clip(name, DETAIL_NAME_LEN),
        value: clip(value, DETAIL_VALUE_LEN)
      })
    }
    for (const d of coverage.detailsFor(id)) pushDetail(d.name, d.value)
    for (const [k, v] of Object.entries(web.web_specs ?? {})) pushDetail(k, String(v))
    if (netContent && web.web_net_quantity != null) {
      pushDetail('Nettó tartalom', netContentLabel(netContent))
    }

    items.push({
      id,
      title,
      description,
      url: siteUrl(tenant.base, productPath(web.web_slug!)),
      brand,
      imageUrl: images[0]!,
      additionalImageUrls: images.slice(1, 11),
      inStock,
      priceGross,
      gtin: gtin && /^\d{8}$|^\d{12,14}$/.test(gtin) ? gtin : null,
      mpn: web.web_mpn,
      identifierExists: web.web_identifier_exists && Boolean(gtin || web.web_mpn),
      groupId,
      hasVariations: groupId ? (groupSize.get(groupId) ?? 0) > 1 : false,
      color: web.web_color,
      size: web.web_size,
      material: web.web_material,
      productCategory: chain.map((c) => c.name).join(' > ') || web.web_product_type,
      googleCategory: leaf?.googleTaxonomyId || web.web_google_category,
      dimensionsCm: l && w && h ? { length: l, width: w, height: h } : null,
      weightKg: web.product_weight_kg,
      shippingWeightKg: web.shipping_weight_kg,
      shippingDimensionsCm: sl && sw && sh ? { length: sl, width: sw, height: sh } : null,
      availabilityDate: inStock ? null : (arrivals.get(id) ?? null),
      highlights: web.web_use_cases
        .map((u) => u.trim())
        .filter(Boolean)
        .slice(0, HIGHLIGHT_MAX)
        .map((u) => clip(u, HIGHLIGHT_LEN)),
      details,
      multipack: web.web_multipack,
      isBundle: web.web_is_bundle,
      countryOfOrigin: web.web_country_of_origin,
      unitPricing: googleUnitPricing(netContent),
      reviewCount: rs?.count ?? 0,
      starRating: rs && rs.count > 0 ? Math.round((rs.sum / rs.count) * 100) / 100 : null,
      updatedAt: (row.updated_at as string | null) ?? null
    })
  }

  return { ctx, items, excluded }
}

export function shippingFor(ctx: FeedContext, priceGross: number): number | null {
  if (ctx.shippingFeeGross == null) return null
  if (ctx.shippingFeeGross === 0) return 0
  if (ctx.freeShippingThresholdGross != null && priceGross >= ctx.freeShippingThresholdGross) {
    return 0
  }
  return ctx.shippingFeeGross
}
