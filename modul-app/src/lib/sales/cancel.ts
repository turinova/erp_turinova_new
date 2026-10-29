import type { SaleStatus } from '@/lib/sales/parse'

export const SALE_CANCEL_REASONS = [
  'test',
  'customer',
  'error',
  'other'
] as const

export type SaleCancelReason = (typeof SALE_CANCEL_REASONS)[number]

export const SALE_CANCEL_REASON_LABEL: Record<SaleCancelReason, string> = {
  test: 'Teszt / szemét',
  customer: 'Ügyfél elállt',
  error: 'Hibás rögzítés',
  other: 'Egyéb'
}

/** P0: csak stock nélküli státuszok. */
export const SALE_CANCELABLE_STATUSES: SaleStatus[] = ['draft', 'confirmed']

export type SaleCancelGateInput = {
  status: SaleStatus
  deletedAt?: string | null
  archivedAt?: string | null
  hasActiveFinalInvoice: boolean
}

export type SaleCancelGate = { ok: true } | { ok: false; message: string }

export function canCancelSale(input: SaleCancelGateInput): SaleCancelGate {
  if (input.deletedAt) {
    return { ok: false, message: 'Az eladás már törölve van.' }
  }
  if (input.archivedAt) {
    return {
      ok: false,
      message: 'Archív eladást előbb vedd ki az archívumból.'
    }
  }
  if (input.status === 'cancelled') {
    return { ok: false, message: 'Az eladás már le van mondva.' }
  }
  if (input.status === 'fulfilled' || input.status === 'partially_returned') {
    return {
      ok: false,
      message:
        'Teljesített eladás nem mondható le így — használd a visszáruut vagy az archívumot.'
    }
  }
  if (input.status === 'returned') {
    return { ok: false, message: 'Visszáru státuszú eladás nem mondható le.' }
  }
  if (!SALE_CANCELABLE_STATUSES.includes(input.status)) {
    return {
      ok: false,
      message: 'Ebben a státuszban nem mondható le az eladás.'
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

export function parseSaleCancelReason(raw: string): SaleCancelReason | null {
  if (
    raw === 'test' ||
    raw === 'customer' ||
    raw === 'error' ||
    raw === 'other'
  ) {
    return raw
  }
  return null
}

export function validateSaleCancelNote(
  reason: SaleCancelReason,
  note: string
): string | null {
  if (reason === 'other' && note.trim().length < 3) {
    return 'Egyéb oknál írj legalább 3 karakteres megjegyzést.'
  }
  return null
}
