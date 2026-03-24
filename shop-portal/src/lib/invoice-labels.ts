/** Human-readable labels for shop-portal invoice rows (Számlázz / internal codes). */

export const INVOICE_TYPE_LABELS: Record<string, string> = {
  dijbekero: 'Díjbekérő',
  elolegszamla: 'Előlegszámla',
  szamla: 'Számla',
  sztorno: 'Sztornó'
}

export const INVOICE_PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Függőben',
  fizetve: 'Fizetve',
  nem_lesz_fizetve: 'Nem lesz fizetve'
}

export function invoiceTypeLabel(code: string | null | undefined): string {
  if (!code) return '—'
  return INVOICE_TYPE_LABELS[code] ?? code
}

export function invoicePaymentStatusLabel(code: string | null | undefined): string {
  if (!code) return '—'
  return INVOICE_PAYMENT_STATUS_LABELS[code] ?? code
}
