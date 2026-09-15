export type PaymentStatus = 'not_paid' | 'partial' | 'paid'

/** DB trigger tolerance: paid if Σ payments ≥ final_total_gross − 1 Ft. */
export const PAYMENT_TOLERANCE_GROSS = 1

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  not_paid: 'Nincs fizetve',
  partial: 'Részben fizetve',
  paid: 'Kifizetve'
}

export const QUOTE_PAID_TOTALS_WARNING =
  'Ehhez a megrendeléshez már van befizetés. A végösszeg változása után a fizetési státusz automatikusan frissül.'

export const QUOTE_CREDIT_OVERPAY_HINT =
  'A jóváírás csökkentheti a végösszeget. Ha a befizetés nagyobb lesz a végösszegnél, a státusz Kifizetve marad (túlfizetés).'

/** Hátralék a fizetendő végösszeghez (final_total_gross) képest. */
export function quoteRemainingGross(
  finalTotalGross: number,
  totalPaid: number
): number {
  return Math.max(0, Math.round((finalTotalGross - totalPaid) * 100) / 100)
}

/** Túlfizetés, ha a jóváírás a végösszeget a befizetés alá viszi. */
export function quoteOverpaidGross(
  finalTotalGross: number,
  totalPaid: number
): number {
  return Math.max(0, Math.round((totalPaid - finalTotalGross) * 100) / 100)
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
