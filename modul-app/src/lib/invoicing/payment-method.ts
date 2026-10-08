import type { InvoiceIssueKind, InvoicePaymentMethod } from '@/lib/invoicing/types'

/** Map ERP payment method name → Számlázz fizmod. */
export function detectInvoicePaymentMethod(
  paymentMethodName: string | null | undefined
): InvoicePaymentMethod | null {
  const name = (paymentMethodName || '').toLowerCase()
  if (!name.trim()) return null
  if (
    name.includes('készpénz') ||
    name.includes('keszpenz') ||
    name.includes('kp')
  ) {
    return 'cash'
  }
  if (name.includes('kártya') || name.includes('kartya') || name.includes('card')) {
    return 'card'
  }
  if (
    name.includes('utal') ||
    name.includes('átutal') ||
    name.includes('transfer') ||
    name.includes('wire')
  ) {
    return 'bank_transfer'
  }
  return null
}

const ALL_METHODS: InvoicePaymentMethod[] = [
  'cash',
  'card',
  'bank_transfer'
]

/**
 * Engedélyezett fizmodok típus szerint.
 * Díjbekérő = csak átutalás (fizetési felhívás, nem pulti KP/kártya).
 */
export function allowedInvoicePaymentMethods(
  kind: InvoiceIssueKind
): InvoicePaymentMethod[] {
  if (kind === 'proforma') return ['bank_transfer']
  return ALL_METHODS
}

export function isInvoicePaymentMethodAllowed(
  kind: InvoiceIssueKind,
  method: InvoicePaymentMethod
): boolean {
  return allowedInvoicePaymentMethods(kind).includes(method)
}

/**
 * Default fizmod a dialógus megnyitásakor / típusváltáskor.
 * Díjbekérő mindig átutalás (ERP cash override nélkül).
 */
export function defaultInvoicePaymentMethod(
  kind: InvoiceIssueKind,
  opts?: {
    lastPaymentMethodName?: string | null
    paymentStatus?: string | null
  }
): InvoicePaymentMethod {
  if (kind === 'proforma') return 'bank_transfer'

  const fromErp = detectInvoicePaymentMethod(opts?.lastPaymentMethodName)
  if (fromErp) return fromErp

  if (kind === 'normal' && opts?.paymentStatus === 'paid') {
    return 'cash'
  }

  return 'bank_transfer'
}

export function invoicePaymentMethodHint(kind: InvoiceIssueKind): string {
  if (kind === 'proforma') {
    return 'Díjbekérőn csak átutalás — fizetési felhívás, nem rögzít ERP befizetést.'
  }
  if (kind === 'advance') {
    return 'Az előleg hogyan érkezett / érkezik (KP, kártya, utalás).'
  }
  return 'A számlán megjelenő mód. Ha az ERP-ben már fizetve van, a számla fizetettnek jelölődik.'
}

export const INVOICE_PAYMENT_METHOD_LABEL: Record<
  InvoicePaymentMethod,
  string
> = {
  cash: 'Készpénz',
  card: 'Bankkártya',
  bank_transfer: 'Átutalás'
}
