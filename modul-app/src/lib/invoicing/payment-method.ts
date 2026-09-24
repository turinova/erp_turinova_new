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

/**
 * Default fizmod a dialógus megnyitásakor / típusváltáskor.
 * Mindhárom típusnál választható; ez csak a javasolt érték.
 */
export function defaultInvoicePaymentMethod(
  kind: InvoiceIssueKind,
  opts?: {
    lastPaymentMethodName?: string | null
    paymentStatus?: string | null
  }
): InvoicePaymentMethod {
  const fromErp = detectInvoicePaymentMethod(opts?.lastPaymentMethodName)
  if (fromErp) return fromErp

  if (kind === 'normal' && opts?.paymentStatus === 'paid') {
    return 'cash'
  }

  // Díjbekérő / előleg / unpaid számla → átutalás default
  return 'bank_transfer'
}

export function invoicePaymentMethodHint(kind: InvoiceIssueKind): string {
  if (kind === 'proforma') {
    return 'A díjbekérőn: hogyan kérjük a fizetést. Még nem rögzít pénzt az ERP-ben.'
  }
  if (kind === 'advance') {
    return 'Az előleg hogyan érkezett / érkezik (KP, kártya, utalás).'
  }
  return 'A számlán megjelenő mód. Ha az ERP-ben már fizetve van, a számla fizetettnek jelölődik.'
}
