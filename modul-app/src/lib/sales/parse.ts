import { z } from 'zod'

export const SALE_STATUS_LABEL = {
  draft: 'Vázlat',
  confirmed: 'Átadásra vár',
  fulfilled: 'Teljesítve',
  partially_returned: 'Részben visszáru',
  cancelled: 'Törölve',
  returned: 'Visszáru'
} as const

export type SaleStatus = keyof typeof SALE_STATUS_LABEL

export const SALE_PAYMENT_STATUS_LABEL = {
  unpaid: 'Fizetetlen',
  partial: 'Részben fizetve',
  paid: 'Fizetve',
  partially_refunded: 'Részben visszatérítve',
  refunded: 'Visszatérítve'
} as const

export type SalePaymentStatus = keyof typeof SALE_PAYMENT_STATUS_LABEL

export const SALE_CHANNEL_LABEL = {
  manual: 'Manuális',
  pos: 'POS',
  webshop: 'Webshop'
} as const

export type SaleChannel = keyof typeof SALE_CHANNEL_LABEL

export function saleStatusTone(
  status: SaleStatus
): 'success' | 'warning' | 'danger' | 'neutral' | 'info' {
  if (status === 'fulfilled') return 'success'
  if (status === 'confirmed') return 'warning'
  if (status === 'partially_returned') return 'warning'
  if (status === 'cancelled' || status === 'returned') return 'danger'
  return 'neutral'
}

export function salePaymentTone(
  status: SalePaymentStatus
): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'paid') return 'success'
  if (status === 'partial' || status === 'partially_refunded') return 'warning'
  if (status === 'refunded') return 'danger'
  return 'danger'
}

export const saleLineSchema = z.object({
  accessoryId: z.string().uuid(),
  quantity: z.number().positive('Adj meg pozitív mennyiséget.'),
  unitPriceGross: z.number().min(0).optional(),
  discountPercentage: z.number().min(0).max(100).optional(),
  discountAmount: z.number().min(0).optional()
})

export const saleFeeSchema = z.object({
  feeTypeId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(200),
  quantity: z.number().positive().default(1),
  unitPriceGross: z.number().min(0),
  taxRatePercent: z.number().min(0).max(100).optional()
})

export const salePaymentSchema = z.object({
  paymentMethodId: z.string().uuid('Válassz fizetési módot.'),
  amount: z.number().positive('A fizetés legyen pozitív.')
})

/** Dokumentum számlázás — nem ügyféltörzs. */
export const saleBillingSchema = z.object({
  billingName: z.string().trim().max(160).nullable().optional(),
  billingCountry: z.string().trim().max(80).nullable().optional(),
  billingCity: z.string().trim().max(80).nullable().optional(),
  billingPostalCode: z.string().trim().max(20).nullable().optional(),
  billingStreet: z.string().trim().max(120).nullable().optional(),
  billingHouseNumber: z.string().trim().max(40).nullable().optional(),
  billingTaxNumber: z.string().trim().max(40).nullable().optional()
})

export const saleFormSchema = z.object({
  warehouseId: z.string().uuid('Válaszd ki a raktárat.'),
  customerId: z.string().uuid().nullable().optional(),
  channel: z.enum(['manual', 'pos', 'webshop']).default('manual'),
  note: z.string().trim().max(500).nullable().optional(),
  discountPercentage: z.number().min(0).max(100).optional(),
  discountAmount: z.number().min(0).optional(),
  items: z.array(saleLineSchema).min(1, 'Adj hozzá legalább egy terméket.'),
  fees: z.array(saleFeeSchema).optional(),
  /** Üres = unpaid (utalás / későbbi settlement). */
  payments: z.array(salePaymentSchema).default([]),
  /**
   * Unpaid (üres payments): true = azonnali áruátadás (fulfilled+stock),
   * false/omit = függőben (confirmed, nincs stock). Paid esetén ignorált.
   */
  fulfillNow: z.boolean().optional(),
  posRegisterId: z.string().uuid().nullable().optional(),
  billing: saleBillingSchema.optional()
})

export type SaleFormInput = z.infer<typeof saleFormSchema>
export type SaleBillingInput = z.infer<typeof saleBillingSchema>

export const updateSaleBillingSchema = z.object({
  salesOrderId: z.string().uuid(),
  billing: saleBillingSchema.extend({
    billingName: z
      .string()
      .trim()
      .min(1, 'A számlázási név kötelező.')
      .max(160)
  })
})

export type UpdateSaleBillingInput = z.infer<typeof updateSaleBillingSchema>

export const saleReturnLineSchema = z.object({
  salesOrderItemId: z.string().uuid(),
  quantity: z.number().positive('Adj meg pozitív mennyiséget.'),
  restock: z.boolean().default(true)
})

export const saleReturnFormSchema = z.object({
  salesOrderId: z.string().uuid(),
  items: z
    .array(saleReturnLineSchema)
    .min(1, 'Válassz legalább egy tételt.'),
  paymentMethodId: z.string().uuid().nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
  reason: z.string().trim().max(200).nullable().optional()
})

export type SaleReturnFormInput = z.infer<typeof saleReturnFormSchema>

export const recordSalePaymentSchema = z.object({
  salesOrderId: z.string().uuid(),
  paymentMethodId: z.string().uuid('Válassz fizetési módot.'),
  amount: z.number().positive('A fizetés legyen pozitív.')
})

export type RecordSalePaymentInput = z.infer<typeof recordSalePaymentSchema>

export function formatMoneyFt(n: number) {
  return new Intl.NumberFormat('hu-HU', {
    maximumFractionDigits: 0
  }).format(Math.round(n))
}

export function canStartSaleReturn(status: SaleStatus): boolean {
  return status === 'fulfilled' || status === 'partially_returned'
}
