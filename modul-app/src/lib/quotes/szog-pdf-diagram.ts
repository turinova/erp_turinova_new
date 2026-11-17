/**
 * PDF szögvágás vizuál — nest + kész alak, kész él mm, élzáró NÉV, szálsávok.
 */

import {
  rebuildSzogCornersFromShape,
  szogDiagonalAnnotations,
  szogFinishedStraightEdgesMm,
  szogStraightEdgeSegments,
  szogvagasPolygonPoints,
  type SzogShapeKind,
  type SzogStraightEdgeId,
  type SzogTrapAxis
} from '@/lib/opti/szogvagas-preview'

export type SzogPdfDiagramInput = {
  /** Egyedi clipPath id-hez (több panel / oldal). */
  id?: string
  grainMm: number
  crossMm: number
  /** Csak true esetén szálsáv + „Szál →” (anyag grain_direction). */
  showGrain?: boolean
  szogKind: SzogShapeKind
  szogTrapShortMm: number | null
  szogTrapAxis: SzogTrapAxis | null
  /** Emberi élzáró név (nem gépkód). */
  edgeALabel: string | null
  edgeBLabel: string | null
  edgeCLabel: string | null
  edgeDLabel: string | null
  edgeFerdeLabel: string | null
}

type Pt = { x: number; y: number }

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function labelForSide(
  side: SzogStraightEdgeId,
  input: SzogPdfDiagramInput
): string | null {
  switch (side) {
    case 'top':
      return input.edgeALabel
    case 'right':
      return input.edgeBLabel
    case 'bottom':
      return input.edgeCLabel
    case 'left':
      return input.edgeDLabel
  }
}

/** Egységvektor a nest közepétől kifelé a mid ponton keresztül. */
function outwardNormal(mid: Pt, boxW: number, boxH: number): Pt {
  const cx = boxW / 2
  const cy = boxH / 2
  const dx = mid.x - cx
  const dy = mid.y - cy
  const len = Math.hypot(dx, dy) || 1
  return { x: dx / len, y: dy / len }
}

function labelPill(
  x: number,
  y: number,
  lines: string[],
  opts?: { bold?: boolean; muted?: boolean }
): string {
  const fontSize = 9.5
  const lineH = 11
  const padX = 4
  const padY = 3
  const maxW = Math.max(...lines.map((l) => l.length * 5.2), 24)
  const w = maxW + padX * 2
  const h = lines.length * lineH + padY * 2
  const left = x - w / 2
  const top = y - h / 2
  const fill = '#ffffff'
  const stroke = '#e2e8f0'
  const color = opts?.muted ? '#64748b' : '#18181B'
  const weight = opts?.bold ? '700' : '500'
  const texts = lines
    .map(
      (line, i) =>
        `<text x="${x.toFixed(1)}" y="${(top + padY + lineH * (i + 0.75)).toFixed(1)}" text-anchor="middle" font-size="${fontSize}" font-weight="${weight}" fill="${color}">${escapeXml(line)}</text>`
    )
    .join('')
  return `<rect x="${left.toFixed(1)}" y="${top.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="0.5"/>${texts}`
}

/** Kompakt SVG string egy panelhez (PDF HTML-be). */
export function buildSzogPdfDiagramSvg(
  input: SzogPdfDiagramInput,
  opts?: { width?: number; height?: number }
): string {
  const boxW = opts?.width ?? 200
  const boxH = opts?.height ?? 150
  const g = input.grainMm
  const c = input.crossMm
  if (g <= 0 || c <= 0) return ''

  const axis = input.szogTrapAxis ?? 'grain'
  const short =
    input.szogKind === 'triangle'
      ? 0
      : Number(input.szogTrapShortMm) > 0
        ? Number(input.szogTrapShortMm)
        : Math.round(g * 0.7)

  const corners = rebuildSzogCornersFromShape(
    input.szogKind,
    g,
    c,
    short,
    axis
  )
  const pts = szogvagasPolygonPoints(boxW, boxH, g, c, corners)
  const finished = szogFinishedStraightEdgesMm(g, c, corners)
  const straight = szogStraightEdgeSegments(boxW, boxH, g, c, corners)
  const diags = szogDiagonalAnnotations(boxW, boxH, g, c, corners)

  // Nagy padding — címkék + pill ne vágódjanak
  const padL = 56
  const padR = 56
  const padT = 40
  const padB = 36
  const svgW = boxW + padL + padR
  const svgH = boxH + padT + padB
  const ox = padL
  const oy = padT
  const clipId = `szog-clip-${(input.id || 'p').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24)}-${Math.round(g)}-${Math.round(c)}`

  const polyPts = pts
    .map((p) => `${(p.x + ox).toFixed(1)},${(p.y + oy).toFixed(1)}`)
    .join(' ')

  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">`,
    `<defs><clipPath id="${clipId}"><polygon points="${polyPts}"/></clipPath></defs>`,
    // Levágott / nest háttér
    `<rect x="${ox}" y="${oy}" width="${boxW}" height="${boxH}" fill="#f1f5f9" stroke="none"/>`,
    // Nest bbox
    `<rect x="${ox}" y="${oy}" width="${boxW}" height="${boxH}" fill="none" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4 3"/>`
  ]

  // Kész alak
  if (polyPts) {
    parts.push(
      `<polygon points="${polyPts}" fill="#e8eaed" stroke="#18181B" stroke-width="1.25"/>`
    )
    if (input.showGrain) {
      const grainLines: string[] = []
      for (let i = 1; i <= 7; i++) {
        const y = oy + (boxH * i) / 8
        grainLines.push(
          `<line x1="${ox + 4}" y1="${y.toFixed(1)}" x2="${ox + boxW - 4}" y2="${y.toFixed(1)}" stroke="#ffffff" stroke-width="1.2" opacity="0.85"/>`
        )
      }
      parts.push(
        `<g clip-path="url(#${clipId})">${grainLines.join('')}</g>`
      )
    }
  }

  // Élzárt egyenes — vastag
  for (const seg of straight) {
    if (!labelForSide(seg.side, input)) continue
    parts.push(
      `<line x1="${(seg.a.x + ox).toFixed(1)}" y1="${(seg.a.y + oy).toFixed(1)}" x2="${(seg.b.x + ox).toFixed(1)}" y2="${(seg.b.y + oy).toFixed(1)}" stroke="#18181B" stroke-width="4.5" stroke-linecap="butt"/>`
    )
  }
  if (input.edgeFerdeLabel) {
    for (const d of diags) {
      parts.push(
        `<line x1="${(d.a.x + ox).toFixed(1)}" y1="${(d.a.y + oy).toFixed(1)}" x2="${(d.b.x + ox).toFixed(1)}" y2="${(d.b.y + oy).toFixed(1)}" stroke="#18181B" stroke-width="4.5" stroke-linecap="butt"/>`
      )
    }
  }
  // Vékony kontúr újra
  if (polyPts) {
    parts.push(
      `<polygon points="${polyPts}" fill="none" stroke="#18181B" stroke-width="1"/>`
    )
  }

  const LABEL_OUT = 22

  // Kész egyenes él címkék — csak mm (élzáró név a fejlécben)
  for (const seg of straight) {
    const mm = Math.round(finished[seg.side] || seg.lengthMm)
    if (mm <= 0) continue
    const n = outwardNormal(seg.mid, boxW, boxH)
    const lx = seg.mid.x + ox + n.x * LABEL_OUT
    const ly = seg.mid.y + oy + n.y * LABEL_OUT
    parts.push(labelPill(lx, ly, [`${mm} mm`]))
  }

  // Ferde — csak mm
  const FERDE_OUT = 28
  for (const d of diags) {
    const n = outwardNormal(d.mid, boxW, boxH)
    const lx = d.mid.x + ox + n.x * FERDE_OUT
    const ly = d.mid.y + oy + n.y * FERDE_OUT
    parts.push(labelPill(lx, ly, [`${d.lengthMm} mm`]))
  }

  if (input.showGrain) {
    parts.push(
      `<text x="${ox + boxW / 2}" y="${oy + boxH - 5}" text-anchor="middle" font-size="10" font-weight="700" fill="#334155">Szál →</text>`
    )
  }

  parts.push(`</svg>`)
  return parts.filter(Boolean).join('')
}

export type SzogPdfEdgeGroup = {
  label: string
  sides: string[]
}

/** Élzáró anyag szerint csoportosítva (ismétlés nélkül). */
export function buildSzogPdfEdgeGroups(
  input: SzogPdfDiagramInput
): SzogPdfEdgeGroup[] {
  const entries: Array<{ side: string; label: string }> = []
  if (input.edgeALabel?.trim())
    entries.push({ side: 'Felső', label: input.edgeALabel.trim() })
  if (input.edgeCLabel?.trim())
    entries.push({ side: 'Alsó', label: input.edgeCLabel.trim() })
  if (input.edgeDLabel?.trim())
    entries.push({ side: 'Bal', label: input.edgeDLabel.trim() })
  if (input.edgeBLabel?.trim())
    entries.push({ side: 'Jobb', label: input.edgeBLabel.trim() })
  if (input.edgeFerdeLabel?.trim())
    entries.push({ side: 'Ferde', label: input.edgeFerdeLabel.trim() })

  const order: string[] = []
  const map = new Map<string, string[]>()
  for (const e of entries) {
    const list = map.get(e.label)
    if (list) list.push(e.side)
    else {
      order.push(e.label)
      map.set(e.label, [e.side])
    }
  }
  return order.map((label) => ({ label, sides: map.get(label)! }))
}

/** Egy soros összefoglaló (pl. régi hívók). */
export function buildSzogPdfEdgeLegend(input: SzogPdfDiagramInput): string {
  return buildSzogPdfEdgeGroups(input)
    .map((g) => `${g.label} — ${g.sides.join(', ')}`)
    .join(' · ')
}
