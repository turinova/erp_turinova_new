import type { SupabaseClient } from '@supabase/supabase-js'

import { grossFromNet } from '@/lib/accessories/parse'
import type { RelatedKind } from '@/lib/accessories/related-kinds'
import {
  ACCESSORY_WEB_COLUMNS,
  mapAccessoryWebFields,
  type AccessoryWebFields
} from '@/lib/accessories/web-shop'
import { fetchAllPages, fetchByIds } from '@/lib/supabase/fetch-all'
import { asValueType, mapAttributeInputRow } from '@/lib/webshop/queries'
import type {
  AttributeInput,
  AttributeValueType,
  CategoryAttributeRole,
  CategoryTemplateItem
} from '@/lib/webshop/types'

import type { DocumentKind } from '@/lib/webshop/excel/columns'
import type { ShopXWorkbook } from '@/lib/webshop/excel/read'

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
  intro: string | null
  coverAccessoryId: string | null
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
  /** Az összes bolt sor webcíme (ütközésvizsgálat a szűkített betöltésnél is). */
  slugOwners: Map<string, string>
  /** Kategória id → hány bolt sor van benne. */
  categoryCounts: Map<string, number>
  /** false = csak a fájlban / listában érintett termékek vannak betöltve (a `usage` részleges). */
  complete: boolean
}

/** Csak ezeket a termékeket (és a hivatkozottakat) töltjük be — nagy katalógusnál kötelező. */
export type ShopXScope = { skus?: string[]; ids?: string[]; groupCodes?: string[] }

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
type Row = Record<string, unknown>
type Loaded<T> = { data: T[]; error: string | null }

const PRODUCT_SELECT = `id, sku, name, barcode, image_url, price_net, active,
  manufacturers ( name ), tax_rates ( rate_percent ),
  accessory_web ( ${ACCESSORY_WEB_COLUMNS}, updated_at )`

type ProductSet = {
  products: Loaded<Row>
  deleted: Loaded<{ sku: string }>
  links: Loaded<{ accessory_id: string; attribute_value_id: string }>
  inputs: Loaded<Row>
  related: Loaded<Row>
  docs: Loaded<Row>
}

async function loadAllProducts(supabase: SupabaseClient, tenantId: string): Promise<ProductSet> {
  const [products, deleted, links, inputs, related, docs] = await Promise.all([
    fetchAllPages<Row>(
      (from, to) =>
        supabase
          .from('accessories')
          .select(PRODUCT_SELECT)
          .eq('tenant_id', tenantId)
          .is('deleted_at', null)
          .order('id', { ascending: true })
          .range(from, to) as unknown as Page<Row>,
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
    fetchAllPages<Row>(
      (from, to) =>
        supabase
          .from('accessory_attribute_inputs')
          .select('accessory_id, attribute_id, value_num, value_max, value_bool')
          .eq('tenant_id', tenantId)
          .order('accessory_id', { ascending: true })
          .order('attribute_id', { ascending: true })
          .range(from, to) as unknown as Page<Row>,
      MAX_LINKS,
      PARALLEL
    ),
    fetchAllPages<Row>(
      (from, to) =>
        supabase
          .from('accessory_related')
          .select('accessory_id, related_id, kind, sort_order')
          .eq('tenant_id', tenantId)
          .order('accessory_id', { ascending: true })
          .order('related_id', { ascending: true })
          .range(from, to) as unknown as Page<Row>,
      MAX_LINKS,
      PARALLEL
    ),
    fetchAllPages<Row>(
      (from, to) =>
        supabase
          .from('accessory_documents')
          .select('accessory_id, media_id, kind, title, language, sort_order')
          .eq('tenant_id', tenantId)
          .order('id', { ascending: true })
          .range(from, to) as unknown as Page<Row>,
      MAX_LINKS,
      PARALLEL
    )
  ])
  return { products, deleted, links, inputs, related, docs }
}

/**
 * Csak a megadott termékek + amire hivatkoznak (kapcsolt termék, csoporttárs, csoport fő termék,
 * kategória borító). Minden lekérdezés id/sku listára szűr — a teljes katalógust nem lapozzuk végig.
 */
async function loadScopedProducts(
  supabase: SupabaseClient,
  tenantId: string,
  scope: ShopXScope,
  extraIds: string[]
): Promise<ProductSet> {
  const productsBy = (col: 'id' | 'sku', values: string[]) =>
    fetchByIds<Row>(values, (chunk, from, to) =>
      supabase
        .from('accessories')
        .select(PRODUCT_SELECT)
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .in(col, chunk)
        .order('id', { ascending: true })
        .range(from, to) as unknown as Page<Row>
    )
  const relatedOf = (ids: string[]) =>
    fetchByIds<Row>(ids, (chunk, from, to) =>
      supabase
        .from('accessory_related')
        .select('accessory_id, related_id, kind, sort_order')
        .eq('tenant_id', tenantId)
        .in('accessory_id', chunk)
        .order('accessory_id', { ascending: true })
        .order('related_id', { ascending: true })
        .range(from, to) as unknown as Page<Row>
    )

  const skuVariants = [...new Set((scope.skus ?? []).flatMap((s) => [s.trim(), s.trim().toUpperCase()]))].filter(Boolean)
  const [bySku, byId, deleted] = await Promise.all([
    skuVariants.length > 0 ? productsBy('sku', skuVariants) : Promise.resolve<Loaded<Row>>({ data: [], error: null }),
    (scope.ids?.length ?? 0) > 0 ? productsBy('id', scope.ids!) : Promise.resolve<Loaded<Row>>({ data: [], error: null }),
    fetchByIds<{ sku: string }>(skuVariants, (chunk, from, to) =>
      supabase
        .from('accessories')
        .select('sku')
        .eq('tenant_id', tenantId)
        .not('deleted_at', 'is', null)
        .in('sku', chunk)
        .order('id', { ascending: true })
        .range(from, to)
    )
  ])
  const firstError = bySku.error ?? byId.error ?? deleted.error
  const empty = { data: [], error: firstError }
  if (firstError) return { products: empty, deleted, links: empty, inputs: empty, related: empty, docs: empty }

  const rows = new Map<string, Row>()
  for (const r of [...bySku.data, ...byId.data]) rows.set(String(r.id), r)

  const groupCodes = new Set((scope.groupCodes ?? []).map((c) => c.trim()).filter(Boolean))
  for (const r of rows.values()) {
    const code = (one<Row>(r.accessory_web)?.web_group_id as string | null | undefined)?.trim()
    if (code) groupCodes.add(code)
  }
  const [members, related] = await Promise.all([
    fetchByIds<{ accessory_id: string }>([...groupCodes], (chunk, from, to) =>
      supabase
        .from('accessory_web')
        .select('accessory_id')
        .eq('tenant_id', tenantId)
        .in('web_group_id', chunk)
        .order('accessory_id', { ascending: true })
        .range(from, to)
    ),
    relatedOf([...rows.keys()])
  ])
  if (members.error || related.error) {
    const error = members.error ?? related.error
    return { products: { data: [], error }, deleted, links: empty, inputs: empty, related, docs: empty }
  }

  const extra = new Set<string>(extraIds)
  for (const m of members.data) extra.add(m.accessory_id)
  for (const r of related.data) extra.add(String(r.related_id))
  const missing = [...extra].filter((id) => !rows.has(id))
  if (missing.length > 0) {
    const [more, moreRelated] = await Promise.all([productsBy('id', missing), relatedOf(missing)])
    if (more.error || moreRelated.error) {
      const error = more.error ?? moreRelated.error
      return { products: { data: [], error }, deleted, links: empty, inputs: empty, related, docs: empty }
    }
    for (const r of more.data) rows.set(String(r.id), r)
    related.data.push(...moreRelated.data)
  }

  const ids = [...rows.keys()]
  const [links, inputs, docs] = await Promise.all([
    fetchByIds<{ accessory_id: string; attribute_value_id: string }>(ids, (chunk, from, to) =>
      supabase
        .from('accessory_attribute_values')
        .select('accessory_id, attribute_value_id')
        .eq('tenant_id', tenantId)
        .in('accessory_id', chunk)
        .order('accessory_id', { ascending: true })
        .order('attribute_value_id', { ascending: true })
        .range(from, to)
    ),
    fetchByIds<Row>(ids, (chunk, from, to) =>
      supabase
        .from('accessory_attribute_inputs')
        .select('accessory_id, attribute_id, value_num, value_max, value_bool')
        .eq('tenant_id', tenantId)
        .in('accessory_id', chunk)
        .order('accessory_id', { ascending: true })
        .order('attribute_id', { ascending: true })
        .range(from, to) as unknown as Page<Row>
    ),
    fetchByIds<Row>(ids, (chunk, from, to) =>
      supabase
        .from('accessory_documents')
        .select('accessory_id, media_id, kind, title, language, sort_order')
        .eq('tenant_id', tenantId)
        .in('accessory_id', chunk)
        .order('id', { ascending: true })
        .range(from, to) as unknown as Page<Row>
    )
  ])
  return { products: { data: [...rows.values()], error: null }, deleted, links, inputs, related, docs }
}

/** A fájlban hivatkozott SKU-k. null = a teljes katalógus kell (Tulajdonságok lap: típusváltáshoz pontos használat). */
export function shopWorkbookScope(wb: ShopXWorkbook): ShopXScope | null {
  if ((wb.attributes?.rows.length ?? 0) > 0) return null
  const skus = new Set<string>()
  const add = (v: string | undefined) => {
    const s = v?.trim()
    if (s) skus.add(s)
  }
  for (const r of wb.products?.rows ?? []) add(r.cells.sku)
  for (const r of wb.specs?.rows ?? []) add(r.cells.sku)
  for (const r of wb.faq?.rows ?? []) add(r.cells.sku)
  for (const r of wb.documents?.rows ?? []) add(r.cells.sku)
  for (const r of wb.related?.rows ?? []) {
    add(r.cells.sku)
    add(r.cells.relatedSku)
  }
  for (const r of wb.groups?.rows ?? []) add(r.cells.main)
  for (const r of wb.categories?.rows ?? []) add(r.cells.cover)
  const groupCodes = new Set<string>()
  for (const r of wb.products?.rows ?? []) if (r.cells.group?.trim()) groupCodes.add(r.cells.group.trim())
  for (const r of wb.groups?.rows ?? []) if (r.cells.code?.trim()) groupCodes.add(r.cells.code.trim())
  return { skus: [...skus], groupCodes: [...groupCodes] }
}

/**
 * `scope` nélkül a teljes katalógust tölti (kis tenant / Tulajdonságok lap).
 * `scope`-pal csak az érintett termékeket — 30k+ terméknél a teljes lapozás statement timeoutba fut.
 */
export async function loadShopXContext(
  supabase: SupabaseClient,
  tenantId: string,
  scope?: ShopXScope | null
): Promise<ShopXContext> {
  const [cats, tpl, attrs, values, media, groups, mappings, webIndex] = await Promise.all([
    (async () => {
      const cols = 'id, name, parent_id, active, google_taxonomy_id, measure_image_url'
      const q = (c: string) =>
        supabase.from('web_categories').select(c).eq('tenant_id', tenantId).is('deleted_at', null)
      const res = await q(`${cols}, intro, cover_accessory_id`)
      // 20260550 előtt nincs intro / cover_accessory_id.
      const out = res.error?.code === '42703' ? await q(cols) : res
      return { data: out.data as unknown as Row[] | null, error: out.error }
    })(),
    supabase
      .from('web_category_attributes')
      .select('category_id, attribute_id, role, sort_order')
      .eq('tenant_id', tenantId),
    supabase
      .from('product_attributes')
      .select('id, name, code, value_type, unit, allow_multiple, is_variant_axis, active, sort_order')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null),
    fetchAllPages<Row>(
      (from, to) =>
        supabase
          .from('attribute_values')
          .select('id, attribute_id, label, active')
          .eq('tenant_id', tenantId)
          .is('deleted_at', null)
          .order('id', { ascending: true })
          .range(from, to) as unknown as Page<Row>,
      MAX_LINKS,
      PARALLEL
    ),
    fetchAllPages<Row>(
      (from, to) =>
        supabase
          .from('media_files')
          .select('id, original_filename, public_url, mime_type')
          .eq('tenant_id', tenantId)
          .order('id', { ascending: true })
          .range(from, to) as unknown as Page<Row>,
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
      .limit(50000),
    fetchAllPages<{ accessory_id: string; web_slug: string | null; web_category_id: string | null }>(
      (from, to) =>
        supabase
          .from('accessory_web')
          .select('accessory_id, web_slug, web_category_id')
          .eq('tenant_id', tenantId)
          .order('accessory_id', { ascending: true })
          .range(from, to),
      MAX_PRODUCTS,
      PARALLEL
    )
  ])

  const sharedError =
    cats.error?.message ?? tpl.error?.message ?? attrs.error?.message ?? values.error ?? media.error ?? webIndex.error
  if (sharedError) {
    console.error('loadShopXContext', sharedError)
    throw new Error('Nem sikerült betölteni a bolt adatait.')
  }

  let set: ProductSet
  if (scope) {
    const extraIds: string[] = []
    const scopedCodes = new Set((scope.groupCodes ?? []).map(foldKey))
    for (const g of groups.data ?? []) {
      if (g.main_accessory_id && scopedCodes.has(foldKey(String(g.code ?? '')))) extraIds.push(g.main_accessory_id as string)
    }
    for (const c of cats.data ?? []) if (c.cover_accessory_id) extraIds.push(c.cover_accessory_id as string)
    set = await loadScopedProducts(supabase, tenantId, scope, extraIds)
  } else {
    set = await loadAllProducts(supabase, tenantId)
  }
  const { products, deleted, links, inputs, related, docs } = set

  const firstError = products.error ?? deleted.error ?? links.error ?? inputs.error ?? related.error ?? docs.error
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
        intro: (c.intro as string | null | undefined) ?? null,
        coverAccessoryId: (c.cover_accessory_id as string | null | undefined) ?? null,
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

  const slugOwners = new Map<string, string>()
  const categoryCounts = new Map<string, number>()
  for (const w of webIndex.data) {
    if (w.web_slug) slugOwners.set(w.web_slug, w.accessory_id)
    if (w.web_category_id) categoryCounts.set(w.web_category_id, (categoryCounts.get(w.web_category_id) ?? 0) + 1)
  }

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
    bulkReady,
    slugOwners,
    categoryCounts,
    complete: !scope
  }
}
