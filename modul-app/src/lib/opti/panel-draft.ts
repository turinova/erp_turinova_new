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
  /**
   * Geometriai hosszabb / rövidebb oldal; négyzetnél hosszu = szálirányú él,
   * rovid = keresztirányú él. null ha nincs pánthely.
   */
  panthelyfurasOldal: PanthelyOldal | null
}

export type PanthelyOldal = 'hosszu' | 'rovid'

export const PANTHELY_MIN = 2
export const PANTHELY_MAX = 20
export const PANTHELY_DEFAULT_OLDAL: PanthelyOldal = 'hosszu'

export function normalizePanthelyOldal(raw: unknown): PanthelyOldal | null {
  return raw === 'hosszu' || raw === 'rovid' ? raw : null
}

/** A választott oldal hossza mm-ben: hosszú = max(szál, kereszt), rövid = min. */
export function panthelyEdgeMm(
  grainMm: number,
  crossMm: number,
  oldal: PanthelyOldal
): number {
  return oldal === 'hosszu'
    ? Math.max(grainMm, crossMm)
    : Math.min(grainMm, crossMm)
}

export function isSquarePanel(grainMm?: number, crossMm?: number): boolean {
  const g = Number(grainMm)
  const c = Number(crossMm)
  return g > 0 && g === c
}

/** Négyzetnél nincs hosszabb oldal — ott a szálirány dönt. */
export function panthelySideWord(
  oldal: PanthelyOldal,
  grainMm?: number,
  crossMm?: number
): string {
  if (isSquarePanel(grainMm, crossMm)) {
    return oldal === 'hosszu' ? 'szálirányú' : 'keresztirányú'
  }
  return oldal === 'hosszu' ? 'hosszú' : 'rövid'
}

/** pl. „hosszú oldal” / négyzetnél „szálirányú él”. */
export function panthelySideText(
  oldal: PanthelyOldal,
  grainMm?: number,
  crossMm?: number
): string {
  const word = panthelySideWord(oldal, grainMm, crossMm)
  return isSquarePanel(grainMm, crossMm) ? `${word} él` : `${word} oldal`
}

/** pl. „Pánthely 3 · hosszú (720 mm)”; oldal nélküli régi sor: „Pánthely 3”. */
export function panthelyLabel(input: {
  quantity: number
  oldal: PanthelyOldal | null
  grainMm?: number
  crossMm?: number
  withMm?: boolean
}): string {
  const base = `Pánthely ${input.quantity}`
  if (!input.oldal) return base
  const side = panthelySideWord(input.oldal, input.grainMm, input.crossMm)
  if (
    input.withMm &&
    Number(input.grainMm) > 0 &&
    Number(input.crossMm) > 0
  ) {
    const mm = panthelyEdgeMm(
      Number(input.grainMm),
      Number(input.crossMm),
      input.oldal
    )
    return `${base} · ${side} (${mm} mm)`
  }
  return `${base} · ${side}`
}

/** Előnézet: a választott él vízszintes-e (vízszintes = szálirányú él). */
export function panthelyEdgeIsHorizontal(
  grainMm: number,
  crossMm: number,
  oldal: PanthelyOldal
): boolean {
  return oldal === 'hosszu' ? grainMm >= crossMm : grainMm < crossMm
}

/** Furatközéppontok távolsága az él elejétől: végeken 100 mm, közbülsők egyenletesen. */
export function panthelyPositionsMm(edgeMm: number, count: number): number[] {
  const n = Math.max(2, Math.floor(count))
  const end = Math.min(100, edgeMm / 2)
  const first = end
  const last = edgeMm - end
  if (n === 2) return [first, last]
  return Array.from(
    { length: n },
    (_, i) => first + ((last - first) * i) / (n - 1)
  )
}

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
  panthelyfurasOldal?: PanthelyOldal | null
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
    panthelyfurasQuantity: panthelySafe,
    panthelyfurasOldal:
      panthelySafe > 0
        ? (normalizePanthelyOldal(input.panthelyfurasOldal) ??
          PANTHELY_DEFAULT_OLDAL)
        : null
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
