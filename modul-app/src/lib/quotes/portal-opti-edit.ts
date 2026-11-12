/**
 * Partner beküldött ajánlat Opti szerkesztés — ki szerkeszthet.
 * portal_submitted_at = partner lock, NEM staff lock.
 */

export function isPortalSubmittedQuote(input: {
  source: string | null | undefined
  portalSubmittedAt: string | null | undefined
}): boolean {
  return input.source === 'portal' && Boolean(input.portalSubmittedAt)
}

/**
 * Opti editable tiltás a beküldés miatt.
 * Csak partner módban tilt; staff szerkeszthet (draft/ordered státusz mellett).
 */
export function isOptiLockedByPortalSubmit(input: {
  partnerMode: boolean
  source: string | null | undefined
  portalSubmittedAt: string | null | undefined
}): boolean {
  if (!input.partnerMode) return false
  return isPortalSubmittedQuote(input)
}

export type PortalOptiSaveInvoiceGate =
  | { ok: true }
  | { ok: false; code: 'advance_or_final'; message: string }
  | { ok: false; code: 'proforma_drift'; message: string }

/** Mentés előtt: aktív előleg/végszámla tilt; díjbekérő + összegváltozás → confirm. */
export function portalOptiSaveInvoiceGate(input: {
  isPortalSubmitted: boolean
  hasActiveAdvance: boolean
  hasActiveFinal: boolean
  hasActiveProforma: boolean
  previousGross: number
  nextGross: number
  confirmStaleProforma: boolean
}): PortalOptiSaveInvoiceGate {
  if (!input.isPortalSubmitted) return { ok: true }

  if (input.hasActiveFinal) {
    return {
      ok: false,
      code: 'advance_or_final',
      message:
        'Van aktív végszámla — Optiból nem módosítható. Előbb sztornózd a bizonylatot.'
    }
  }
  if (input.hasActiveAdvance) {
    return {
      ok: false,
      code: 'advance_or_final',
      message:
        'Van aktív előlegszámla — Optiból nem módosítható. Előbb sztornózd a bizonylatot.'
    }
  }

  if (
    input.hasActiveProforma &&
    Math.round(input.previousGross) !== Math.round(input.nextGross) &&
    !input.confirmStaleProforma
  ) {
    return {
      ok: false,
      code: 'proforma_drift',
      message:
        'Van élő díjbekérő, és az összeg változna. Ha folytatod, a díjbekérő elavult lesz — sztornózd vagy állíts ki újat.'
    }
  }

  return { ok: true }
}
