import { z } from 'zod'

export const RECEIPT_STATUSES = ['checking', 'received', 'cancelled'] as const
export type GoodsReceiptStatus = (typeof RECEIPT_STATUSES)[number]

export const RECEIPT_STATUS_LABEL: Record<GoodsReceiptStatus, string> = {
  checking: 'Ellenőrzés',
  received: 'Bevételezve',
  cancelled: 'Törölve'
}

export function receiptStatusTone(
  status: GoodsReceiptStatus
): 'warning' | 'success' | 'neutral' | 'danger' | 'info' {
  if (status === 'checking') return 'warning'
  if (status === 'received') return 'success'
  if (status === 'cancelled') return 'danger'
  return 'neutral'
}

export const receiptItemQtySchema = z.object({
  id: z.string().uuid(),
  quantityReceived: z.coerce
    .number()
    .min(0, 'A mennyiség nem lehet negatív.')
    .max(1_000_000)
})

export const receiptQuantitiesSchema = z.object({
  items: z.array(receiptItemQtySchema).min(1).max(500)
})

export type ReceiptQuantitiesInput = {
  items: { id: string; quantityReceived: number }[]
}

/** Kapott vs cél — overage / underage jelzés. */
export function qtyVariance(
  received: number,
  target: number
): 'ok' | 'under' | 'over' | 'zero' {
  if (received <= 0) return 'zero'
  if (received < target) return 'under'
  if (received > target) return 'over'
  return 'ok'
}
