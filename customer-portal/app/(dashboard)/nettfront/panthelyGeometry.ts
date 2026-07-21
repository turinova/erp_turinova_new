/**
 * Engineering geometry for panthely (hinge hole) placement on a front panel.
 * Coordinate system: origin bottom-left, Y up (magasság), X right (szélesség).
 *
 * Rules (workshop):
 * - Only hosszú / rövid edge type (no left/right choice).
 * - Hole center is always 22.5 mm inward from the panel edge.
 * - First and last pant always 100 mm from the ends of the edge.
 * - 2+ pant: evenly spaced between those end positions (3 → midpoint, 4+ → equal gaps).
 */

import type { PanthelyConfig, PanthelyEl } from './fronttervezoTypes'

/** Hole center distance from the outer edge, into the panel (mm). */
export const PANTHELY_INSET_FROM_EDGE_MM = 22.5

/** Distance from both ends of the hinge edge for standard 2/3-hinge layouts (mm). */
export const PANTHELY_END_OFFSET_MM = 100

export type PanthelyEdgeKind = 'vertical' | 'horizontal'

export type PanthelyHolePoint = {
  index: number
  xMm: number
  yMm: number
  distMm: number
}

export function edgeLengthMm(heightMm: number, widthMm: number, oldal: 'hosszu' | 'rovid'): number {
  const longLen = Math.max(heightMm, widthMm)
  const shortLen = Math.min(heightMm, widthMm)

  return oldal === 'hosszu' ? longLen : shortLen
}

/** Whether the long edge is vertical (typical standing door: H >= W). */
export function isLongEdgeVertical(heightMm: number, widthMm: number): boolean {
  return heightMm >= widthMm
}

/**
 * Default edge for visualization (no Bal/Jobb UI):
 * - Standing (H>=W): hosszú → left vertical; rövid → bottom horizontal
 * - Landscape (W>H): hosszú → bottom horizontal; rövid → left vertical
 */
export function defaultEdgeKind(heightMm: number, widthMm: number, oldal: 'hosszu' | 'rovid'): PanthelyEdgeKind {
  const longVertical = isLongEdgeVertical(heightMm, widthMm)

  if (oldal === 'hosszu') {
    return longVertical ? 'vertical' : 'horizontal'
  }

  return longVertical ? 'horizontal' : 'vertical'
}

export function oldalLabel(oldal: 'hosszu' | 'rovid'): string {
  return oldal === 'hosszu' ? 'Hosszú oldal' : 'Rövid oldal'
}

export function distanceFieldShortHint(kind: PanthelyEdgeKind): string {
  return kind === 'vertical' ? 'alulról / felülről' : 'balról / jobbról'
}

/**
 * Distances along the edge from the start end (bottom for vertical, left for horizontal).
 * Always: first @ 100 mm, last @ edgeLen-100 mm; middle holes evenly spaced.
 */
export function standardDistancesAlongEdge(edgeLenMm: number, count: number): number[] {
  const end = PANTHELY_END_OFFSET_MM
  const n = Math.max(2, Math.floor(count))

  if (edgeLenMm <= 0) {
    return Array.from({ length: n }, (_, i) => end + i * end)
  }

  const first = end
  const last = edgeLenMm - end

  if (n === 2) {
    return [first, last]
  }

  const span = last - first

  return Array.from({ length: n }, (_, i) => Math.round(first + (span * i) / (n - 1)))
}

/** Hole centers in panel mm (origin bottom-left). Always inset 22.5 mm from the edge. */
export function computeHolePoints(
  heightMm: number,
  widthMm: number,
  config: Pick<PanthelyConfig, 'oldal' | 'el' | 'tavolsagokAlulMm'>
): PanthelyHolePoint[] {
  if (heightMm <= 0 || widthMm <= 0) return []

  const kind = defaultEdgeKind(heightMm, widthMm, config.oldal)
  const inset = PANTHELY_INSET_FROM_EDGE_MM
  const points: PanthelyHolePoint[] = []

  config.tavolsagokAlulMm.forEach((distMm, index) => {
    if (!Number.isFinite(distMm) || distMm < 0) return

    if (kind === 'vertical') {
      // Default: left long/short vertical edge
      points.push({ index, xMm: inset, yMm: distMm, distMm })
    } else {
      // Default: bottom horizontal edge
      points.push({ index, xMm: distMm, yMm: inset, distMm })
    }
  })

  return points
}

export type PanthelyValidationIssue = {
  type: 'size' | 'count' | 'edge'
  message: string
}

export function validatePanthelyLayout(
  heightMm: number,
  widthMm: number,
  oldal: 'hosszu' | 'rovid',
  count: number
): PanthelyValidationIssue[] {
  const issues: PanthelyValidationIssue[] = []

  if (heightMm <= 0 || widthMm <= 0) {
    issues.push({ type: 'size', message: 'Adja meg a front magasságát és szélességét (mm).' })

    return issues
  }

  if (!Number.isFinite(count) || count < 2) {
    issues.push({ type: 'count', message: 'Legalább 2 pánthely kell.' })

    return issues
  }

  if (count > 12) {
    issues.push({ type: 'count', message: 'Maximum 12 pánthely adható meg.' })

    return issues
  }

  const edgeLen = edgeLengthMm(heightMm, widthMm, oldal)
  const minLen = PANTHELY_END_OFFSET_MM * 2 + Math.max(0, count - 2) * 40

  if (edgeLen < minLen) {
    issues.push({
      type: 'edge',
      message: `A választott él túl rövid (${edgeLen} mm) ${count} pánthelyhez. Legalább ~${minLen} mm kell (végeken 10–10 cm + középső hely).`
    })
  }

  return issues
}

export function summarizePanthely(
  heightMm: number,
  widthMm: number,
  config: PanthelyConfig
): string {
  const edgeLen = edgeLengthMm(heightMm, widthMm, config.oldal)
  const kind = defaultEdgeKind(heightMm, widthMm, config.oldal)
  const n = config.mennyiseg

  const endsHint =
    kind === 'vertical' ? 'fentről és lentről' : 'mindkét végen'

  if (n === 2) {
    return `${n} pánthely a ${oldalLabel(config.oldal).toLowerCase()}n (${edgeLen} mm él): ${endsHint} ${PANTHELY_END_OFFSET_MM} mm.`
  }

  return `${n} pánthely a ${oldalLabel(config.oldal).toLowerCase()}n (${edgeLen} mm él): ${endsHint} ${PANTHELY_END_OFFSET_MM} mm, közbülsők egyenletesen.`
}

export function buildStandardPanthelyConfig(
  heightMm: number,
  widthMm: number,
  oldal: 'hosszu' | 'rovid',
  count: number
): PanthelyConfig {
  const edgeLen = edgeLengthMm(
    heightMm > 0 ? heightMm : 720,
    widthMm > 0 ? widthMm : 400,
    oldal
  )

  return {
    oldal,
    el: 'A',
    mennyiseg: Math.max(2, Math.floor(count)),
    tavolsagokAlulMm: standardDistancesAlongEdge(edgeLen, count)
  }
}

/** @deprecated kept for imports — use standardDistancesAlongEdge */
export function typicalTwoHingeDistances(edgeLenMm: number): number[] {
  return standardDistancesAlongEdge(edgeLenMm, 2)
}

/** @deprecated kept for imports — use standardDistancesAlongEdge */
export function typicalThreeHingeDistances(edgeLenMm: number): number[] {
  return standardDistancesAlongEdge(edgeLenMm, 3)
}

export function normalizePanthelyConfig(p: PanthelyConfig): PanthelyConfig {
  return {
    ...p,
    el: p.el ?? 'A'
  }
}

// Unused by UI but may be referenced — keep type export path clean
export type { PanthelyEl }
