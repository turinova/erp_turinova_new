import type { QuoteStatus } from '@/lib/quotes/queries'

/** Újranyitás okai (DB check + UI). */
export const QUOTE_REOPEN_REASONS = [
  'accidental',
  'customer_return',
  'wrong_handover',
  'other'
] as const

export type QuoteReopenReason = (typeof QUOTE_REOPEN_REASONS)[number]

export const QUOTE_REOPEN_REASON_LABEL: Record<QuoteReopenReason, string> = {
  accidental: 'Véletlen átadás',
  customer_return: 'Ügyfél visszavitte / visszahozta',
  wrong_handover: 'Hibás / téves átadás',
  other: 'Egyéb'
}

export type QuoteReopenGateInput = {
  status: QuoteStatus
  orderNumber: string | null
  deletedAt?: string | null
  archivedAt?: string | null
  hasActiveFinalInvoice: boolean
}

export type QuoteReopenGate =
  | { ok: true }
  | { ok: false; message: string }

/** Pure gate — UI + action ugyanazt használja. */
export function canReopenFinishedQuote(
  input: QuoteReopenGateInput
): QuoteReopenGate {
  if (input.deletedAt) {
    return { ok: false, message: 'A megrendelés már törölve van.' }
  }
  if (input.archivedAt) {
    return {
      ok: false,
      message: 'Archív megrendelést előbb vedd ki az archívumból.'
    }
  }
  if (!input.orderNumber) {
    return { ok: false, message: 'Nincs megrendelésszám.' }
  }
  if (input.status !== 'finished') {
    return {
      ok: false,
      message: 'Csak lezárt megrendelés nyitható újra.'
    }
  }
  if (input.hasActiveFinalInvoice) {
    return {
      ok: false,
      message:
        'Van aktív végszámla — előbb sztornózd a bizonylatot, aztán nyisd újra.'
    }
  }
  return { ok: true }
}

export type QuoteArchiveGateInput = {
  status: QuoteStatus
  orderNumber: string | null
  deletedAt?: string | null
  archivedAt?: string | null
}

export type QuoteArchiveGate =
  | { ok: true }
  | { ok: false; message: string }

const ARCHIVEABLE: QuoteStatus[] = ['finished', 'cancelled']

export function canArchiveQuote(input: QuoteArchiveGateInput): QuoteArchiveGate {
  if (input.deletedAt) {
    return { ok: false, message: 'A megrendelés már törölve van.' }
  }
  if (input.archivedAt) {
    return { ok: false, message: 'Már az archívumban van.' }
  }
  if (!input.orderNumber) {
    return {
      ok: false,
      message: 'Piszkozatot töröld, ne archiváld.'
    }
  }
  if (!ARCHIVEABLE.includes(input.status)) {
    return {
      ok: false,
      message: 'Csak lezárt vagy lemondott megrendelés archiválható.'
    }
  }
  return { ok: true }
}

export function canUnarchiveQuote(input: {
  archivedAt?: string | null
  deletedAt?: string | null
}): QuoteArchiveGate {
  if (input.deletedAt) {
    return { ok: false, message: 'A megrendelés már törölve van.' }
  }
  if (!input.archivedAt) {
    return { ok: false, message: 'Nincs az archívumban.' }
  }
  return { ok: true }
}

/** Megrendelésszám begépelés — trim + case-insensitive. */
export function orderNumbersMatch(
  typed: string,
  expected: string | null | undefined
): boolean {
  if (!expected) return false
  return typed.trim().toLocaleLowerCase('hu-HU') ===
    expected.trim().toLocaleLowerCase('hu-HU')
}

export function parseQuoteReopenReason(
  raw: string
): QuoteReopenReason | null {
  if (
    raw === 'accidental' ||
    raw === 'customer_return' ||
    raw === 'wrong_handover' ||
    raw === 'other'
  ) {
    return raw
  }
  return null
}

export function validateReopenNote(
  reason: QuoteReopenReason,
  note: string
): string | null {
  const trimmed = note.trim()
  if (reason === 'other' && trimmed.length < 3) {
    return 'Egyéb oknál írj legalább 3 karakteres megjegyzést.'
  }
  return null
}

/** Scanner bulk átadás erős confirm szövege. */
export const HANDOVER_BULK_CONFIRM_WORD = 'ÁTADÁS'
