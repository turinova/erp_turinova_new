/**
 * Webshop auto-enrichment — LLM/agent feed richness without extra form fields.
 * Mentéskor / payloadnál: csak üres mezőket tölt; user override megmarad.
 */

import type { WebFaqItem } from '@/lib/accessories/web-shop'

export type WebshopShippingDefaults = {
  weightKg: number
  lengthCm: number
  widthCm: number
  heightCm: number
}

/** Soft default — tenant_webshop_settings felülírhatja. */
export const DEFAULT_WEBSHOP_SHIPPING: WebshopShippingDefaults = {
  weightKg: 0.25,
  lengthCm: 20,
  widthCm: 12,
  heightCm: 6
}

const CATEGORY_SYNONYMS: Record<string, string[]> = {
  zsaner: ['zsanér', 'pánt', 'hinge', 'bútorzsanér', 'ajtózsanér'],
  fogantyu: ['fogantyú', 'húzó', 'gomb', 'handle', 'knob', 'bútorfogantyú'],
  fiokcsuszo: ['fiókcsúszó', 'csúszó', 'drawer slide', 'fiók sín'],
  vasalat: ['vasalat', 'bútorvasalat', 'hardware', 'szerelvény'],
  magnet: ['mágnes', 'catch', 'ajtómágnes'],
  csavar: ['csavar', 'screw', 'rögzítő'],
  konzol: ['konzol', 'polckonzol', 'bracket'],
  kilincs: ['kilincs', 'ajtókilincs', 'door handle']
}

const MATERIAL_WORDS: { re: RegExp; label: string }[] = [
  { re: /\bacél\b/i, label: 'Acél' },
  { re: /\bzamak\b/i, label: 'Zamak' },
  { re: /\bműanyag\b|\bmuanyag\b|\bplastic\b/i, label: 'Műanyag' },
  { re: /\balumínium\b|\baluminum\b|\balu\b/i, label: 'Alumínium' },
  { re: /\bfa\b|\bfából\b/i, label: 'Fa' },
  { re: /\brez\b|\bbrass\b/i, label: 'Réz' },
  { re: /\bnemesacél\b|\binox\b|\bstainless\b/i, label: 'Nemesacél' }
]

const COLOR_WORDS: { re: RegExp; label: string }[] = [
  { re: /\bfehér\b|\bwhite\b/i, label: 'Fehér' },
  { re: /\bfekete\b|\bblack\b/i, label: 'Fekete' },
  { re: /\bezüst\b|\bsilver\b/i, label: 'Ezüst' },
  { re: /\bbarna\b|\bbrown\b/i, label: 'Barna' },
  { re: /\bszürke\b|\bszurke\b|\bgrey\b|\bgray\b/i, label: 'Szürke' },
  { re: /\barany\b|\bgold\b/i, label: 'Arany' },
  { re: /\bnikkel\b|\bnickel\b/i, label: 'Nikkel' },
  { re: /\bkróm\b|\bkrom\b|\bchrome\b/i, label: 'Króm' }
]

const FAQ_BY_CATEGORY: { match: RegExp; faq: WebFaqItem[] }[] = [
  {
    match: /zsanér|zsaner|hinge|pánt/i,
    faq: [
      {
        q: 'Milyen csavar kell a szereléshez?',
        a: 'Általában a csomagban lévő vagy 3,5×16 mm-es forgácslapcsavar megfelelő. A pontos méret a termék adatlapján / leírásában szerepel.'
      },
      {
        q: 'Melyik oldalra szerelhető?',
        a: 'A legtöbb bútorzsanér balra és jobbra is szerelhető; a nyílásirány a szereléskor állítható.'
      }
    ]
  },
  {
    match: /fogantyú|fogantyu|húzó|handle|knob/i,
    faq: [
      {
        q: 'Milyen furattávolság kell?',
        a: 'Nézd a termék jellemzőinél a furattávolságot (pl. 96 / 128 / 160 mm). Ha nincs megadva, a leírásban szerepel.'
      },
      {
        q: 'Milyen csavar jár hozzá?',
        a: 'A legtöbb fogantyúhoz M4-es csavar kell; a hossz a bútorajtó vastagságától függ.'
      }
    ]
  },
  {
    match: /fiókcsúszó|fiokcsuszo|csúszó|drawer\s*slide/i,
    faq: [
      {
        q: 'Teljes kihúzású vagy részleges?',
        a: 'A termék nevében / leírásában szerepel. Teljes kihúzásnál a fiók teljesen kihúzható.'
      },
      {
        q: 'Mekkora teherbírás?',
        a: 'A teherbírás a jellemzőknél vagy a leírásban van megadva kg-ban.'
      }
    ]
  },
  {
    match: /vasalat|hardware/i,
    faq: [
      {
        q: 'Illik a meglévő bútoromhoz?',
        a: 'Ellenőrizd a méreteket és a furatkiosztást a leírásban. Kérdés esetén keresd a bolt elérhetőségét.'
      }
    ]
  }
]

function normalizeKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('hu')
    .replace(/[^a-z0-9]+/g, '')
}

function tokenizeHu(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('hu')
    .split(/[^a-z0-9áéíóöőúüű]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3)
}

/** Név + kategória → keresőszavak (agent vocabulary). */
export function suggestSearchAliases(input: {
  productName: string
  productType?: string | null
  existing?: string[]
}): string[] {
  const out = new Set<string>()
  for (const e of input.existing ?? []) {
    const t = e.trim().toLocaleLowerCase('hu')
    if (t) out.add(t)
  }

  const blob = `${input.productName} ${input.productType ?? ''}`
  for (const tok of tokenizeHu(blob)) {
    out.add(tok)
    const key = normalizeKey(tok)
    const syns = CATEGORY_SYNONYMS[key]
    if (syns) {
      for (const s of syns) out.add(s.toLocaleLowerCase('hu'))
    }
  }

  // Kategória path darabok
  if (input.productType) {
    for (const part of input.productType.split(/[>/|,]/)) {
      const p = part.trim().toLocaleLowerCase('hu')
      if (p.length >= 3) out.add(p)
      const syns = CATEGORY_SYNONYMS[normalizeKey(p)]
      if (syns) for (const s of syns) out.add(s.toLocaleLowerCase('hu'))
    }
  }

  return [...out].slice(0, 24)
}

/** Leírás / név → műszaki kulcs–érték párok. */
export function parseSpecsFromText(text: string): Record<string, string> {
  const specs: Record<string, string> = {}
  const t = text.trim()
  if (!t) return specs

  const degree = t.match(/(\d+)\s*°/)
  if (degree) specs['Nyílásszög'] = `${degree[1]}°`

  const hole = t.match(
    /furat(?:távolság|tavolsag)?[:\s]*(\d+(?:[.,]\d+)?)\s*mm/i
  )
  if (hole) specs['Furattávolság'] = `${hole[1].replace(',', '.')} mm`

  for (const m of MATERIAL_WORDS) {
    if (m.re.test(t)) {
      specs['Anyag'] = m.label
      break
    }
  }
  for (const c of COLOR_WORDS) {
    if (c.re.test(t)) {
      specs['Szín'] = c.label
      break
    }
  }

  return specs
}

export function faqTemplateForCategory(
  productType: string | null | undefined,
  productName: string
): WebFaqItem[] {
  const blob = `${productType ?? ''} ${productName}`
  for (const row of FAQ_BY_CATEGORY) {
    if (row.match.test(blob)) return row.faq.map((f) => ({ ...f }))
  }
  return []
}

function mergeSpecs(
  existing: Record<string, string>,
  parsed: Record<string, string>
): Record<string, string> {
  const out = { ...existing }
  for (const [k, v] of Object.entries(parsed)) {
    const key = k.trim()
    if (!key || !v.trim()) continue
    const has = Object.keys(out).some(
      (x) => x.toLocaleLowerCase('hu') === key.toLocaleLowerCase('hu')
    )
    if (!has) out[key] = v.trim()
  }
  return out
}

export type EnrichableWebFields = {
  sellableWeb: boolean
  webSearchAliases: string[]
  webSpecs: Record<string, string>
  webFaq: WebFaqItem[]
  webUseCases: string[]
  webColor: string | null
  webSize: string | null
  webMaterial: string | null
  webDescriptionLong: string | null
  webProductType: string | null
  shippingWeightKg: number | null
  shippingLengthCm: number | null
  shippingWidthCm: number | null
  shippingHeightCm: number | null
  productWeightKg: number | null
  productLengthCm: number | null
  productWidthCm: number | null
  productHeightCm: number | null
  webMpn: string | null
}

/**
 * Üres mezőket tölti. Nem ír felül nem-üres user értéket.
 */
export function enrichWebProductFields(
  fields: EnrichableWebFields,
  opts: {
    productName: string
    sku?: string | null
    shippingDefaults?: WebshopShippingDefaults | null
  }
): EnrichableWebFields {
  if (!fields.sellableWeb) return fields

  const name = opts.productName.trim()
  const long = fields.webDescriptionLong?.trim() || ''
  const productType = fields.webProductType?.trim() || null
  const defaults = opts.shippingDefaults ?? DEFAULT_WEBSHOP_SHIPPING

  const aliases = suggestSearchAliases({
    productName: name,
    productType,
    existing: fields.webSearchAliases
  })

  const parsed = parseSpecsFromText(`${name}\n${long}`)
  const specs = mergeSpecs(fields.webSpecs ?? {}, parsed)

  let webColor = fields.webColor?.trim() || null
  const webSize = fields.webSize?.trim() || null
  let webMaterial = fields.webMaterial?.trim() || null
  if (!webColor && specs['Szín']) webColor = specs['Szín']
  if (!webMaterial && specs['Anyag']) webMaterial = specs['Anyag']

  // Sablon GYIK / „Mire jó?” nem töltődik: általános szöveg az AI-nak zaj,
  // a vásárlónak ígéret nélküli válasz.
  const webFaq = fields.webFaq ?? []
  const webUseCases = fields.webUseCases ?? []

  const shippingWeightKg =
    fields.shippingWeightKg != null && fields.shippingWeightKg > 0
      ? fields.shippingWeightKg
      : defaults.weightKg
  const shippingLengthCm =
    fields.shippingLengthCm != null && fields.shippingLengthCm > 0
      ? fields.shippingLengthCm
      : defaults.lengthCm
  const shippingWidthCm =
    fields.shippingWidthCm != null && fields.shippingWidthCm > 0
      ? fields.shippingWidthCm
      : defaults.widthCm
  const shippingHeightCm =
    fields.shippingHeightCm != null && fields.shippingHeightCm > 0
      ? fields.shippingHeightCm
      : defaults.heightCm

  // A termék nettó mérete sosem a csomag alapértéke — a PDP-n hamis adat lenne.
  const productWeightKg = fields.productWeightKg
  const productLengthCm = fields.productLengthCm
  const productWidthCm = fields.productWidthCm
  const productHeightCm = fields.productHeightCm

  // MPN a gyártó azonosítója — a saját cikkszámból nem származtatható.
  const webMpn = fields.webMpn?.trim() || null

  return {
    ...fields,
    webSearchAliases: aliases,
    webSpecs: specs,
    webFaq,
    webUseCases,
    webColor,
    webSize,
    webMaterial,
    shippingWeightKg,
    shippingLengthCm,
    shippingWidthCm,
    shippingHeightCm,
    productWeightKg,
    productLengthCm,
    productWidthCm,
    productHeightCm,
    webMpn
  }
}
