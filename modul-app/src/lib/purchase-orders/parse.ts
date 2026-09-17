import { z } from 'zod'

export const PO_STATUSES = [
  'draft',
  'ordered',
  'partial',
  'received',
  'cancelled'
] as const
export type PurchaseOrderStatus = (typeof PO_STATUSES)[number]

export const PO_STATUS_LABEL: Record<PurchaseOrderStatus, string> = {
  draft: 'Vázlat',
  ordered: 'Megrendelve',
  partial: 'Részben beérkezett',
  received: 'Beérkezett',
  cancelled: 'Törölve'
}

export function poStatusTone(
  status: PurchaseOrderStatus
): 'warning' | 'success' | 'info' | 'neutral' | 'danger' {
  if (status === 'draft') return 'warning'
  if (status === 'ordered') return 'success'
  if (status === 'partial') return 'info'
  if (status === 'received') return 'neutral'
  return 'danger'
}

const emptyToNull = (v: string) => {
  const t = v.trim()
  return t === '' ? null : t
}

export const purchaseOrderItemSchema = z.object({
  accessoryId: z.string().uuid('Érvénytelen termék.'),
  nameSnapshot: z.string().trim().min(1).max(200),
  skuSnapshot: z.string().trim().min(1).max(100),
  quantity: z.coerce
    .number()
    .positive('A mennyiség legyen nagyobb nullánál.')
    .max(1_000_000),
  netPrice: z.coerce
    .number()
    .int('Egész Ft legyen.')
    .min(0, 'Az ár nem lehet negatív.'),
  taxRateId: z.string().uuid('Érvénytelen adónem.'),
  taxRatePercent: z.coerce.number().min(0).max(100),
  unitId: z.string().uuid('Érvénytelen egység.'),
  unitShortform: z.string().trim().min(1).max(20)
})

export const purchaseOrderFormSchema = z.object({
  supplierId: z.string().uuid('Válassz beszállítót.'),
  warehouseId: z.string().uuid('Válassz célraktárat.'),
  expectedDate: z
    .string()
    .trim()
    .transform(emptyToNull)
    .refine(
      (v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v),
      'Érvénytelen dátum.'
    ),
  note: z.string().trim().max(2000).transform(emptyToNull),
  currency: z.enum(['HUF', 'EUR', 'USD']).default('HUF'),
  items: z
    .array(purchaseOrderItemSchema)
    .min(1, 'Legalább egy tétel kell.')
    .max(200)
})

export type PurchaseOrderFormValues = z.infer<typeof purchaseOrderFormSchema>

export type PurchaseOrderItemInput = {
  accessoryId: string
  nameSnapshot: string
  skuSnapshot: string
  quantity: number
  netPrice: number
  taxRateId: string
  taxRatePercent: number
  unitId: string
  unitShortform: string
}

export type PurchaseOrderFormInput = {
  supplierId: string
  warehouseId: string
  expectedDate: string
  note: string
  currency: 'HUF' | 'EUR' | 'USD'
  items: PurchaseOrderItemInput[]
}

/** Sor nettó / áfa / bruttó (HUF kerekítés). */
export function lineAmounts(
  quantity: number,
  netPrice: number,
  taxRatePercent: number
) {
  const net = Math.round(quantity * netPrice)
  const vat = Math.round((net * taxRatePercent) / 100)
  return { net, vat, gross: net + vat }
}

export function sumOrderAmounts(
  items: { quantity: number; netPrice: number; taxRatePercent: number }[]
) {
  return items.reduce(
    (acc, it) => {
      const line = lineAmounts(it.quantity, it.netPrice, it.taxRatePercent)
      acc.net += line.net
      acc.vat += line.vat
      acc.gross += line.gross
      return acc
    },
    { net: 0, vat: 0, gross: 0 }
  )
}

/** Duplikált accessory → qty összevonás (utolsó ár nyer). */
export function mergeItemsByAccessory(
  items: PurchaseOrderItemInput[]
): PurchaseOrderItemInput[] {
  const map = new Map<string, PurchaseOrderItemInput>()
  for (const it of items) {
    const prev = map.get(it.accessoryId)
    if (!prev) {
      map.set(it.accessoryId, { ...it })
      continue
    }
    map.set(it.accessoryId, {
      ...it,
      quantity: prev.quantity + it.quantity
    })
  }
  return Array.from(map.values())
}
