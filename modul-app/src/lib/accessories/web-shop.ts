/**
 * Webshop / agent feed readiness — doc 38.
 * Szintek: blocked → indexable → competitive → agent_excellent
 */

export type WebKv = { key: string; value: string }
export type WebFaqItem = { q: string; a: string }
export type WebPriceTier = { min_qty: number; price_net: number }

export type AccessoryWebFields = {
  sellable_web: boolean
  web_slug: string | null
  web_title: string | null
  web_description_short: string | null
  web_description_long: string | null
  web_brand: string | null
  web_gtin: string | null
  web_mpn: string | null
  web_product_type: string | null
  web_google_category: string | null
  web_tags: string[]
  web_search_aliases: string[]
  web_color: string | null
  web_size: string | null
  web_material: string | null
  web_attributes: Record<string, string>
  web_specs: Record<string, string>
  web_gallery: string[]
  web_faq: WebFaqItem[]
  web_use_cases: string[]
  web_compatibility: string[]
  web_compare_at_price: number | null
  shipping_weight_kg: number | null
  shipping_length_cm: number | null
  shipping_width_cm: number | null
  shipping_height_cm: number | null
  product_weight_kg: number | null
  product_length_cm: number | null
  product_width_cm: number | null
  product_height_cm: number | null
  web_group_id: string | null
  web_box_contents: string[]
  web_dimension_image_url: string | null
  web_safety_info: string | null
  web_identifier_exists: boolean
  web_image_alts: Record<string, string>
  web_price_tiers: WebPriceTier[]
  web_net_quantity: number | null
  web_net_unit: string | null
  web_ingredients: string | null
  web_usage: string | null
  web_video_url: string | null
  web_country_of_origin: string | null
  web_multipack: number | null
  web_is_bundle: boolean
}

export type ShopReadyLevel =
  | 'off'
  | 'blocked'
  | 'indexable'
  | 'competitive'
  | 'agent_excellent'

/** Emberi UI label (lista + űrlap badge) — ne feed/ACP zsargon. */
export const SHOP_READY_LABEL: Record<ShopReadyLevel, string> = {
  off: 'Nincs a boltban',
  blocked: 'Majdnem kész',
  indexable: 'Alapból kész',
  competitive: 'Kész a boltra',
  agent_excellent: 'Szuper kitöltés'
}

export type ShopReadyTone =
  | 'neutral'
  | 'danger'
  | 'warning'
  | 'success'
  | 'info'

export function shopReadyTone(level: ShopReadyLevel): ShopReadyTone {
  if (level === 'agent_excellent') return 'success'
  if (level === 'competitive') return 'info'
  if (level === 'indexable') return 'warning'
  if (level === 'blocked') return 'danger'
  return 'neutral'
}

export type ShopReadyInput = AccessoryWebFields & {
  name: string
  image_url: string | null
  barcode: string | null
  manufacturer_name?: string | null
  price_net: number
  active: boolean
}

function nonEmpty(s: string | null | undefined): boolean {
  return Boolean(s && s.trim().length > 0)
}

function attrCount(rec: Record<string, string>): number {
  return Object.keys(rec).filter((k) => nonEmpty(k) && nonEmpty(rec[k])).length
}

export function effectiveWebTitle(row: {
  web_title: string | null
  name: string
}): string {
  return row.web_title?.trim() || row.name
}

export function effectiveWebBrand(row: {
  web_brand: string | null
  manufacturer_name?: string | null
}): string {
  return row.web_brand?.trim() || row.manufacturer_name?.trim() || ''
}

export function effectiveGtin(row: {
  web_gtin: string | null
  barcode: string | null
}): string {
  return row.web_gtin?.trim() || row.barcode?.trim() || ''
}

export function evaluateShopReady(row: ShopReadyInput): {
  level: ShopReadyLevel
  score: number
  missing: string[]
} {
  if (!row.sellable_web) {
    return { level: 'off', score: 0, missing: [] }
  }

  const missing: string[] = []
  const title = effectiveWebTitle(row)
  const brand = effectiveWebBrand(row)
  const gtin = effectiveGtin(row)
  const shortLen = row.web_description_short?.trim().length ?? 0
  const longLen = row.web_description_long?.trim().length ?? 0
  const attrs =
    attrCount(row.web_attributes) +
    (nonEmpty(row.web_color) ? 1 : 0) +
    (nonEmpty(row.web_size) ? 1 : 0) +
    (nonEmpty(row.web_material) ? 1 : 0)
  const specs = attrCount(row.web_specs)
  const gallery = row.web_gallery.filter((u) => nonEmpty(u)).length
  const faqOk = row.web_faq.filter((f) => nonEmpty(f.q) && nonEmpty(f.a)).length
  const hasId =
    Boolean(gtin) ||
    (Boolean(brand) && nonEmpty(row.web_mpn)) ||
    row.web_identifier_exists === false

  if (!nonEmpty(row.web_slug)) missing.push('Slug')
  if (!nonEmpty(title)) missing.push('Cím')
  if (!row.image_url?.trim()) missing.push('Fő kép')
  if (!(row.price_net > 0)) missing.push('Ár')
  if (!row.active) missing.push('Aktív')

  const blocked = missing.length > 0
  if (shortLen < 80) missing.push('Rövid leírás (≥80)')
  if (longLen < 200) missing.push('Részletes leírás (≥200)')
  if (!nonEmpty(brand)) missing.push('Márka')
  if (!nonEmpty(row.web_product_type)) missing.push('Kategória (product type)')

  let score = 0
  if (nonEmpty(row.web_slug)) score += 10
  if (nonEmpty(title)) score += 10
  if (row.image_url?.trim()) score += 10
  if (row.price_net > 0) score += 8
  if (row.active) score += 5
  if (shortLen >= 80) score += 10
  if (longLen >= 200) score += 10
  if (nonEmpty(brand)) score += 8
  if (nonEmpty(row.web_product_type)) score += 8
  if (hasId) score += 8
  if (nonEmpty(row.web_google_category)) score += 4
  if (gallery >= 3) score += 6
  else if (gallery >= 1) score += 2
  if (attrs + specs >= 4) score += 8
  else if (attrs + specs >= 1) score += 3
  if (row.shipping_weight_kg != null && row.shipping_weight_kg > 0) score += 4
  if (faqOk >= 1 || row.web_use_cases.length > 0) score += 5
  if (row.web_search_aliases.length > 0) score += 3
  if (score > 100) score = 100

  if (blocked) {
    return { level: 'blocked', score, missing }
  }

  const indexable =
    shortLen >= 80 &&
    longLen >= 200 &&
    nonEmpty(brand) &&
    nonEmpty(row.web_product_type)

  if (!indexable) {
    return { level: 'blocked', score, missing }
  }

  const competitive =
    hasId &&
    gallery >= 3 &&
    attrs + specs >= 4 &&
    nonEmpty(row.web_google_category) &&
    row.shipping_weight_kg != null &&
    row.shipping_weight_kg > 0

  if (!competitive) {
    const soft: string[] = []
    if (!hasId) soft.push('GTIN vagy márka+MPN')
    if (gallery < 3) soft.push('Legalább 3 galéria kép')
    if (attrs + specs < 4) soft.push('Legalább 4 attribútum/spec')
    if (!nonEmpty(row.web_google_category)) soft.push('Google kategória')
    if (row.shipping_weight_kg == null || row.shipping_weight_kg <= 0) {
      soft.push('Csomag súly')
    }
    return { level: 'indexable', score, missing: soft }
  }

  const excellent =
    (faqOk >= 1 ||
      row.web_use_cases.length > 0 ||
      row.web_compatibility.length > 0) &&
    row.web_search_aliases.length > 0

  if (!excellent) {
    return {
      level: 'competitive',
      score,
      missing: [
        ...(faqOk < 1 && row.web_use_cases.length === 0
          ? ['FAQ vagy felhasználási eset']
          : []),
        ...(row.web_search_aliases.length === 0 ? ['Kereső szinonimák'] : [])
      ]
    }
  }

  return { level: 'agent_excellent', score, missing: [] }
}

export function parseLinesToList(raw: string): string[] {
  return raw
    .split(/\n|,/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function listToLines(items: string[]): string {
  return items.join('\n')
}

export function recordToKv(rec: Record<string, string>): WebKv[] {
  const entries = Object.entries(rec)
  if (entries.length === 0) return [{ key: '', value: '' }]
  return entries.map(([key, value]) => ({ key, value }))
}

export function kvToRecord(rows: WebKv[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const row of rows) {
    const k = row.key.trim()
    const v = row.value.trim()
    if (!k || !v) continue
    out[k] = v
  }
  return out
}

export function parseFaqRaw(raw: string): WebFaqItem[] {
  // Blokkok üres sorral; első sor Q:, többi A: vagy szöveg
  const blocks = raw
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)
  const items: WebFaqItem[] = []
  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim())
    const qLine = lines[0] ?? ''
    const q = qLine.replace(/^q:\s*/i, '').trim()
    const a = lines
      .slice(1)
      .join('\n')
      .replace(/^a:\s*/i, '')
      .trim()
    if (q && a) items.push({ q, a })
  }
  return items
}

export function faqToRaw(items: WebFaqItem[]): string {
  return items.map((f) => `Q: ${f.q}\nA: ${f.a}`).join('\n\n')
}

export const emptyWebFields = (): AccessoryWebFields => ({
  sellable_web: false,
  web_slug: null,
  web_title: null,
  web_description_short: null,
  web_description_long: null,
  web_brand: null,
  web_gtin: null,
  web_mpn: null,
  web_product_type: null,
  web_google_category: null,
  web_tags: [],
  web_search_aliases: [],
  web_color: null,
  web_size: null,
  web_material: null,
  web_attributes: {},
  web_specs: {},
  web_gallery: [],
  web_faq: [],
  web_use_cases: [],
  web_compatibility: [],
  web_compare_at_price: null,
  shipping_weight_kg: null,
  shipping_length_cm: null,
  shipping_width_cm: null,
  shipping_height_cm: null,
  product_weight_kg: null,
  product_length_cm: null,
  product_width_cm: null,
  product_height_cm: null,
  web_group_id: null,
  web_box_contents: [],
  web_dimension_image_url: null,
  web_safety_info: null,
  web_identifier_exists: true,
  web_image_alts: {},
  web_price_tiers: [],
  web_net_quantity: null,
  web_net_unit: null,
  web_ingredients: null,
  web_usage: null,
  web_video_url: null,
  web_country_of_origin: null,
  web_multipack: null,
  web_is_bundle: false
})

/** Tiszta, növekvő min_qty-jű tier lista (duplikált min_qty: utolsó nyer). */
export function normalizePriceTiers(value: unknown): WebPriceTier[] {
  if (!Array.isArray(value)) return []
  const byQty = new Map<number, number>()
  for (const row of value) {
    if (!row || typeof row !== 'object') continue
    const minQty = Number((row as { min_qty?: unknown }).min_qty)
    const priceNet = Number((row as { price_net?: unknown }).price_net)
    if (!Number.isInteger(minQty) || minQty < 2) continue
    if (!Number.isFinite(priceNet) || priceNet <= 0) continue
    byQty.set(minQty, Math.round(priceNet))
  }
  return [...byQty.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([min_qty, price_net]) => ({ min_qty, price_net }))
}

/** „10 = 1800” soronként → tier lista. */
export function parsePriceTiersRaw(raw: string): WebPriceTier[] {
  const rows = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [q, p] = line.split(/[=:;]/).map((s) => s?.trim() ?? '')
      return {
        min_qty: Number(q?.replace(/\D/g, '')),
        price_net: Number(p?.replace(/\s/g, '').replace(',', '.'))
      }
    })
  return normalizePriceTiers(rows)
}

export function priceTiersToRaw(tiers: WebPriceTier[]): string {
  return tiers.map((t) => `${t.min_qty} = ${t.price_net}`).join('\n')
}

/** Adott mennyiséghez érvényes nettó egységár. */
export function unitNetForQuantity(
  baseNet: number,
  tiers: WebPriceTier[],
  quantity: number
): number {
  let price = baseNet
  for (const t of tiers) {
    if (quantity >= t.min_qty && t.price_net < price) price = t.price_net
  }
  return price
}

export function suggestWebSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 120)
}

/** Egy leírásmezőből rövid snippet feedhez / listához. */
export function suggestWebDescriptionShort(long: string): string {
  const t = long.trim().replace(/\s+/g, ' ')
  if (!t) return ''
  if (t.length <= 800) return t
  const slice = t.slice(0, 800)
  const lastSpace = slice.lastIndexOf(' ')
  return (lastSpace > 80 ? slice.slice(0, lastSpace) : slice).trim()
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean)
}

function asStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof k !== 'string' || !k.trim()) continue
    if (typeof v !== 'string' || !v.trim()) continue
    out[k.trim()] = v.trim()
  }
  return out
}

function asFaq(value: unknown): WebFaqItem[] {
  if (!Array.isArray(value)) return []
  const items: WebFaqItem[] = []
  for (const row of value) {
    if (!row || typeof row !== 'object') continue
    const q = typeof (row as { q?: unknown }).q === 'string' ? (row as { q: string }).q.trim() : ''
    const a = typeof (row as { a?: unknown }).a === 'string' ? (row as { a: string }).a.trim() : ''
    if (q && a) items.push({ q, a })
  }
  return items
}

function asNullableNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function asTrimmedText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/** DB row → typed web fields (list + detail). */
export function mapAccessoryWebFields(row: Record<string, unknown>): AccessoryWebFields {
  return {
    sellable_web: row.sellable_web === true,
    web_slug: typeof row.web_slug === 'string' ? row.web_slug : null,
    web_title: typeof row.web_title === 'string' ? row.web_title : null,
    web_description_short:
      typeof row.web_description_short === 'string'
        ? row.web_description_short
        : null,
    web_description_long:
      typeof row.web_description_long === 'string'
        ? row.web_description_long
        : null,
    web_brand: typeof row.web_brand === 'string' ? row.web_brand : null,
    web_gtin: typeof row.web_gtin === 'string' ? row.web_gtin : null,
    web_mpn: typeof row.web_mpn === 'string' ? row.web_mpn : null,
    web_product_type:
      typeof row.web_product_type === 'string' ? row.web_product_type : null,
    web_google_category:
      typeof row.web_google_category === 'string'
        ? row.web_google_category
        : null,
    web_tags: asStringArray(row.web_tags),
    web_search_aliases: asStringArray(row.web_search_aliases),
    web_color: typeof row.web_color === 'string' ? row.web_color : null,
    web_size: typeof row.web_size === 'string' ? row.web_size : null,
    web_material:
      typeof row.web_material === 'string' ? row.web_material : null,
    web_attributes: asStringRecord(row.web_attributes),
    web_specs: asStringRecord(row.web_specs),
    web_gallery: asStringArray(row.web_gallery),
    web_faq: asFaq(row.web_faq),
    web_use_cases: asStringArray(row.web_use_cases),
    web_compatibility: asStringArray(row.web_compatibility),
    web_compare_at_price: asNullableNumber(row.web_compare_at_price),
    shipping_weight_kg: asNullableNumber(row.shipping_weight_kg),
    shipping_length_cm: asNullableNumber(row.shipping_length_cm),
    shipping_width_cm: asNullableNumber(row.shipping_width_cm),
    shipping_height_cm: asNullableNumber(row.shipping_height_cm),
    product_weight_kg: asNullableNumber(row.product_weight_kg),
    product_length_cm: asNullableNumber(row.product_length_cm),
    product_width_cm: asNullableNumber(row.product_width_cm),
    product_height_cm: asNullableNumber(row.product_height_cm),
    web_group_id:
      typeof row.web_group_id === 'string' ? row.web_group_id : null,
    web_box_contents: asStringArray(row.web_box_contents),
    web_dimension_image_url:
      typeof row.web_dimension_image_url === 'string' &&
      row.web_dimension_image_url.trim()
        ? row.web_dimension_image_url.trim()
        : null,
    web_safety_info:
      typeof row.web_safety_info === 'string' && row.web_safety_info.trim()
        ? row.web_safety_info.trim()
        : null,
    web_identifier_exists: row.web_identifier_exists !== false,
    web_image_alts: asStringRecord(row.web_image_alts),
    web_price_tiers: normalizePriceTiers(row.web_price_tiers),
    web_net_quantity: asNullableNumber(row.web_net_quantity),
    web_net_unit: asTrimmedText(row.web_net_unit),
    web_ingredients: asTrimmedText(row.web_ingredients),
    web_usage: asTrimmedText(row.web_usage),
    web_video_url: asTrimmedText(row.web_video_url),
    web_country_of_origin: asTrimmedText(row.web_country_of_origin)?.toUpperCase() ?? null,
    web_multipack: asNullableNumber(row.web_multipack),
    web_is_bundle: row.web_is_bundle === true
  }
}

export const WEB_SELECT_COLUMNS = `
  sellable_web,
  web_slug,
  web_title,
  web_description_short,
  web_description_long,
  web_brand,
  web_gtin,
  web_mpn,
  web_product_type,
  web_google_category,
  web_tags,
  web_search_aliases,
  web_color,
  web_size,
  web_material,
  web_attributes,
  web_specs,
  web_gallery,
  web_faq,
  web_use_cases,
  web_compatibility,
  web_compare_at_price,
  shipping_weight_kg,
  shipping_length_cm,
  shipping_width_cm,
  shipping_height_cm,
  product_weight_kg,
  product_length_cm,
  product_width_cm,
  product_height_cm,
  web_group_id,
  web_box_contents,
  web_dimension_image_url,
  web_safety_info,
  web_identifier_exists,
  web_image_alts,
  web_price_tiers,
  web_net_quantity,
  web_net_unit,
  web_ingredients,
  web_usage,
  web_video_url,
  web_country_of_origin,
  web_multipack,
  web_is_bundle
` as const

/** Az `accessory_web` tábla oszlopai (a galéria az alap terméken marad). */
export const ACCESSORY_WEB_COLUMNS = `${WEB_SELECT_COLUMNS.replace(/\n\s*web_gallery,/, '')},
  web_category_id`
