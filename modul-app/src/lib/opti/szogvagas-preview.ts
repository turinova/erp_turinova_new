/** UI-only szögvágás: saroklevágás (nest = téglalap marad). */

export type SzogCornerId = 'TL' | 'TR' | 'BL' | 'BR'

export type SzogCornerCut = {
  corner: SzogCornerId
  /**
   * Levágás a saroktól (belső).
   * UI bemenet: kész él = grainMm − alongGrainMm (végleges megmaradó).
   */
  alongGrainMm: number
  /**
   * Levágás a saroktól (belső).
   * UI bemenet: kész él = crossMm − alongCrossMm (végleges megmaradó).
   */
  alongCrossMm: number
}

/** Kész (megmaradó) élhossz a saroktól távolabbi vég felől. */
export function remainFromCut(fullMm: number, alongMm: number): number {
  if (fullMm <= 0) return 0
  return Math.min(fullMm, Math.max(0, fullMm - alongMm))
}

/** UI kész méret → belső levágás a saroktól. remain=0 → teljes él (átló / háromszög). */
export function cutFromRemain(fullMm: number, remainMm: number): number {
  if (fullMm <= 0) return 0
  const remain = Math.min(fullMm, Math.max(0, remainMm))
  return Math.min(fullMm, Math.max(0, fullMm - remain))
}

/** Mindkét él teljes levágása a saroktól = átlós háromszög. */
export function isSzogFullDiagonal(
  cut: SzogCornerCut,
  grainMm: number,
  crossMm: number
): boolean {
  return (
    grainMm > 0 &&
    crossMm > 0 &&
    cut.alongGrainMm >= grainMm &&
    cut.alongCrossMm >= crossMm
  )
}

/** Háromszög preset: a megadott sarokból átló a szemköztiig. */
export function szogTriangleCut(
  corner: SzogCornerId,
  grainMm: number,
  crossMm: number
): SzogCornerCut {
  return {
    corner,
    alongGrainMm: grainMm,
    alongCrossMm: crossMm
  }
}

/** Megmunkálás-only alak (nest = meglévő szál × kereszt). */
export type SzogShapeKind = 'trapezoid' | 'triangle'

/** Párhuzamos élek tengelye: szál (felső/alsó) vagy kereszt (bal/jobb). */
export type SzogTrapAxis = 'grain' | 'cross'

/** Ferde a másik tengelyen (szál-mód: bal/jobb · kereszt-mód: felső/alsó). */
export type SzogTrapSlant = 'left' | 'right' | 'top' | 'bottom'

/**
 * Egyferdéjű trapéz a meglévő G×C nesten.
 * shortMm = a rövidebb párhuzamos él kész hossza a választott tengelyen.
 * Konvenció: rövid él „felső” (szál) vagy „bal” (kereszt); 180° ugyanaz.
 */
export function cornersFromTrapezoid(
  grainMm: number,
  crossMm: number,
  shortMm: number,
  axis: SzogTrapAxis,
  slant: SzogTrapSlant
): SzogCornerCut[] {
  if (grainMm <= 0 || crossMm <= 0) return []
  const full = axis === 'grain' ? grainMm : crossMm
  const short = Math.min(Math.max(0, Math.round(shortMm)), full)
  if (short >= full) return []

  if (axis === 'grain') {
    const side = slant === 'right' ? 'right' : 'left'
    if (short <= 0) {
      return [
        szogTriangleCut(side === 'left' ? 'TL' : 'TR', grainMm, crossMm)
      ]
    }
    return [
      {
        corner: side === 'left' ? 'TL' : 'TR',
        alongGrainMm: grainMm - short,
        alongCrossMm: crossMm
      }
    ]
  }

  // Kereszt: párhuzamosok = bal/jobb; rövid = bal; ferde fixen felső (nincs alsó váltó)
  if (short <= 0) {
    return [szogTriangleCut('TL', grainMm, crossMm)]
  }
  return [
    {
      corner: 'TL',
      alongGrainMm: grainMm,
      alongCrossMm: crossMm - short
    }
  ]
}

/**
 * Háromszög: axis = szál → TL átló; kereszt → TR átló (ferde a szálhoz képest).
 */
export function cornersFromTriangle(
  grainMm: number,
  crossMm: number,
  axis: SzogTrapAxis = 'grain'
): SzogCornerCut[] {
  if (grainMm <= 0 || crossMm <= 0) return []
  return [szogTriangleCut(axis === 'cross' ? 'TR' : 'TL', grainMm, crossMm)]
}

export function defaultTrapezoidShortMm(fullMm: number): number {
  if (fullMm <= 0) return 0
  return Math.max(1, Math.min(fullMm - 1, Math.round(fullMm * 0.7)))
}

/** Shape UI → corners (ferde fix bal/felső — tükör / 180° ugyanaz). */
export function rebuildSzogCornersFromShape(
  kind: SzogShapeKind,
  grainMm: number,
  crossMm: number,
  trapShortMm: number,
  trapAxis: SzogTrapAxis
): SzogCornerCut[] {
  if (grainMm <= 0 || crossMm <= 0) return []
  if (kind === 'triangle') {
    return cornersFromTriangle(grainMm, crossMm, 'grain')
  }
  return cornersFromTrapezoid(
    grainMm,
    crossMm,
    trapShortMm,
    trapAxis,
    trapAxis === 'cross' ? 'top' : 'left'
  )
}

/**
 * Ferde él kész hossza mm (quote).
 * Nincs szög / nincs vágás → 0.
 */
export function panelFerdeEdgeLengthMm(input: {
  szogvagas: boolean
  grainMm: number
  crossMm: number
  szogKind?: SzogShapeKind | null
  szogTrapShortMm?: number | null
  szogTrapAxis?: SzogTrapAxis | null
}): number {
  if (!input.szogvagas || input.grainMm <= 0 || input.crossMm <= 0) return 0
  const kind = input.szogKind ?? 'trapezoid'
  const axis = input.szogTrapAxis ?? 'grain'
  const full = szogTrapParallelFullMm(axis, input.grainMm, input.crossMm)
  const shortRaw = Number(input.szogTrapShortMm)
  const short =
    kind === 'triangle'
      ? 0
      : Number.isFinite(shortRaw) && shortRaw > 0 && shortRaw < full
        ? shortRaw
        : defaultTrapezoidShortMm(full)
  const corners = rebuildSzogCornersFromShape(
    kind,
    input.grainMm,
    input.crossMm,
    short,
    axis
  )
  const mm = szogDiagonalFinishedMm(corners)
  return mm > 0.5 ? mm : 0
}

/** Szabásjegyzék / PDF Egyéb: asztalos-nyelvű alak összefoglaló. */
export function szogShapeSummaryLabel(input: {
  szogvagas: boolean
  szogKind?: SzogShapeKind | null
  szogTrapShortMm?: number | null
  szogTrapAxis?: SzogTrapAxis | null
}): string | null {
  if (!input.szogvagas) return null
  const kind = input.szogKind
  if (kind === 'triangle') return 'Háromszög (szögvágás)'
  if (kind === 'trapezoid') {
    const short = Number(input.szogTrapShortMm)
    const axis =
      input.szogTrapAxis === 'cross'
        ? 'kereszt irányában'
        : 'szál irányában'
    if (Number.isFinite(short) && short > 0) {
      return `Trapéz: kész rövid él ${Math.round(short)} mm, ${axis}`
    }
    return `Trapéz, ${axis}`
  }
  return 'Szögvágás'
}

export function szogTrapParallelFullMm(
  axis: SzogTrapAxis,
  grainMm: number,
  crossMm: number
): number {
  return axis === 'grain' ? grainMm : crossMm
}

export type SzogShapeError = { message: string }

export function validateSzogShape(
  kind: SzogShapeKind,
  grainMm: number,
  crossMm: number,
  trapShortMm: number,
  trapAxis: SzogTrapAxis = 'grain'
): SzogShapeError | null {
  if (grainMm <= 0 || crossMm <= 0) {
    return { message: 'Előbb add meg a szál × kereszt méretet.' }
  }
  if (kind === 'triangle') return null
  const full = szogTrapParallelFullMm(trapAxis, grainMm, crossMm)
  if (!Number.isFinite(trapShortMm)) {
    return { message: 'Add meg a kész rövid él hosszát.' }
  }
  if (trapShortMm < 1 || trapShortMm >= full) {
    return {
      message: `A kész rövid él legyen 1 és ${full - 1} mm között.`
    }
  }
  return null
}

export const SZOG_CORNER_ORDER: SzogCornerId[] = ['TL', 'TR', 'BL', 'BR']

/** Minimális saroklevágás egy élen (mm), ha nem átlós háromszög. */
export const SZOG_MIN_CUT_MM = 20

export const SZOG_CORNER_LABELS: Record<SzogCornerId, string> = {
  TL: 'Bal felső',
  TR: 'Jobb felső',
  BL: 'Bal alsó',
  BR: 'Jobb alsó'
}

/** Szomszéd sarok ugyanazon az élen (szál / kereszt). */
export function szogGrainNeighbor(corner: SzogCornerId): SzogCornerId {
  switch (corner) {
    case 'TL':
      return 'TR'
    case 'TR':
      return 'TL'
    case 'BL':
      return 'BR'
    case 'BR':
      return 'BL'
  }
}

export function szogCrossNeighbor(corner: SzogCornerId): SzogCornerId {
  switch (corner) {
    case 'TL':
      return 'BL'
    case 'BL':
      return 'TL'
    case 'TR':
      return 'BR'
    case 'BR':
      return 'TR'
  }
}

/**
 * Max levágás (along) egy sarok adott tengelyén, a szomszéd foglalása után.
 * Legalább 1 mm középső él marad, ha van szomszéd.
 */
export function szogMaxAlongMm(
  corner: SzogCornerId,
  axis: 'grain' | 'cross',
  corners: SzogCornerCut[],
  grainMm: number,
  crossMm: number
): number {
  const full = axis === 'grain' ? grainMm : crossMm
  if (full <= 0) return 0
  const by = new Map(corners.map((c) => [c.corner, c]))
  const neighborId =
    axis === 'grain' ? szogGrainNeighbor(corner) : szogCrossNeighbor(corner)
  const neighbor = by.get(neighborId)
  const taken = neighbor
    ? axis === 'grain'
      ? neighbor.alongGrainMm
      : neighbor.alongCrossMm
    : 0
  // Ha a szomszéd elviszi a teljes élt, nincs hely
  if (taken >= full) return 0
  // Maradjon legalább 1 mm a két vágás között (ne érjenek össze)
  return Math.max(0, full - taken - (neighbor ? 1 : 0))
}

export type SzogCornerAvailability = {
  enabled: boolean
  reason?: string
}

/**
 * Melyik sarok kapcsolható be (már aktív = mindig enabled, hogy ki lehessen kapcsolni).
 */
export function szogCornerAvailability(
  corners: SzogCornerCut[],
  grainMm: number,
  crossMm: number
): Record<SzogCornerId, SzogCornerAvailability> {
  const by = new Map(corners.map((c) => [c.corner, c]))
  const triangle = corners.find((c) =>
    isSzogFullDiagonal(c, grainMm, crossMm)
  )
  const out = {} as Record<SzogCornerId, SzogCornerAvailability>

  for (const id of SZOG_CORNER_ORDER) {
    if (by.has(id)) {
      out[id] = { enabled: true }
      continue
    }

    if (triangle) {
      out[id] = {
        enabled: false,
        reason: `Átlós háromszög (${SZOG_CORNER_LABELS[triangle.corner]}) miatt más sarok nem adható.`
      }
      continue
    }

    const maxG = szogMaxAlongMm(id, 'grain', corners, grainMm, crossMm)
    const maxC = szogMaxAlongMm(id, 'cross', corners, grainMm, crossMm)

    if (maxG < SZOG_MIN_CUT_MM && maxC < SZOG_MIN_CUT_MM) {
      out[id] = {
        enabled: false,
        reason:
          'A szomszédos vágások miatt mindkét élen elfogyott a hely.'
      }
      continue
    }
    if (maxG < SZOG_MIN_CUT_MM) {
      const edge =
        id === 'TL' || id === 'TR' ? 'felső' : 'alsó'
      const who = SZOG_CORNER_LABELS[szogGrainNeighbor(id)]
      out[id] = {
        enabled: false,
        reason: `A ${edge} él már foglalt (${who}) — nincs hely ehhez a sarokhoz.`
      }
      continue
    }
    if (maxC < SZOG_MIN_CUT_MM) {
      const edge = id === 'TL' || id === 'BL' ? 'bal' : 'jobb'
      const who = SZOG_CORNER_LABELS[szogCrossNeighbor(id)]
      out[id] = {
        enabled: false,
        reason: `A ${edge} él már foglalt (${who}) — nincs hely ehhez a sarokhoz.`
      }
      continue
    }

    out[id] = { enabled: true }
  }

  return out
}

/** Default saroklevágás, a szabad helyhez clampelve. */
export function defaultSzogCornerCut(
  corner: SzogCornerId,
  corners: SzogCornerCut[],
  grainMm: number,
  crossMm: number
): SzogCornerCut | null {
  const maxG = szogMaxAlongMm(corner, 'grain', corners, grainMm, crossMm)
  const maxC = szogMaxAlongMm(corner, 'cross', corners, grainMm, crossMm)
  if (maxG < SZOG_MIN_CUT_MM || maxC < SZOG_MIN_CUT_MM) return null
  const wantG = Math.max(
    SZOG_MIN_CUT_MM,
    Math.min(Math.round(grainMm * 0.1), maxG)
  )
  const wantC = Math.max(
    SZOG_MIN_CUT_MM,
    Math.min(Math.round(crossMm * 0.1), maxC)
  )
  return {
    corner,
    alongGrainMm: wantG,
    alongCrossMm: wantC
  }
}

/** Melyik két él neve a sarknál (plain HU). */
export function szogCornerEdgeLabels(corner: SzogCornerId): {
  grain: string
  cross: string
} {
  switch (corner) {
    case 'TL':
      return { grain: 'Felső él', cross: 'Bal él' }
    case 'TR':
      return { grain: 'Felső él', cross: 'Jobb él' }
    case 'BL':
      return { grain: 'Alsó él', cross: 'Bal él' }
    case 'BR':
      return { grain: 'Alsó él', cross: 'Jobb él' }
  }
}

export function emptySzogCorners(): SzogCornerCut[] {
  return []
}

export function countSzogCuts(corners: SzogCornerCut[]): number {
  return corners.filter((c) => c.alongGrainMm > 0 || c.alongCrossMm > 0).length
}

export function szogShapeLabel(cutCount: number): string {
  if (cutCount <= 0) return 'téglalap'
  if (cutCount === 1) return 'ötszög'
  if (cutCount === 2) return 'hatszög'
  if (cutCount === 3) return 'hétszög'
  return 'nyolcszög'
}

export function szogShapeLabelForCorners(
  corners: SzogCornerCut[],
  grainMm: number,
  crossMm: number
): string {
  const active = corners.filter(
    (c) => c.alongGrainMm > 0 || c.alongCrossMm > 0
  )
  if (
    active.length === 1 &&
    isSzogFullDiagonal(active[0]!, grainMm, crossMm)
  ) {
    return 'háromszög'
  }
  return szogShapeLabel(active.length)
}

export type SzogCornerError = {
  corner: SzogCornerId
  message: string
}

type Pt = { x: number; y: number }

/** Validáció edge case-ekre. */
export function validateSzogCorners(
  corners: SzogCornerCut[],
  grainMm: number,
  crossMm: number
): SzogCornerError[] {
  const errors: SzogCornerError[] = []
  if (grainMm <= 0 || crossMm <= 0) return errors

  const triangles = corners.filter((c) =>
    isSzogFullDiagonal(c, grainMm, crossMm)
  )
  if (triangles.length > 0 && corners.length > 1) {
    errors.push({
      corner: triangles[0]!.corner,
      message: 'Átlós háromszögnél csak egy sarok lehet (kész: 0 × 0 mm).'
    })
  }
  if (triangles.length > 1) {
    errors.push({
      corner: triangles[1]!.corner,
      message: 'Egyszerre csak egy átlós háromszög adható meg.'
    })
  }

  for (const c of corners) {
    if (c.alongGrainMm < 0 || c.alongCrossMm < 0) {
      errors.push({
        corner: c.corner,
        message: 'A kész él nem lehet hosszabb a teljes élnél.'
      })
      continue
    }
    if (c.alongGrainMm === 0 && c.alongCrossMm === 0) {
      errors.push({
        corner: c.corner,
        message:
          'Nincs vágás — mindkét kész él = teljes él. Csökkentsd legalább az egyiket.'
      })
      continue
    }

    const fullG = c.alongGrainMm >= grainMm
    const fullC = c.alongCrossMm >= crossMm
    if (fullG && fullC) {
      // Kész 0 × 0 = átlós háromszög — OK
      continue
    }
    // Kész 0 egy élen (élvégig) + másik kész < teljes — OK
    if (fullG || fullC) {
      const other = fullG ? c.alongCrossMm : c.alongGrainMm
      if (other <= 0) {
        errors.push({
          corner: c.corner,
          message:
            'Ha az egyik kész él 0 (élvégig), a másik legyen rövidebb a teljesnél.'
        })
      }
      continue
    }
    if (c.alongGrainMm === 0 || c.alongCrossMm === 0) {
      errors.push({
        corner: c.corner,
        message:
          'Mindkét kész él legyen rövidebb a teljesnél, vagy az egyik legyen 0 (élvégig).'
      })
      continue
    }
    if (c.alongGrainMm > grainMm || c.alongCrossMm > crossMm) {
      errors.push({
        corner: c.corner,
        message: 'A kész él nem lehet hosszabb a teljes élnél.'
      })
    }
  }

  if (triangles.length > 0) return errors

  // Ugyanazon az élen két szomszédos sarok ne fedje át egymást
  const byId = new Map(corners.map((c) => [c.corner, c]))
  const top = [
    byId.get('TL')?.alongGrainMm,
    byId.get('TR')?.alongGrainMm
  ] as const
  if (
    top[0] != null &&
    top[1] != null &&
    top[0] + top[1] >= grainMm
  ) {
    errors.push({
      corner: 'TR',
      message:
        'A felső élen a bal felső vágás után már nincs hely a jobb felsőnek.'
    })
  }
  const bot = [
    byId.get('BL')?.alongGrainMm,
    byId.get('BR')?.alongGrainMm
  ] as const
  if (
    bot[0] != null &&
    bot[1] != null &&
    bot[0] + bot[1] >= grainMm
  ) {
    errors.push({
      corner: 'BR',
      message:
        'Az alsó élen a bal alsó vágás után már nincs hely a jobb alsónak.'
    })
  }
  const left = [
    byId.get('TL')?.alongCrossMm,
    byId.get('BL')?.alongCrossMm
  ] as const
  if (
    left[0] != null &&
    left[1] != null &&
    left[0] + left[1] >= crossMm
  ) {
    errors.push({
      corner: 'BL',
      message:
        'A bal élen a bal felső vágás után már nincs hely a bal alsónak.'
    })
  }
  const right = [
    byId.get('TR')?.alongCrossMm,
    byId.get('BR')?.alongCrossMm
  ] as const
  if (
    right[0] != null &&
    right[1] != null &&
    right[0] + right[1] >= crossMm
  ) {
    errors.push({
      corner: 'BR',
      message:
        'A jobb élen a jobb felső vágás után már nincs hely a jobb alsónak.'
    })
  }

  return errors
}

export type SzogStraightEdgeId = 'top' | 'bottom' | 'left' | 'right'

export type SzogFinishedEdgesMm = Record<SzogStraightEdgeId, number>

/** Egyenes kész élhosszak (mm) a bounding box oldalain. */
export function szogFinishedStraightEdgesMm(
  grainMm: number,
  crossMm: number,
  corners: SzogCornerCut[]
): SzogFinishedEdgesMm {
  const by = new Map(corners.map((c) => [c.corner, c]))
  const along = (id: SzogCornerId, axis: 'grain' | 'cross') => {
    const c = by.get(id)
    if (!c) return 0
    return axis === 'grain' ? c.alongGrainMm : c.alongCrossMm
  }
  return {
    top: Math.max(0, grainMm - along('TL', 'grain') - along('TR', 'grain')),
    bottom: Math.max(0, grainMm - along('BL', 'grain') - along('BR', 'grain')),
    left: Math.max(0, crossMm - along('TL', 'cross') - along('BL', 'cross')),
    right: Math.max(0, crossMm - along('TR', 'cross') - along('BR', 'cross'))
  }
}

export type SzogStraightEdgeSegment = {
  side: SzogStraightEdgeId
  a: Pt
  b: Pt
  mid: Pt
  lengthMm: number
}

/**
 * Kész egyenes él szakaszok a preview boxban (ferde nélkül).
 * Élzárás preview: csak ezekre megy színcsík, ha lengthMm > 0.
 */
export function szogStraightEdgeSegments(
  boxW: number,
  boxH: number,
  grainMm: number,
  crossMm: number,
  corners: SzogCornerCut[]
): SzogStraightEdgeSegment[] {
  const pts = szogvagasPolygonPoints(
    boxW,
    boxH,
    grainMm,
    crossMm,
    corners
  )
  if (pts.length < 2 || grainMm <= 0 || crossMm <= 0) return []
  const finished = szogFinishedStraightEdgesMm(grainMm, crossMm, corners)
  const eps = Math.max(1.2, Math.min(boxW, boxH) * 0.02)
  const out: SzogStraightEdgeSegment[] = []

  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!
    const b = pts[(i + 1) % pts.length]!
    let side: SzogStraightEdgeId | null = null
    if (Math.abs(a.y) <= eps && Math.abs(b.y) <= eps) side = 'top'
    else if (Math.abs(a.y - boxH) <= eps && Math.abs(b.y - boxH) <= eps)
      side = 'bottom'
    else if (Math.abs(a.x) <= eps && Math.abs(b.x) <= eps) side = 'left'
    else if (Math.abs(a.x - boxW) <= eps && Math.abs(b.x - boxW) <= eps)
      side = 'right'
    if (!side) continue // ferde — élzárás preview most nem
    const lengthMm = finished[side]
    if (lengthMm <= 0.5) continue
    out.push({
      side,
      a,
      b,
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      lengthMm
    })
  }
  return out
}

export function szogDiagonalLengthMm(cut: SzogCornerCut): number {
  return Math.hypot(cut.alongGrainMm, cut.alongCrossMm)
}

/** Összes ferde (vágott) él kész hossza mm — trapéz/háromszög: tipikusan 1. */
export function szogDiagonalFinishedMm(corners: SzogCornerCut[]): number {
  let sum = 0
  for (const c of corners) {
    if (c.alongGrainMm <= 0 && c.alongCrossMm <= 0) continue
    sum += szogDiagonalLengthMm(c)
  }
  return sum
}

export type SzogDiagonalAnnot = {
  corner: SzogCornerId
  lengthMm: number
  mid: Pt
  a: Pt
  b: Pt
}

/** Ferde vágások: szakasz + mm-címke (élzárás preview a ferdén). */
export function szogDiagonalAnnotations(
  boxW: number,
  boxH: number,
  grainMm: number,
  crossMm: number,
  corners: SzogCornerCut[]
): SzogDiagonalAnnot[] {
  const out: SzogDiagonalAnnot[] = []
  for (const c of corners) {
    if (c.alongGrainMm <= 0 && c.alongCrossMm <= 0) continue
    const { onGrain, onCross } = cutPoints(
      c.corner,
      c.alongGrainMm,
      c.alongCrossMm,
      boxW,
      boxH,
      grainMm,
      crossMm
    )
    out.push({
      corner: c.corner,
      lengthMm: Math.round(szogDiagonalLengthMm(c)),
      a: onGrain,
      b: onCross,
      mid: {
        x: (onGrain.x + onCross.x) / 2,
        y: (onGrain.y + onCross.y) / 2
      }
    })
  }
  return out
}

export function pointsToCssPolygon(points: Pt[]): string {
  if (points.length === 0) return ''
  return `polygon(${points.map((p) => `${p.x.toFixed(1)}px ${p.y.toFixed(1)}px`).join(', ')})`
}

function nearlySame(a: Pt, b: Pt, eps = 0.6): boolean {
  return Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps
}

function dedupeRing(points: Pt[]): Pt[] {
  if (points.length === 0) return points
  const out: Pt[] = []
  for (const p of points) {
    const last = out[out.length - 1]
    if (!last || !nearlySame(last, p)) out.push(p)
  }
  if (out.length > 1 && nearlySame(out[0]!, out[out.length - 1]!)) out.pop()
  return out
}

/** Sarok → két pont a találkozó éleken (bbox W×H, szál = vízszintes). */
function cutPoints(
  corner: SzogCornerId,
  alongGrainMm: number,
  alongCrossMm: number,
  boxW: number,
  boxH: number,
  grainMm: number,
  crossMm: number
): { onGrain: Pt; onCross: Pt } {
  const gx = boxW / grainMm
  const cy = boxH / crossMm
  // Teljes él (háromszög): pontosan a távoli csúcsig — ne clampelj 0.01-gyel.
  const g = Math.min(Math.max(0, alongGrainMm), grainMm)
  const c = Math.min(Math.max(0, alongCrossMm), crossMm)

  switch (corner) {
    case 'TL':
      return {
        onGrain: { x: g * gx, y: 0 },
        onCross: { x: 0, y: c * cy }
      }
    case 'TR':
      return {
        onGrain: { x: boxW - g * gx, y: 0 },
        onCross: { x: boxW, y: c * cy }
      }
    case 'BL':
      return {
        onGrain: { x: g * gx, y: boxH },
        onCross: { x: 0, y: boxH - c * cy }
      }
    case 'BR':
      return {
        onGrain: { x: boxW - g * gx, y: boxH },
        onCross: { x: boxW, y: boxH - c * cy }
      }
  }
}

/**
 * Megmaradó sokszög a bounding boxban.
 * Körbejárás: TL → TR → BR → BL, sarkoknál a vágott pontok beszúrva.
 */
export function szogvagasPolygonPoints(
  boxW: number,
  boxH: number,
  grainMm: number,
  crossMm: number,
  corners: SzogCornerCut[]
): Pt[] {
  if (grainMm <= 0 || crossMm <= 0 || boxW <= 0 || boxH <= 0) return []

  const active = corners.filter(
    (c) => c.alongGrainMm > 0 || c.alongCrossMm > 0
  )
  if (active.length === 0) {
    return [
      { x: 0, y: 0 },
      { x: boxW, y: 0 },
      { x: boxW, y: boxH },
      { x: 0, y: boxH }
    ]
  }

  const by = new Map(active.map((c) => [c.corner, c]))

  const pts: Pt[] = []

  // Top-left region
  {
    const cut = by.get('TL')
    if (cut) {
      const { onGrain, onCross } = cutPoints(
        'TL',
        cut.alongGrainMm,
        cut.alongCrossMm,
        boxW,
        boxH,
        grainMm,
        crossMm
      )
      pts.push(onCross, onGrain)
    } else {
      pts.push({ x: 0, y: 0 })
    }
  }

  // Top-right
  {
    const cut = by.get('TR')
    if (cut) {
      const { onGrain, onCross } = cutPoints(
        'TR',
        cut.alongGrainMm,
        cut.alongCrossMm,
        boxW,
        boxH,
        grainMm,
        crossMm
      )
      pts.push(onGrain, onCross)
    } else {
      pts.push({ x: boxW, y: 0 })
    }
  }

  // Bottom-right
  {
    const cut = by.get('BR')
    if (cut) {
      const { onGrain, onCross } = cutPoints(
        'BR',
        cut.alongGrainMm,
        cut.alongCrossMm,
        boxW,
        boxH,
        grainMm,
        crossMm
      )
      pts.push(onCross, onGrain)
    } else {
      pts.push({ x: boxW, y: boxH })
    }
  }

  // Bottom-left
  {
    const cut = by.get('BL')
    if (cut) {
      const { onGrain, onCross } = cutPoints(
        'BL',
        cut.alongGrainMm,
        cut.alongCrossMm,
        boxW,
        boxH,
        grainMm,
        crossMm
      )
      pts.push(onGrain, onCross)
    } else {
      pts.push({ x: 0, y: boxH })
    }
  }

  return dedupeRing(pts)
}

export function pointsToSvgPolygon(points: Pt[]): string {
  return points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
}

/** Ferde vágás szakaszok a preview vonalhoz. */
export function szogCutSegments(
  boxW: number,
  boxH: number,
  grainMm: number,
  crossMm: number,
  corners: SzogCornerCut[]
): Array<{ a: Pt; b: Pt }> {
  const segs: Array<{ a: Pt; b: Pt }> = []
  for (const c of corners) {
    if (c.alongGrainMm <= 0 && c.alongCrossMm <= 0) continue
    const { onGrain, onCross } = cutPoints(
      c.corner,
      c.alongGrainMm,
      c.alongCrossMm,
      boxW,
      boxH,
      grainMm,
      crossMm
    )
    segs.push({ a: onGrain, b: onCross })
  }
  return segs
}
