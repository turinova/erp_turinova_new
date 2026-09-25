'use client'

import { Check, ChevronDown, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'

import { FormField } from '@/components/patterns/form-field'
import { FormSection } from '@/components/patterns/form-section'
import { StatusBadge } from '@/components/patterns/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MenuSelect } from '@/components/ui/menu-select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { AccessoryListItem } from '@/lib/accessories/queries'
import {
  evaluateShopReady,
  kvToRecord,
  listToLines,
  parseLinesToList,
  parsePriceTiersRaw,
  priceTiersToRaw,
  recordToKv,
  SHOP_READY_LABEL,
  shopReadyTone,
  suggestWebDescriptionShort,
  suggestWebSlug,
  type WebFaqItem,
  type WebKv
} from '@/lib/accessories/web-shop'
import {
  AccessorySpecField,
  EMPTY_SPEC_DRAFT,
  type SpecInputDraft
} from '@/components/accessories/accessory-spec-field'
import {
  parseSpecNumber,
  resolveCategoryTemplate,
  specNumberToRaw
} from '@/lib/webshop/key-specs'
import type {
  AttributeInput,
  ProductAttributeRow,
  WebCategoryRow
} from '@/lib/webshop/types'
import {
  enrichWebProductFields,
  type WebshopShippingDefaults
} from '@/lib/webshop/enrich'
import { evaluateAiReadiness } from '@/lib/webshop/ai-readiness'
import { AiReadinessPanel } from '@/components/accessories/ai-readiness-panel'
import { cn } from '@/lib/utils'

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
  galleryRaw: string
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
    galleryRaw: '',
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
    priceTiersRaw: '',
    identifierExists: true
  }
}

export function webFormStateFromAccessory(
  initial: AccessoryListItem | null | undefined
): AccessoryWebFormState {
  if (!initial) return emptyWebFormState()
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
    galleryRaw: listToLines(initial.web_gallery),
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
    webGallery: parseLinesToList(web.galleryRaw),
    webFaq: web.faqItems.filter((f) => f.q.trim() && f.a.trim()),
    webUseCases: parseLinesToList(web.useCasesRaw),
    webCompatibility: parseLinesToList(web.compatibilityRaw),
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
    webBoxContents: parseLinesToList(web.boxContentsRaw),
    webDimensionImageUrl: web.dimensionImageUrl.trim() || null,
    webSafetyInfo: web.safetyInfo.trim() || null,
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

type AccessoryWebshopSectionProps = {
  web: AccessoryWebFormState
  onChange: (next: AccessoryWebFormState) => void
  productName: string
  manufacturerName: string | null
  barcode: string
  imageUrl: string | null
  /** Galéria a Képek szekcióból (nem a web form szövegmező). */
  galleryUrls: string[]
  priceNet: number | null
  priceGross: number | null
  active: boolean
  fieldErrors: Record<string, string>
  disabled: boolean
  categories: WebCategoryRow[]
  attributes: ProductAttributeRow[]
  sku?: string
  shippingDefaults?: WebshopShippingDefaults | null
  /** Hány képhez van leírás (alt). */
  imageAltCount?: number
}

function OptionalMore({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="col-span-full rounded-md border border-border bg-subtle/40">
      <button
        type="button"
        className="flex w-full items-center gap-1.5 px-2.5 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronDown
          className={cn(
            'size-3.5 shrink-0 text-ink-muted transition-transform',
            open ? null : '-rotate-90'
          )}
          aria-hidden
        />
        <span className="text-label font-semibold text-ink">{title}</span>
      </button>
      {open ? (
        <div className="grid grid-cols-1 gap-x-3 gap-y-2.5 border-t border-border px-2.5 py-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {children}
        </div>
      ) : null}
    </div>
  )
}

function CheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-1.5 text-hint text-ink-secondary">
      {ok ? (
        <Check className="size-3.5 shrink-0 text-success-ink" aria-hidden />
      ) : (
        <X className="size-3.5 shrink-0 text-danger-ink" aria-hidden />
      )}
      <span className={ok ? 'text-ink-secondary' : 'text-ink'}>{label}</span>
    </li>
  )
}

export function AccessoryWebshopSection({
  web,
  onChange,
  productName,
  manufacturerName,
  barcode,
  imageUrl,
  galleryUrls,
  priceNet,
  active,
  fieldErrors,
  disabled,
  categories,
  attributes,
  sku = '',
  shippingDefaults = null,
  imageAltCount = 0
}: AccessoryWebshopSectionProps) {
  const [open, setOpen] = useState(() => web.sellableWeb)
  const panelId = useId()
  const patch = (partial: Partial<AccessoryWebFormState>) =>
    onChange({ ...web, ...partial })

  useEffect(() => {
    if (!web.sellableWeb) return
    const hasWebError = Object.keys(fieldErrors).some((k) =>
      k === 'imageUrl'
        ? true
        : k.startsWith('web') ||
          k.startsWith('spec-') ||
          k.startsWith('shipping') ||
          k.startsWith('product')
    )
    if (hasWebError) setOpen(true)
  }, [fieldErrors, web.sellableWeb])

  const ready = useMemo(() => {
    const payload = webFormToPayload(web, attributes, {
      productName,
      manufacturerName,
      barcode,
      sku,
      shippingDefaults
    })
    return evaluateShopReady({
      sellable_web: payload.sellableWeb,
      web_slug: payload.webSlug || null,
      web_title: payload.webTitle || null,
      web_description_short: payload.webDescriptionShort || null,
      web_description_long: payload.webDescriptionLong || null,
      web_brand: payload.webBrand || null,
      web_gtin: payload.webGtin || null,
      web_mpn: payload.webMpn || null,
      web_product_type: payload.webProductType || null,
      web_google_category: payload.webGoogleCategory || null,
      web_tags: payload.webTags,
      web_search_aliases: payload.webSearchAliases,
      web_color: payload.webColor || null,
      web_size: payload.webSize || null,
      web_material: payload.webMaterial || null,
      web_attributes: payload.webAttributes,
      web_specs: payload.webSpecs,
      web_gallery: galleryUrls,
      web_faq: payload.webFaq,
      web_use_cases: payload.webUseCases,
      web_compatibility: payload.webCompatibility,
      web_compare_at_price: payload.webCompareAtPrice,
      shipping_weight_kg: payload.shippingWeightKg,
      shipping_length_cm: payload.shippingLengthCm,
      shipping_width_cm: payload.shippingWidthCm,
      shipping_height_cm: payload.shippingHeightCm,
      product_weight_kg: payload.productWeightKg,
      product_length_cm: payload.productLengthCm,
      product_width_cm: payload.productWidthCm,
      product_height_cm: payload.productHeightCm,
      web_group_id: payload.webGroupId || null,
      web_box_contents: payload.webBoxContents,
      web_dimension_image_url: payload.webDimensionImageUrl,
      web_safety_info: payload.webSafetyInfo,
      web_price_tiers: payload.webPriceTiers,
      web_identifier_exists: payload.webIdentifierExists,
      web_image_alts: {},
      name: productName,
      image_url: imageUrl,
      barcode: barcode.trim() || null,
      manufacturer_name: manufacturerName,
      price_net: priceNet ?? 0,
      active
    })
  }, [
    web,
    attributes,
    galleryUrls,
    productName,
    manufacturerName,
    barcode,
    sku,
    shippingDefaults,
    imageUrl,
    priceNet,
    active
  ])

  const longOk = web.webDescriptionLong.trim().length >= 200
  const hasImage = Boolean(imageUrl?.trim())
  const hasPrice = (priceNet ?? 0) > 0
  const hasCategory = Boolean(web.webCategoryId || web.webProductType.trim())
  const activeAttrs = attributes.filter((a) => a.active)

  function setAttrValues(attributeId: string, valueIds: string[]) {
    const attr = attributes.find((a) => a.id === attributeId)
    if (!attr) return
    const ownIds = new Set(attr.values.map((v) => v.id))
    const kept = web.attributeValueIds.filter((id) => !ownIds.has(id))
    const next = [...kept, ...valueIds.filter((id) => ownIds.has(id))]
    const merchant = merchantFieldsFromAttributes(attributes, next, {
      webColor: web.webColor,
      webSize: web.webSize,
      webMaterial: web.webMaterial
    })
    patch({
      attributeValueIds: next,
      ...merchant
    })
  }

  function selectedValuesForAttr(attributeId: string): string[] {
    const attr = attributes.find((a) => a.id === attributeId)
    if (!attr) return []
    const ids = new Set(attr.values.map((v) => v.id))
    return web.attributeValueIds.filter((id) => ids.has(id))
  }

  function setSpecDraft(attributeId: string, draft: SpecInputDraft) {
    patch({ specInputs: { ...web.specInputs, [attributeId]: draft } })
  }

  const template = useMemo(
    () => resolveCategoryTemplate(categories, web.webCategoryId || null),
    [categories, web.webCategoryId]
  )
  const attrById = useMemo(
    () => new Map(attributes.filter((a) => a.active).map((a) => [a.id, a])),
    [attributes]
  )
  const keyAttrs = template.items
    .filter((i) => i.role === 'key')
    .map((i) => attrById.get(i.attributeId))
    .filter((a): a is ProductAttributeRow => a != null)
  const specAttrs = template.items
    .filter((i) => i.role === 'spec')
    .map((i) => attrById.get(i.attributeId))
    .filter((a): a is ProductAttributeRow => a != null)
  const templateIds = new Set(template.items.map((i) => i.attributeId))
  const otherAttrs = activeAttrs.filter((a) => !templateIds.has(a.id))

  function attrHasValue(attr: ProductAttributeRow): boolean {
    if (attr.valueType === 'list') return selectedValuesForAttr(attr.id).length > 0
    const d = web.specInputs[attr.id]
    if (!d) return false
    if (attr.valueType === 'boolean') return d.bool !== ''
    return Boolean(d.numRaw.trim() || d.maxRaw.trim())
  }
  const keyFilled = keyAttrs.filter(attrHasValue).length

  function renderSpecField(
    attr: ProductAttributeRow,
    opts?: { primary?: boolean }
  ) {
    return (
      <AccessorySpecField
        key={attr.id}
        attr={attr}
        draft={web.specInputs[attr.id] ?? EMPTY_SPEC_DRAFT}
        selectedValueIds={selectedValuesForAttr(attr.id)}
        onDraftChange={(d) => setSpecDraft(attr.id, d)}
        onValuesChange={(ids) => setAttrValues(attr.id, ids)}
        disabled={disabled}
        error={fieldErrors[`spec-${attr.id}`]}
        productName={opts?.primary ? productName : undefined}
        emphasis={attr.valueType === 'list' && attr.allowMultiple}
      />
    )
  }

  function onCategoryChange(id: string) {
    const cat = categories.find((c) => c.id === id)
    const path = cat
      ? cat.parentName
        ? `${cat.parentName} > ${cat.name}`
        : cat.name
      : ''
    patch({
      webCategoryId: id,
      webProductType: path,
      webGoogleCategory: cat?.googleTaxonomyId || web.webGoogleCategory
    })
  }

  function onDescriptionChange(value: string) {
    patch({
      webDescriptionLong: value,
      webDescriptionShort: suggestWebDescriptionShort(value)
    })
  }

  const primaryKey = keyAttrs[0]
  const primaryNum =
    primaryKey && (primaryKey.valueType === 'number' || primaryKey.valueType === 'range')
      ? parseSpecNumber(web.specInputs[primaryKey.id]?.numRaw ?? '')
      : null
  const imageCount = (imageUrl?.trim() ? 1 : 0) + galleryUrls.length
  const aiReadiness = evaluateAiReadiness({
    title: web.webTitle.trim() || productName,
    description: web.webDescriptionLong.trim() || null,
    brand: web.webBrand.trim() || manufacturerName,
    gtin: web.webGtin.trim() || barcode.trim() || null,
    mpn: web.webMpn.trim() || null,
    identifierExists: web.identifierExists,
    imageCount,
    imagesWithAlt: Math.min(imageAltCount, imageCount),
    keySpecsTotal: keyAttrs.length,
    keySpecsFilled: keyFilled,
    hasMeasureImage: Boolean(web.dimensionImageUrl.trim() || template.measureImageUrl),
    hasProductDimensions: Boolean(
      web.productLengthRaw.trim() || web.productWidthRaw.trim() || web.productHeightRaw.trim()
    ),
    hasCategory,
    primarySpec: primaryKey
      ? {
          name: primaryKey.name,
          value: primaryNum != null && !Number.isNaN(primaryNum) ? primaryNum : null,
          unit: primaryKey.unit
        }
      : null
  })

  const missingBits: string[] = []
  if (web.sellableWeb) {
    if (!hasImage) missingBits.push('fő kép')
    if (!hasPrice || !active) missingBits.push('aktív termék + ár')
    if (!hasCategory) missingBits.push('kategória')
    if (!longOk) missingBits.push('leírás (min. ~200 karakter)')
  }

  return (
    <FormSection
      title="Webshop"
      description="Kapcsold be, válassz kategóriát, írj leírást — a többi automatikus."
      columns={4}
      bodyHidden={!open}
      onTitleClick={() => setOpen((v) => !v)}
      headerAction={
        <button
          type="button"
          className="-m-1 rounded p-1 text-ink-muted hover:bg-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={
            open ? 'Webshop szekció bezárása' : 'Webshop szekció megnyitása'
          }
          onClick={() => setOpen((v) => !v)}
        >
          <ChevronDown
            className={cn(
              'size-3.5 transition-transform',
              open ? null : '-rotate-90'
            )}
            aria-hidden
          />
        </button>
      }
      headerAside={
        <button
          type="button"
          className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
        >
          <StatusBadge tone={shopReadyTone(ready.level)}>
            {SHOP_READY_LABEL[ready.level]}
          </StatusBadge>
        </button>
      }
    >
      <div id={panelId} className="contents">
        <div className="col-span-full space-y-2">
          <Switch
            id="accessory-sellable-web"
            checked={web.sellableWeb}
            disabled={disabled}
            onCheckedChange={(v) => {
              const next: AccessoryWebFormState = {
                ...web,
                sellableWeb: v
              }
              if (v && !next.webSlug.trim() && productName.trim()) {
                next.webSlug = suggestWebSlug(productName)
              }
              if (v && next.webDescriptionLong.trim()) {
                next.webDescriptionShort = suggestWebDescriptionShort(
                  next.webDescriptionLong
                )
              }
              onChange(next)
            }}
            label="Elérhető az online boltban"
            description="Mentéskor automatikus: keresőszavak, műszaki a leírásból, csomagméret. A pult (POS) ettől független."
          />

          {web.sellableWeb && missingBits.length > 0 ? (
            <p
              className="rounded-md border border-warning/30 bg-warning-soft px-2.5 py-2 text-hint text-warning-ink"
              role="status"
            >
              Még hiányzik: {missingBits.join(', ')}.
            </p>
          ) : null}

          {web.sellableWeb && missingBits.length === 0 ? (
            <ul className="grid gap-1 sm:grid-cols-2">
              <CheckRow ok label="Fő kép" />
              <CheckRow ok label="Ár + aktív" />
              <CheckRow ok label="Kategória" />
              <CheckRow ok label="Leírás" />
              {keyAttrs.length > 0 ? (
                <CheckRow
                  ok={keyFilled === keyAttrs.length}
                  label={`Kulcsadatok ${keyFilled}/${keyAttrs.length}`}
                />
              ) : null}
            </ul>
          ) : null}
        </div>

        {web.sellableWeb ? <AiReadinessPanel result={aiReadiness} /> : null}

        {web.sellableWeb ? (
          <>
            <FormField
              label="Hol van a boltban"
              htmlFor="accessory-web-category"
              required
              error={fieldErrors.webCategoryId || fieldErrors.webProductType}
              hint="A Google kategória a választásból jön"
              className="sm:col-span-2"
            >
              <MenuSelect
                id="accessory-web-category"
                value={web.webCategoryId}
                onChange={onCategoryChange}
                disabled={disabled}
                placeholder="Válassz kategóriát…"
                options={categories
                  .filter((c) => c.active)
                  .map((c) => ({
                    value: c.id,
                    label: c.parentName
                      ? `${c.parentName} › ${c.name}`
                      : c.name
                  }))}
              />
            </FormField>

            <FormField
              label="Leírás a vásárlónak"
              htmlFor="accessory-web-long"
              required
              error={
                fieldErrors.webDescriptionLong ||
                fieldErrors.webDescriptionShort
              }
              hint={`${web.webDescriptionLong.trim().length} karakter · írd le mire való (min. ~200). A rövid szöveg automatikus.`}
              className="col-span-full"
            >
              <Textarea
                id="accessory-web-long"
                value={web.webDescriptionLong}
                onChange={(e) => onDescriptionChange(e.target.value)}
                rows={6}
                maxLength={5000}
                disabled={disabled}
                placeholder="Pl. Fehér bútorzsanér ajtókhoz. Acél, csendes záródás. 110°-os nyílás."
              />
            </FormField>

            {web.webCategoryId && keyAttrs.length === 0 ? (
              <p className="col-span-full rounded-md border border-border bg-subtle px-2.5 py-2 text-hint text-ink-secondary">
                Ennek a kategóriának még nincs kulcsadata, ezért a termékoldalon nem
                lesz „Passzol-e?” blokk. A Webshop → Bolt kategóriák → Kulcsadatok
                résznél állíthatod be (pl. fogantyúnál Furattávolság).
              </p>
            ) : null}

            {keyAttrs.length > 0 ? (
              <>
                <div className="col-span-full space-y-0.5">
                  <p className="text-label font-semibold text-ink">
                    Kulcsadatok — „Passzol-e?”{' '}
                    <span className="font-normal text-ink-secondary">
                      ({keyFilled}/{keyAttrs.length} kitöltve)
                    </span>
                  </p>
                  <p className="text-hint text-ink-secondary">
                    Ezeket veti össze a vásárló a régi alkatrészével. Ami üres, az nem
                    jelenik meg.
                    {template.inherited && template.sourceCategoryName
                      ? ` Sablon: ${template.sourceCategoryName}.`
                      : ''}
                  </p>
                </div>
                {keyAttrs.map((attr, index) =>
                  renderSpecField(attr, { primary: index === 0 })
                )}
              </>
            ) : null}

            {specAttrs.length > 0 ? (
              <>
                <p className="col-span-full text-label font-semibold text-ink">
                  Ajánlott adatok
                </p>
                {specAttrs.map((attr) => renderSpecField(attr))}
              </>
            ) : null}

            {otherAttrs.length > 0 && template.items.length === 0 ? (
              <>
                <p className="col-span-full text-label font-semibold text-ink">
                  Jellemzők
                </p>
                {otherAttrs.map((attr) => renderSpecField(attr))}
              </>
            ) : null}

            {otherAttrs.length > 0 && template.items.length > 0 ? (
              <OptionalMore title={`További jellemzők (${otherAttrs.length})`}>
                {otherAttrs.map((attr) => renderSpecField(attr))}
              </OptionalMore>
            ) : null}

            <OptionalMore title="Még több (nem kötelező a feltöltéshez)">
              <FormField
                label="Listaár (bruttó Ft)"
                htmlFor="accessory-web-compare"
                optionalLabel
                hint="Nem jelenik meg áthúzva. Árcsökkentéskor a termékoldal magától az előző 30 nap legalacsonyabb árát mutatja."
              >
                <Input
                  id="accessory-web-compare"
                  value={web.compareAtRaw}
                  onChange={(e) => patch({ compareAtRaw: e.target.value })}
                  inputMode="numeric"
                  disabled={disabled}
                />
              </FormField>

              <FormField
                label="Csomag súly (kg)"
                htmlFor="acc-ship-w"
                optionalLabel
              >
                <Input
                  id="acc-ship-w"
                  value={web.shippingWeightRaw}
                  onChange={(e) =>
                    patch({ shippingWeightRaw: e.target.value })
                  }
                  inputMode="decimal"
                  disabled={disabled}
                />
              </FormField>
              <FormField label="Hossz (cm)" htmlFor="acc-ship-l" optionalLabel>
                <Input
                  id="acc-ship-l"
                  value={web.shippingLengthRaw}
                  onChange={(e) =>
                    patch({ shippingLengthRaw: e.target.value })
                  }
                  inputMode="decimal"
                  disabled={disabled}
                />
              </FormField>
              <FormField
                label="Szélesség (cm)"
                htmlFor="acc-ship-wd"
                optionalLabel
              >
                <Input
                  id="acc-ship-wd"
                  value={web.shippingWidthRaw}
                  onChange={(e) =>
                    patch({ shippingWidthRaw: e.target.value })
                  }
                  inputMode="decimal"
                  disabled={disabled}
                />
              </FormField>
              <FormField
                label="Magasság (cm)"
                htmlFor="acc-ship-h"
                optionalLabel
              >
                <Input
                  id="acc-ship-h"
                  value={web.shippingHeightRaw}
                  onChange={(e) =>
                    patch({ shippingHeightRaw: e.target.value })
                  }
                  inputMode="decimal"
                  disabled={disabled}
                />
              </FormField>

              <FormField
                label="Gyártói cikkszám (MPN)"
                htmlFor="accessory-web-mpn"
                optionalLabel
                hint="Ha nincs vonalkód"
                className="sm:col-span-2"
              >
                <Input
                  id="accessory-web-mpn"
                  value={web.webMpn}
                  onChange={(e) => patch({ webMpn: e.target.value })}
                  maxLength={64}
                  disabled={disabled}
                />
              </FormField>

              <div className="col-span-full">
                <Switch
                  id="accessory-web-no-identifier"
                  checked={!web.identifierExists}
                  disabled={disabled}
                  onCheckedChange={(v) => patch({ identifierExists: !v })}
                  label="Nincs vonalkódja és gyártói cikkszáma"
                  description="Saját gyártású vagy egyedi termék. A Google / ChatGPT feed ezt jelzi, így nem hiányolja az azonosítót."
                />
              </div>

              <div className="col-span-full space-y-2">
                <p className="text-label font-semibold text-ink">
                  Gyakori kérdések
                </p>
                {web.faqItems.map((item, index) => (
                  <div
                    key={index}
                    className="space-y-1.5 rounded-md border border-border bg-surface p-2"
                  >
                    <FormField
                      label="Kérdés"
                      htmlFor={`faq-q-${index}`}
                      optionalLabel
                    >
                      <Input
                        id={`faq-q-${index}`}
                        value={item.q}
                        disabled={disabled}
                        onChange={(e) => {
                          const next = [...web.faqItems]
                          next[index] = { ...item, q: e.target.value }
                          patch({ faqItems: next })
                        }}
                        placeholder="Pl. Milyen csavar kell hozzá?"
                      />
                    </FormField>
                    <FormField
                      label="Válasz"
                      htmlFor={`faq-a-${index}`}
                      optionalLabel
                    >
                      <Textarea
                        id={`faq-a-${index}`}
                        value={item.a}
                        disabled={disabled}
                        rows={2}
                        onChange={(e) => {
                          const next = [...web.faqItems]
                          next[index] = { ...item, a: e.target.value }
                          patch({ faqItems: next })
                        }}
                      />
                    </FormField>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={disabled || web.faqItems.length <= 1}
                      onClick={() =>
                        patch({
                          faqItems: web.faqItems.filter((_, i) => i !== index)
                        })
                      }
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                      Törlés
                    </Button>
                  </div>
                ))}
                {web.faqItems.length < 2 ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={disabled}
                    onClick={() =>
                      patch({
                        faqItems: [...web.faqItems, { q: '', a: '' }]
                      })
                    }
                  >
                    <Plus className="size-3.5" aria-hidden />
                    Új kérdés
                  </Button>
                ) : null}
              </div>
            </OptionalMore>

            <OptionalMore title="Termékoldal: méretrajz, variáns, csomag, mennyiségi ár">
              <p className="col-span-full text-hint text-ink-secondary">
                A termék nettó méretei csak akkor, ha pontosan tudod — a Műszaki
                adatok között jelennek meg. A csomagméret a „Még több” résznél van.
              </p>
              <FormField
                label="Termék hossz (cm)"
                htmlFor="acc-prod-l"
                optionalLabel
              >
                <Input
                  id="acc-prod-l"
                  value={web.productLengthRaw}
                  onChange={(e) => patch({ productLengthRaw: e.target.value })}
                  inputMode="decimal"
                  disabled={disabled}
                />
              </FormField>
              <FormField
                label="Termék szélesség (cm)"
                htmlFor="acc-prod-w"
                optionalLabel
              >
                <Input
                  id="acc-prod-w"
                  value={web.productWidthRaw}
                  onChange={(e) => patch({ productWidthRaw: e.target.value })}
                  inputMode="decimal"
                  disabled={disabled}
                />
              </FormField>
              <FormField
                label="Termék magasság (cm)"
                htmlFor="acc-prod-h"
                optionalLabel
              >
                <Input
                  id="acc-prod-h"
                  value={web.productHeightRaw}
                  onChange={(e) => patch({ productHeightRaw: e.target.value })}
                  inputMode="decimal"
                  disabled={disabled}
                />
              </FormField>
              <FormField
                label="Termék súly (kg)"
                htmlFor="acc-prod-kg"
                optionalLabel
              >
                <Input
                  id="acc-prod-kg"
                  value={web.productWeightRaw}
                  onChange={(e) => patch({ productWeightRaw: e.target.value })}
                  inputMode="decimal"
                  disabled={disabled}
                />
              </FormField>

              <FormField
                label="Méretrajz kép URL"
                htmlFor="acc-dim-img"
                optionalLabel
                hint="Méretezett rajz vagy fotó — a „Passzol-e?” blokkban jelenik meg"
                className="sm:col-span-2"
              >
                <Input
                  id="acc-dim-img"
                  value={web.dimensionImageUrl}
                  onChange={(e) => patch({ dimensionImageUrl: e.target.value })}
                  maxLength={2000}
                  disabled={disabled}
                  placeholder="https://…"
                />
              </FormField>
              <FormField
                label="Figyelmeztetés, biztonsági információ"
                htmlFor="acc-safety"
                optionalLabel
                hint="Magyarul, a termékoldal „Gyártó és biztonság” részében. Pl. „Gyermekek elől elzárva tartandó — apró alkatrészek.”"
                className="col-span-full"
              >
                <Textarea
                  id="acc-safety"
                  value={web.safetyInfo}
                  onChange={(e) => patch({ safetyInfo: e.target.value })}
                  rows={2}
                  maxLength={2000}
                  disabled={disabled}
                />
              </FormField>
              <FormField
                label="Variáns-csoport"
                htmlFor="acc-web-group"
                optionalLabel
                hint="Azonos érték = egy termékcsalád. A váltó azokat az adatokat mutatja, amelyekben a tagok eltérnek."
                className="sm:col-span-2"
              >
                <Input
                  id="acc-web-group"
                  value={web.webGroupId}
                  onChange={(e) => patch({ webGroupId: e.target.value })}
                  maxLength={64}
                  disabled={disabled}
                  placeholder="Pl. riextouch-xh35"
                />
              </FormField>

              <FormField
                label="Mihez illik"
                htmlFor="acc-web-compat"
                optionalLabel
                hint="Soronként egy · pl. 16–22 mm vastag front"
                className="sm:col-span-2"
              >
                <Textarea
                  id="acc-web-compat"
                  value={web.compatibilityRaw}
                  onChange={(e) => patch({ compatibilityRaw: e.target.value })}
                  rows={3}
                  disabled={disabled}
                />
              </FormField>
              <FormField
                label="Mire jó"
                htmlFor="acc-web-use"
                optionalLabel
                hint="Soronként egy előny · pl. Konyhafrontra"
                className="sm:col-span-2"
              >
                <Textarea
                  id="acc-web-use"
                  value={web.useCasesRaw}
                  onChange={(e) => patch({ useCasesRaw: e.target.value })}
                  rows={3}
                  disabled={disabled}
                />
              </FormField>
              <FormField
                label="Csomag tartalma"
                htmlFor="acc-web-box"
                optionalLabel
                hint="Soronként egy · pl. 2 db M4×25 csavar"
                className="sm:col-span-2"
              >
                <Textarea
                  id="acc-web-box"
                  value={web.boxContentsRaw}
                  onChange={(e) => patch({ boxContentsRaw: e.target.value })}
                  rows={3}
                  disabled={disabled}
                />
              </FormField>
              <FormField
                label="Mennyiségi nettó ár"
                htmlFor="acc-web-tiers"
                optionalLabel
                error={fieldErrors.webPriceTiers}
                hint="Soronként: darabtól = nettó egységár · pl. 10 = 1800"
                className="sm:col-span-2"
              >
                <Textarea
                  id="acc-web-tiers"
                  value={web.priceTiersRaw}
                  onChange={(e) => patch({ priceTiersRaw: e.target.value })}
                  rows={3}
                  disabled={disabled}
                  placeholder={'10 = 1800\n50 = 1650'}
                />
              </FormField>
            </OptionalMore>
          </>
        ) : null}
      </div>
    </FormSection>
  )
}
