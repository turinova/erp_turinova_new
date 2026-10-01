import { z } from 'zod'

import type { StatusBadgeTone } from '@/components/patterns/status-badge'

export const SALES_QUOTE_STATUS_LABEL = {
  draft: 'Piszkozat',
  sent: 'Kiküldve',
  accepted: 'Elfogadva',
  lost: 'Elveszett',
  expired: 'Lejárt',
  cancelled: 'Törölve'
} as const

export type SalesQuoteStatus = keyof typeof SALES_QUOTE_STATUS_LABEL

export const SALES_QUOTE_STATUSES = Object.keys(
  SALES_QUOTE_STATUS_LABEL
) as SalesQuoteStatus[]

export function salesQuoteStatusTone(
  status: SalesQuoteStatus
): StatusBadgeTone {
  switch (status) {
    case 'sent':
      return 'info'
    case 'accepted':
      return 'success'
    case 'lost':
    case 'cancelled':
      return 'danger'
    case 'expired':
      return 'warning'
    default:
      return 'neutral'
  }
}

export const salesQuoteLineSchema = z
  .object({
    kind: z
      .enum(['product', 'sheet_material', 'linear_material'])
      .default('product'),
    accessoryId: z.string().uuid().nullable().optional(),
    sheetMaterialId: z.string().uuid().nullable().optional(),
    linearMaterialId: z.string().uuid().nullable().optional(),
    quantity: z.number().positive('Adj meg pozitív mennyiséget.'),
    unitPriceGross: z.number().min(0).optional(),
    discountPercentage: z.number().min(0).max(100).optional()
  })
  .superRefine((val, ctx) => {
    const kind = val.kind ?? 'product'
    if (kind === 'product' && !val.accessoryId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Hiányzó termék.',
        path: ['accessoryId']
      })
    }
    if (kind === 'sheet_material' && !val.sheetMaterialId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Hiányzó táblás anyag.',
        path: ['sheetMaterialId']
      })
    }
    if (kind === 'linear_material' && !val.linearMaterialId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Hiányzó szálas anyag.',
        path: ['linearMaterialId']
      })
    }
  })
  .transform((val) => {
    const kind = val.kind ?? 'product'
    const quantity =
      kind === 'sheet_material' || kind === 'linear_material'
        ? Math.round(val.quantity * 10) / 10
        : val.quantity
    return {
      ...val,
      kind,
      quantity,
      accessoryId: kind === 'product' ? val.accessoryId ?? null : null,
      sheetMaterialId:
        kind === 'sheet_material' ? val.sheetMaterialId ?? null : null,
      linearMaterialId:
        kind === 'linear_material' ? val.linearMaterialId ?? null : null
    }
  })

export const salesQuoteFeeSchema = z.object({
  feeTypeId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(200),
  quantity: z.number().positive().default(1),
  unitPriceGross: z.number().min(0),
  taxRatePercent: z.number().min(0).max(100).optional()
})

/** Dokumentum számlázás — nem ügyféltörzs. */
export const salesQuoteBillingSchema = z.object({
  billingName: z.string().trim().max(160).nullable().optional(),
  billingCountry: z.string().trim().max(80).nullable().optional(),
  billingCity: z.string().trim().max(80).nullable().optional(),
  billingPostalCode: z.string().trim().max(20).nullable().optional(),
  billingStreet: z.string().trim().max(120).nullable().optional(),
  billingHouseNumber: z.string().trim().max(40).nullable().optional(),
  billingTaxNumber: z.string().trim().max(40).nullable().optional()
})

export const salesQuoteFormSchema = z.object({
  warehouseId: z.string().uuid('Válaszd ki a raktárat.'),
  customerId: z.string().uuid('Válassz ügyfelet.'),
  note: z.string().trim().max(500).nullable().optional(),
  validUntil: z.string().nullable().optional(),
  discountPercentage: z.number().min(0).max(100).optional(),
  items: z
    .array(salesQuoteLineSchema)
    .min(1, 'Adj hozzá legalább egy terméket.'),
  fees: z.array(salesQuoteFeeSchema).optional(),
  billing: salesQuoteBillingSchema.optional(),
  clonedFromId: z.string().uuid().nullable().optional()
})

export const salesQuoteDraftUpdateSchema = z.object({
  quoteId: z.string().uuid(),
  note: z.string().trim().max(500).nullable().optional(),
  validUntil: z.string().nullable().optional(),
  billing: salesQuoteBillingSchema
})

export type SalesQuoteFormInput = z.infer<typeof salesQuoteFormSchema>
export type SalesQuoteBillingInput = z.infer<typeof salesQuoteBillingSchema>
export type SalesQuoteDraftUpdateInput = z.infer<
  typeof salesQuoteDraftUpdateSchema
>
