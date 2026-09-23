import type { InvoicePaymentMethod } from '@/lib/invoicing/types'

/** Készpénz — magyar kerekítés + azonnali paid. */
export function isCashPaymentMethodName(
  name: string | null | undefined
): boolean {
  const n = (name ?? '').toLowerCase()
  return n.includes('készpénz') || n.includes('keszpenz') || n === 'cash'
}

/** Bankkártya / card — azonnali paid. */
export function isCardPaymentMethodName(
  name: string | null | undefined
): boolean {
  const n = (name ?? '').toLowerCase()
  return (
    n.includes('kártya') ||
    n.includes('kartya') ||
    n.includes('bankkártya') ||
    n.includes('bankkartya') ||
    n === 'card' ||
    n.includes('credit') ||
    n.includes('debit')
  )
}

/**
 * Utalás / átutalás — create-kor nincs sales_payments sor → unpaid + díjbekérő.
 * (Nem POS KP feladás.)
 */
export function isDeferredPaymentMethodName(
  name: string | null | undefined
): boolean {
  const n = (name ?? '').toLowerCase()
  return (
    n.includes('utalás') ||
    n.includes('utalas') ||
    n.includes('átutalás') ||
    n.includes('atutalas') ||
    n.includes('átutalas') ||
    n.includes('transfer') ||
    n.includes('wire') ||
    n.includes('banki') ||
    n === 'bank' ||
    n.includes('bank transfer')
  )
}

/** Azonnali settlement (KP / kártya / egyéb nem-deferred). */
export function isImmediatePaymentMethodName(
  name: string | null | undefined
): boolean {
  return !isDeferredPaymentMethodName(name)
}

export function toInvoicePaymentMethod(
  name: string | null | undefined
): InvoicePaymentMethod {
  if (isCashPaymentMethodName(name)) return 'cash'
  if (isCardPaymentMethodName(name)) return 'card'
  return 'bank_transfer'
}
