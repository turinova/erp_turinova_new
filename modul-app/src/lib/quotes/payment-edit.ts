import type { QuoteDetail, QuotePaymentRow } from '@/lib/quotes/queries'
import type { QuoteStatus } from '@/lib/quotes/queries'
import type { PaymentStatus } from '@/lib/quotes/payment-labels'

/** Befizetés szerkeszthető / érvényteleníthető? (UI + szerver kapuk). */
export function canEditQuotePayment(input: {
  canWrite: boolean
  isPartner: boolean
  quoteStatus: QuoteStatus
  hasOrderNumber: boolean
  hasFinalInvoice: boolean
}): boolean {
  if (input.isPartner) return false
  if (!input.canWrite) return false
  if (input.quoteStatus === 'draft' || input.quoteStatus === 'cancelled') {
    return false
  }
  if (!input.hasOrderNumber) return false
  if (input.hasFinalInvoice) return false
  return true
}

export function quotePaymentDue(
  detail: Pick<QuoteDetail, 'final_total_gross' | 'total_gross'>
): number {
  return Number(detail.final_total_gross || detail.total_gross) || 0
}

export function quoteAlivePaidSum(payments: QuotePaymentRow[]): number {
  return payments.reduce((s, p) => s + p.amount, 0)
}
