import { z } from 'zod'

export {
  formatHuNumber,
  formatMoneyFt,
  grossFromNet,
  netFromGross,
  parseDecimalInput,
  parseIntegerInput
} from '@/lib/sheet-materials/parse'

function emptyToNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/** Üres / hiányzó szövegmező — elfogad string | null | undefined. */
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
    message: 'A slug legfeljebb 120 karakter.'
  })
  .refine(
    (v) => v == null || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v),
    'A slug csak kisbetű, szám és kötőjel lehet.'
  )

const optionalBarcode = (label: string) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (v == null ? null : emptyToNull(v)))
    .refine((v) => v == null || v.length <= 64, {
      message: `${label} legfeljebb 64 karakter.`
    })

const stringListSchema = z
  .array(z.string().trim().min(1).max(120))
  .max(40)
  .default([])

const kvRecordSchema = z.record(z.string().trim().min(1).max(80), z.string().trim().min(1).max(500))

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

export const accessoryFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'A termék neve kötelező.')
      .max(200, 'A név legfeljebb 200 karakter.'),
    manufacturerId: z.string().uuid('Válassz gyártót.'),
    sku: z
      .string()
      .trim()
      .min(1, 'A SKU kötelező.')
      .max(100, 'A SKU legfeljebb 100 karakter.'),
    barcode: optionalBarcode('A gyártói vonalkód'),
    barcodeInternal: optionalBarcode('A belső vonalkód'),
    taxRateId: z.string().uuid('Válassz adónemet.'),
    unitId: z.string().uuid('Válassz egységet.'),
    priceNet: z
      .number({ invalid_type_error: 'Érvényes árat adj meg.' })
      .min(0, 'Az ár nem lehet negatív.')
      .int('Az ár egész forint legyen.'),
    purchasePriceNet: z
      .number({ invalid_type_error: 'Érvényes beszerzési nettót adj meg.' })
      .min(0, 'A beszerzési ár nem lehet negatív.')
      .int('A beszerzési ár egész forint legyen.')
      .nullable(),
    marginFactor: z
      .number({ invalid_type_error: 'Érvényes árrés szorzót adj meg.' })
      .gt(0, 'A szorzó legyen nagyobb mint 0.')
      .max(100, 'A szorzó legfeljebb 100.')
      .nullable(),
    imageUrl: z
      .union([z.string(), z.null(), z.undefined()])
      .transform((v) => {
        if (v == null) return null
        const trimmed = v.trim()
        return trimmed.length > 0 ? trimmed : null
      }),
    active: z.boolean(),
    sellablePos: z.boolean().default(true),

    sellableWeb: z.boolean().default(false),
    webSlug: optionalSlug,
    webTitle: optionalText(150, 'Bolt cím'),
    webDescriptionShort: optionalText(800, 'Rövid leírás'),
    webDescriptionLong: optionalText(5000, 'Részletes leírás'),
    webBrand: optionalText(120, 'Márka'),
    webGtin: optionalText(32, 'GTIN'),
    webMpn: optionalText(64, 'MPN'),
    webProductType: optionalText(240, 'Terméktípus'),
    webGoogleCategory: optionalText(240, 'Google kategória'),
    webTags: stringListSchema,
    webSearchAliases: stringListSchema,
    webColor: optionalText(40, 'Szín'),
    webSize: optionalText(40, 'Méret'),
    webMaterial: optionalText(100, 'Anyag'),
    webAttributes: kvRecordSchema.default({}),
    webSpecs: kvRecordSchema.default({}),
    webGallery: z
      .array(
        z
          .string()
          .trim()
          .min(1, 'Üres kép URL.')
          .max(2000, 'A kép URL túl hosszú.')
      )
      .max(20)
      .default([]),
    webFaq: faqSchema.default([]),
    webUseCases: stringListSchema,
    webCompatibility: stringListSchema,
    webCompareAtPrice: z
      .union([z.number(), z.null(), z.undefined()])
      .transform((v) => (v == null ? null : v))
      .refine(
        (v) =>
          v == null ||
          (Number.isInteger(v) && v >= 0),
        'Érvényes, nem negatív egész ár kell.'
      ),
    shippingWeightKg: optionalNonNegNumber,
    shippingLengthCm: optionalNonNegNumber,
    shippingWidthCm: optionalNonNegNumber,
    shippingHeightCm: optionalNonNegNumber,
    productWeightKg: optionalNonNegNumber,
    productLengthCm: optionalNonNegNumber,
    productWidthCm: optionalNonNegNumber,
    productHeightCm: optionalNonNegNumber,
    webGroupId: optionalText(64, 'Termékcsoport ID'),
    webBoxContents: stringListSchema,
    webDimensionImageUrl: optionalText(2000, 'Méretrajz kép URL'),
    webSafetyInfo: optionalText(2000, 'Biztonsági információ'),
    webIdentifierExists: z.boolean().default(true),
    webImageAlts: z
      .record(z.string().max(2000), z.string().trim().max(200, 'A kép leírása legfeljebb 200 karakter.'))
      .default({})
      .transform((r) =>
        Object.fromEntries(Object.entries(r).filter(([k, v]) => k.trim() && v))
      ),
    webPriceTiers: z
      .array(
        z.object({
          min_qty: z
            .number()
            .int('A mennyiség egész szám legyen.')
            .min(2, 'Mennyiségi ár legalább 2 db-tól.'),
          price_net: z
            .number()
            .int('Az ár egész forint legyen.')
            .positive('Az ár legyen nagyobb mint 0.')
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
    if (!data.sellableWeb) return
    if (!data.webSlug) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Webshophoz kötelező a slug.',
        path: ['webSlug']
      })
    }
    const title = data.webTitle?.trim() || data.name
    if (!title) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Webshop cím kötelező.',
        path: ['webTitle']
      })
    }
    if (!data.imageUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Webshophoz kell fő kép.',
        path: ['imageUrl']
      })
    }
    if (!(data.webDescriptionShort && data.webDescriptionShort.length >= 80)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A leírás túl rövid (automatikus rövid szöveg ≥80 karakter).',
        path: ['webDescriptionLong']
      })
    }
    if (!(data.webDescriptionLong && data.webDescriptionLong.length >= 200)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Írj legalább ~200 karakteres leírást a vásárlónak.',
        path: ['webDescriptionLong']
      })
    }
    if (!data.webCategoryId && !(data.webProductType && data.webProductType.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Válassz bolt kategóriát.',
        path: ['webCategoryId']
      })
    }
  })

export type AccessoryFormValues = z.infer<typeof accessoryFormSchema>
