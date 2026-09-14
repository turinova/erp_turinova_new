export type PaymentStatus = 'not_paid' | 'partial' | 'paid'

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  not_paid: 'Nincs fizetve',
  partial: 'Részben fizetve',
  paid: 'Kifizetve'
}

export function paymentStatusTone(
  status: PaymentStatus
): 'danger' | 'warning' | 'success' {
  if (status === 'paid') return 'success'
  if (status === 'partial') return 'warning'
  return 'danger'
}

export function parsePaymentAmount(raw: string): number | null {
  const normalized = raw.trim().replace(/\s/g, '').replace(',', '.')
  if (normalized === '') return 0
  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) return null
  const value = Number(normalized)
  if (!Number.isFinite(value) || value < 0) return null
  return Math.round(value * 100) / 100
}
