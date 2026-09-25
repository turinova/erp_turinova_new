import { z } from 'zod'

import { isCountryCode } from '@/lib/geo/countries'
import { youtubeIdOf } from '@/lib/storefront/youtube'

function emptyToNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const optionalText = (max: number, label: string) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (v == null ? null : emptyToNull(v)))
    .refine((v) => v == null || v.length <= max, {
      message: `${label} legfeljebb ${max} karakter.`
    })

const optionalSlug = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (v == null ? null : emptyToNull(v)))
  .refine((v) => v == null || v.length <= 120, {
    message: 'A webcím legfeljebb 120 karakter.'
  })
  .refine(
    (v) => v == null || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v),
    'A webcím csak kisbetű, szám és kötőjel lehet.'
  )

const stringListSchema = z.array(z.string().trim().min(1).max(120)).max(40).default([])

const kvRecordSchema = z.record(
  z.string().trim().min(1).max(80),
  z.string().trim().min(1).max(500)
)

const faqSchema = z.array(
  z.object({
    q: z.string().trim().min(1).max(300),
    a: z.string().trim().min(1).max(2000)
  })
)

const optionalNonNegNumber = z
  .union([z.number(), z.null(), z.undefined()])
  .transform((v) => (v == null ? null : v))
  .refine((v) => v == null || (typeof v === 'number' && !Number.isNaN(v) && v >= 0), {
    message: 'Érvényes, nem negatív szám kell.'
  })

export const SHOP_DESCRIPTION_MIN = 200
export const SHOP_SHORT_DESCRIPTION_MIN = 80

export const shopProductSchema = z
  .object({
    sellableWeb: z.boolean().default(false),
    webSlug: optionalSlug,
    webTitle: optionalText(150, 'Bolt cím'),
    webDescriptionShort: optionalText(800, 'Rövid leírás'),
    webDescriptionLong: optionalText(5000, 'Leírás'),
    webBrand: optionalText(120, 'Márka'),
    webGtin: optionalText(32, 'GTIN'),
    webMpn: optionalText(64, 'Gyártói cikkszám'),
    webProductType: optionalText(240, 'Terméktípus'),
    webGoogleCategory: optionalText(240, 'Google kategória'),
    webTags: stringListSchema,
    webSearchAliases: stringListSchema,
    webColor: optionalText(40, 'Szín'),
    webSize: optionalText(40, 'Méret'),
    webMaterial: optionalText(100, 'Anyag'),
    webAttributes: kvRecordSchema.default({}),
    webSpecs: kvRecordSchema.default({}),
    webFaq: faqSchema.default([]),
    webUseCases: stringListSchema,
    webCompatibility: stringListSchema,
    webCompareAtPrice: z
      .union([z.number(), z.null(), z.undefined()])
      .transform((v) => (v == null ? null : v))
      .refine((v) => v == null || (Number.isInteger(v) && v >= 0), 'Érvényes, nem negatív egész ár kell.'),
    shippingWeightKg: optionalNonNegNumber,
    shippingLengthCm: optionalNonNegNumber,
    shippingWidthCm: optionalNonNegNumber,
    shippingHeightCm: optionalNonNegNumber,
    productWeightKg: optionalNonNegNumber,
    productLengthCm: optionalNonNegNumber,
    productWidthCm: optionalNonNegNumber,
    productHeightCm: optionalNonNegNumber,
    webGroupId: optionalText(64, 'Változatcsoport'),
    webBoxContents: stringListSchema,
    webDimensionImageUrl: optionalText(2000, 'Méretrajz'),
    webSafetyInfo: optionalText(2000, 'Figyelmeztetés'),
    webNetQuantity: optionalNonNegNumber,
    webNetUnit: z
      .union([z.enum(['g', 'kg', 'ml', 'l', 'db', 'm', 'm2']), z.literal(''), z.null(), z.undefined()])
      .transform((v) => (v ? v : null)),
    webIngredients: optionalText(4000, 'Összetevők'),
    webUsage: optionalText(4000, 'Használat'),
    webVideoUrl: optionalText(2000, 'Videó link').refine(
      (v) => v == null || youtubeIdOf(v) != null,
      'Csak YouTube link adható meg (pl. https://www.youtube.com/watch?v=…).'
    ),
    webCountryOfOrigin: z
      .union([z.string(), z.null(), z.undefined()])
      .transform((v) => (v == null ? null : emptyToNull(v)?.toUpperCase() ?? null))
      .refine((v) => v == null || isCountryCode(v), 'Válassz országot a listából.'),
    webMultipack: z
      .union([z.number(), z.null(), z.undefined()])
      .transform((v) => (v == null || v === 0 ? null : v))
      .refine(
        (v) => v == null || (Number.isInteger(v) && v >= 2 && v <= 10000),
        'A darabszám 2 és 10 000 közötti egész legyen.'
      ),
    webIsBundle: z.boolean().default(false),
    webIdentifierExists: z.boolean().default(true),
    webImageAlts: z
      .record(z.string().max(2000), z.string().trim().max(200, 'A kép leírása legfeljebb 200 karakter.'))
      .default({})
      .transform((r) => Object.fromEntries(Object.entries(r).filter(([k, v]) => k.trim() && v))),
    webPriceTiers: z
      .array(
        z.object({
          min_qty: z.number().int('A mennyiség egész szám legyen.').min(2, 'Mennyiségi ár legalább 2 db-tól.'),
          price_net: z.number().int('Az ár egész forint legyen.').positive('Az ár legyen nagyobb mint 0.')
        })
      )
      .max(10, 'Legfeljebb 10 mennyiségi ár.')
      .default([]),
    webCategoryId: z
      .union([z.string().uuid(), z.null(), z.undefined()])
      .transform((v) => v ?? null),
    attributeValueIds: z.array(z.string().uuid()).default([]),
    attributeInputs: z
      .array(
        z
          .object({
            attributeId: z.string().uuid(),
            valueNum: z.number().finite().nullable(),
            valueMax: z.number().finite().nullable(),
            valueBool: z.boolean().nullable()
          })
          .refine(
            (v) => v.valueMax == null || v.valueNum == null || v.valueMax >= v.valueNum,
            'A tartomány vége nem lehet kisebb az elejénél.'
          )
      )
      .max(64)
      .default([])
  })
  .superRefine((data, ctx) => {
    if ((data.webNetQuantity != null && data.webNetQuantity > 0) !== (data.webNetUnit != null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A nettó tartalomhoz mennyiség és mértékegység is kell.',
        path: ['webNetQuantity']
      })
    }
  })

export type ShopProductValues = z.infer<typeof shopProductSchema>
export type ShopProductInput = z.input<typeof shopProductSchema>

export type ShopRequirementIssue = { field: string; message: string; label: string }

/**
 * Ami nélkül a termék nem tehető ki a boltba. Az alap termék adatai (név, kép, ár, aktív)
 * az alapadatoknál szerkeszthetők — ezért külön kontextusként jönnek.
 */
export function shopRequirementIssues(
  data: Pick<
    ShopProductValues,
    'webSlug' | 'webTitle' | 'webDescriptionLong' | 'webDescriptionShort' | 'webCategoryId' | 'webProductType'
  >,
  core: { name: string; imageUrl: string | null; priceNet: number; active: boolean }
): ShopRequirementIssue[] {
  const out: ShopRequirementIssue[] = []
  if (!(data.webTitle?.trim() || core.name.trim())) {
    out.push({ field: 'webTitle', label: 'Cím', message: 'A termékoldal címe kötelező.' })
  }
  if (!core.imageUrl) {
    out.push({ field: 'imageUrl', label: 'Fő kép', message: 'Tölts fel fő képet az alapadatoknál.' })
  }
  if (!(core.priceNet > 0)) {
    out.push({ field: 'priceNet', label: 'Ár', message: 'Adj meg árat az alapadatoknál.' })
  }
  if (!core.active) {
    out.push({ field: 'active', label: 'Aktív', message: 'A termék legyen aktív az alapadatoknál.' })
  }
  if (!data.webCategoryId && !data.webProductType?.trim()) {
    out.push({ field: 'webCategoryId', label: 'Kategória', message: 'Válaszd ki, hol legyen a boltban.' })
  }
  if ((data.webDescriptionLong?.trim().length ?? 0) < SHOP_DESCRIPTION_MIN) {
    out.push({
      field: 'webDescriptionLong',
      label: 'Leírás',
      message: `Írj legalább ${SHOP_DESCRIPTION_MIN} karakteres leírást a vásárlónak.`
    })
  } else if ((data.webDescriptionShort?.trim().length ?? 0) < SHOP_SHORT_DESCRIPTION_MIN) {
    out.push({
      field: 'webDescriptionLong',
      label: 'Leírás',
      message: `A leírás eleje legyen legalább ${SHOP_SHORT_DESCRIPTION_MIN} karakter (ebből lesz a rövid szöveg).`
    })
  }
  return out
}

/** Űrlap értékek → `accessory_web` sor (attribútumok külön táblában). */
export function shopValuesToRow(data: ShopProductValues, priceTiers: { min_qty: number; price_net: number }[]) {
  const netOk = data.webNetQuantity != null && data.webNetQuantity > 0
  return {
    sellable_web: data.sellableWeb,
    web_slug: data.webSlug,
    web_title: data.webTitle,
    web_description_short: data.webDescriptionShort,
    web_description_long: data.webDescriptionLong,
    web_brand: data.webBrand,
    web_gtin: data.webGtin,
    web_mpn: data.webMpn,
    web_product_type: data.webProductType,
    web_google_category: data.webGoogleCategory,
    web_tags: data.webTags,
    web_search_aliases: data.webSearchAliases,
    web_color: data.webColor,
    web_size: data.webSize,
    web_material: data.webMaterial,
    web_attributes: data.webAttributes,
    web_specs: data.webSpecs,
    web_faq: data.webFaq,
    web_use_cases: data.webUseCases,
    web_compatibility: data.webCompatibility,
    web_compare_at_price: data.webCompareAtPrice,
    shipping_weight_kg: data.shippingWeightKg,
    shipping_length_cm: data.shippingLengthCm,
    shipping_width_cm: data.shippingWidthCm,
    shipping_height_cm: data.shippingHeightCm,
    product_weight_kg: data.productWeightKg,
    product_length_cm: data.productLengthCm,
    product_width_cm: data.productWidthCm,
    product_height_cm: data.productHeightCm,
    web_group_id: data.webGroupId,
    web_category_id: data.webCategoryId,
    web_box_contents: data.webBoxContents,
    web_dimension_image_url: data.webDimensionImageUrl,
    web_safety_info: data.webSafetyInfo,
    web_net_quantity: netOk ? data.webNetQuantity : null,
    web_net_unit: netOk ? data.webNetUnit : null,
    web_ingredients: data.webIngredients,
    web_usage: data.webUsage,
    web_video_url: data.webVideoUrl,
    web_country_of_origin: data.webCountryOfOrigin,
    web_multipack: data.webMultipack,
    web_is_bundle: data.webIsBundle,
    web_identifier_exists: data.webIdentifierExists,
    web_image_alts: data.webImageAlts,
    web_price_tiers: priceTiers
  }
}
