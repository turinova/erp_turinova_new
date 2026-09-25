import {
  kvToRecord,
  listToLines,
  parseLinesToList,
  parsePriceTiersRaw,
  priceTiersToRaw,
  recordToKv,
  suggestWebDescriptionShort,
  suggestWebSlug,
  type WebFaqItem,
  type WebKv
} from '@/lib/accessories/web-shop'
import type { SpecInputDraft } from '@/components/accessories/accessory-spec-field'
import { parseSpecNumber, resolveCategoryTemplate, specNumberToRaw } from '@/lib/webshop/key-specs'
import type { AttributeInput, ProductAttributeRow, WebCategoryRow } from '@/lib/webshop/types'
import { enrichWebProductFields, type WebshopShippingDefaults } from '@/lib/webshop/enrich'
import type { ShopProductInput } from '@/lib/webshop/product-parse'
import type { ShopProductDetail } from '@/lib/webshop/product-queries'

export type AccessoryWebFormState = {
  sellableWeb: boolean
  webSlug: string
  webTitle: string
  webDescriptionShort: string
  webDescriptionLong: string
  webBrand: string
  webGtin: string
  webMpn: string
  webProductType: string
  webGoogleCategory: string
  webTagsRaw: string
  webSearchAliasesRaw: string
  webColor: string
  webSize: string
  webMaterial: string
  attributes: WebKv[]
  specs: WebKv[]
  faqItems: WebFaqItem[]
  useCasesRaw: string
  compatibilityRaw: string
  compareAtRaw: string
  shippingWeightRaw: string
  shippingLengthRaw: string
  shippingWidthRaw: string
  shippingHeightRaw: string
  productWeightRaw: string
  productLengthRaw: string
  productWidthRaw: string
  productHeightRaw: string
  webGroupId: string
  webCategoryId: string
  attributeValueIds: string[]
  /** Nem listás műszaki adatok (szám / tartomány / igen-nem) attribútum szerint. */
  specInputs: Record<string, SpecInputDraft>
  boxContentsRaw: string
  dimensionImageUrl: string
  safetyInfo: string
  netQuantityRaw: string
  netUnit: string
  ingredients: string
  usage: string
  videoUrl: string
  countryOfOrigin: string
  multipackRaw: string
  isBundle: boolean
  priceTiersRaw: string
  /** false = nincs EAN/MPN (egyedi, saját gyártás) — feedben identifier_exists=no. */
  identifierExists: boolean
}

export function emptyWebFormState(): AccessoryWebFormState {
  return {
    sellableWeb: false,
    webSlug: '',
    webTitle: '',
    webDescriptionShort: '',
    webDescriptionLong: '',
    webBrand: '',
    webGtin: '',
    webMpn: '',
    webProductType: '',
    webGoogleCategory: '',
    webTagsRaw: '',
    webSearchAliasesRaw: '',
    webColor: '',
    webSize: '',
    webMaterial: '',
    attributes: [{ key: '', value: '' }],
    specs: [{ key: '', value: '' }],
    faqItems: [{ q: '', a: '' }],
    useCasesRaw: '',
    compatibilityRaw: '',
    compareAtRaw: '',
    shippingWeightRaw: '',
    shippingLengthRaw: '',
    shippingWidthRaw: '',
    shippingHeightRaw: '',
    productWeightRaw: '',
    productLengthRaw: '',
    productWidthRaw: '',
    productHeightRaw: '',
    webGroupId: '',
    webCategoryId: '',
    attributeValueIds: [],
    specInputs: {},
    boxContentsRaw: '',
    dimensionImageUrl: '',
    safetyInfo: '',
    netQuantityRaw: '',
    netUnit: '',
    ingredients: '',
    usage: '',
    videoUrl: '',
    countryOfOrigin: '',
    multipackRaw: '',
    isBundle: false,
    priceTiersRaw: '',
    identifierExists: true
  }
}

export function webFormStateFromShop(detail: ShopProductDetail): AccessoryWebFormState {
  const initial = {
    ...detail.web,
    web_category_id: detail.web_category_id,
    attribute_value_ids: detail.attribute_value_ids,
    attribute_inputs: detail.attribute_inputs
  }
  const faq =
    initial.web_faq.length > 0
      ? initial.web_faq
      : ([{ q: '', a: '' }] as WebFaqItem[])
  return {
    sellableWeb: initial.sellable_web,
    webSlug: initial.web_slug ?? '',
    webTitle: initial.web_title ?? '',
    webDescriptionShort: initial.web_description_short ?? '',
    webDescriptionLong:
      initial.web_description_long?.trim() ||
      initial.web_description_short ||
      '',
    webBrand: initial.web_brand ?? '',
    webGtin: initial.web_gtin ?? '',
    webMpn: initial.web_mpn ?? '',
    webProductType: initial.web_product_type ?? '',
    webGoogleCategory: initial.web_google_category ?? '',
    webTagsRaw: listToLines(initial.web_tags),
    webSearchAliasesRaw: listToLines(initial.web_search_aliases),
    webColor: initial.web_color ?? '',
    webSize: initial.web_size ?? '',
    webMaterial: initial.web_material ?? '',
    attributes: recordToKv(initial.web_attributes),
    specs: recordToKv(initial.web_specs),
    faqItems: faq,
    useCasesRaw: listToLines(initial.web_use_cases),
    compatibilityRaw: listToLines(initial.web_compatibility),
    compareAtRaw:
      initial.web_compare_at_price != null
        ? String(initial.web_compare_at_price)
        : '',
    shippingWeightRaw:
      initial.shipping_weight_kg != null
        ? String(initial.shipping_weight_kg)
        : '',
    shippingLengthRaw:
      initial.shipping_length_cm != null
        ? String(initial.shipping_length_cm)
        : '',
    shippingWidthRaw:
      initial.shipping_width_cm != null
        ? String(initial.shipping_width_cm)
        : '',
    shippingHeightRaw:
      initial.shipping_height_cm != null
        ? String(initial.shipping_height_cm)
        : '',
    productWeightRaw:
      initial.product_weight_kg != null
        ? String(initial.product_weight_kg)
        : '',
    productLengthRaw:
      initial.product_length_cm != null
        ? String(initial.product_length_cm)
        : '',
    productWidthRaw:
      initial.product_width_cm != null ? String(initial.product_width_cm) : '',
    productHeightRaw:
      initial.product_height_cm != null
        ? String(initial.product_height_cm)
        : '',
    webGroupId: initial.web_group_id ?? '',
    webCategoryId: initial.web_category_id ?? '',
    attributeValueIds: initial.attribute_value_ids ?? [],
    specInputs: Object.fromEntries(
      (initial.attribute_inputs ?? []).map((i) => [
        i.attributeId,
        {
          numRaw: specNumberToRaw(i.valueNum),
          maxRaw: specNumberToRaw(i.valueMax),
          bool: i.valueBool == null ? '' : i.valueBool ? 'yes' : 'no'
        } satisfies SpecInputDraft
      ])
    ),
    boxContentsRaw: listToLines(initial.web_box_contents),
    dimensionImageUrl: initial.web_dimension_image_url ?? '',
    safetyInfo: initial.web_safety_info ?? '',
    netQuantityRaw: initial.web_net_quantity != null ? String(initial.web_net_quantity).replace('.', ',') : '',
    netUnit: initial.web_net_unit ?? '',
    ingredients: initial.web_ingredients ?? '',
    usage: initial.web_usage ?? '',
    videoUrl: initial.web_video_url ?? '',
    countryOfOrigin: initial.web_country_of_origin ?? '',
    multipackRaw: initial.web_multipack != null ? String(initial.web_multipack) : '',
    isBundle: initial.web_is_bundle === true,
    priceTiersRaw: priceTiersToRaw(initial.web_price_tiers),
    identifierExists: initial.web_identifier_exists !== false
  }
}

function draftsToInputs(
  drafts: Record<string, SpecInputDraft>,
  attributes: ProductAttributeRow[]
): AttributeInput[] {
  const out: AttributeInput[] = []
  for (const attr of attributes) {
    if (attr.valueType === 'list') continue
    const d = drafts[attr.id]
    if (!d) continue
    const num = parseSpecNumber(d.numRaw)
    const max = parseSpecNumber(d.maxRaw)
    const input: AttributeInput = {
      attributeId: attr.id,
      valueNum: attr.valueType === 'boolean' || num == null || Number.isNaN(num) ? null : num,
      valueMax:
        attr.valueType !== 'range' || max == null || Number.isNaN(max) ? null : max,
      valueBool:
        attr.valueType === 'boolean' && d.bool ? d.bool === 'yes' : null
    }
    if (input.valueNum != null || input.valueMax != null || input.valueBool != null) {
      out.push(input)
    }
  }
  return out
}

/** Mentés előtti ellenőrzés — hibás szám ne vesszen el csendben. */
export function webSpecInputErrors(
  web: AccessoryWebFormState,
  attributes: ProductAttributeRow[]
): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const attr of attributes) {
    if (attr.valueType !== 'number' && attr.valueType !== 'range') continue
    const d = web.specInputs[attr.id]
    if (!d) continue
    const num = parseSpecNumber(d.numRaw)
    const max = attr.valueType === 'range' ? parseSpecNumber(d.maxRaw) : null
    if ((num != null && Number.isNaN(num)) || (max != null && Number.isNaN(max))) {
      errors[`spec-${attr.id}`] = `${attr.name}: csak szám lehet (pl. 37,5).`
    } else if (num != null && max != null && max < num) {
      errors[`spec-${attr.id}`] = `${attr.name}: a „tól” nem lehet nagyobb az „ig”-nél.`
    } else if ((num != null && num < 0) || (max != null && max < 0)) {
      errors[`spec-${attr.id}`] = `${attr.name}: nem lehet negatív.`
    }
  }
  return errors
}

/** Listaszerkesztő mezők: soronként egy elem, a vessző az elem része maradhat. */
export function linesOnly(raw: string): string[] {
  return raw
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
}

function parseOptionalInt(raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  const n = Number(t.replace(/\s/g, '').replace(',', '.'))
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return null
  return n
}

function parseOptionalDecimal(raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  const n = Number(t.replace(/\s/g, '').replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

/**
 * color / size / material kódú műszaki adatból tölti a merchant mezőt.
 * Ha nincs ilyen kódú adat, a meglévő értéket megtartja.
 */
export function merchantFieldsFromAttributes(
  attributes: ProductAttributeRow[],
  attributeValueIds: string[],
  fallback: { webColor: string; webSize: string; webMaterial: string }
): { webColor: string; webSize: string; webMaterial: string } {
  const out = { ...fallback }
  const selected = new Set(attributeValueIds)
  for (const attr of attributes) {
    const code = attr.code.toLowerCase()
    const field =
      code === 'color'
        ? 'webColor'
        : code === 'size'
          ? 'webSize'
          : code === 'material'
            ? 'webMaterial'
            : null
    if (!field) continue
    const picked = attr.values.filter((v) => selected.has(v.id))
    out[field] = picked
      .map((v) => v.label.trim())
      .join(', ')
      .slice(0, field === 'webMaterial' ? 100 : 40)
  }
  return out
}

export function webFormToPayload(
  web: AccessoryWebFormState,
  attributes: ProductAttributeRow[] = [],
  opts?: {
    productName?: string
    manufacturerName?: string | null
    barcode?: string
    sku?: string | null
    shippingDefaults?: WebshopShippingDefaults | null
  }
) {
  const merchant = merchantFieldsFromAttributes(
    attributes,
    web.attributeValueIds,
    {
      webColor: web.webColor,
      webSize: web.webSize,
      webMaterial: web.webMaterial
    }
  )

  const long = web.webDescriptionLong.trim()
  const short =
    web.webDescriptionShort.trim() ||
    (long ? suggestWebDescriptionShort(long) : '')
  const slug =
    web.webSlug.trim() ||
    (opts?.productName ? suggestWebSlug(opts.productName) : '')
  const brand =
    web.webBrand.trim() || opts?.manufacturerName?.trim() || ''
  const gtin = web.webGtin.trim() || opts?.barcode?.trim() || ''

  const shippingWeightKg = parseOptionalDecimal(web.shippingWeightRaw)
  const shippingLengthCm = parseOptionalDecimal(web.shippingLengthRaw)
  const shippingWidthCm = parseOptionalDecimal(web.shippingWidthRaw)
  const shippingHeightCm = parseOptionalDecimal(web.shippingHeightRaw)
  const productWeightKg = parseOptionalDecimal(web.productWeightRaw)
  const productLengthCm = parseOptionalDecimal(web.productLengthRaw)
  const productWidthCm = parseOptionalDecimal(web.productWidthRaw)
  const productHeightCm = parseOptionalDecimal(web.productHeightRaw)

  const base = {
    sellableWeb: web.sellableWeb,
    webSlug: slug || null,
    webTitle: web.webTitle.trim() || null,
    webDescriptionShort: short || null,
    webDescriptionLong: long || null,
    webBrand: brand || null,
    webGtin: gtin || null,
    webMpn: web.webMpn.trim() || null,
    webProductType: web.webProductType.trim() || null,
    webGoogleCategory: web.webGoogleCategory.trim() || null,
    webTags: parseLinesToList(web.webTagsRaw),
    webSearchAliases: parseLinesToList(web.webSearchAliasesRaw),
    webColor: merchant.webColor || null,
    webSize: merchant.webSize || null,
    webMaterial: merchant.webMaterial || null,
    webAttributes: kvToRecord(web.attributes),
    webSpecs: kvToRecord(web.specs),
    webFaq: web.faqItems.filter((f) => f.q.trim() && f.a.trim()),
    webUseCases: linesOnly(web.useCasesRaw),
    webCompatibility: linesOnly(web.compatibilityRaw),
    webCompareAtPrice: parseOptionalInt(web.compareAtRaw),
    shippingWeightKg,
    shippingLengthCm,
    shippingWidthCm,
    shippingHeightCm,
    productWeightKg,
    productLengthCm,
    productWidthCm,
    productHeightCm,
    webGroupId: web.webGroupId.trim() || null,
    webCategoryId: web.webCategoryId || null,
    attributeValueIds: web.attributeValueIds,
    attributeInputs: draftsToInputs(web.specInputs, attributes),
    webBoxContents: linesOnly(web.boxContentsRaw),
    webDimensionImageUrl: web.dimensionImageUrl.trim() || null,
    webSafetyInfo: web.safetyInfo.trim() || null,
    webNetQuantity: parseOptionalDecimal(web.netQuantityRaw),
    webNetUnit: (web.netUnit || null) as ShopProductInput['webNetUnit'],
    webIngredients: web.ingredients.trim() || null,
    webUsage: web.usage.trim() || null,
    webVideoUrl: web.videoUrl.trim() || null,
    webCountryOfOrigin: web.countryOfOrigin || null,
    webMultipack: parseOptionalInt(web.multipackRaw),
    webIsBundle: web.isBundle,
    webPriceTiers: parsePriceTiersRaw(web.priceTiersRaw),
    webIdentifierExists: web.identifierExists
  }

  if (!base.sellableWeb) return base

  const enriched = enrichWebProductFields(
    {
      sellableWeb: true,
      webSearchAliases: base.webSearchAliases,
      webSpecs: base.webSpecs,
      webFaq: base.webFaq,
      webUseCases: base.webUseCases,
      webColor: base.webColor,
      webSize: base.webSize,
      webMaterial: base.webMaterial,
      webDescriptionLong: base.webDescriptionLong,
      webProductType: base.webProductType,
      shippingWeightKg: base.shippingWeightKg,
      shippingLengthCm: base.shippingLengthCm,
      shippingWidthCm: base.shippingWidthCm,
      shippingHeightCm: base.shippingHeightCm,
      productWeightKg: base.productWeightKg,
      productLengthCm: base.productLengthCm,
      productWidthCm: base.productWidthCm,
      productHeightCm: base.productHeightCm,
      webMpn: base.webMpn
    },
    {
      productName: opts?.productName ?? '',
      sku: opts?.sku,
      shippingDefaults: opts?.shippingDefaults
    }
  )

  return {
    ...base,
    webSearchAliases: enriched.webSearchAliases,
    webSpecs: enriched.webSpecs,
    webFaq: enriched.webFaq,
    webUseCases: enriched.webUseCases,
    webColor: enriched.webColor,
    webSize: enriched.webSize,
    webMaterial: enriched.webMaterial,
    shippingWeightKg: enriched.shippingWeightKg,
    shippingLengthCm: enriched.shippingLengthCm,
    shippingWidthCm: enriched.shippingWidthCm,
    shippingHeightCm: enriched.shippingHeightCm,
    productWeightKg: enriched.productWeightKg,
    productLengthCm: enriched.productLengthCm,
    productWidthCm: enriched.productWidthCm,
    productHeightCm: enriched.productHeightCm,
    webMpn: enriched.webMpn
  }
}

export function selectedValuesForAttr(
  web: AccessoryWebFormState,
  attr: ProductAttributeRow
): string[] {
  const ids = new Set(attr.values.map((v) => v.id))
  return web.attributeValueIds.filter((id) => ids.has(id))
}

export function attrHasValue(web: AccessoryWebFormState, attr: ProductAttributeRow): boolean {
  if (attr.valueType === 'list') return selectedValuesForAttr(web, attr).length > 0
  const d = web.specInputs[attr.id]
  if (!d) return false
  if (attr.valueType === 'boolean') return d.bool !== ''
  return Boolean(d.numRaw.trim() || d.maxRaw.trim())
}

/** A kategória sablonja szerint: kulcsadatok, ajánlott adatok, egyéb jellemzők. */
export function specModel(
  web: AccessoryWebFormState,
  attributes: ProductAttributeRow[],
  categories: WebCategoryRow[]
) {
  const template = resolveCategoryTemplate(categories, web.webCategoryId || null)
  const active = attributes.filter((a) => a.active)
  const byId = new Map(active.map((a) => [a.id, a]))
  const pick = (role: string) =>
    template.items
      .filter((i) => i.role === role)
      .map((i) => byId.get(i.attributeId))
      .filter((a): a is ProductAttributeRow => a != null)
  const keyAttrs = pick('key')
  const specAttrs = pick('spec')
  const templateIds = new Set(template.items.map((i) => i.attributeId))
  const otherAttrs = active.filter((a) => !templateIds.has(a.id))
  const keyFilled = keyAttrs.filter((a) => attrHasValue(web, a)).length
  return { template, keyAttrs, specAttrs, otherAttrs, keyFilled }
}
