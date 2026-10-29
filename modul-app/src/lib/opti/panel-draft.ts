/** Opti panel — local draft (nincs DB mentés, amíg árajánlat nem készül). */

export type OptiPanelDraft = {
  id: string
  sheetMaterialId: string
  sheetMaterialName: string
  grainMm: number
  crossMm: number
  quantity: number
  marking: string
  edgeAId: string | null
  edgeBId: string | null
  edgeCId: string | null
  edgeDId: string | null
  edgeALabel: string
  edgeBLabel: string
  edgeCLabel: string
  edgeDLabel: string
  /** Duplungolás: megmunkálás flag; a darabszám a formon ×2. */
  duplungolas: boolean
  /** Szögvágás: megmunkálás flag. */
  szogvagas: boolean
  /** Pánthely lyuk / panel (0 = nincs; 2–20). */
  panthelyfurasQuantity: number
}

export const PANTHELY_MIN = 2
export const PANTHELY_MAX = 20

/** 0 = off; különben 2–20 egész. Invalid → null. */
export function parsePanthelyQuantity(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed || trimmed === '0') return 0
  const n = Number(trimmed.replace(',', '.'))
  if (!Number.isFinite(n)) return null
  const whole = Math.round(n)
  if (whole === 0) return 0
  if (whole < PANTHELY_MIN || whole > PANTHELY_MAX) return null
  return whole
}

export function createPanelDraft(input: {
  sheetMaterialId: string
  sheetMaterialName: string
  grainMm: number
  crossMm: number
  quantity: number
  marking: string
  edgeAId: string
  edgeBId: string
  edgeCId: string
  edgeDId: string
  edgeALabel: string
  edgeBLabel: string
  edgeCLabel: string
  edgeDLabel: string
  duplungolas?: boolean
  szogvagas?: boolean
  panthelyfurasQuantity?: number
}): OptiPanelDraft {
  const panthely = Number(input.panthelyfurasQuantity) || 0
  const panthelySafe =
    panthely === 0
      ? 0
      : panthely >= PANTHELY_MIN && panthely <= PANTHELY_MAX
        ? Math.round(panthely)
        : 0
  return {
    id: crypto.randomUUID(),
    sheetMaterialId: input.sheetMaterialId,
    sheetMaterialName: input.sheetMaterialName,
    grainMm: input.grainMm,
    crossMm: input.crossMm,
    quantity: input.quantity,
    marking: input.marking.trim(),
    edgeAId: input.edgeAId || null,
    edgeBId: input.edgeBId || null,
    edgeCId: input.edgeCId || null,
    edgeDId: input.edgeDId || null,
    edgeALabel: input.edgeALabel,
    edgeBLabel: input.edgeBLabel,
    edgeCLabel: input.edgeCLabel,
    edgeDLabel: input.edgeDLabel,
    duplungolas: Boolean(input.duplungolas),
    szogvagas: Boolean(input.szogvagas),
    panthelyfurasQuantity: panthelySafe
  }
}

/** Él szín — ugyanaz a hash logika, mint a main-app Opti előnézetben. */
export function edgeMaterialColor(edgeMaterialId: string | null | undefined): string {
  if (!edgeMaterialId) return '#94a3b8'

  const colors = [
    '#18181B',
    '#16a34a',
    '#ea580c',
    '#dc2626',
    '#7c3aed',
    '#0891b2',
    '#db2777',
    '#78716c',
    '#475569',
    '#ca8a04'
  ]

  const hash = edgeMaterialId
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return colors[hash % colors.length]
}
