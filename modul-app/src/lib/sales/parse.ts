import { z } from 'zod'

export const SALE_STATUS_LABEL = {
  draft: 'Vázlat',
  confirmed: 'Rögzítve',
  fulfilled: 'Teljesítve',
  cancelled: 'Törölve',
  returned: 'Visszáru'
} as const

export type SaleStatus = keyof typeof SALE_STATUS_LABEL

export const SALE_PAYMENT_STATUS_LABEL = {
  unpaid: 'Fizetetlen',
  partial: 'Részben fizetve',
  paid: 'Fizetve'
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
  if (status === 'confirmed') return 'info'
  if (status === 'cancelled' || status === 'returned') return 'danger'
  return 'neutral'
}

export function salePaymentTone(
  status: SalePaymentStatus
): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'paid') return 'success'
  if (status === 'partial') return 'warning'
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

export const saleFormSchema = z.object({
  warehouseId: z.string().uuid('Válaszd ki a raktárat.'),
  customerId: z.string().uuid().nullable().optional(),
  channel: z.enum(['manual', 'pos', 'webshop']).default('manual'),
  note: z.string().trim().max(500).nullable().optional(),
  discountPercentage: z.number().min(0).max(100).optional(),
  discountAmount: z.number().min(0).optional(),
  items: z.array(saleLineSchema).min(1, 'Adj hozzá legalább egy terméket.'),
  fees: z.array(saleFeeSchema).optional(),
  payments: z.array(salePaymentSchema).min(1, 'Adj meg legalább egy fizetést.')
})

export type SaleFormInput = z.infer<typeof saleFormSchema>

export function formatMoneyFt(n: number) {
  return new Intl.NumberFormat('hu-HU', {
    maximumFractionDigits: 0
  }).format(Math.round(n))
}
