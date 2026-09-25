import type { SupabaseClient } from '@supabase/supabase-js'

import { grossFromNet } from '@/lib/accessories/parse'
import type { RelatedKind } from '@/lib/accessories/related-kinds'
import {
  ACCESSORY_WEB_COLUMNS,
  mapAccessoryWebFields,
  type AccessoryWebFields
} from '@/lib/accessories/web-shop'
import { fetchAllPages } from '@/lib/supabase/fetch-all'
import { asValueType, mapAttributeInputRow } from '@/lib/webshop/queries'
import type {
  AttributeInput,
  AttributeValueType,
  CategoryAttributeRole,
  CategoryTemplateItem
} from '@/lib/webshop/types'

import type { DocumentKind } from '@/lib/webshop/excel/columns'

const MAX_PRODUCTS = 50000
const MAX_LINKS = 400000
const MAX_MEDIA = 100000
/** Nagy táblák párhuzamos lapozása (1000 sor / kérés). */
const PARALLEL = 6

export type ShopXCategory = {
  id: string
  name: string
  parentId: string | null
  active: boolean
  googleTaxonomyId: string | null
  measureImageUrl: string | null
  template: CategoryTemplateItem[]
  /** „Konyha > Zsanérok” */
  path: string
}

export type ShopXAttributeValue = { id: string; label: string; active: boolean }

export type ShopXRelated = { relatedId: string; kind: RelatedKind; sortOrder: number }

export type ShopXDocument = {
  mediaId: string
  kind: DocumentKind
  title: string | null
  language: string
  sortOrder: number
}

export type ShopXMedia = { id: string; filename: string; url: string; mime: string }

export type ShopXVariantGroup = {
  id: string
  code: string
  name: string | null
  mainAccessoryId: string | null
  /** product_attributes.id vagy '__pack' */
  axes: string[]
}

export type ShopXAttribute = {
  id: string
  name: string
  code: string
  valueType: AttributeValueType
  unit: string | null
  allowMultiple: boolean
  isVariantAxis: boolean
  active: boolean
  sortOrder: number
  values: ShopXAttributeValue[]
  /** Hány termék használja (típusváltás csak 0-nál). */
  usage: number
}

export type ShopXProduct = {
  id: string
  sku: string
  name: string
  barcode: string | null
  imageUrl: string | null
  priceNet: number
  priceGross: number
  vatPercent: number
  active: boolean
  manufacturerName: string | null
  /** null = még nincs bolt sora. */
  web: AccessoryWebFields | null
  categoryId: string | null
  webUpdatedAt: string | null
  valueIds: string[]
  inputs: AttributeInput[]
}

export type ShopXContext = {
  categories: ShopXCategory[]
  categoryById: Map<string, ShopXCategory>
  attributes: ShopXAttribute[]
  attributeById: Map<string, ShopXAttribute>
  /** attribute_value_id → attribútum */
  valueOwner: Map<string, ShopXAttribute>
  products: ShopXProduct[]
  bySku: Map<string, ShopXProduct>
  byId: Map<string, ShopXProduct>
  deletedSkus: Set<string>
  related: Map<string, ShopXRelated[]>
  documents: Map<string, ShopXDocument[]>
  /** kisbetűs fájlnév → média */
  mediaByFilename: Map<string, ShopXMedia>
  mediaById: Map<string, ShopXMedia>
  /** publikus URL (query nélkül) → média */
  mediaByUrl: Map<string, ShopXMedia>
  /** foldKey(kód) → csoport */
  groups: Map<string, ShopXVariantGroup>
  /** `${kind}:${source_key}` → target id (megjegyzett párosítás) */
  mappings: Map<string, string>
  /** A 20260549 migráció lefutott (tömeges mentés, visszavonás, csoportok). */
  bulkReady: boolean
}

export const PACK_AXIS = '__pack'

export function foldKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function one<T>(value: unknown): T | null {
  return ((Array.isArray(value) ? value[0] : value) ?? null) as T | null
}

function categoryPaths(rows: Omit<ShopXCategory, 'path'>[]): ShopXCategory[] {
  const byId = new Map(rows.map((r) => [r.id, r]))
  return rows.map((r) => {
    const names: string[] = []
    const seen = new Set<string>()
    let cur: Omit<ShopXCategory, 'path'> | undefined = r
    while (cur && !seen.has(cur.id) && seen.size < 10) {
      seen.add(cur.id)
      names.unshift(cur.name.trim())
      cur = cur.parentId ? byId.get(cur.parentId) : undefined
    }
    return { ...r, path: names.join(' > ') }
  })
}

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>

export async function loadShopXContext(
  supabase: SupabaseClient,
  tenantId: string
): Promise<ShopXContext> {
  const [cats, tpl, attrs, values, products, deleted, links, inputs, related, docs, media, groups, mappings] = await Promise.all([
    supabase
      .from('web_categories')
      .select('id, name, parent_id, active, google_taxonomy_id, measure_image_url')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null),
    supabase
      .from('web_category_attributes')
      .select('category_id, attribute_id, role, sort_order')
      .eq('tenant_id', tenantId),
    supabase
      .from('product_attributes')
      .select('id, name, code, value_type, unit, allow_multiple, is_variant_axis, active, sort_order')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null),
    fetchAllPages<Record<string, unknown>>(
      (from, to) =>
        supabase
          .from('attribute_values')
          .select('id, attribute_id, label, active')
          .eq('tenant_id', tenantId)
          .is('deleted_at', null)
          .order('id', { ascending: true })
          .range(from, to) as unknown as Page<Record<string, unknown>>,
      MAX_LINKS,
      PARALLEL
    ),
    fetchAllPages<Record<string, unknown>>(
      (from, to) =>
        supabase
          .from('accessories')
          .select(
            `id, sku, name, barcode, image_url, price_net, active,
             manufacturers ( name ), tax_rates ( rate_percent ),
             accessory_web ( ${ACCESSORY_WEB_COLUMNS}, updated_at )`
          )
          .eq('tenant_id', tenantId)
          .is('deleted_at', null)
          .order('id', { ascending: true })
          .range(from, to) as unknown as Page<Record<string, unknown>>,
      MAX_PRODUCTS,
      PARALLEL
    ),
    fetchAllPages<{ sku: string }>(
      (from, to) =>
        supabase
          .from('accessories')
          .select('sku')
          .eq('tenant_id', tenantId)
          .not('deleted_at', 'is', null)
          .order('id', { ascending: true })
          .range(from, to),
      MAX_PRODUCTS
    ),
    fetchAllPages<{ accessory_id: string; attribute_value_id: string }>(
      (from, to) =>
        supabase
          .from('accessory_attribute_values')
          .select('accessory_id, attribute_value_id')
          .eq('tenant_id', tenantId)
          .order('accessory_id', { ascending: true })
          .order('attribute_value_id', { ascending: true })
          .range(from, to),
      MAX_LINKS,
      PARALLEL
    ),
    fetchAllPages<Record<string, unknown>>(
      (from, to) =>
        supabase
          .from('accessory_attribute_inputs')
          .select('accessory_id, attribute_id, value_num, value_max, value_bool')
          .eq('tenant_id', tenantId)
          .order('accessory_id', { ascending: true })
          .order('attribute_id', { ascending: true })
          .range(from, to) as unknown as Page<Record<string, unknown>>,
      MAX_LINKS,
      PARALLEL
    ),
    fetchAllPages<Record<string, unknown>>(
      (from, to) =>
        supabase
          .from('accessory_related')
          .select('accessory_id, related_id, kind, sort_order')
          .eq('tenant_id', tenantId)
          .order('accessory_id', { ascending: true })
          .order('related_id', { ascending: true })
          .range(from, to) as unknown as Page<Record<string, unknown>>,
      MAX_LINKS,
      PARALLEL
    ),
    fetchAllPages<Record<string, unknown>>(
      (from, to) =>
        supabase
          .from('accessory_documents')
          .select('accessory_id, media_id, kind, title, language, sort_order')
          .eq('tenant_id', tenantId)
          .order('id', { ascending: true })
          .range(from, to) as unknown as Page<Record<string, unknown>>,
      MAX_LINKS,
      PARALLEL
    ),
    fetchAllPages<Record<string, unknown>>(
      (from, to) =>
        supabase
          .from('media_files')
          .select('id, original_filename, public_url, mime_type')
          .eq('tenant_id', tenantId)
          .order('id', { ascending: true })
          .range(from, to) as unknown as Page<Record<string, unknown>>,
      MAX_MEDIA,
      PARALLEL
    ),
    supabase
      .from('web_variant_groups')
      .select('id, code, name, main_accessory_id, axes')
      .eq('tenant_id', tenantId)
      .limit(20000),
    supabase
      .from('webshop_import_mappings')
      .select('kind, source_key, target_id')
      .eq('tenant_id', tenantId)
      .limit(50000)
  ])

  const firstError =
    cats.error?.message ??
    tpl.error?.message ??
    attrs.error?.message ??
    values.error ??
    products.error ??
    links.error ??
    inputs.error ??
    related.error ??
    docs.error ??
    media.error
  if (firstError) {
    console.error('loadShopXContext', firstError)
    throw new Error('Nem sikerült betölteni a bolt adatait.')
  }

  const tplByCat = new Map<string, CategoryTemplateItem[]>()
  for (const t of tpl.data ?? []) {
    const list = tplByCat.get(t.category_id as string) ?? []
    list.push({
      attributeId: t.attribute_id as string,
      role: (t.role === 'spec' ? 'spec' : 'key') as CategoryAttributeRole,
      sortOrder: Number(t.sort_order ?? 100)
    })
    tplByCat.set(t.category_id as string, list)
  }
  const aliveIds = new Set((cats.data ?? []).map((c) => c.id as string))
  const categories = categoryPaths(
    (cats.data ?? []).map((c) => {
      const parent = (c.parent_id as string | null) ?? null
      return {
        id: c.id as string,
        name: String(c.name ?? ''),
        parentId: parent && aliveIds.has(parent) ? parent : null,
        active: c.active !== false,
        googleTaxonomyId: (c.google_taxonomy_id as string | null) ?? null,
        measureImageUrl: (c.measure_image_url as string | null) ?? null,
        template: tplByCat.get(c.id as string) ?? []
      }
    })
  ).sort((a, b) => a.path.localeCompare(b.path, 'hu'))

  // A 20260549 előtt ezek a táblák nincsenek: a régi (egyszerű) import így is működik.
  const bulkReady = !groups.error && !mappings.error
  if (!bulkReady) console.warn('loadShopXContext bulk tables', groups.error?.message ?? mappings.error?.message)

  const valuesByAttr = new Map<string, ShopXAttributeValue[]>()
  for (const v of values.data) {
    const list = valuesByAttr.get(v.attribute_id as string) ?? []
    list.push({ id: v.id as string, label: String(v.label ?? ''), active: v.active !== false })
    valuesByAttr.set(v.attribute_id as string, list)
  }
  const attributes: ShopXAttribute[] = (attrs.data ?? [])
    .map((a) => ({
      id: a.id as string,
      name: String(a.name ?? ''),
      code: String(a.code ?? ''),
      valueType: asValueType(a.value_type),
      unit: (a.unit as string | null)?.trim() || null,
      allowMultiple: a.allow_multiple === true,
      isVariantAxis: a.is_variant_axis === true,
      active: a.active !== false,
      sortOrder: Number(a.sort_order ?? 100),
      values: valuesByAttr.get(a.id as string) ?? [],
      usage: 0
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'hu'))
  const attributeById = new Map(attributes.map((a) => [a.id, a]))
  const valueOwner = new Map<string, ShopXAttribute>()
  for (const a of attributes) for (const v of a.values) valueOwner.set(v.id, a)

  const linksBy = new Map<string, string[]>()
  for (const l of links.data) {
    const list = linksBy.get(l.accessory_id) ?? []
    list.push(l.attribute_value_id)
    linksBy.set(l.accessory_id, list)
    const owner = valueOwner.get(l.attribute_value_id)
    if (owner) owner.usage++
  }
  const inputsBy = new Map<string, AttributeInput[]>()
  for (const r of inputs.data) {
    const id = r.accessory_id as string
    const list = inputsBy.get(id) ?? []
    list.push(mapAttributeInputRow(r))
    inputsBy.set(id, list)
    const attr = attributeById.get(r.attribute_id as string)
    if (attr) attr.usage++
  }

  const relatedBy = new Map<string, ShopXRelated[]>()
  for (const r of related.data) {
    const id = r.accessory_id as string
    const list = relatedBy.get(id) ?? []
    list.push({
      relatedId: r.related_id as string,
      kind: String(r.kind ?? 'required') as RelatedKind,
      sortOrder: Number(r.sort_order ?? 100)
    })
    relatedBy.set(id, list)
  }
  for (const list of relatedBy.values()) list.sort((a, b) => a.sortOrder - b.sortOrder)

  const docsBy = new Map<string, ShopXDocument[]>()
  for (const d of docs.data) {
    const id = d.accessory_id as string
    const list = docsBy.get(id) ?? []
    list.push({
      mediaId: d.media_id as string,
      kind: String(d.kind ?? 'other') as DocumentKind,
      title: (d.title as string | null) ?? null,
      language: String(d.language ?? 'hu'),
      sortOrder: Number(d.sort_order ?? 100)
    })
    docsBy.set(id, list)
  }
  for (const list of docsBy.values()) list.sort((a, b) => a.sortOrder - b.sortOrder)

  const mediaList: ShopXMedia[] = media.data.map((m) => ({
    id: m.id as string,
    filename: String(m.original_filename ?? ''),
    url: String(m.public_url ?? ''),
    mime: String(m.mime_type ?? '')
  }))

  const groupMap = new Map<string, ShopXVariantGroup>()
  for (const g of groups.data ?? []) {
    const code = String(g.code ?? '').trim()
    if (!code) continue
    groupMap.set(foldKey(code), {
      id: g.id as string,
      code,
      name: (g.name as string | null) ?? null,
      mainAccessoryId: (g.main_accessory_id as string | null) ?? null,
      axes: Array.isArray(g.axes) ? (g.axes as string[]) : []
    })
  }
  const mappingMap = new Map<string, string>()
  for (const m of mappings.data ?? []) mappingMap.set(`${m.kind}:${m.source_key}`, m.target_id as string)

  const list: ShopXProduct[] = products.data.map((row) => {
    const webRow = one<Record<string, unknown>>(row.accessory_web)
    const vat = Number(one<{ rate_percent?: number }>(row.tax_rates)?.rate_percent ?? 0)
    const priceNet = Number(row.price_net ?? 0)
    const id = String(row.id)
    return {
      id,
      sku: String(row.sku ?? ''),
      name: String(row.name ?? ''),
      barcode: (row.barcode as string | null)?.trim() || null,
      imageUrl: (row.image_url as string | null)?.trim() || null,
      priceNet,
      priceGross: grossFromNet(priceNet, vat),
      vatPercent: vat,
      active: row.active === true,
      manufacturerName: one<{ name?: string }>(row.manufacturers)?.name?.trim() || null,
      web: webRow ? mapAccessoryWebFields(webRow) : null,
      categoryId: (webRow?.web_category_id as string | null | undefined) ?? null,
      webUpdatedAt: (webRow?.updated_at as string | null | undefined) ?? null,
      valueIds: linksBy.get(id) ?? [],
      inputs: inputsBy.get(id) ?? []
    }
  })
  list.sort((a, b) => a.name.localeCompare(b.name, 'hu'))

  return {
    categories,
    categoryById: new Map(categories.map((c) => [c.id, c])),
    attributes,
    attributeById,
    valueOwner,
    products: list,
    bySku: new Map(list.map((p) => [foldKey(p.sku), p])),
    byId: new Map(list.map((p) => [p.id, p])),
    deletedSkus: new Set(deleted.data.map((d) => foldKey(String(d.sku ?? '')))),
    related: relatedBy,
    documents: docsBy,
    mediaByFilename: new Map(mediaList.map((m) => [m.filename.toLowerCase(), m])),
    mediaById: new Map(mediaList.map((m) => [m.id, m])),
    mediaByUrl: new Map(mediaList.map((m) => [m.url.split('?')[0], m])),
    groups: groupMap,
    mappings: mappingMap,
    bulkReady
  }
}
