/** sessionStorage keys — keep in sync with sections that persist lines */
export const FRONTTERVEZO_SESSION_KEY_BUTORLAP = 'fronttervezo-butorlap-lines'
export const FRONTTERVEZO_SESSION_KEY_INOMAT = 'fronttervezo-inomat-lines'

/** Fired when any front-type line list is written to session (same tab + cross-tab via storage) */
export const FRONTTERVEZO_LINES_UPDATED = 'fronttervezo-lines-updated'

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
    festett: 0,
    folias: 0,
    alu: 0
  }
}

export function dispatchFronttervezoLinesUpdated(): void {
  if (typeof window === 'undefined') return

  window.dispatchEvent(new CustomEvent(FRONTTERVEZO_LINES_UPDATED))
}
