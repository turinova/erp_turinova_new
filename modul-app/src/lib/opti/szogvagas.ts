/**
 * Szögvágás = sarok levágása (megmunkálás).
 * Opti nesting továbbra is téglalap (grain × cross).
 *
 * Preview koordináta: origó bal-felső, x = kereszt (szélesség), y = szál (magasság).
 * Élek: A=felső, B=jobb, C=alsó, D=bal.
 */

export type SzogCornerId = 'tl' | 'tr' | 'bl' | 'br'

export type SzogCornerCut = {
  corner: SzogCornerId
  /** Megmaradó hossz az egyik élen (mm) — lásd edgePair. */
  remainEdge1Mm: number
  /** Megmaradó hossz a másik élen (mm). */
  remainEdge2Mm: number
}

export type SzogPoint = { x: number; y: number }

export const SZOG_CORNERS: Array<{
  id: SzogCornerId
  label: string
  /** edge1, edge2 labels for the two remain fields */
  edge1Label: string
  edge2Label: string
}> = [
  {
    id: 'tl',
    label: 'Bal felső',
    edge1Label: 'Felső élen ennyi marad',
    edge2Label: 'Bal élen ennyi marad'
  },
  {
    id: 'tr',
    label: 'Jobb felső',
    edge1Label: 'Felső élen ennyi marad',
    edge2Label: 'Jobb élen ennyi marad'
  },
  {
    id: 'bl',
    label: 'Bal alsó',
    edge1Label: 'Alsó élen ennyi marad',
    edge2Label: 'Bal élen ennyi marad'
  },
  {
    id: 'br',
    label: 'Jobb alsó',
    edge1Label: 'Alsó élen ennyi marad',
    edge2Label: 'Jobb élen ennyi marad'
  }
]

export function szogCornerMeta(id: SzogCornerId) {
  return SZOG_CORNERS.find((c) => c.id === id)!
}

/** Hány oldalú lesz a lap: 4 + sarok db. */
export function szogPolygonSideCount(cornerCount: number): number {
  return 4 + Math.max(0, cornerCount)
}

export function szogShapeWord(cornerCount: number): string {
  const n = szogPolygonSideCount(cornerCount)
  if (n <= 4) return 'téglalap'
  if (n === 5) return 'ötszög'
  if (n === 6) return 'hatszög'
  if (n === 7) return 'hétszög'
  return 'nyolcszög'
}

export function szogLabel(cuts: SzogCornerCut[]): string {
  const n = cuts.length
  if (n <= 0) return 'Szög'
  if (n === 1) {
    return `Szög · ${szogCornerMeta(cuts[0]!.corner).label}`
  }
  return `Szög ×${n}`
}

export type SzogValidation =
  | { ok: true; cuts: SzogCornerCut[] }
  | { ok: false; message: string; field?: string }

function isCornerId(v: unknown): v is SzogCornerId {
  return v === 'tl' || v === 'tr' || v === 'bl' || v === 'br'
}

export function normalizeSzogCuts(raw: unknown): SzogCornerCut[] {
  if (!Array.isArray(raw)) return []
  const out: SzogCornerCut[] = []
  const seen = new Set<SzogCornerId>()
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    if (!isCornerId(r.corner)) continue
    if (seen.has(r.corner)) continue
    const e1 = Number(r.remainEdge1Mm)
    const e2 = Number(r.remainEdge2Mm)
    if (!Number.isFinite(e1) || !Number.isFinite(e2)) continue
    seen.add(r.corner)
    out.push({
      corner: r.corner,
      remainEdge1Mm: Math.round(e1),
      remainEdge2Mm: Math.round(e2)
    })
  }
  return out
}

/**
 * Validálja a sarokvágásokat a téglalap méreteire.
 * grainMm = függőleges (szál), crossMm = vízszintes (kereszt).
 */
export function validateSzogCuts(
  grainMm: number,
  crossMm: number,
  cuts: SzogCornerCut[]
): SzogValidation {
  if (cuts.length === 0) {
    return { ok: false, message: 'Jelölj meg legalább egy sarkot.' }
  }
  if (!(grainMm > 0 && crossMm > 0)) {
    return { ok: false, message: 'Előbb add meg a téglalap méretét.' }
  }

  const byCorner = new Map<SzogCornerId, SzogCornerCut>()
  for (const c of cuts) {
    if (byCorner.has(c.corner)) {
      return { ok: false, message: 'Ugyanaz a sarok kétszer szerepel.' }
    }
    byCorner.set(c.corner, c)
  }

  for (const c of cuts) {
    const meta = szogCornerMeta(c.corner)
    if (!(c.remainEdge1Mm > 0) || !(c.remainEdge2Mm > 0)) {
      return {
        ok: false,
        message: `${meta.label}: mindkét élhossz legyen nagyobb 0-nál.`,
        field: c.corner
      }
    }
    // edge1 always on top/bottom (cross direction length), edge2 on left/right (grain)
    if (c.remainEdge1Mm >= crossMm) {
      return {
        ok: false,
        message: `${meta.label}: ${meta.edge1Label.replace(' ennyi marad', '')} legyen kisebb, mint ${crossMm} mm.`,
        field: c.corner
      }
    }
    if (c.remainEdge2Mm >= grainMm) {
      return {
        ok: false,
        message: `${meta.label}: ${meta.edge2Label.replace(' ennyi marad', '')} legyen kisebb, mint ${grainMm} mm.`,
        field: c.corner
      }
    }
  }

  // Same horizontal edge: top (tl+tr) or bottom (bl+br)
  const top = [byCorner.get('tl'), byCorner.get('tr')].filter(Boolean) as SzogCornerCut[]
  if (top.length === 2) {
    const sum = top[0]!.remainEdge1Mm + top[1]!.remainEdge1Mm
    if (sum >= crossMm) {
      return {
        ok: false,
        message: `A felső élen a két sarok együtt túl hosszú (${sum} ≥ ${crossMm} mm).`
      }
    }
  }
  const bot = [byCorner.get('bl'), byCorner.get('br')].filter(Boolean) as SzogCornerCut[]
  if (bot.length === 2) {
    const sum = bot[0]!.remainEdge1Mm + bot[1]!.remainEdge1Mm
    if (sum >= crossMm) {
      return {
        ok: false,
        message: `Az alsó élen a két sarok együtt túl hosszú (${sum} ≥ ${crossMm} mm).`
      }
    }
  }
  // Same vertical edge: left (tl+bl) or right (tr+br) — edge2
  const left = [byCorner.get('tl'), byCorner.get('bl')].filter(Boolean) as SzogCornerCut[]
  if (left.length === 2) {
    const sum = left[0]!.remainEdge2Mm + left[1]!.remainEdge2Mm
    if (sum >= grainMm) {
      return {
        ok: false,
        message: `A bal élen a két sarok együtt túl hosszú (${sum} ≥ ${grainMm} mm).`
      }
    }
  }
  const right = [byCorner.get('tr'), byCorner.get('br')].filter(Boolean) as SzogCornerCut[]
  if (right.length === 2) {
    const sum = right[0]!.remainEdge2Mm + right[1]!.remainEdge2Mm
    if (sum >= grainMm) {
      return {
        ok: false,
        message: `A jobb élen a két sarok együtt túl hosszú (${sum} ≥ ${grainMm} mm).`
      }
    }
  }

  return { ok: true, cuts: [...byCorner.values()] }
}

/**
 * Sokszög csúcsok (mm), kerület mentén (felső bal → …).
 * W = crossMm, H = grainMm.
 * remainEdge1 = vízszintes élen megmaradó hossz (a saroktól távolabbi vég felől),
 * remainEdge2 = függőleges élen megmaradó hossz (a saroktól távolabbi vég felől).
 */
export function szogPolygonPoints(
  grainMm: number,
  crossMm: number,
  cuts: SzogCornerCut[]
): SzogPoint[] {
  const W = crossMm
  const H = grainMm
  const map = new Map(cuts.map((c) => [c.corner, c]))
  const pts: SzogPoint[] = []

  // Top-left
  if (map.has('tl')) {
    const c = map.get('tl')!
    pts.push({ x: 0, y: H - c.remainEdge2Mm })
    pts.push({ x: W - c.remainEdge1Mm, y: 0 })
  } else {
    pts.push({ x: 0, y: 0 })
  }

  // Top-right
  if (map.has('tr')) {
    const c = map.get('tr')!
    pts.push({ x: c.remainEdge1Mm, y: 0 })
    pts.push({ x: W, y: H - c.remainEdge2Mm })
  } else {
    pts.push({ x: W, y: 0 })
  }

  // Bottom-right — bottom remain from left; right remain from top
  if (map.has('br')) {
    const c = map.get('br')!
    pts.push({ x: W, y: c.remainEdge2Mm })
    pts.push({ x: c.remainEdge1Mm, y: H })
  } else {
    pts.push({ x: W, y: H })
  }

  // Bottom-left — bottom remain from right; left remain from top
  if (map.has('bl')) {
    const c = map.get('bl')!
    pts.push({ x: W - c.remainEdge1Mm, y: H })
    pts.push({ x: 0, y: c.remainEdge2Mm })
  } else {
    pts.push({ x: 0, y: H })
  }

  return pts
}

export function szogPolygonSvgPath(
  grainMm: number,
  crossMm: number,
  cuts: SzogCornerCut[],
  widthPx: number,
  heightPx: number
): string {
  const pts = szogPolygonPoints(grainMm, crossMm, cuts)
  if (pts.length === 0 || crossMm <= 0 || grainMm <= 0) return ''
  const sx = widthPx / crossMm
  const sy = heightPx / grainMm
  return pts
    .map((p, i) => {
      const x = p.x * sx
      const y = p.y * sy
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ') + ' Z'
}
