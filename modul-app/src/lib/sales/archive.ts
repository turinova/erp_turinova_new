import type { SaleStatus } from '@/lib/sales/parse'

export type SaleArchiveGate =
  | { ok: true }
  | { ok: false; message: string }

const ARCHIVEABLE: SaleStatus[] = [
  'cancelled',
  'returned',
  'fulfilled',
  'partially_returned'
]

export function canArchiveSale(input: {
  status: SaleStatus
  deletedAt?: string | null
  archivedAt?: string | null
}): SaleArchiveGate {
  if (input.deletedAt) {
    return { ok: false, message: 'Az eladás már törölve van.' }
  }
  if (input.archivedAt) {
    return { ok: false, message: 'Már az archívumban van.' }
  }
  if (!ARCHIVEABLE.includes(input.status)) {
    return {
      ok: false,
      message:
        'Csak teljesített, visszáru vagy lemondott eladás archiválható. Átadásra várót előbb mondd le.'
    }
  }
  return { ok: true }
}

export function canUnarchiveSale(input: {
  archivedAt?: string | null
  deletedAt?: string | null
}): SaleArchiveGate {
  if (input.deletedAt) {
    return { ok: false, message: 'Az eladás már törölve van.' }
  }
  if (!input.archivedAt) {
    return { ok: false, message: 'Nincs az archívumban.' }
  }
  return { ok: true }
}

export const SALE_BULK_MAX = 50
