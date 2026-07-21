/** sessionStorage keys — keep in sync with sections that persist lines */
export const FRONTTERVEZO_SESSION_KEY_BUTORLAP = 'nettfront-butorlap-lines'
export const FRONTTERVEZO_SESSION_KEY_INOMAT = 'nettfront-inomat-lines'
export const FRONTTERVEZO_SESSION_KEY_ALU = 'nettfront-alu-lines'
export const FRONTTERVEZO_SESSION_KEY_FESTETT = 'nettfront-festett-lines'
export const FRONTTERVEZO_SESSION_KEY_FOLIAS = 'nettfront-folias-lines'

/** Fired when any front-type line list is written to session (same tab + cross-tab via storage) */
export const FRONTTERVEZO_LINES_UPDATED = 'nettfront-lines-updated'

export type FronttervezoFrontTypeKey = 'butorlap' | 'inomat' | 'festett' | 'folias' | 'alu'

export type FronttervezoLineCounts = Record<FronttervezoFrontTypeKey, number>

const emptyCounts = (): FronttervezoLineCounts => ({
  butorlap: 0,
  inomat: 0,
  festett: 0,
  folias: 0,
  alu: 0
})

function parseArrayLength(key: string): number {
  if (typeof window === 'undefined') return 0

  try {
    const raw = sessionStorage.getItem(key)

    if (!raw) return 0
    const parsed = JSON.parse(raw) as unknown

    return Array.isArray(parsed) ? parsed.length : 0
  } catch {
    return 0
  }
}

export function parseFronttervezoLineCounts(): FronttervezoLineCounts {
  if (typeof window === 'undefined') return emptyCounts()

  return {
    butorlap: parseArrayLength(FRONTTERVEZO_SESSION_KEY_BUTORLAP),
    inomat: parseArrayLength(FRONTTERVEZO_SESSION_KEY_INOMAT),
    festett: parseArrayLength(FRONTTERVEZO_SESSION_KEY_FESTETT),
    folias: parseArrayLength(FRONTTERVEZO_SESSION_KEY_FOLIAS),
    alu: parseArrayLength(FRONTTERVEZO_SESSION_KEY_ALU)
  }
}

export function dispatchFronttervezoLinesUpdated(): void {
  if (typeof window === 'undefined') return

  window.dispatchEvent(new CustomEvent(FRONTTERVEZO_LINES_UPDATED))
}

/** Összes Nettfront session tétel törlése (új ajánlat / mentés után) */
export function clearFronttervezoSessionLines(options?: { silent?: boolean }): void {
  if (typeof window === 'undefined') return

  sessionStorage.removeItem(FRONTTERVEZO_SESSION_KEY_BUTORLAP)
  sessionStorage.removeItem(FRONTTERVEZO_SESSION_KEY_INOMAT)
  sessionStorage.removeItem(FRONTTERVEZO_SESSION_KEY_ALU)
  sessionStorage.removeItem(FRONTTERVEZO_SESSION_KEY_FESTETT)
  sessionStorage.removeItem(FRONTTERVEZO_SESSION_KEY_FOLIAS)

  if (!options?.silent) {
    dispatchFronttervezoLinesUpdated()
  }
}
