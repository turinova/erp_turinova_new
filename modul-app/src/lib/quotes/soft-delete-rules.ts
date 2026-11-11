/**
 * Ajánlat soft-delete szabályok (piszkozat, nincs megrendelés).
 * Megrendelést lemondani kell — nem törölni.
 */

export type SoftDeleteQuoteGateInput = {
  status: string
  orderNumber: string | null
  /** Partner beküldés — staff soft-delete tiltva. */
  portalSubmittedAt?: string | null
  /** Aktív (nem sztornózott) bizonylat: díjbekérő / előleg / számla */
  hasActiveInvoice: boolean
  hasPayments: boolean
}

/** null = törölhető; különben user-facing tiltás. */
export function softDeleteQuoteBlocker(
  input: SoftDeleteQuoteGateInput
): string | null {
  if (input.orderNumber) {
    return 'Megrendelést mondj le, ne töröld. Piszkozat törölhető csak.'
  }
  if (input.status !== 'draft') {
    return 'Megrendelést mondj le, ne töröld. Piszkozat törölhető csak.'
  }
  if (input.portalSubmittedAt) {
    return 'Beküldött partner ajánlatot ne töröld. Hozd létre a megrendelést, vagy egyeztesd a partnerrel.'
  }
  if (input.hasActiveInvoice) {
    return 'Van aktív bizonylat (pl. díjbekérő). Előbb sztornózd, aztán törölheted az ajánlatot.'
  }
  if (input.hasPayments) {
    return 'Van rögzített befizetés — az ajánlat nem törölhető.'
  }
  return null
}

export function canSoftDeleteQuote(input: SoftDeleteQuoteGateInput): boolean {
  return softDeleteQuoteBlocker(input) == null
}
