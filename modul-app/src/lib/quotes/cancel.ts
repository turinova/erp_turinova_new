import type { QuoteStatus } from '@/lib/quotes/queries'

/** Megrendelés lemondás okai (DB check + UI). */
export const QUOTE_CANCEL_REASONS = [
  'customer',
  'wrong_order',
  'material',
  'other'
] as const

export type QuoteCancelReason = (typeof QUOTE_CANCEL_REASONS)[number]

export const QUOTE_CANCEL_REASON_LABEL: Record<QuoteCancelReason, string> = {
  customer: 'Ügyfél elállt',
  wrong_order: 'Hibás / téves megrendelés',
  material: 'Anyag- vagy kapacitáshiány',
  other: 'Egyéb'
}

export const QUOTE_CANCELABLE_STATUSES: QuoteStatus[] = [
  'ordered',
  'in_production',
  'ready'
]

export type QuoteCancelGateInput = {
  status: QuoteStatus
  orderNumber: string | null
  deletedAt?: string | null
  hasActiveFinalInvoice: boolean
}

export type QuoteCancelGate =
  | { ok: true }
  | { ok: false; message: string }

/** Pure gate — UI + action ugyanazt használja. */
export function canCancelQuote(input: QuoteCancelGateInput): QuoteCancelGate {
  if (input.deletedAt) {
    return { ok: false, message: 'A megrendelés már törölve van.' }
  }
  if (!input.orderNumber) {
    return {
      ok: false,
      message: 'Piszkozatot töröld, ne mondd le.'
    }
  }
  if (input.status === 'cancelled') {
    return { ok: false, message: 'A megrendelés már le van mondva.' }
  }
  if (input.status === 'draft') {
    return {
      ok: false,
      message: 'Piszkozatot töröld, ne mondd le.'
    }
  }
  if (input.status === 'finished') {
    return {
      ok: false,
      message: 'Lezárt megrendelés nem mondható le.'
    }
  }
  if (!QUOTE_CANCELABLE_STATUSES.includes(input.status)) {
    return {
      ok: false,
      message: 'Ebben a státuszban nem mondható le a megrendelés.'
    }
  }
  if (input.hasActiveFinalInvoice) {
    return {
      ok: false,
      message:
        'Van aktív végszámla — előbb sztornózd a bizonylatot, aztán mondd le.'
    }
  }
  return { ok: true }
}

export function needsStrongCancelConfirm(status: QuoteStatus): boolean {
  return status === 'in_production' || status === 'ready'
}

export function parseQuoteCancelReason(
  raw: string
): QuoteCancelReason | null {
  if (
    raw === 'customer' ||
    raw === 'wrong_order' ||
    raw === 'material' ||
    raw === 'other'
  ) {
    return raw
  }
  return null
}

export function validateCancelNote(
  reason: QuoteCancelReason,
  note: string
): string | null {
  const trimmed = note.trim()
  if (reason === 'other' && trimmed.length < 3) {
    return 'Egyéb oknál írj legalább 3 karakteres megjegyzést.'
  }
  return null
}
