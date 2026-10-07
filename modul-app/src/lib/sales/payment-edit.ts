import type { SaleDetail, SalePaymentRow } from '@/lib/sales/queries'
import type { SalePaymentStatus, SaleStatus } from '@/lib/sales/parse'

/** Fizetési sor szerkeszthető / törölhető? (UI + szerver kapuk összhang). */
export function canEditSalePayment(input: {
  canWrite: boolean
  saleStatus: SaleStatus
  paymentStatus: SalePaymentStatus
  hasFinalInvoice: boolean
  posShiftOpen: boolean | null
  payment: SalePaymentRow
}): boolean {
  if (!input.canWrite) return false
  if (input.saleStatus === 'cancelled' || input.saleStatus === 'returned') {
    return false
  }
  if (input.hasFinalInvoice) return false
  if (
    input.paymentStatus === 'refunded' ||
    input.paymentStatus === 'partially_refunded'
  ) {
    return false
  }
  if (input.payment.kind !== 'payment') return false
  if (input.payment.sales_return_id) return false
  if (input.payment.provider_ref) return false
  if (input.posShiftOpen === false) return false
  return true
}

export function salePaymentDue(detail: Pick<
  SaleDetail,
  'total_gross' | 'cash_rounding_amount'
>): number {
  return Math.round(detail.total_gross + detail.cash_rounding_amount)
}

export function salePaymentRemaining(
  detail: Pick<SaleDetail, 'total_gross' | 'cash_rounding_amount' | 'payments'>
): number {
  const due = salePaymentDue(detail)
  const paidSum = detail.payments
    .filter((p) => p.kind === 'payment')
    .reduce((s, p) => s + p.amount, 0)
  const refundSum = detail.payments
    .filter((p) => p.kind === 'refund')
    .reduce((s, p) => s + p.amount, 0)
  return Math.max(0, due - (paidSum - refundSum))
}
