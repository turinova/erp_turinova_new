import {
  isCardPaymentMethodName,
  isCashPaymentMethodName,
  isDeferredPaymentMethodName
} from '@/lib/sales/payment-kind'

/** Rendszer fizetési mód fajták (DB: payment_methods.kind). */
export const PAYMENT_METHOD_KINDS = [
  'cash',
  'card',
  'transfer',
  'szep_card',
  'cod'
] as const

export type PaymentMethodKind = (typeof PAYMENT_METHOD_KINDS)[number]

export const PAYMENT_METHOD_KIND_LABEL: Record<PaymentMethodKind, string> = {
  cash: 'Készpénz',
  card: 'Bankkártya',
  transfer: 'Átutalás',
  szep_card: 'SZÉP kártya',
  cod: 'Utánvét'
}

export function parsePaymentMethodKind(v: unknown): PaymentMethodKind | null {
  return typeof v === 'string' &&
    (PAYMENT_METHOD_KINDS as readonly string[]).includes(v)
    ? (v as PaymentMethodKind)
    : null
}

/** Rendezés a listákban: fix sorrend, régi (kind nélküli) sorok a végén. */
export function paymentMethodKindOrder(kind: PaymentMethodKind | null): number {
  return kind ? PAYMENT_METHOD_KINDS.indexOf(kind) : PAYMENT_METHOD_KINDS.length
}

/** kind elsődleges; név csak régi sorokra / snapshotokra. */
export function resolvePaymentMethodKind(method: {
  kind?: string | null
  name?: string | null
}): PaymentMethodKind | null {
  const k = parsePaymentMethodKind(method.kind)
  if (k) return k
  const name = method.name ?? ''
  const n = name.toLowerCase()
  if (n.includes('szép') || n.includes('szep')) return 'szep_card'
  if (isCashPaymentMethodName(name)) return 'cash'
  if (n.includes('utánvét') || n.includes('utanvet')) return 'cod'
  if (isCardPaymentMethodName(name)) return 'card'
  if (isDeferredPaymentMethodName(name)) return 'transfer'
  return null
}

export function isTransferPaymentMethod(method: {
  kind?: string | null
  name?: string | null
}): boolean {
  return resolvePaymentMethodKind(method) === 'transfer'
}

export function isCardPaymentMethod(method: {
  kind?: string | null
  name?: string | null
}): boolean {
  return resolvePaymentMethodKind(method) === 'card'
}
