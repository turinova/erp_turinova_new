import { MAX_RELATED_PER_KIND, RELATED_KIND_META, type RelatedKind } from '@/lib/accessories/related-kinds'
import {
  emptyWebFields,
  normalizePriceTiers,
  suggestWebDescriptionShort,
  suggestWebSlug
} from '@/lib/accessories/web-shop'
import { countryName, countryOptions, isCountryCode } from '@/lib/geo/countries'
import { youtubeIdOf } from '@/lib/storefront/youtube'
import { resolveCategoryTemplate } from '@/lib/webshop/key-specs'
import {
  shopProductSchema,
  shopRequirementIssues,
  shopValuesToRow,
  type ShopProductValues
} from '@/lib/webshop/product-parse'
import type { AttributeInput, AttributeValueType } from '@/lib/webshop/types'

import {
  ATTRIBUTE_TYPE_ALIASES,
  CLEAR_MARK,
  DOCUMENT_KIND_ALIASES,
  DOCUMENT_KIND_LABEL,
  RELATED_KIND_ALIASES,
  SHOP_COLUMNS,
  SHOP_DOCUMENTS_MAX_PER_PRODUCT,
  SHOP_EXCEL_VERSION,
  SHOP_FAQ_MAX_PER_PRODUCT,
  type DocumentKind,
  type ShopColumn,
  type ShopColumnId
} from '@/lib/webshop/excel/columns'
import {
  foldKey,
  PACK_AXIS,
  type ShopXAttribute,
  type ShopXCategory,
  type ShopXContext,
  type ShopXDocument,
  type ShopXProduct,
  type ShopXRelated
} from '@/lib/webshop/excel/context'
import {
  closest,
  editDistance,
  formatNumberHu,
  joinList,
  parseBool,
  parseNumberHu,
  parseTiersGross,
  splitList
} from '@/lib/webshop/excel/format'
import type { RawRow, RawSheet, ShopXWorkbook } from '@/lib/webshop/excel/read'
import {
  matchesShopItem,
  SHOP_X_ITEM_FILTERS,
  SHOP_X_SHEET_LABEL,
  type ShopXCatalogChanges,
  type ShopXDecisions,
  type ShopXGroupCard,
  type ShopXIssue,
  type ShopXIssueLevel,
  type ShopXItem,
  type ShopXItemFilter,
  type ShopXPending,
  type ShopXPendingKind,
  type ShopXPreview,
  type ShopXProblem,
  type ShopXRowRef,
  type ShopXSheet
} from '@/lib/webshop/excel/types'

type Values = ShopProductValues

export const PLACEHOLDER = 'new:'
const DUMMY_UUID = '00000000-0000-4000-8000-000000000000'
const MAX_LIST_ITEMS = 40
const MAX_GROUP_CARDS = 50
const MAX_KEY_ATTRS = 4
const MAX_GROUP_AXES = 3
const MAX_CANDIDATES = 8
/** Ennyi döntésnél számolunk jelölteket (a többi a javaslatot kapja). */
const CANDIDATE_PENDING_LIMIT = 300
/** Előnézetben szűrőnként ennyi tétel megy át (a teljes lista a jelentésben). */
const PREVIEW_PER_FILTER: Record<ShopXItemFilter, number> = {
  all: 150,
  error: 150,
  blocked: 100,
  live: 60,
  update: 100,
  unchanged: 40
}

const FIELD: Partial<Record<ShopColumnId, keyof Values>> = {
  available: 'sellableWeb',
  category: 'webCategoryId',
  description: 'webDescriptionLong',
  shortDescription: 'webDescriptionShort',
  useCases: 'webUseCases',
  compatibility: 'webCompatibility',
  boxContents: 'webBoxContents',
  brand: 'webBrand',
  mpn: 'webMpn',
  gtin: 'webGtin',
  group: 'webGroupId',
  netQuantity: 'webNetQuantity',
  netUnit: 'webNetUnit',
  multipack: 'webMultipack',
  isBundle: 'webIsBundle',
  priceTiers: 'webPriceTiers',
  compareAt: 'webCompareAtPrice',
  productLength: 'productLengthCm',
  productWidth: 'productWidthCm',
  productHeight: 'productHeightCm',
  productWeight: 'productWeightKg',
  shippingLength: 'shippingLengthCm',
  shippingWidth: 'shippingWidthCm',
  shippingHeight: 'shippingHeightCm',
  shippingWeight: 'shippingWeightKg',
  country: 'webCountryOfOrigin',
  ingredients: 'webIngredients',
  usage: 'webUsage',
  safety: 'webSafetyInfo',
  video: 'webVideoUrl',
  dimensionImage: 'webDimensionImageUrl',
  title: 'webTitle',
  slug: 'webSlug',
  googleCategory: 'webGoogleCategory',
  searchAliases: 'webSearchAliases',
  tags: 'webTags'
}

const LABEL_BY_FIELD = new Map<string, string>(
  SHOP_COLUMNS.filter((c) => FIELD[c.id]).map((c) => [FIELD[c.id] as string, c.label])
)

const NET_UNIT_ALIASES: Record<string, Values['webNetUnit']> = {
  g: 'g',
  gr: 'g',
  gramm: 'g',
  kg: 'kg',
  ml: 'ml',
  l: 'l',
  liter: 'l',
  db: 'db',
  darab: 'db',
  m: 'm',
  meter: 'm',
  m2: 'm2',
  'm²': 'm2',
  nm: 'm2',
  negyzetmeter: 'm2'
}

const PACK_AXIS_NAMES = new Set(['kiszereles', 'csomag', 'pack'])
const RELATED_KIND_OPTIONS = Object.values(RELATED_KIND_META)
  .map((m) => m.label)
  .join(', ')

export type ShopXRelatedWrite = { kinds: RelatedKind[]; list: ShopXRelated[] }

export type ShopXWrite = {
  accessoryId: string
  sku: string
  name: string
  values: Values
  /** Változott az accessory_web sor (különben csak a kapcsolt táblák). */
  webChanged: boolean
  /** A Jellemzők lap által érintett attribútumok (csak ezek cserélődnek). */
  touchedAttributes: string[]
  related: ShopXRelatedWrite | null
  /** Kölcsönös alternatíva: ezeknél a termékeknél is fel/le kerül ez a termék. */
  altAdd: string[]
  altRemove: string[]
  documents: ShopXDocument[] | null
  previousSlug: string | null
  wasLive: boolean
}

export type ShopXAttributeCreate = {
  kind: 'attribute'
  key: string
  name: string
  valueType: AttributeValueType
  unit: string | null
  allowMultiple: boolean
  isVariantAxis: boolean
  active: boolean
}

export type ShopXCreation =
  | ShopXAttributeCreate
  | { kind: 'category'; key: string; parts: string[] }
  | { kind: 'value'; key: string; attributeId: string; label: string }

export type ShopXAttributePatch = Partial<{
  value_type: AttributeValueType
  unit: string | null
  allow_multiple: boolean
  is_variant_axis: boolean
  active: boolean
}>

export type ShopXCategoryPatch = Partial<{
  active: boolean
  google_taxonomy_id: string | null
  measure_image_url: string | null
}>

export type ShopXCatalogOp =
  | { kind: 'attributeUpdate'; attributeId: string; name: string; patch: ShopXAttributePatch }
  | {
      kind: 'categoryUpdate'
      /** Létező id, vagy PLACEHOLDER + kategória kulcs. */
      categoryId: string
      path: string
      patch: ShopXCategoryPatch
      /** undefined = nem változik; [] = törlés. Attribútum id-k (lehet PLACEHOLDER). */
      keyAttrs?: string[]
      specAttrs?: string[]
    }
  | {
      kind: 'group'
      code: string
      name?: string | null
      mainAccessoryId?: string | null
      axes?: string[]
    }

export type ShopXMappingWrite = { kind: 'category' | 'value' | 'attribute'; sourceKey: string; targetId: string }

export type ShopXPlan = {
  preview: ShopXPreview
  /** Minden tétel (a preview.items csonkolt). */
  items: ShopXItem[]
  writes: ShopXWrite[]
  /** Az érintett termékek stabil (fájl szerinti) sorrendje — a mentés lépései ebben haladnak. */
  order: string[]
  creations: ShopXCreation[]
  catalogOps: ShopXCatalogOp[]
  mappings: ShopXMappingWrite[]
}

type AttrState = { valueIds: Set<string>; inputs: Map<string, AttributeInput> }

type Work = {
  product: ShopXProduct
  item: ShopXItem
  before: Values
  values: Values
  attrs: AttrState
  touchedAttrs: Set<string>
  faqTouched: boolean
  requested: boolean | null
  cellsSeen: Set<ShopColumnId>
  productRow: number | null
  skipped: boolean
  related: ShopXRelatedWrite | null
  altAdd: string[]
  altRemove: string[]
  documents: ShopXDocument[] | null
}

type Resolved = { type: 'use'; id: string } | { type: 'create' } | null

export function valuesFromProduct(p: ShopXProduct): Values {
  const w = p.web ?? emptyWebFields()
  return {
    sellableWeb: w.sellable_web,
    webSlug: w.web_slug,
    webTitle: w.web_title,
    webDescriptionShort: w.web_description_short,
    webDescriptionLong: w.web_description_long,
    webBrand: w.web_brand,
    webGtin: w.web_gtin,
    webMpn: w.web_mpn,
    webProductType: w.web_product_type,
    webGoogleCategory: w.web_google_category,
    webTags: w.web_tags,
    webSearchAliases: w.web_search_aliases,
    webColor: w.web_color,
    webSize: w.web_size,
    webMaterial: w.web_material,
    webAttributes: w.web_attributes,
    webSpecs: w.web_specs,
    webFaq: w.web_faq,
    webUseCases: w.web_use_cases,
    webCompatibility: w.web_compatibility,
    webCompareAtPrice: w.web_compare_at_price,
    shippingWeightKg: w.shipping_weight_kg,
    shippingLengthCm: w.shipping_length_cm,
    shippingWidthCm: w.shipping_width_cm,
    shippingHeightCm: w.shipping_height_cm,
    productWeightKg: w.product_weight_kg,
    productLengthCm: w.product_length_cm,
    productWidthCm: w.product_width_cm,
    productHeightCm: w.product_height_cm,
    webGroupId: w.web_group_id,
    webBoxContents: w.web_box_contents,
    webDimensionImageUrl: w.web_dimension_image_url,
    webSafetyInfo: w.web_safety_info,
    webNetQuantity: w.web_net_quantity,
    webNetUnit: (w.web_net_unit as Values['webNetUnit']) ?? null,
    webIngredients: w.web_ingredients,
    webUsage: w.web_usage,
    webVideoUrl: w.web_video_url,
    webCountryOfOrigin: w.web_country_of_origin,
    webMultipack: w.web_multipack,
    webIsBundle: w.web_is_bundle,
    webIdentifierExists: w.web_identifier_exists,
    webImageAlts: w.web_image_alts,
    webPriceTiers: w.web_price_tiers,
    webCategoryId: p.categoryId,
    attributeValueIds: p.valueIds,
    attributeInputs: p.inputs
  }
}

/** accessory_web sor a tervből (mentéshez és a változás-összevetéshez). */
export function webRowOf(v: Values) {
  return shopValuesToRow(v, normalizePriceTiers(v.webPriceTiers))
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

let countryIndex: Map<string, string> | null = null
function countryCodeOf(raw: string): string | null {
  const t = raw.trim()
  if (t.length === 2 && isCountryCode(t)) return t.toUpperCase()
  if (!countryIndex) {
    countryIndex = new Map()
    const en = new Intl.DisplayNames(['en'], { type: 'region' })
    for (const o of countryOptions()) {
      countryIndex.set(foldKey(o.name), o.code)
      const e = en.of(o.code)
      if (e) countryIndex.set(foldKey(e), o.code)
    }
    countryIndex.set('anglia', 'GB')
    countryIndex.set('nagy-britannia', 'GB')
    countryIndex.set('usa', 'US')
    countryIndex.set('kina', 'CN')
  }
  return countryIndex.get(foldKey(t)) ?? null
}

/** A legközelebbi n jelölt (részszöveg-egyezés előrébb). */
function rankCandidates<T>(needle: string, items: T[], keyOf: (t: T) => string, n = MAX_CANDIDATES): T[] {
  if (!needle || items.length === 0) return []
  return items
    .map((item) => {
      const key = keyOf(item)
      const contains = key.includes(needle) || needle.includes(key)
      return { item, score: editDistance(needle, key) - (contains ? 100 : 0) }
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, n)
    .map((x) => x.item)
}

const NUMBER_RE = /^(-?[\d\s.,]+)\s*([^\d\s][^\d]*)?$/
const RANGE_RE = /^([\d\s.,]+)\s*(?:-|–|—|\.\.)\s*([\d\s.,]+)\s*([^\d\s][^\d]*)?$/

/** Új jellemző típusa a feltöltött értékekből. */
function inferAttributeType(values: string[]): {
  valueType: AttributeValueType
  unit: string | null
  allowMultiple: boolean
} {
  const vals = values.map((v) => v.trim()).filter((v) => v && v !== CLEAR_MARK)
  if (vals.length === 0) return { valueType: 'list', unit: null, allowMultiple: false }
  const units = new Set<string>()
  let numeric = true
  let range = false
  for (const v of vals) {
    const r = v.match(RANGE_RE)
    const m = r ? null : v.match(NUMBER_RE)
    if (!r && !m) {
      numeric = false
      break
    }
    if (r) range = true
    const unit = (r ? r[3] : m![2])?.trim()
    units.add(unit ? unit : '')
  }
  if (numeric && units.size === 1) {
    const unit = [...units][0] || null
    return { valueType: range ? 'range' : 'number', unit, allowMultiple: false }
  }
  if (vals.every((v) => parseBool(v) != null)) return { valueType: 'boolean', unit: null, allowMultiple: false }
  return { valueType: 'list', unit: null, allowMultiple: vals.some((v) => splitList(v).length > 1) }
}

// ---------------------------------------------------------------------------
// Hivatkozások: kategória, jellemzőérték
// ---------------------------------------------------------------------------

type CategoryHit =
  | { kind: 'found'; id: string; category: ShopXCategory | null; path: string }
  | { kind: 'ambiguous'; paths: string[] }
  | { kind: 'missing'; key: string; parts: string[]; suggestion: ShopXCategory | null }

function splitPath(raw: string): string[] {
  return raw
    .split(/\s*[>|]\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function categoryKey(parts: string[]): string {
  return `cat:${parts.map(foldKey).join(' > ')}`
}

function createLabelForPath(ctx: ShopXContext, parts: string[]): string {
  const fresh: string[] = []
  for (let i = 0; i < parts.length; i++) {
    const prefix = parts.slice(0, i + 1).map(foldKey).join(' > ')
    if (!ctx.categories.some((c) => foldKey(c.path) === prefix)) fresh.push(parts[i])
  }
  return `${parts.join(' > ')}${fresh.length > 0 && fresh.length < parts.length ? ` (új: ${fresh.join(' > ')})` : ''}`
}

// ---------------------------------------------------------------------------

export function buildShopImportPlan(ctx: ShopXContext, wb: ShopXWorkbook, decisions: ShopXDecisions): ShopXPlan {
  const exact = wb.snapshot
  const works = new Map<string, Work>()
  const orphanItems = new Map<string, ShopXItem>()
  const problems = new Map<string, ShopXProblem>()
  const pending = new Map<string, ShopXPending>()
  const creations = new Map<string, ShopXCreation>()
  const catalogOps: ShopXCatalogOp[] = []
  const mappings = new Map<string, ShopXMappingWrite>()
  const placeholderLabel = new Map<string, { attributeId: string; label: string }>()
  const notices: string[] = []
  const catalog: ShopXCatalogChanges = {
    categoriesCreated: [],
    categoriesUpdated: [],
    attributesCreated: [],
    attributesUpdated: [],
    valuesCreated: 0,
    groupsChanged: []
  }

  const addProblem = (ref: ShopXRowRef, message: string) => {
    const k = `${ref.sheet}:${ref.rowNumber}`
    const p = problems.get(k) ?? { sheet: ref.sheet, rowNumber: ref.rowNumber, messages: [] }
    if (!p.messages.includes(message)) p.messages.push(message)
    problems.set(k, p)
  }

  const issue = (item: ShopXItem, level: ShopXIssueLevel, where: string, message: string, ref?: ShopXRowRef) => {
    const it: ShopXIssue = { level, where, message }
    if (!item.issues.some((x) => x.where === where && x.message === message)) item.issues.push(it)
    if (level === 'error' && ref) addProblem(ref, `${where}: ${message}`)
  }

  const whereOf = (sheet: ShopXSheet, rowNumber: number) => `${SHOP_X_SHEET_LABEL[sheet]} ${rowNumber}. sor`

  const dateCells = <C extends string>(r: RawRow<C>, labels: Partial<Record<C, string>>): string | null => {
    const hit = (r.dates ?? []).filter((c) => labels[c])
    if (hit.length === 0) return null
    return `Az Excel dátummá alakította (${hit.map((c) => labels[c]).join(', ')}: ${hit.map((c) => r.cells[c]).join(', ')}). Állítsd a cellát Szöveg formátumúra, és írd be újra.`
  }

  // --- Döntések (javaslat / választás / létrehozás / megjegyzett) -------------
  const mappingKindOf = (kind: ShopXPendingKind) => kind

  const validTarget = (kind: ShopXPendingKind, id: string, attributeId: string | null): boolean => {
    if (kind === 'category') return ctx.categoryById.has(id)
    if (kind === 'attribute') return ctx.attributeById.has(id)
    const owner = ctx.valueOwner.get(id)
    return Boolean(owner && (!attributeId || owner.id === attributeId))
  }

  const resolveDecision = (
    key: string,
    kind: ShopXPendingKind,
    suggestionId: string | null,
    attributeId: string | null
  ): { resolved: Resolved; remembered: boolean } => {
    const d = decisions[key]
    if (d === 'create') return { resolved: { type: 'create' }, remembered: false }
    if (d === 'suggestion') {
      return { resolved: suggestionId ? { type: 'use', id: suggestionId } : null, remembered: false }
    }
    if (typeof d === 'string' && d.startsWith('use:')) {
      const id = d.slice(4)
      return { resolved: validTarget(kind, id, attributeId) ? { type: 'use', id } : null, remembered: false }
    }
    if (d == null) {
      const m = ctx.mappings.get(`${mappingKindOf(kind)}:${key}`)
      if (m && validTarget(kind, m, attributeId)) return { resolved: { type: 'use', id: m }, remembered: true }
    }
    return { resolved: null, remembered: false }
  }

  const registerPending = (
    p: Omit<ShopXPending, 'rowCount' | 'choice' | 'remembered' | 'candidates'>,
    opts: { suggestionId: string | null; attributeId: string | null; candidates: () => { id: string; label: string }[] }
  ): Resolved => {
    const { resolved, remembered } = resolveDecision(p.key, p.kind, opts.suggestionId, opts.attributeId)
    const prev = pending.get(p.key)
    if (prev) prev.rowCount += 1
    else {
      const d = decisions[p.key]
      pending.set(p.key, {
        ...p,
        candidates: pending.size < CANDIDATE_PENDING_LIMIT ? opts.candidates() : [],
        rowCount: 1,
        choice: remembered && resolved?.type === 'use' ? `use:${resolved.id}` : resolved ? (d ?? null) : null,
        remembered
      })
    }
    if (resolved?.type === 'use' && !remembered) {
      mappings.set(p.key, { kind: mappingKindOf(p.kind), sourceKey: p.key, targetId: resolved.id })
    }
    return resolved
  }

  const orphan = (sheet: ShopXSheet, rowNumber: number, sku: string, message: string) => {
    const key = `sku:${foldKey(sku) || `${sheet}-${rowNumber}`}`
    const item = orphanItems.get(key) ?? {
      key,
      sku,
      name: '',
      accessoryId: null,
      rows: [],
      status: 'error' as const,
      changes: [],
      shop: 'off' as const,
      shopReasons: [],
      issues: []
    }
    item.rows.push({ sheet, rowNumber })
    issue(item, 'error', sheet === 'products' ? 'SKU' : whereOf(sheet, rowNumber), message, { sheet, rowNumber })
    orphanItems.set(key, item)
  }

  /** Katalógus-lapok (Kategóriák, Tulajdonságok, Változatcsoportok) hibái — nem termékhez kötődnek. */
  const catalogItem = (sheet: ShopXSheet): ShopXItem => {
    const key = `sheet:${sheet}`
    const existing = orphanItems.get(key)
    if (existing) return existing
    const item: ShopXItem = {
      key,
      sku: '',
      name: `${SHOP_X_SHEET_LABEL[sheet]} lap`,
      accessoryId: null,
      rows: [],
      status: 'error',
      changes: [],
      shop: 'off',
      shopReasons: [],
      issues: []
    }
    orphanItems.set(key, item)
    return item
  }
  const catalogIssue = (sheet: ShopXSheet, rowNumber: number, level: ShopXIssueLevel, message: string) => {
    const item = catalogItem(sheet)
    if (!item.rows.some((r) => r.rowNumber === rowNumber)) item.rows.push({ sheet, rowNumber })
    issue(item, level, whereOf(sheet, rowNumber), message, { sheet, rowNumber })
  }

  const workFor = (product: ShopXProduct): Work => {
    let w = works.get(product.id)
    if (w) return w
    const before = valuesFromProduct(product)
    w = {
      product,
      before,
      values: {
        ...before,
        attributeValueIds: [...before.attributeValueIds],
        attributeInputs: [...before.attributeInputs]
      },
      attrs: {
        valueIds: new Set(product.valueIds),
        inputs: new Map(product.inputs.map((i) => [i.attributeId, i]))
      },
      touchedAttrs: new Set(),
      faqTouched: false,
      requested: null,
      cellsSeen: new Set(),
      productRow: null,
      skipped: false,
      related: null,
      altAdd: [],
      altRemove: [],
      documents: null,
      item: {
        key: product.id,
        sku: product.sku,
        name: product.name,
        accessoryId: product.id,
        rows: [],
        status: 'unchanged',
        changes: [],
        shop: product.web?.sellable_web ? 'stays_live' : 'off',
        shopReasons: [],
        issues: []
      }
    }
    works.set(product.id, w)
    return w
  }

  const lookupSku = (raw: string | undefined, sheet: ShopXSheet, rowNumber: number): ShopXProduct | null => {
    const sku = (raw ?? '').trim()
    if (!sku) {
      orphan(sheet, rowNumber, '', 'Hiányzik az SKU — enélkül nem tudjuk, melyik termék.')
      return null
    }
    const product = ctx.bySku.get(foldKey(sku))
    if (product) return product
    orphan(
      sheet,
      rowNumber,
      sku,
      ctx.deletedSkus.has(foldKey(sku))
        ? 'Ez a termék törölve van.'
        : 'Ilyen termék nincs. Előbb vedd fel a Termékek oldalon (ez a fájl nem hoz létre terméket).'
    )
    return null
  }

  // --- Fájl szintű ---------------------------------------------------------
  if (wb.version != null && wb.version > SHOP_EXCEL_VERSION) {
    notices.push('Ez a fájl egy újabb sablonból készült. Ami ismeretlen benne, azt kihagyjuk.')
  }
  if (exact) {
    notices.push(
      'Ez egy mentés előtti állapot (visszaállító fájl): a benne lévő termékek minden adata pontosan erre áll vissza.'
    )
  }
  const sheets: [ShopXSheet, RawSheet<string> | null][] = [
    ['products', wb.products],
    ['specs', wb.specs],
    ['faq', wb.faq],
    ['related', wb.related],
    ['documents', wb.documents],
    ['groups', wb.groups],
    ['categories', wb.categories],
    ['attributes', wb.attributes]
  ]
  const unknown = sheets.flatMap(([sheet, s]) =>
    (s?.unknownHeaders ?? []).filter(Boolean).map((h) => `${h} (${SHOP_X_SHEET_LABEL[sheet]})`)
  )
  if (unknown.length > 0) {
    notices.push(`Ezeket az oszlopokat nem ismerjük, kihagytuk: ${unknown.slice(0, 8).join(', ')}${unknown.length > 8 ? '…' : ''}.`)
  }
  if (!ctx.bulkReady && (wb.groups?.rows.length ?? 0) > 0) {
    notices.push('A Változatcsoportok lap mentéséhez még egy adatbázis frissítés kell — most kihagyjuk.')
  }

  // --- Jellemzők (létező + a fájlban létrehozandó) ---------------------------
  const allAttributes: ShopXAttribute[] = [...ctx.attributes]
  const attrByKey = new Map<string, ShopXAttribute>()
  for (const a of ctx.attributes) {
    attrByKey.set(foldKey(a.name), a)
    if (a.code) attrByKey.set(foldKey(a.code), a)
  }
  /** attribútum id → foldKey(label) → (létező vagy PLACEHOLDER) érték id */
  const plannedValues = new Map<string, Map<string, string>>()

  const planValue = (attr: ShopXAttribute, label: string): string => {
    const key = `val:${attr.id}:${foldKey(label)}`
    const placeholder = `${PLACEHOLDER}${key}`
    if (!creations.has(key)) {
      creations.set(key, { kind: 'value', key, attributeId: attr.id, label: label.slice(0, 120) })
      catalog.valuesCreated++
    }
    placeholderLabel.set(placeholder, { attributeId: attr.id, label })
    const m = plannedValues.get(attr.id) ?? new Map<string, string>()
    m.set(foldKey(label), placeholder)
    plannedValues.set(attr.id, m)
    return placeholder
  }

  const planAttribute = (c: Omit<ShopXAttributeCreate, 'kind' | 'key'>): ShopXAttribute => {
    const key = `attr:${foldKey(c.name)}`
    const synthetic: ShopXAttribute = {
      id: `${PLACEHOLDER}${key}`,
      name: c.name,
      code: '',
      valueType: c.valueType,
      unit: c.unit,
      allowMultiple: c.allowMultiple,
      isVariantAxis: c.isVariantAxis,
      active: c.active,
      sortOrder: 1000,
      values: [],
      usage: 0
    }
    creations.set(key, { kind: 'attribute', key, ...c })
    catalog.attributesCreated.push(c.name)
    allAttributes.push(synthetic)
    attrByKey.set(foldKey(c.name), synthetic)
    return synthetic
  }

  // --- Tulajdonságok lap ---------------------------------------------------
  const seenAttrRows = new Map<string, number>()
  for (const r of wb.attributes?.rows ?? []) {
    const n = r.rowNumber
    const name = (r.cells.name ?? '').trim()
    if (!name) {
      catalogIssue('attributes', n, 'error', 'Hiányzik a jellemző neve.')
      continue
    }
    const k = foldKey(name)
    const dupRow = seenAttrRows.get(k)
    if (dupRow) {
      catalogIssue('attributes', n, 'error', `Kétszer szerepel (${dupRow}. sor is). Hagyd meg az egyiket.`)
      continue
    }
    seenAttrRows.set(k, n)
    const typeRaw = (r.cells.type ?? '').trim()
    const valueType = typeRaw ? ATTRIBUTE_TYPE_ALIASES[foldKey(typeRaw)] : undefined
    if (typeRaw && !valueType) {
      catalogIssue('attributes', n, 'error', `Ismeretlen típus: „${typeRaw}”. Lista, Szám, Tartomány vagy Igen/nem.`)
      continue
    }
    const unitRaw = (r.cells.unit ?? '').trim()
    const unit = unitRaw === CLEAR_MARK ? null : unitRaw ? unitRaw.slice(0, 20) : undefined
    const boolCell = (id: 'multiple' | 'variantAxis' | 'active', label: string): boolean | undefined | 'bad' => {
      const raw = (r.cells[id] ?? '').trim()
      if (!raw) return undefined
      const b = parseBool(raw)
      if (b == null) {
        catalogIssue('attributes', n, 'error', `${label}: írj igen-t vagy nem-et.`)
        return 'bad'
      }
      return b
    }
    const multiple = boolCell('multiple', 'Több érték')
    const axis = boolCell('variantAxis', 'Változat szempont')
    const active = boolCell('active', 'Látható')
    if (multiple === 'bad' || axis === 'bad' || active === 'bad') continue
    const valueLabels = [...new Set(splitList(r.cells.values ?? '').filter((v) => v !== CLEAR_MARK))]
    const tooLong = valueLabels.find((v) => v.length > 120)
    if (tooLong) {
      catalogIssue('attributes', n, 'error', `Egy érték legfeljebb 120 karakter: „${tooLong.slice(0, 40)}…”`)
      continue
    }

    const existing = attrByKey.get(k)
    const target =
      existing ??
      planAttribute({
        name: name.slice(0, 80),
        valueType: valueType ?? 'list',
        unit: unit ?? null,
        allowMultiple: multiple ?? false,
        isVariantAxis: axis ?? false,
        active: active ?? true
      })
    if (existing && !existing.id.startsWith(PLACEHOLDER)) {
      const patch: ShopXAttributePatch = {}
      if (valueType && valueType !== existing.valueType) {
        if (existing.usage > 0) {
          catalogIssue(
            'attributes',
            n,
            'error',
            `A(z) „${existing.name}” típusa nem váltható: ${existing.usage} termék már használja. Hozz létre új jellemzőt.`
          )
          continue
        }
        patch.value_type = valueType
      }
      if (unit !== undefined && unit !== existing.unit) patch.unit = unit
      if (multiple !== undefined && multiple !== existing.allowMultiple) patch.allow_multiple = multiple
      if (axis !== undefined && axis !== existing.isVariantAxis) patch.is_variant_axis = axis
      if (active !== undefined && active !== existing.active) patch.active = active
      if (Object.keys(patch).length > 0) {
        catalogOps.push({ kind: 'attributeUpdate', attributeId: existing.id, name: existing.name, patch })
        catalog.attributesUpdated.push(existing.name)
      }
    }
    if ((valueType ?? target.valueType) !== 'list' && valueLabels.length > 0) {
      catalogIssue('attributes', n, 'warning', 'Értékeket csak Lista típusnál veszünk fel — ezeket kihagytuk.')
      continue
    }
    for (const label of valueLabels) {
      if (target.values.some((v) => foldKey(v.label) === foldKey(label))) continue
      if (plannedValues.get(target.id)?.has(foldKey(label))) continue
      planValue(target, label)
    }
  }

  // --- Kategóriák (létező + a fájlban létrehozandó) ---------------------------
  const plannedCats = new Map<string, { key: string; parts: string[] }>()

  const findCategory = (raw: string): CategoryHit => {
    const parts = splitPath(raw)
    const folded = parts.map(foldKey).join(' > ')
    const exactHit = ctx.categories.find((c) => foldKey(c.path) === folded)
    if (exactHit) return { kind: 'found', id: exactHit.id, category: exactHit, path: exactHit.path }
    const planned = plannedCats.get(folded)
    if (planned) return { kind: 'found', id: `${PLACEHOLDER}${planned.key}`, category: null, path: planned.parts.join(' > ') }
    const matches =
      parts.length === 1
        ? ctx.categories.filter((c) => foldKey(c.name) === folded)
        : ctx.categories.filter((c) => foldKey(c.path).endsWith(` > ${folded}`))
    if (matches.length === 1) return { kind: 'found', id: matches[0].id, category: matches[0], path: matches[0].path }
    if (matches.length > 1) return { kind: 'ambiguous', paths: matches.map((c) => c.path) }
    const suggestion =
      parts.length === 1
        ? closest(folded, ctx.categories, (c) => foldKey(c.name))
        : closest(folded, ctx.categories, (c) => foldKey(c.path))
    return { kind: 'missing', key: categoryKey(parts), parts, suggestion }
  }

  const planCategory = (parts: string[]): string => {
    const key = categoryKey(parts)
    if (!creations.has(key)) {
      creations.set(key, { kind: 'category', key, parts })
      plannedCats.set(parts.map(foldKey).join(' > '), { key, parts })
      catalog.categoriesCreated.push(parts.join(' > '))
    }
    return `${PLACEHOLDER}${key}`
  }

  const attrIdsFromCell = (
    raw: string,
    sheet: ShopXSheet,
    rowNumber: number,
    label: string
  ): string[] | null => {
    const ids: string[] = []
    for (const name of splitList(raw)) {
      const a = attrByKey.get(foldKey(name))
      if (!a) {
        const guess = closest(foldKey(name), allAttributes, (x) => foldKey(x.name))
        catalogIssue(
          sheet,
          rowNumber,
          'error',
          `${label}: nincs ilyen jellemző: „${name}”.${guess ? ` Erre gondoltál: ${guess.name}?` : ''} Vedd fel a Tulajdonságok lapon.`
        )
        return null
      }
      if (!ids.includes(a.id)) ids.push(a.id)
    }
    return ids
  }

  // --- Kategóriák lap ------------------------------------------------------
  const seenCatRows = new Map<string, number>()
  for (const r of wb.categories?.rows ?? []) {
    const n = r.rowNumber
    const parts = splitPath(r.cells.path ?? '')
    if (parts.length === 0) {
      catalogIssue('categories', n, 'error', 'Hiányzik az útvonal (pl. Konyha > Zsanérok).')
      continue
    }
    if (parts.length > 6) {
      catalogIssue('categories', n, 'error', 'Legfeljebb 6 szint mélységű lehet.')
      continue
    }
    const long = parts.find((p) => p.length > 120)
    if (long) {
      catalogIssue('categories', n, 'error', `Egy szint neve legfeljebb 120 karakter: „${long.slice(0, 40)}…”`)
      continue
    }
    const folded = parts.map(foldKey).join(' > ')
    const dupRow = seenCatRows.get(folded)
    if (dupRow) {
      catalogIssue('categories', n, 'error', `Kétszer szerepel (${dupRow}. sor is). Hagyd meg az egyiket.`)
      continue
    }
    seenCatRows.set(folded, n)

    const existing = ctx.categories.find((c) => foldKey(c.path) === folded) ?? null
    const patch: ShopXCategoryPatch = {}
    const activeRaw = (r.cells.active ?? '').trim()
    if (activeRaw) {
      const b = parseBool(activeRaw)
      if (b == null) {
        catalogIssue('categories', n, 'error', 'Látható: írj igen-t vagy nem-et.')
        continue
      }
      if (!existing || existing.active !== b) patch.active = b
    }
    const googleRaw = (r.cells.google ?? '').trim()
    if (googleRaw) {
      const g = googleRaw === CLEAR_MARK ? null : googleRaw.slice(0, 240)
      if (!existing || existing.googleTaxonomyId !== g) patch.google_taxonomy_id = g
    }
    const measureRaw = (r.cells.measureImage ?? '').trim()
    if (measureRaw) {
      if (measureRaw === CLEAR_MARK) {
        if (!existing || existing.measureImageUrl) patch.measure_image_url = null
      } else {
        const m = ctx.mediaByFilename.get(measureRaw.toLowerCase())
        if (!m || !m.mime.startsWith('image/')) {
          catalogIssue('categories', n, 'error', `Mérési ábra: nincs ilyen kép a Média könyvtárban: „${measureRaw}”.`)
          continue
        }
        if (!existing || existing.measureImageUrl !== m.url) patch.measure_image_url = m.url
      }
    }
    const tplCell = (id: 'keyAttrs' | 'specAttrs', label: string): string[] | undefined | 'bad' => {
      const raw = (r.cells[id] ?? '').trim()
      if (!raw) return undefined
      if (raw === CLEAR_MARK) return []
      return attrIdsFromCell(raw, 'categories', n, label) ?? 'bad'
    }
    const keyAttrs = tplCell('keyAttrs', 'Fő jellemzők')
    const specAttrs = tplCell('specAttrs', 'További jellemzők')
    if (keyAttrs === 'bad' || specAttrs === 'bad') continue
    if (keyAttrs && keyAttrs.length > MAX_KEY_ATTRS) {
      catalogIssue('categories', n, 'error', `Legfeljebb ${MAX_KEY_ATTRS} fő jellemző lehet (most ${keyAttrs.length}).`)
      continue
    }
    const specOnly = specAttrs?.filter((id) => !keyAttrs?.includes(id))
    const tplOf = (role: 'key' | 'spec') =>
      (existing?.template ?? [])
        .filter((t) => t.role === role)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((t) => t.attributeId)
    const keyChanged = keyAttrs !== undefined && !same(keyAttrs, tplOf('key'))
    const specChanged = specOnly !== undefined && !same(specOnly, tplOf('spec'))

    const categoryId = existing ? existing.id : planCategory(parts)
    if (Object.keys(patch).length > 0 || keyChanged || specChanged) {
      catalogOps.push({
        kind: 'categoryUpdate',
        categoryId,
        path: parts.join(' > '),
        patch,
        ...(keyChanged ? { keyAttrs } : {}),
        ...(specChanged ? { specAttrs: specOnly } : {})
      })
      if (existing) catalog.categoriesUpdated.push(existing.path)
    }
  }

  const groupCodeByFold = new Map<string, string>()
  for (const g of ctx.groups.values()) groupCodeByFold.set(foldKey(g.code), g.code)
  for (const p of ctx.products) {
    const g = p.web?.web_group_id?.trim()
    if (g && !groupCodeByFold.has(foldKey(g))) groupCodeByFold.set(foldKey(g), g)
  }

  // --- Bolt lap ------------------------------------------------------------
  const productRows = wb.products?.rows ?? []
  const productCols = new Set(wb.products?.columns ?? [])
  const skuRows = new Map<string, number[]>()
  for (const r of productRows) {
    const k = foldKey(r.cells.sku ?? '')
    if (!k) continue
    skuRows.set(k, [...(skuRows.get(k) ?? []), r.rowNumber])
  }
  const shopLabels = Object.fromEntries(SHOP_COLUMNS.map((c) => [c.id, c.label])) as Record<ShopColumnId, string>

  for (const r of productRows) {
    const ref: ShopXRowRef = { sheet: 'products', rowNumber: r.rowNumber }
    const product = lookupSku(r.cells.sku, 'products', r.rowNumber)
    if (!product) continue
    const w = workFor(product)
    w.item.rows.push(ref)
    const dup = skuRows.get(foldKey(product.sku)) ?? []
    if (dup.length > 1) {
      w.skipped = true
      issue(w.item, 'error', 'SKU', `Kétszer szerepel a fájlban (${dup.join('. és ')}. sor). Hagyd meg csak az egyiket.`, ref)
      continue
    }
    w.productRow = r.rowNumber
    const dated = new Set<string>(r.dates ?? [])
    const dateMsg = dateCells(r, shopLabels)
    if (dateMsg) issue(w.item, 'error', 'Dátum', dateMsg, ref)
    for (const col of SHOP_COLUMNS) {
      if (dated.has(col.id)) continue
      let raw = r.cells[col.id]
      if ((raw == null || raw === '') && exact && FIELD[col.id] && productCols.has(col.id)) raw = CLEAR_MARK
      if (raw == null || raw === '') continue
      w.cellsSeen.add(col.id)
      applyProductCell(w, col, raw, ref)
    }
  }

  function applyProductCell(w: Work, col: ShopColumn, raw: string, ref: ShopXRowRef) {
    const clear = raw.trim() === CLEAR_MARK
    const v = w.values
    const fail = (message: string) => issue(w.item, 'error', col.label, message, ref)
    const p = w.product

    switch (col.kind) {
      case 'key':
      case 'info':
        return
      case 'availability': {
        if (clear) {
          w.requested = false
          return
        }
        const b = parseBool(raw)
        if (b == null) return fail('Írj igen-t vagy nem-et.')
        w.requested = b
        return
      }
      case 'text': {
        const field = FIELD[col.id] as keyof Values
        if (clear) {
          ;(v as Record<string, unknown>)[field] = null
          return
        }
        const text = raw.trim()
        const prev = (w.before as Record<string, unknown>)[field]
        if (typeof prev === 'string' && prev.trim() === text) return
        if (col.max && text.length > col.max) {
          return fail(`${text.length} karakter, legfeljebb ${col.max} lehet.`)
        }
        ;(v as Record<string, unknown>)[field] = text
        return
      }
      case 'list': {
        const field = FIELD[col.id] as keyof Values
        if (clear) {
          ;(v as Record<string, unknown>)[field] = []
          return
        }
        const items = [...new Set(splitList(raw))]
        const long = items.find((i) => i.length > (col.max ?? 120))
        if (long) return fail(`Egy elem legfeljebb ${col.max ?? 120} karakter: „${long.slice(0, 40)}…”`)
        if (items.length > MAX_LIST_ITEMS) return fail(`Legfeljebb ${MAX_LIST_ITEMS} elem lehet (most ${items.length}).`)
        ;(v as Record<string, unknown>)[field] = items
        return
      }
      case 'bool': {
        const field = FIELD[col.id] as keyof Values
        if (clear) {
          ;(v as Record<string, unknown>)[field] = false
          return
        }
        const b = parseBool(raw)
        if (b == null) return fail('Írj igen-t vagy nem-et.')
        ;(v as Record<string, unknown>)[field] = b
        return
      }
      case 'decimal': {
        const field = FIELD[col.id] as keyof Values
        if (clear) {
          ;(v as Record<string, unknown>)[field] = null
          return
        }
        const n = parseNumberHu(raw.replace(/\s*(cm|kg|mm|g)$/i, ''))
        if (n == null || Number.isNaN(n)) return fail(`Csak szám lehet (pl. 2,5), ez nem az: „${raw}”.`)
        if (n < 0) return fail('Nem lehet negatív.')
        ;(v as Record<string, unknown>)[field] = n
        return
      }
      case 'int': {
        if (clear) {
          v.webMultipack = null
          return
        }
        const n = parseNumberHu(raw.replace(/\s*db$/i, ''))
        if (n == null || Number.isNaN(n) || !Number.isInteger(n)) return fail('Egész szám kell (pl. 6).')
        if (n <= 1) {
          v.webMultipack = null
          issue(w.item, 'info', col.label, '1 darabot nem jelzünk külön — üresnek vettük.')
          return
        }
        if (n > 10000) return fail('Legfeljebb 10 000 lehet.')
        v.webMultipack = n
        return
      }
      case 'netUnit': {
        if (clear) {
          v.webNetUnit = null
          return
        }
        const unit = NET_UNIT_ALIASES[foldKey(raw).replace(/\.$/, '')]
        if (!unit) return fail('Ezek közül válassz: g, kg, ml, l, db, m, m2.')
        v.webNetUnit = unit
        return
      }
      case 'country': {
        if (clear) {
          v.webCountryOfOrigin = null
          return
        }
        const code = countryCodeOf(raw)
        if (!code) {
          const guess = closest(foldKey(raw), countryOptions(), (o) => foldKey(o.name))
          return fail(`Nem ismerjük ezt az országot: „${raw}”.${guess ? ` Erre gondoltál: ${guess.name}?` : ''}`)
        }
        v.webCountryOfOrigin = code
        return
      }
      case 'video': {
        if (clear) {
          v.webVideoUrl = null
          return
        }
        if (!youtubeIdOf(raw.trim())) return fail('Csak YouTube link adható meg (https://www.youtube.com/watch?v=…).')
        v.webVideoUrl = raw.trim()
        return
      }
      case 'slug': {
        if (clear) {
          v.webSlug = null
          return
        }
        const t = raw.trim()
        const norm = suggestWebSlug(t)
        if (!norm) return fail('A webcím csak kisbetű, szám és kötőjel lehet.')
        if (norm !== t) issue(w.item, 'info', col.label, `Átalakítottuk erre: ${norm}`)
        v.webSlug = norm
        return
      }
      case 'category': {
        if (clear) {
          v.webCategoryId = null
          return
        }
        const hit = findCategory(raw)
        if (hit.kind === 'found') {
          v.webCategoryId = hit.id
          if (hit.category && !hit.category.active) {
            issue(w.item, 'warning', col.label, `A(z) „${hit.path}” kategória rejtett — a termék nem látszik benne.`)
          }
          return
        }
        if (hit.kind === 'ambiguous') {
          return fail(`Több ilyen kategória van. Írd ki az útvonalat: ${hit.paths.slice(0, 3).join(' vagy ')}.`)
        }
        const folded = hit.parts.map(foldKey).join(' > ')
        const resolved = registerPending(
          {
            key: hit.key,
            kind: 'category',
            raw: hit.parts.join(' > '),
            attributeName: null,
            suggestion: hit.suggestion?.path ?? null,
            createLabel: createLabelForPath(ctx, hit.parts)
          },
          {
            suggestionId: hit.suggestion?.id ?? null,
            attributeId: null,
            candidates: () =>
              rankCandidates(folded, ctx.categories, (c) => foldKey(hit.parts.length === 1 ? c.name : c.path)).map((c) => ({
                id: c.id,
                label: c.path
              }))
          }
        )
        if (resolved?.type === 'use') {
          v.webCategoryId = resolved.id
          return
        }
        if (resolved?.type === 'create') {
          v.webCategoryId = planCategory(hit.parts)
          return
        }
        return fail(
          `Nincs ilyen kategória: „${hit.parts.join(' > ')}”.${hit.suggestion ? ` Erre gondoltál: ${hit.suggestion.path}?` : ''} Döntsd el fent, mi legyen vele.`
        )
      }
      case 'group': {
        if (clear) {
          v.webGroupId = null
          return
        }
        const t = raw.trim()
        if (t.length > (col.max ?? 64)) return fail(`Legfeljebb ${col.max ?? 64} karakter.`)
        const known = groupCodeByFold.get(foldKey(t))
        if (!known) groupCodeByFold.set(foldKey(t), t)
        v.webGroupId = known ?? t
        return
      }
      case 'tiers': {
        if (clear) {
          v.webPriceTiers = []
          return
        }
        const parsed = parseTiersGross(raw, p.vatPercent, p.priceGross)
        if (!parsed.ok) return fail(parsed.message)
        v.webPriceTiers = parsed.tiers
        return
      }
      case 'money': {
        if (clear) {
          v.webCompareAtPrice = null
          return
        }
        const n = parseNumberHu(raw.replace(/\s*ft$/i, ''))
        if (n == null || Number.isNaN(n) || n < 0) return fail('Érvényes forint összeg kell (pl. 2990).')
        const rounded = Math.round(n)
        if (rounded <= p.priceGross) {
          issue(w.item, 'warning', col.label, `Nem nagyobb az eladási árnál (${p.priceGross} Ft) — ez nem akció.`)
        }
        v.webCompareAtPrice = rounded
        return
      }
      case 'media': {
        if (clear) {
          v.webDimensionImageUrl = null
          return
        }
        const m = ctx.mediaByFilename.get(raw.trim().toLowerCase())
        if (!m || !m.mime.startsWith('image/')) return fail(`Nincs ilyen kép a Média könyvtárban: „${raw.trim()}”.`)
        v.webDimensionImageUrl = m.url
        return
      }
    }
  }

  // --- Jellemzők lap -------------------------------------------------------
  type SpecEntry = { ref: ShopXRowRef; clear: boolean; valueIds: string[]; input: AttributeInput | null }
  const specByProduct = new Map<string, Map<string, SpecEntry>>()
  const specLabels = { attribute: 'Jellemző', value: 'Érték' } as const

  const specValuesByName = new Map<string, string[]>()
  for (const r of wb.specs?.rows ?? []) {
    const name = foldKey(r.cells.attribute ?? '')
    if (!name || attrByKey.has(name)) continue
    specValuesByName.set(name, [...(specValuesByName.get(name) ?? []), r.cells.value ?? ''])
  }

  const resolveAttribute = (attrRaw: string): { attr: ShopXAttribute | null; message: string | null } => {
    const found = attrByKey.get(foldKey(attrRaw))
    if (found) return { attr: found, message: null }
    const key = `attr:${foldKey(attrRaw)}`
    const guess = closest(foldKey(attrRaw), ctx.attributes, (a) => foldKey(a.name))
    const inferred = inferAttributeType(specValuesByName.get(foldKey(attrRaw)) ?? [])
    const typeLabel = { list: 'lista', number: 'szám', range: 'tartomány', boolean: 'igen/nem' }[inferred.valueType]
    const resolved = registerPending(
      {
        key,
        kind: 'attribute',
        raw: attrRaw,
        attributeName: null,
        suggestion: guess?.name ?? null,
        createLabel: `${attrRaw} (${typeLabel}${inferred.unit ? `, ${inferred.unit}` : ''}${inferred.allowMultiple ? ', több érték' : ''})`
      },
      {
        suggestionId: guess?.id ?? null,
        attributeId: null,
        candidates: () =>
          rankCandidates(foldKey(attrRaw), ctx.attributes, (a) => foldKey(a.name)).map((a) => ({ id: a.id, label: a.name }))
      }
    )
    if (resolved?.type === 'use') {
      const a = ctx.attributeById.get(resolved.id) ?? null
      if (a) attrByKey.set(foldKey(attrRaw), a)
      return { attr: a, message: null }
    }
    if (resolved?.type === 'create') {
      const a = planAttribute({
        name: attrRaw.slice(0, 80),
        valueType: inferred.valueType,
        unit: inferred.unit,
        allowMultiple: inferred.allowMultiple,
        isVariantAxis: false,
        active: true
      })
      return { attr: a, message: null }
    }
    return {
      attr: null,
      message: `Nincs ilyen jellemző: „${attrRaw}”.${guess ? ` Erre gondoltál: ${guess.name}?` : ''} Döntsd el fent, mi legyen vele.`
    }
  }

  for (const r of wb.specs?.rows ?? []) {
    const ref: ShopXRowRef = { sheet: 'specs', rowNumber: r.rowNumber }
    const where = whereOf('specs', r.rowNumber)
    if (!(r.cells.value ?? '').trim()) continue
    const product = lookupSku(r.cells.sku, 'specs', r.rowNumber)
    if (!product) continue
    const w = workFor(product)
    w.item.rows.push(ref)
    const dateMsg = dateCells(r, specLabels)
    if (dateMsg) {
      issue(w.item, 'error', where, dateMsg, ref)
      continue
    }
    const attrRaw = (r.cells.attribute ?? '').trim()
    const valueRaw = (r.cells.value ?? '').trim()
    if (!attrRaw) {
      issue(w.item, 'error', where, 'Hiányzik, melyik jellemző.', ref)
      continue
    }
    const { attr, message } = resolveAttribute(attrRaw)
    if (!attr) {
      issue(w.item, 'error', where, message ?? 'Ismeretlen jellemző.', ref)
      continue
    }
    if (!attr.active) {
      issue(w.item, 'warning', where, `A(z) „${attr.name}” jellemző ki van kapcsolva — nem jelenik meg a boltban.`)
    }
    const parsed = parseSpecValue(w, attr, valueRaw, ref, where)
    if (!parsed) continue
    const byAttr = specByProduct.get(product.id) ?? new Map<string, SpecEntry>()
    const prev = byAttr.get(attr.id)
    if (prev) {
      if (attr.valueType === 'list' && attr.allowMultiple && !prev.clear && !parsed.clear) {
        prev.valueIds = [...new Set([...prev.valueIds, ...parsed.valueIds])]
      } else {
        issue(
          w.item,
          'error',
          where,
          `A(z) „${attr.name}” kétszer szerepel ennél a terméknél (${prev.ref.rowNumber}. sor is). Hagyd meg az egyiket.`,
          ref
        )
        continue
      }
    } else {
      byAttr.set(attr.id, { ref, ...parsed })
    }
    specByProduct.set(product.id, byAttr)
  }

  function parseSpecValue(
    w: Work,
    attr: ShopXAttribute,
    raw: string,
    ref: ShopXRowRef,
    where: string
  ): Omit<SpecEntry, 'ref'> | null {
    const fail = (message: string) => {
      issue(w.item, 'error', where, `${attr.name}: ${message}`, ref)
      return null
    }
    if (raw === CLEAR_MARK) return { clear: true, valueIds: [], input: null }
    const isNew = attr.id.startsWith(PLACEHOLDER)

    if (attr.valueType === 'list') {
      const labels = splitList(raw)
      if (labels.length > 1 && !attr.allowMultiple) {
        return fail('ennél a jellemzőnél csak egy érték választható.')
      }
      const ids: string[] = []
      let unresolved = false
      for (const label of labels) {
        if (label.length > 120) return fail(`egy érték legfeljebb 120 karakter: „${label.slice(0, 40)}…”`)
        const found = attr.values.find((v) => foldKey(v.label) === foldKey(label))
        if (found) {
          if (!found.active) issue(w.item, 'warning', where, `${attr.name}: a(z) „${found.label}” érték ki van kapcsolva.`)
          ids.push(found.id)
          continue
        }
        const planned = plannedValues.get(attr.id)?.get(foldKey(label))
        if (planned) {
          ids.push(planned)
          continue
        }
        // Új jellemző: az értékei a létrehozással együtt jönnek.
        if (isNew) {
          ids.push(planValue(attr, label))
          continue
        }
        const key = `val:${attr.id}:${foldKey(label)}`
        const guess = closest(foldKey(label), attr.values, (v) => foldKey(v.label))
        const resolved = registerPending(
          {
            key,
            kind: 'value',
            raw: label,
            attributeName: attr.name,
            suggestion: guess?.label ?? null,
            createLabel: `${attr.name}: ${label}`
          },
          {
            suggestionId: guess?.id ?? null,
            attributeId: attr.id,
            candidates: () =>
              rankCandidates(foldKey(label), attr.values, (v) => foldKey(v.label)).map((v) => ({ id: v.id, label: v.label }))
          }
        )
        if (resolved?.type === 'use') ids.push(resolved.id)
        else if (resolved?.type === 'create') ids.push(planValue(attr, label))
        else {
          unresolved = true
          issue(
            w.item,
            'error',
            where,
            `${attr.name}: nincs ilyen érték: „${label}”.${guess ? ` Erre gondoltál: ${guess.label}?` : ''} Döntsd el fent, mi legyen vele — addig ez a jellemző nem változik.`,
            ref
          )
        }
      }
      if (unresolved || ids.length === 0) return null
      return { clear: false, valueIds: [...new Set(ids)], input: null }
    }

    if (attr.valueType === 'boolean') {
      const b = parseBool(raw)
      if (b == null) return fail('írj igen-t vagy nem-et.')
      return { clear: false, valueIds: [], input: { attributeId: attr.id, valueNum: null, valueMax: null, valueBool: b } }
    }

    const unitCheck = (unit: string | undefined): string | null => {
      const u = unit?.trim()
      if (!u) return null
      if (!attr.unit) return null
      return foldKey(u) === foldKey(attr.unit)
        ? null
        : `más mértékegység (${u}). Ennél ${attr.unit}-ben add meg — számold át.`
    }

    const rangeMatch = attr.valueType === 'range' ? raw.match(RANGE_RE) : null
    if (rangeMatch) {
      const a = parseNumberHu(rangeMatch[1])
      const b = parseNumberHu(rangeMatch[2])
      const unitErr = unitCheck(rangeMatch[3])
      if (unitErr) return fail(unitErr)
      if (a == null || b == null || Number.isNaN(a) || Number.isNaN(b)) return fail('így írd: 10-20.')
      if (b < a) return fail('a tartomány vége nem lehet kisebb az elejénél.')
      return { clear: false, valueIds: [], input: { attributeId: attr.id, valueNum: a, valueMax: b, valueBool: null } }
    }
    const m = raw.match(NUMBER_RE)
    if (!m) return fail(`csak szám lehet${attr.valueType === 'range' ? ' vagy tartomány (10-20)' : ''}, pl. 35.`)
    const unitErr = unitCheck(m[2])
    if (unitErr) return fail(unitErr)
    const n = parseNumberHu(m[1])
    if (n == null || Number.isNaN(n)) return fail('csak szám lehet, pl. 37,5.')
    if (n < 0) return fail('nem lehet negatív.')
    return { clear: false, valueIds: [], input: { attributeId: attr.id, valueNum: n, valueMax: null, valueBool: null } }
  }

  // Pillanatkép: a Bolt lap termékeinél ami nincs a Jellemzők lapon, az törlődik.
  if (exact && wb.specs) {
    for (const w of works.values()) {
      if (w.productRow == null) continue
      const byAttr = specByProduct.get(w.product.id) ?? new Map<string, SpecEntry>()
      const ref: ShopXRowRef = { sheet: 'products', rowNumber: w.productRow }
      for (const attr of ctx.attributes) {
        if (byAttr.has(attr.id)) continue
        const has = attr.valueType === 'list' ? attr.values.some((v) => w.attrs.valueIds.has(v.id)) : w.attrs.inputs.has(attr.id)
        if (has) byAttr.set(attr.id, { ref, clear: true, valueIds: [], input: null })
      }
      if (byAttr.size > 0) specByProduct.set(w.product.id, byAttr)
    }
  }

  for (const [productId, byAttr] of specByProduct) {
    const w = works.get(productId)!
    for (const [attrId, entry] of byAttr) {
      const attr = allAttributes.find((a) => a.id === attrId)!
      w.touchedAttrs.add(attrId)
      if (attr.valueType === 'list') {
        for (const v of attr.values) w.attrs.valueIds.delete(v.id)
        for (const id of [...w.attrs.valueIds]) {
          if (placeholderLabel.get(id)?.attributeId === attrId) w.attrs.valueIds.delete(id)
        }
        for (const id of entry.valueIds) w.attrs.valueIds.add(id)
      } else if (entry.clear || !entry.input) {
        w.attrs.inputs.delete(attrId)
      } else {
        w.attrs.inputs.set(attrId, entry.input)
      }
    }
  }

  // --- GYIK lap ------------------------------------------------------------
  const faqByProduct = new Map<string, { ref: ShopXRowRef; q: string; a: string; clear: boolean }[]>()
  const faqBroken = new Set<string>()
  for (const r of wb.faq?.rows ?? []) {
    const ref: ShopXRowRef = { sheet: 'faq', rowNumber: r.rowNumber }
    const where = whereOf('faq', r.rowNumber)
    const product = lookupSku(r.cells.sku, 'faq', r.rowNumber)
    if (!product) continue
    const w = workFor(product)
    w.item.rows.push(ref)
    const q = (r.cells.question ?? '').trim()
    const a = (r.cells.answer ?? '').trim()
    if (q === CLEAR_MARK) {
      faqByProduct.set(product.id, [...(faqByProduct.get(product.id) ?? []), { ref, q, a, clear: true }])
      continue
    }
    const problem = !q
      ? 'Hiányzik a kérdés.'
      : !a
        ? 'Hiányzik a válasz.'
        : q.length > 300
          ? `A kérdés ${q.length} karakter, legfeljebb 300 lehet.`
          : a.length > 2000
            ? `A válasz ${a.length} karakter, legfeljebb 2000 lehet.`
            : null
    if (problem) {
      faqBroken.add(product.id)
      issue(w.item, 'error', where, `${problem} Ennél a terméknél a GYIK nem változik, amíg ki nem javítod.`, ref)
      continue
    }
    faqByProduct.set(product.id, [...(faqByProduct.get(product.id) ?? []), { ref, q, a, clear: false }])
  }
  if (exact && wb.faq) {
    for (const w of works.values()) {
      if (w.productRow == null || faqByProduct.has(w.product.id) || faqBroken.has(w.product.id)) continue
      if ((w.before.webFaq ?? []).length > 0) faqByProduct.set(w.product.id, [])
    }
  }
  for (const [productId, entries] of faqByProduct) {
    if (faqBroken.has(productId)) continue
    const w = works.get(productId)!
    const clear = entries.some((e) => e.clear)
    const list = entries.filter((e) => !e.clear)
    if (clear && list.length > 0) {
      issue(w.item, 'warning', 'GYIK', 'A - jel mellett kérdések is vannak — a kérdéseket mentjük, a törlést nem.')
    }
    if (list.length > SHOP_FAQ_MAX_PER_PRODUCT) {
      issue(
        w.item,
        'error',
        'GYIK',
        `Legfeljebb ${SHOP_FAQ_MAX_PER_PRODUCT} kérdés lehet egy terméknél (most ${list.length}). A GYIK nem változik.`,
        list[0].ref
      )
      continue
    }
    w.faqTouched = true
    w.values.webFaq = list.map((e) => ({ q: e.q, a: e.a }))
  }

  // --- Kapcsolatok lap -----------------------------------------------------
  type RelEntry = { ref: ShopXRowRef; relatedId: string; order: number | null; index: number }
  const relByProduct = new Map<string, Map<RelatedKind, RelEntry[]>>()
  const relCleared = new Map<string, Set<RelatedKind>>()
  const relBroken = new Map<string, Set<RelatedKind>>()
  const relSeenPair = new Map<string, number>()
  const ALL_KINDS = Object.keys(RELATED_KIND_META) as RelatedKind[]

  for (const [index, r] of (wb.related?.rows ?? []).entries()) {
    const ref: ShopXRowRef = { sheet: 'related', rowNumber: r.rowNumber }
    const where = whereOf('related', r.rowNumber)
    const product = lookupSku(r.cells.sku, 'related', r.rowNumber)
    if (!product) continue
    const w = workFor(product)
    w.item.rows.push(ref)
    const kindRaw = (r.cells.kind ?? '').trim()
    const relRaw = (r.cells.relatedSku ?? '').trim()
    const kind = kindRaw ? RELATED_KIND_ALIASES[foldKey(kindRaw)] : undefined
    if (kindRaw && !kind) {
      issue(w.item, 'error', where, `Ismeretlen típus: „${kindRaw}”. Ezek közül: ${RELATED_KIND_OPTIONS}.`, ref)
      continue
    }
    if (relRaw === CLEAR_MARK) {
      const set = relCleared.get(product.id) ?? new Set<RelatedKind>()
      for (const k of kind ? [kind] : ALL_KINDS) set.add(k)
      relCleared.set(product.id, set)
      continue
    }
    if (!kind) {
      issue(w.item, 'error', where, `Hiányzik a típus (${RELATED_KIND_OPTIONS}).`, ref)
      continue
    }
    const markBroken = () => {
      const set = relBroken.get(product.id) ?? new Set<RelatedKind>()
      set.add(kind)
      relBroken.set(product.id, set)
    }
    if (!relRaw) {
      markBroken()
      issue(w.item, 'error', where, 'Hiányzik a kapcsolt termék SKU-ja.', ref)
      continue
    }
    const target = ctx.bySku.get(foldKey(relRaw))
    if (!target) {
      markBroken()
      issue(
        w.item,
        'error',
        where,
        `Nincs ilyen kapcsolt termék: „${relRaw}”${ctx.deletedSkus.has(foldKey(relRaw)) ? ' (törölve van)' : ''}. Ez a típus nem változik.`,
        ref
      )
      continue
    }
    if (target.id === product.id) {
      issue(w.item, 'error', where, 'Egy termék nem kapcsolódhat saját magához.', ref)
      continue
    }
    const pairKey = `${product.id}:${target.id}`
    const prevRow = relSeenPair.get(pairKey)
    if (prevRow) {
      issue(
        w.item,
        'error',
        where,
        `${target.sku} már szerepel ennél a terméknél (${prevRow}. sor). Két termék között egy kapcsolat lehet.`,
        ref
      )
      continue
    }
    relSeenPair.set(pairKey, r.rowNumber)
    const orderRaw = (r.cells.order ?? '').trim()
    const order = orderRaw ? parseNumberHu(orderRaw) : null
    if (orderRaw && (order == null || Number.isNaN(order))) {
      issue(w.item, 'warning', where, 'A sorrend nem szám — a sorok sorrendjét használjuk.')
    }
    const byKind = relByProduct.get(product.id) ?? new Map<RelatedKind, RelEntry[]>()
    byKind.set(kind, [
      ...(byKind.get(kind) ?? []),
      { ref, relatedId: target.id, order: order != null && !Number.isNaN(order) ? order : null, index }
    ])
    relByProduct.set(product.id, byKind)
  }

  const relTouchedIds = new Set<string>([...relByProduct.keys(), ...relCleared.keys()])
  if (exact && wb.related) {
    for (const w of works.values()) if (w.productRow != null) relTouchedIds.add(w.product.id)
  }

  /** A fájl szerinti kívánt lista típusonként (csak az érintett típusok). */
  const desiredRel = new Map<string, Map<RelatedKind, string[]>>()
  for (const productId of relTouchedIds) {
    const w = works.get(productId)!
    const byKind = relByProduct.get(productId) ?? new Map<RelatedKind, RelEntry[]>()
    const cleared = relCleared.get(productId) ?? new Set<RelatedKind>()
    const broken = relBroken.get(productId) ?? new Set<RelatedKind>()
    const kinds = new Set<RelatedKind>(exact ? ALL_KINDS : [...byKind.keys(), ...cleared])
    const out = new Map<RelatedKind, string[]>()
    for (const kind of kinds) {
      if (broken.has(kind)) continue
      const entries = (byKind.get(kind) ?? []).sort(
        (a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || a.index - b.index
      )
      if (cleared.has(kind) && entries.length > 0) {
        issue(w.item, 'warning', 'Kapcsolatok', `${RELATED_KIND_META[kind].label}: a - jel mellett termékek is vannak — a termékeket mentjük.`)
      }
      out.set(kind, entries.map((e) => e.relatedId))
    }
    desiredRel.set(productId, out)
  }

  // Alternatíva kölcsönös: ha A-nál ott van B, B-nél is ott lesz A (pillanatképnél pontos másolat).
  if (!exact) {
    const addAlt = new Map<string, string[]>()
    for (const [productId, byKind] of desiredRel) {
      for (const other of byKind.get('alternative') ?? []) {
        const otherKinds = desiredRel.get(other)
        const otherAlt = otherKinds?.get('alternative')
        if (otherAlt && !otherAlt.includes(productId)) addAlt.set(other, [...(addAlt.get(other) ?? []), productId])
      }
    }
    for (const [productId, extra] of addAlt) {
      const list = desiredRel.get(productId)!.get('alternative')!
      list.push(...extra)
      const w = works.get(productId)!
      issue(
        w.item,
        'info',
        'Kapcsolatok',
        `Alternatívaként ide is bekerül: ${extra.map((id) => ctx.byId.get(id)?.sku ?? '').join(', ')} (kölcsönös).`
      )
    }
  }

  for (const [productId, byKind] of desiredRel) {
    const w = works.get(productId)!
    const current = ctx.related.get(productId) ?? []
    const currentOf = (kind: RelatedKind) => current.filter((c) => c.kind === kind).map((c) => c.relatedId)
    const finalByKind = new Map<RelatedKind, string[]>()
    for (const [kind, ids] of byKind) {
      if (ids.length > MAX_RELATED_PER_KIND) {
        const first = relByProduct.get(productId)?.get(kind)?.[0]?.ref
        issue(
          w.item,
          'error',
          'Kapcsolatok',
          `${RELATED_KIND_META[kind].label}: legfeljebb ${MAX_RELATED_PER_KIND} termék lehet (most ${ids.length}). Nem változik.`,
          first
        )
        continue
      }
      finalByKind.set(kind, ids)
    }
    // Két termék között egy kapcsolat: ha máshol (nem érintett típusban) már ott van, onnan átkerül.
    for (const [kind, ids] of [...finalByKind]) {
      for (const id of ids) {
        const other = current.find((c) => c.relatedId === id && c.kind !== kind)
        if (!other || finalByKind.has(other.kind)) continue
        finalByKind.set(
          other.kind,
          currentOf(other.kind).filter((x) => x !== id)
        )
        issue(
          w.item,
          'info',
          'Kapcsolatok',
          `${ctx.byId.get(id)?.sku ?? ''}: „${RELATED_KIND_META[other.kind].label}” helyett „${RELATED_KIND_META[kind].label}” lesz.`
        )
      }
    }
    for (const [kind, ids] of [...finalByKind]) {
      const cur = currentOf(kind)
      const moved = [...finalByKind.values()].flat()
      const lost = cur.filter((id) => !ids.includes(id) && !moved.includes(id))
      if (same(cur, ids) && lost.length === 0) finalByKind.delete(kind)
    }
    const beforeAlt = currentOf('alternative')
    const afterAlt = finalByKind.get('alternative') ?? beforeAlt
    if (!exact) {
      const hasPairTo = (from: string, to: string) => (ctx.related.get(from) ?? []).some((c) => c.relatedId === to)
      w.altAdd = afterAlt.filter((id) => !desiredRel.get(id)?.has('alternative') && !hasPairTo(id, productId))
      w.altRemove = beforeAlt.filter(
        (id) =>
          !afterAlt.includes(id) &&
          !desiredRel.get(id)?.has('alternative') &&
          (ctx.related.get(id) ?? []).some((c) => c.relatedId === productId && c.kind === 'alternative')
      )
    }
    if (finalByKind.size > 0) {
      w.related = {
        kinds: [...finalByKind.keys()],
        list: [...finalByKind].flatMap(([kind, ids]) => ids.map((relatedId, i) => ({ relatedId, kind, sortOrder: (i + 1) * 10 })))
      }
    }
  }

  // --- Dokumentumok lap ----------------------------------------------------
  type DocEntry = ShopXDocument & { ref: ShopXRowRef }
  const docsByProduct = new Map<string, DocEntry[]>()
  const docsCleared = new Set<string>()
  const docsBroken = new Set<string>()
  for (const r of wb.documents?.rows ?? []) {
    const ref: ShopXRowRef = { sheet: 'documents', rowNumber: r.rowNumber }
    const where = whereOf('documents', r.rowNumber)
    const product = lookupSku(r.cells.sku, 'documents', r.rowNumber)
    if (!product) continue
    const w = workFor(product)
    w.item.rows.push(ref)
    const fileRaw = (r.cells.file ?? '').trim()
    if (fileRaw === CLEAR_MARK) {
      docsCleared.add(product.id)
      continue
    }
    const broken = (message: string) => {
      docsBroken.add(product.id)
      issue(w.item, 'error', where, `${message} A termék dokumentumai nem változnak, amíg ki nem javítod.`, ref)
    }
    if (!fileRaw) {
      broken('Hiányzik a fájlnév.')
      continue
    }
    const media = ctx.mediaByFilename.get(fileRaw.toLowerCase())
    if (!media) {
      broken(`Nincs ilyen fájl a Média könyvtárban: „${fileRaw}”. Előbb töltsd fel a Média oldalon.`)
      continue
    }
    const kindRaw = (r.cells.kind ?? '').trim()
    const kind: DocumentKind | undefined = kindRaw ? DOCUMENT_KIND_ALIASES[foldKey(kindRaw)] : 'other'
    if (!kind) {
      broken(`Ismeretlen típus: „${kindRaw}”. Ezek közül: ${Object.values(DOCUMENT_KIND_LABEL).join(', ')}.`)
      continue
    }
    const title = (r.cells.title ?? '').trim() || null
    if (title && title.length > 200) {
      broken(`A cím ${title.length} karakter, legfeljebb 200 lehet.`)
      continue
    }
    const language = ((r.cells.language ?? '').trim() || 'hu').toLowerCase()
    if (!/^[a-z]{2}$/.test(language)) {
      broken(`A nyelv kétbetűs kód legyen (hu, en, de…), nem „${r.cells.language}”.`)
      continue
    }
    const list = docsByProduct.get(product.id) ?? []
    if (list.some((d) => d.mediaId === media.id)) {
      broken(`A(z) „${media.filename}” kétszer szerepel ennél a terméknél.`)
      continue
    }
    if (!media.mime.includes('pdf') && !media.mime.startsWith('image/')) {
      issue(w.item, 'warning', where, `A(z) „${media.filename}” nem PDF és nem kép — a vásárló letöltésként kapja.`)
    }
    list.push({ ref, mediaId: media.id, kind, title, language, sortOrder: (list.length + 1) * 10 })
    docsByProduct.set(product.id, list)
  }
  const docTouched = new Set<string>([...docsByProduct.keys(), ...docsCleared])
  if (exact && wb.documents) {
    for (const w of works.values()) if (w.productRow != null) docTouched.add(w.product.id)
  }
  for (const productId of docTouched) {
    if (docsBroken.has(productId)) continue
    const w = works.get(productId)!
    const list: ShopXDocument[] = (docsByProduct.get(productId) ?? []).map((d) => ({
      mediaId: d.mediaId,
      kind: d.kind,
      title: d.title,
      language: d.language,
      sortOrder: d.sortOrder
    }))
    if (docsCleared.has(productId) && list.length > 0) {
      issue(w.item, 'warning', 'Dokumentumok', 'A - jel mellett fájlok is vannak — a fájlokat mentjük.')
    }
    if (list.length > SHOP_DOCUMENTS_MAX_PER_PRODUCT) {
      issue(
        w.item,
        'error',
        'Dokumentumok',
        `Legfeljebb ${SHOP_DOCUMENTS_MAX_PER_PRODUCT} dokumentum lehet egy terméknél (most ${list.length}). Nem változik.`,
        docsByProduct.get(productId)?.[0]?.ref
      )
      continue
    }
    const current = (ctx.documents.get(productId) ?? []).map((d) => [d.mediaId, d.kind, d.title, d.language])
    if (!same(current, list.map((d) => [d.mediaId, d.kind, d.title, d.language]))) w.documents = list
  }

  // --- Termékenként: származtatott mezők, bolt állapot, webcím ------------
  const slugOwner = new Map<string, string>()
  for (const p of ctx.products) if (p.web?.web_slug) slugOwner.set(p.web.web_slug, p.id)
  const takeSlug = (base: string, ownId: string): string => {
    const root = base || 'termek'
    const free = (s: string) => {
      const owner = slugOwner.get(s)
      return !owner || owner === ownId
    }
    let slug = root
    for (let i = 2; !free(slug) && i < 1000; i++) slug = `${root.slice(0, 115)}-${i}`
    return slug
  }

  const writes: ShopXWrite[] = []
  const categoryNodes = ctx.categories

  for (const w of works.values()) {
    if (w.skipped) {
      w.item.status = 'error'
      continue
    }
    const v = w.values
    const b = w.before
    const p = w.product

    if (!w.cellsSeen.has('shortDescription') && !same(v.webDescriptionLong, b.webDescriptionLong)) {
      const derivedBefore = b.webDescriptionLong ? suggestWebDescriptionShort(b.webDescriptionLong) : ''
      if (!b.webDescriptionShort || b.webDescriptionShort === derivedBefore) {
        v.webDescriptionShort = v.webDescriptionLong ? suggestWebDescriptionShort(v.webDescriptionLong) : null
      }
    }
    if (!v.webDescriptionShort && v.webDescriptionLong) {
      v.webDescriptionShort = suggestWebDescriptionShort(v.webDescriptionLong)
    }

    if ((v.webNetQuantity != null && v.webNetQuantity > 0) !== (v.webNetUnit != null)) {
      const col = v.webNetUnit == null ? 'Nettó tartalom egysége' : 'Nettó tartalom'
      issue(
        w.item,
        'error',
        col,
        'A nettó tartalomhoz szám és mértékegység is kell (pl. 500 és g). Egyik sem változik.',
        w.productRow ? { sheet: 'products', rowNumber: w.productRow } : undefined
      )
      v.webNetQuantity = b.webNetQuantity
      v.webNetUnit = b.webNetUnit
    }

    v.attributeValueIds = [...w.attrs.valueIds]
    v.attributeInputs = [...w.attrs.inputs.values()]
    if (w.touchedAttrs.size > 0) {
      for (const attr of allAttributes) {
        const code = attr.code.toLowerCase()
        const field = code === 'color' ? 'webColor' : code === 'size' ? 'webSize' : code === 'material' ? 'webMaterial' : null
        if (!field || !w.touchedAttrs.has(attr.id)) continue
        const labels = [
          ...attr.values.filter((x) => w.attrs.valueIds.has(x.id)).map((x) => x.label),
          ...[...w.attrs.valueIds].filter((id) => placeholderLabel.get(id)?.attributeId === attr.id).map((id) => placeholderLabel.get(id)!.label)
        ]
        v[field] = labels.join(', ').slice(0, field === 'webMaterial' ? 100 : 40) || null
      }
    }

    // Séma: az egyes mezőket már ellenőriztük; ami itt mégis elbukik, az marad a régi.
    for (let pass = 0; pass < 3; pass++) {
      const check = shopProductSchema.safeParse({
        ...v,
        webCategoryId: v.webCategoryId?.startsWith(PLACEHOLDER) ? DUMMY_UUID : v.webCategoryId,
        attributeValueIds: [],
        attributeInputs: []
      })
      if (check.success) break
      const keys = [...new Set(check.error.issues.map((i) => i.path[0]).filter((k): k is string => typeof k === 'string'))]
      for (const k of keys) {
        const label = LABEL_BY_FIELD.get(k) ?? k
        const msg = check.error.issues.find((i) => i.path[0] === k)?.message ?? 'Hibás érték.'
        issue(w.item, 'error', label, `${msg} Nem változik.`, w.productRow ? { sheet: 'products', rowNumber: w.productRow } : undefined)
        ;(v as Record<string, unknown>)[k] = (b as Record<string, unknown>)[k]
      }
    }

    // Kategória váltás: a régi kategória kulcsadatai megmaradnak, de nem kulcsadatok többé.
    const realCat = (id: string | null) => (id && !id.startsWith(PLACEHOLDER) ? id : null)
    if (realCat(v.webCategoryId) && realCat(b.webCategoryId) && v.webCategoryId !== b.webCategoryId) {
      const oldTpl = resolveCategoryTemplate(categoryNodes, b.webCategoryId)
      const newTpl = resolveCategoryTemplate(categoryNodes, v.webCategoryId)
      const newIds = new Set(newTpl.items.map((i) => i.attributeId))
      const lost = oldTpl.items
        .filter((i) => !newIds.has(i.attributeId))
        .map((i) => ctx.attributeById.get(i.attributeId))
        .filter((a): a is ShopXAttribute => Boolean(a))
        .filter((a) => a.values.some((x) => w.attrs.valueIds.has(x.id)) || w.attrs.inputs.has(a.id))
      if (lost.length > 0) {
        issue(
          w.item,
          'warning',
          'Kategória',
          `Az új kategóriában nem kulcsadat: ${lost.map((a) => a.name).join(', ')}. Nem töröljük, az egyéb jellemzők között marad.`
        )
      }
    }
    const newTplIds = realCat(v.webCategoryId)
      ? new Set(resolveCategoryTemplate(categoryNodes, v.webCategoryId).items.map((i) => i.attributeId))
      : null
    if (newTplIds && newTplIds.size > 0 && !exact) {
      const extra = [...w.touchedAttrs]
        .filter((id) => !newTplIds.has(id) && !id.startsWith(PLACEHOLDER))
        .map((id) => ctx.attributeById.get(id)?.name)
        .filter(Boolean)
      if (extra.length > 0) {
        issue(w.item, 'info', 'Jellemzők', `Nem kulcsadata ennek a kategóriának: ${extra.slice(0, 5).join(', ')} — az egyéb jellemzők közé kerül.`)
      }
    }

    // Bolt állapot
    const core = { name: p.name, imageUrl: p.imageUrl, priceNet: p.priceNet, active: p.active }
    const wasLive = b.sellableWeb
    const wantLive = w.requested ?? wasLive
    if (!wantLive) {
      v.sellableWeb = false
      w.item.shop = wasLive ? 'goes_off' : 'off'
    } else {
      const now = shopRequirementIssues(v, core)
      const before = wasLive ? shopRequirementIssues(b, core) : []
      if (now.length === 0) {
        v.sellableWeb = true
        w.item.shop = wasLive ? 'stays_live' : 'goes_live'
      } else if (wasLive && before.length > 0) {
        v.sellableWeb = true
        w.item.shop = 'stays_live'
        issue(w.item, 'warning', 'Elérhető a boltban', `Kint van, de már most hiányos: ${now.map((i) => i.label.toLowerCase()).join(', ')}.`)
      } else {
        v.sellableWeb = false
        w.item.shop = wasLive ? 'forced_off' : 'blocked'
        w.item.shopReasons = now.map((i) => i.message)
        if (w.productRow) {
          addProblem(
            { sheet: 'products', rowNumber: w.productRow },
            `${wasLive ? 'Lekerül a boltból' : 'Nem kerül ki a boltba'}: ${now.map((i) => i.message).join(' ')}`
          )
        }
        if (wasLive) {
          issue(w.item, 'warning', 'Elérhető a boltban', `A változások miatt lekerül a boltból: ${now.map((i) => i.label.toLowerCase()).join(', ')}.`)
        }
      }
    }

    // Webcím
    const hadSlug = b.webSlug
    if (v.webSlug) {
      const taken = takeSlug(v.webSlug, p.id)
      if (taken !== v.webSlug) {
        issue(w.item, 'info', 'Webcím', `A(z) „${v.webSlug}” foglalt, ezt kapta: ${taken}`)
        v.webSlug = taken
      }
    }

    const changes: string[] = []
    for (const col of SHOP_COLUMNS) {
      const f = FIELD[col.id]
      if (!f || f === 'sellableWeb') continue
      if (!same(v[f], b[f])) changes.push(col.label)
    }
    const attrsChanged =
      !same([...w.attrs.valueIds].sort(), [...b.attributeValueIds].sort()) ||
      !same(
        [...w.attrs.inputs.values()].sort((x, y) => x.attributeId.localeCompare(y.attributeId)),
        [...b.attributeInputs].sort((x, y) => x.attributeId.localeCompare(y.attributeId))
      )
    if (attrsChanged) {
      const names = [...w.touchedAttrs].map((id) => allAttributes.find((a) => a.id === id)?.name).filter(Boolean)
      changes.push(`Jellemzők${names.length > 0 ? `: ${names.slice(0, 3).join(', ')}${names.length > 3 ? '…' : ''}` : ''}`)
    }
    if (w.faqTouched && !same(v.webFaq, b.webFaq)) changes.push('GYIK')
    if (w.related) {
      changes.push(`Kapcsolatok: ${w.related.kinds.map((k) => RELATED_KIND_META[k].label.toLowerCase()).join(', ')}`)
    } else if (w.altAdd.length > 0 || w.altRemove.length > 0) {
      changes.push('Kapcsolatok: kölcsönös alternatíva')
    }
    if (w.documents) changes.push('Dokumentumok')
    const shopChanged = v.sellableWeb !== b.sellableWeb

    if (!v.webSlug && (changes.length > 0 || shopChanged)) {
      v.webSlug = takeSlug(suggestWebSlug(p.name), p.id)
    }
    if (hadSlug && v.webSlug !== hadSlug && wasLive) {
      issue(w.item, 'warning', 'Webcím', 'A régi link nem fog működni (Google, megosztott linkek).')
    }
    if (v.webSlug) slugOwner.set(v.webSlug, p.id)

    const webChanged = !same(webRowOf(v), webRowOf(b))
    const touched = changes.length > 0 || shopChanged
    w.item.changes = changes
    if (touched) {
      w.item.status = 'update'
      const exportedAt = wb.exportedAt ? Date.parse(wb.exportedAt) : Number.NaN
      const editedAt = w.product.webUpdatedAt ? Date.parse(w.product.webUpdatedAt) : Number.NaN
      if (!exact && Number.isFinite(exportedAt) && Number.isFinite(editedAt) && editedAt > exportedAt) {
        issue(w.item, 'warning', 'Termék', 'A letöltés óta valaki módosította. Ha mented, a fájlban lévő adat lesz érvényes.')
      }
      writes.push({
        accessoryId: p.id,
        sku: p.sku,
        name: p.name,
        values: v,
        webChanged,
        touchedAttributes: attrsChanged ? [...w.touchedAttrs] : [],
        related: w.related,
        altAdd: w.altAdd,
        altRemove: w.altRemove,
        documents: w.documents,
        previousSlug: hadSlug,
        wasLive
      })
    } else {
      w.item.status = w.item.issues.some((i) => i.level === 'error') ? 'error' : 'unchanged'
    }
  }

  // --- Változatcsoportok lap -----------------------------------------------
  const groupPrefs = new Map<string, { axes: string[] | null; mainId: string | null; name: string | null }>()
  for (const g of ctx.groups.values()) {
    groupPrefs.set(foldKey(g.code), { axes: g.axes.length > 0 ? g.axes : null, mainId: g.mainAccessoryId, name: g.name })
  }
  const groupMembers = new Map<string, string[]>()
  for (const p of ctx.products) {
    const w = works.get(p.id)
    const code = w && !w.skipped ? w.values.webGroupId : p.web?.web_group_id ?? null
    if (!code) continue
    const k = foldKey(code)
    groupMembers.set(k, [...(groupMembers.get(k) ?? []), p.id])
  }
  const groupSheetCodes = new Set<string>()
  if (ctx.bulkReady) {
    const seenGroups = new Map<string, number>()
    for (const r of wb.groups?.rows ?? []) {
      const n = r.rowNumber
      const code = (r.cells.code ?? '').trim()
      if (!code) {
        catalogIssue('groups', n, 'error', 'Hiányzik a csoport kód.')
        continue
      }
      if (code.length > 64) {
        catalogIssue('groups', n, 'error', 'A kód legfeljebb 64 karakter.')
        continue
      }
      const k = foldKey(code)
      const dupRow = seenGroups.get(k)
      if (dupRow) {
        catalogIssue('groups', n, 'error', `Kétszer szerepel (${dupRow}. sor is). Hagyd meg az egyiket.`)
        continue
      }
      seenGroups.set(k, n)
      const members = groupMembers.get(k) ?? []
      if (members.length === 0) {
        catalogIssue('groups', n, 'warning', `A(z) „${code}” csoportban nincs termék. Add meg a kódot a Bolt lap Változatcsoport oszlopában.`)
      }
      const existing = ctx.groups.get(k)
      const op: Extract<ShopXCatalogOp, { kind: 'group' }> = { kind: 'group', code: groupCodeByFold.get(k) ?? code }
      const titleRaw = (r.cells.title ?? '').trim()
      if (titleRaw) {
        const title = titleRaw === CLEAR_MARK ? null : titleRaw
        if (title && title.length > 150) {
          catalogIssue('groups', n, 'error', 'A csoport neve legfeljebb 150 karakter.')
          continue
        }
        if ((existing?.name ?? null) !== title) op.name = title
      }
      const mainRaw = (r.cells.main ?? '').trim()
      if (mainRaw) {
        if (mainRaw === CLEAR_MARK) {
          if (existing?.mainAccessoryId) op.mainAccessoryId = null
        } else {
          const main = ctx.bySku.get(foldKey(mainRaw))
          if (!main || !members.includes(main.id)) {
            catalogIssue('groups', n, 'error', `Fő termék: „${mainRaw}” nem tagja a(z) „${code}” csoportnak.`)
            continue
          }
          if (existing?.mainAccessoryId !== main.id) op.mainAccessoryId = main.id
        }
      }
      const axesRaw = (r.cells.axes ?? '').trim()
      if (axesRaw) {
        let axes: string[] | null = []
        if (axesRaw !== CLEAR_MARK) {
          for (const name of splitList(axesRaw)) {
            if (PACK_AXIS_NAMES.has(foldKey(name))) {
              if (!axes.includes(PACK_AXIS)) axes.push(PACK_AXIS)
              continue
            }
            const a = attrByKey.get(foldKey(name))
            if (!a) {
              catalogIssue('groups', n, 'error', `Választási szempont: nincs ilyen jellemző: „${name}”.`)
              axes = null
              break
            }
            if (!axes.includes(a.id)) axes.push(a.id)
          }
        }
        if (!axes) continue
        if (axes.length > MAX_GROUP_AXES) {
          catalogIssue('groups', n, 'error', `Legfeljebb ${MAX_GROUP_AXES} választási szempont lehet.`)
          continue
        }
        if (!same(existing?.axes ?? [], axes)) op.axes = axes
      }
      groupSheetCodes.add(k)
      const pref = groupPrefs.get(k) ?? { axes: null, mainId: null, name: null }
      groupPrefs.set(k, {
        axes: op.axes !== undefined ? (op.axes.length > 0 ? op.axes : null) : pref.axes,
        mainId: op.mainAccessoryId !== undefined ? op.mainAccessoryId : pref.mainId,
        name: op.name !== undefined ? op.name : pref.name
      })
      if (op.name !== undefined || op.mainAccessoryId !== undefined || op.axes !== undefined) {
        catalogOps.push(op)
        catalog.groupsChanged.push(op.code)
      }
    }
  }

  // --- Változatcsoport kártyák ---------------------------------------------
  const groups = buildGroupCards(ctx, works, placeholderLabel, allAttributes, groupPrefs, groupSheetCodes)
  for (const card of groups) {
    for (const message of card.issues) {
      for (const m of card.members) {
        const w = works.get(ctx.bySku.get(foldKey(m.sku))?.id ?? '')
        if (w && !w.skipped) issue(w.item, 'warning', 'Változatcsoport', `${card.code}: ${message}`)
      }
    }
  }

  const items = [...works.values()].map((w) => w.item).concat([...orphanItems.values()])
  items.sort((a, b) => (a.rows[0]?.rowNumber ?? 0) - (b.rows[0]?.rowNumber ?? 0))

  const stats = {
    items: items.filter((i) => !i.key.startsWith('sheet:')).length,
    update: items.filter((i) => i.status === 'update').length,
    unchanged: items.filter((i) => i.status === 'unchanged').length,
    error: items.filter((i) => i.status === 'error').length,
    partial: items.filter((i) => i.status === 'update' && i.issues.some((x) => x.level === 'error')).length,
    goesLive: items.filter((i) => i.status === 'update' && i.shop === 'goes_live').length,
    goesOff: items.filter((i) => i.status === 'update' && (i.shop === 'goes_off' || i.shop === 'forced_off')).length,
    blocked: items.filter((i) => i.shop === 'blocked' || i.shop === 'forced_off').length,
    warnings: items.filter((i) => i.issues.some((x) => x.level === 'warning')).length
  }

  const itemCounts = Object.fromEntries(
    SHOP_X_ITEM_FILTERS.map((f) => [f, items.filter((i) => matchesShopItem(i, f)).length])
  ) as Record<ShopXItemFilter, number>
  const picked = new Set<ShopXItem>()
  for (const f of ['error', 'blocked', 'live', 'update', 'unchanged', 'all'] as ShopXItemFilter[]) {
    let n = 0
    for (const i of items) {
      if (n >= PREVIEW_PER_FILTER[f]) break
      if (!matchesShopItem(i, f)) continue
      picked.add(i)
      n++
    }
  }
  const previewItems = items.filter((i) => picked.has(i))

  const order = [...works.keys()]
  return {
    preview: {
      items: previewItems,
      itemCounts,
      itemsTruncated: previewItems.length < items.length,
      pending: [...pending.values()],
      groups,
      catalog,
      stats,
      notices,
      problems: [...problems.values()].sort((a, b) => a.sheet.localeCompare(b.sheet) || a.rowNumber - b.rowNumber),
      writeCount: writes.length,
      catalogChangeCount: creations.size + catalogOps.length,
      snapshot: exact
    },
    items,
    writes,
    order,
    creations: [...creations.values()],
    catalogOps,
    mappings: [...mappings.values()]
  }
}

function buildGroupCards(
  ctx: ShopXContext,
  works: Map<string, Work>,
  placeholderLabel: Map<string, { attributeId: string; label: string }>,
  attributes: ShopXAttribute[],
  prefs: Map<string, { axes: string[] | null; mainId: string | null; name: string | null }>,
  extraCodes: Set<string>
): ShopXGroupCard[] {
  type Member = {
    id: string
    sku: string
    name: string
    live: boolean
    categoryId: string | null
    valueIds: Set<string>
    inputs: AttributeInput[]
    pack: string | null
  }
  const touched = new Set<string>(extraCodes)
  for (const w of works.values()) {
    if (w.skipped) continue
    if (w.values.webGroupId) touched.add(foldKey(w.values.webGroupId))
    if (w.before.webGroupId && w.before.webGroupId !== w.values.webGroupId) touched.add(foldKey(w.before.webGroupId))
  }
  if (touched.size === 0) return []

  const packOf = (qty: number | null, unit: string | null, multipack: number | null) =>
    multipack ? `${multipack} db` : qty && unit ? `${formatNumberHu(qty)} ${unit}` : null

  const members = new Map<string, { code: string; list: Member[] }>()
  for (const p of ctx.products) {
    const w = works.get(p.id)
    const code = w && !w.skipped ? w.values.webGroupId : p.web?.web_group_id ?? null
    if (!code) continue
    const k = foldKey(code)
    if (!touched.has(k)) continue
    const entry = members.get(k) ?? { code, list: [] }
    const useW = w && !w.skipped
    entry.list.push({
      id: p.id,
      sku: p.sku,
      name: p.name,
      live: useW ? w.values.sellableWeb : p.web?.sellable_web === true,
      categoryId: useW ? w.values.webCategoryId : p.categoryId,
      valueIds: useW ? w.attrs.valueIds : new Set(p.valueIds),
      inputs: useW ? [...w.attrs.inputs.values()] : p.inputs,
      pack: useW
        ? packOf(w.values.webNetQuantity, w.values.webNetUnit, w.values.webMultipack)
        : packOf(p.web?.web_net_quantity ?? null, p.web?.web_net_unit ?? null, p.web?.web_multipack ?? null)
    })
    members.set(k, entry)
  }

  const display = (attr: ShopXAttribute, m: Member): string | null => {
    if (attr.valueType === 'list') {
      const labels = [
        ...attr.values.filter((v) => m.valueIds.has(v.id)).map((v) => v.label),
        ...[...m.valueIds].filter((id) => placeholderLabel.get(id)?.attributeId === attr.id).map((id) => placeholderLabel.get(id)!.label)
      ]
      return labels.length > 0 ? joinList(labels) : null
    }
    const i = m.inputs.find((x) => x.attributeId === attr.id)
    if (!i) return null
    if (attr.valueType === 'boolean') return i.valueBool == null ? null : i.valueBool ? 'igen' : 'nem'
    if (i.valueNum == null) return null
    const unit = attr.unit ? ` ${attr.unit}` : ''
    return i.valueMax != null ? `${formatNumberHu(i.valueNum)}–${formatNumberHu(i.valueMax)}${unit}` : `${formatNumberHu(i.valueNum)}${unit}`
  }

  const cards: ShopXGroupCard[] = []
  for (const [k, { code, list }] of members) {
    const pref = prefs.get(k)
    const issues: string[] = []
    if (list.length === 1) {
      issues.push('Egyedül van a csoportban — sima termékként jelenik meg.')
    }
    const axes: { name: string; valueOf: (m: Member) => string | null }[] = []
    if (list.length > 1) {
      const packAxis = { name: 'Kiszerelés', valueOf: (m: Member) => m.pack }
      if (pref?.axes) {
        for (const id of pref.axes) {
          if (id === PACK_AXIS) {
            axes.push(packAxis)
            continue
          }
          const attr = attributes.find((a) => a.id === id)
          if (attr) axes.push({ name: attr.name, valueOf: (m) => display(attr, m) })
        }
      } else {
        for (const attr of attributes) {
          const vals = new Set(list.map((m) => display(attr, m)?.toLocaleLowerCase('hu')).filter(Boolean))
          if (vals.size >= 2) axes.push({ name: attr.name, valueOf: (m) => display(attr, m) })
        }
        if (new Set(list.map((m) => m.pack).filter(Boolean)).size >= 2) axes.push(packAxis)
      }
      const cats = new Set(list.map((m) => m.categoryId ?? ''))
      if (cats.size > 1) {
        const names = [...cats].map((id) => (id ? (ctx.categoryById.get(id)?.path ?? 'új kategória') : 'nincs kategória'))
        issues.push(`A tagok különböző kategóriában vannak (${names.join(', ')}). Tedd őket egy kategóriába.`)
      }
      if (axes.length === 0) {
        issues.push(
          'A vásárló nem tud választani köztük: semmiben nem térnek el. Adj meg eltérő jellemzőt (pl. Hossz, Szín) a Jellemzők lapon.'
        )
      } else {
        const byTuple = new Map<string, string[]>()
        for (const m of list) {
          const t = axes.map((a) => (a.valueOf(m) ?? '').toLocaleLowerCase('hu')).join('|')
          byTuple.set(t, [...(byTuple.get(t) ?? []), m.sku])
        }
        for (const skus of byTuple.values()) {
          if (skus.length > 1) {
            issues.push(`${skus.join(' és ')} mindenben egyezik (${axes.map((a) => a.name).join(', ')}) — a vásárló nem tud választani köztük.`)
          }
        }
        for (const a of axes) {
          const missing = list.filter((m) => !a.valueOf(m)).map((m) => m.sku)
          if (missing.length > 0) issues.push(`${missing.join(', ')}: hiányzik a(z) „${a.name}”.`)
        }
      }
    }
    const mainId = pref?.mainId && list.some((m) => m.id === pref.mainId) ? pref.mainId : null
    if (mainId && !list.find((m) => m.id === mainId)?.live && list.some((m) => m.live)) {
      issues.push('A fő termék nincs kint a boltban — a kategória oldalon egy másik tag látszik helyette.')
    }
    cards.push({
      code,
      title: pref?.name ?? null,
      axes: axes.map((a) => a.name),
      members: list.map((m) => ({
        sku: m.sku,
        name: m.name,
        live: m.live,
        main: m.id === mainId,
        values: Object.fromEntries(axes.map((a) => [a.name, a.valueOf(m) ?? '—']))
      })),
      issues
    })
    if (cards.length >= MAX_GROUP_CARDS) break
  }
  return cards
}

/** Kategória display — export és előnézet ugyanazt használja. */
export function categoryPathOf(ctx: ShopXContext, id: string | null): string {
  return id ? (ctx.categoryById.get(id)?.path ?? '') : ''
}

export function countryLabel(code: string | null): string {
  return code ? (countryName(code) ?? code) : ''
}
