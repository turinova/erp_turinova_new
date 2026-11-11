import {
  exactNetForGross,
  isNetFirstReachable,
  isValidVatForNet,
  normalizeVatPercent,
  roundHalfAwayFromZero
} from '@/lib/money/vat-split'

export type NetFirstInvoiceLine = {
  name: string
  quantity: number
  unit: string
  unitNet: number
  vatPercent: number
  lineNet: number
  lineVat: number
  lineGross: number
}

/** Számlatétel bruttó céllal; a nettó/ÁFA bontást a fit számolja. */
export type GrossTargetLine = {
  name: string
  quantity: number
  unit: string
  vatPercent: number
  gross: number
  /**
   * Ha a sort két tételre kell bontani: `quantity` = mennyiség megosztása,
   * `keep` = mindkét tétel megtartja a mennyiséget (pl. Előleg 1 db).
   */
  splitMode?: 'quantity' | 'keep'
}

export type FitNetFirstResult =
  | { ok: true; lines: NetFirstInvoiceLine[] }
  | { ok: false; message: string }

type WorkLine = GrossTargetLine & { g: number }

function sameSignNonZero(a: number, b: number): boolean {
  return b !== 0 && Math.sign(a) === Math.sign(b)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function nearestReachable(
  g: number,
  vatPercent: number,
  preferUp: boolean
): number {
  const order = preferUp ? [1, -1, 2, -2] : [-1, 1, -2, 2]
  for (const d of order) {
    const c = g + d
    if (sameSignNonZero(g, c) && isNetFirstReachable(c, vatPercent)) return c
  }
  return g
}

/** Közeli, Számlázz-szabályos bruttók (±1…±3 Ft). */
function reachableNeighbors(g: number, vatPercent: number): number[] {
  const out: number[] = []
  for (const d of [1, -1, 2, -2, 3, -3]) {
    const c = g + d
    if (sameSignNonZero(g, c) && isNetFirstReachable(c, vatPercent)) out.push(c)
  }
  return out
}

function canAbsorb(
  line: WorkLine,
  delta: number
): boolean {
  if (delta === 0) return true
  const next = line.g + delta
  return sameSignNonZero(line.g, next) && isNetFirstReachable(next, line.vatPercent)
}

/** m² / táblás anyag: ne felezzük (eltérő egységár); inkább másik sor. */
function isFragileSplitLine(line: WorkLine): boolean {
  if (line.splitMode === 'keep') return false
  const unit = line.unit.trim().toLowerCase()
  if (unit === 'm²' || unit === 'm2') return true
  const name = line.name.trim().toLowerCase()
  return name.startsWith('táblás anyag') || name.startsWith('tablas anyag')
}

function findReachablePair(
  total: number,
  vatPercent: number,
  hint: number
): [number, number] | null {
  for (let off = 0; off <= 40; off++) {
    for (const b of off === 0 ? [hint] : [hint + off, hint - off]) {
      const a = total - b
      if (!sameSignNonZero(total, a) || !sameSignNonZero(total, b)) continue
      if (isNetFirstReachable(a, vatPercent) && isNetFirstReachable(b, vatPercent)) {
        return [a, b]
      }
    }
  }
  return null
}

/** Egy tétel két, egyenként szabályos tételre bontása (bruttó összeg változatlan). */
function splitLine(line: WorkLine, target: number): WorkLine[] | null {
  const qty = line.quantity
  let qtyA = qty
  let qtyB = qty
  if (line.splitMode !== 'keep') {
    if (Number.isInteger(qty) && qty >= 2) {
      qtyA = qty - 1
      qtyB = 1
    } else if (qty >= 0.02) {
      qtyA = round2(qty / 2)
      qtyB = round2(qty - qtyA)
    }
  }
  const hint = Math.round((target * qtyB) / (qtyA + qtyB))
  const pair = findReachablePair(target, line.vatPercent, hint || Math.sign(target))
  if (!pair) return null
  return [
    { ...line, quantity: qtyA, g: pair[0] },
    { ...line, quantity: qtyB, g: pair[1] }
  ]
}

/**
 * Ha a maradék ±1…±3 Ft-ot senki sem nyelheti el egyben, próbáljuk
 * átbillenteni egy sort a másik irányba, hogy a maradék elnyelhető legyen.
 * (Pl. anyag 5383→5382 hagy +1-et, amit a szabás 3115→3116 nem tud:
 *  anyag 5384 + szabás 3114 viszont stimmel.)
 */
function rebalanceResidual(work: WorkLine[], residual: number): number {
  if (residual === 0) return 0

  for (let i = 0; i < work.length; i++) {
    const line = work[i]!
    for (const next of reachableNeighbors(line.g, line.vatPercent)) {
      const delta = next - line.g
      const newResidual = residual - delta
      if (newResidual === 0) {
        line.g = next
        return 0
      }
      const other = work.find(
        (o, j) => j !== i && canAbsorb(o, newResidual)
      )
      if (other) {
        line.g = next
        other.g += newResidual
        return 0
      }
    }
  }
  return residual
}

/**
 * Bruttó célokból Számlázz-szabályos tételek, Σ bruttó = `dueGross` fillérre.
 * - Ha egy bruttó nettó-első módon nem érhető el, ±1 Ft-ot másik tétel vesz át.
 * - Ha a mohó irány beragad (pl. anyag −1, szabás +1 nem elérhető), átbillentés.
 * - Táblás anyag m²-t ne felezzük (eltérő egységár) — inkább másik sor / átbillentés.
 * - Végső esetben egy tétel két tételre bomlik (pl. egysoros előleg).
 * - `tolerance` feletti eltérés valódi adathiba → hiba, nem csendes fallback.
 */
export function fitNetFirstLines(
  targets: GrossTargetLine[],
  dueGrossRaw: number,
  opts: { tolerance?: number } = {}
): FitNetFirstResult {
  const tolerance = opts.tolerance ?? 0
  const dueGross = roundHalfAwayFromZero(dueGrossRaw)

  let work: WorkLine[] = targets
    .map((t) => ({ ...t, g: roundHalfAwayFromZero(t.gross) }))
    .filter((t) => t.g !== 0)

  if (work.length === 0) {
    return dueGross === 0
      ? { ok: true, lines: [] }
      : { ok: false, message: 'Nincs számlázható tétel.' }
  }

  const sumTargets = work.reduce((s, l) => s + l.g, 0)
  if (Math.abs(dueGross - sumTargets) > tolerance) {
    return {
      ok: false,
      message: `A számlatételek összege (${sumTargets} Ft) nem egyezik a végösszeggel (${dueGross} Ft).`
    }
  }

  let residual = dueGross - sumTargets
  for (const line of work) {
    if (isNetFirstReachable(line.g, line.vatPercent)) continue
    const next = nearestReachable(line.g, line.vatPercent, residual > 0)
    residual -= next - line.g
    line.g = next
  }

  const byWeight = () =>
    work
      .map((l, i) => ({ l, i }))
      .sort((a, b) => Math.abs(b.l.g) - Math.abs(a.l.g))

  for (let guard = 0; residual !== 0 && guard < 10; guard++) {
    const whole = byWeight().find(
      ({ l }) =>
        sameSignNonZero(l.g, l.g + residual) &&
        isNetFirstReachable(l.g + residual, l.vatPercent)
    )
    if (whole) {
      whole.l.g += residual
      residual = 0
      break
    }
    const step = Math.sign(residual)
    // ±1 Ft: előbb nem-törékeny sor (szabás / díj), ne az anyag m².
    const ranked = byWeight().sort((a, b) => {
      const fa = isFragileSplitLine(a.l) ? 1 : 0
      const fb = isFragileSplitLine(b.l) ? 1 : 0
      if (fa !== fb) return fa - fb
      return Math.abs(b.l.g) - Math.abs(a.l.g)
    })
    const one = ranked.find(
      ({ l }) =>
        sameSignNonZero(l.g, l.g + step) &&
        isNetFirstReachable(l.g + step, l.vatPercent)
    )
    if (!one) break
    one.l.g += step
    residual -= step
  }

  if (residual !== 0) {
    residual = rebalanceResidual(work, residual)
  }

  if (residual !== 0) {
    // Bontás: előbb szabás/díj, ne táblás anyag m² (eltérő egységár).
    const splitCandidates = byWeight().sort((a, b) => {
      const fa = isFragileSplitLine(a.l) ? 1 : 0
      const fb = isFragileSplitLine(b.l) ? 1 : 0
      if (fa !== fb) return fa - fb
      return Math.abs(b.l.g) - Math.abs(a.l.g)
    })
    let splitAt: { l: WorkLine; i: number } | null = null
    let parts: WorkLine[] | null = null
    for (const cand of splitCandidates) {
      parts = splitLine(cand.l, cand.l.g + residual)
      if (parts) {
        splitAt = cand
        break
      }
    }
    if (!splitAt || !parts) {
      return {
        ok: false,
        message: 'A számlatételek ÁFA bontása nem állítható elő pontosan.'
      }
    }
    work = [
      ...work.slice(0, splitAt.i),
      ...parts,
      ...work.slice(splitAt.i + 1)
    ]
    residual = 0
  }

  const lines: NetFirstInvoiceLine[] = []
  for (const line of work) {
    const net = exactNetForGross(line.g, line.vatPercent)
    if (net == null) {
      return {
        ok: false,
        message: `A(z) „${line.name}” tétel ÁFA bontása nem állítható elő pontosan.`
      }
    }
    const qty = line.quantity > 0 ? line.quantity : 1
    lines.push({
      name: line.name,
      quantity: qty,
      unit: line.unit,
      unitNet: net / qty,
      vatPercent: line.vatPercent,
      lineNet: net,
      lineVat: line.g - net,
      lineGross: line.g
    })
  }

  const check = assertNetFirstLines(lines, dueGross)
  if (!check.ok) return check
  return { ok: true, lines }
}

/** Kapuőr: minden tétel Számlázz-szabályos és Σ bruttó = fizetendő. */
export function assertNetFirstLines(
  lines: NetFirstInvoiceLine[],
  dueGross?: number
): { ok: true } | { ok: false; message: string } {
  let sum = 0
  for (const l of lines) {
    if (
      l.lineNet + l.lineVat !== l.lineGross ||
      !isValidVatForNet(l.lineNet, l.lineVat, l.vatPercent)
    ) {
      return {
        ok: false,
        message: `A(z) „${l.name}” tétel ÁFA értéke nem felel meg a Számlázz.hu szabályának (nettó × kulcs / 100).`
      }
    }
    sum += l.lineGross
  }
  if (dueGross != null && sum !== roundHalfAwayFromZero(dueGross)) {
    return {
      ok: false,
      message: `A számlatételek összege (${sum} Ft) nem egyezik a fizetendővel (${dueGross} Ft).`
    }
  }
  return { ok: true }
}

/** Előleg / részösszegű díjbekérő: 1 tétel, vagy 2 azonos nevű tétel, ha kell. */
export function buildAdvanceLines(
  amountGross: number,
  label: string,
  vatPercent = 27
): FitNetFirstResult {
  return fitNetFirstLines(
    [
      {
        name: label,
        quantity: 1,
        unit: 'db',
        vatPercent,
        gross: amountGross,
        splitMode: 'keep'
      }
    ],
    amountGross
  )
}

/** Eladás (POS / sales) tételei: sor bruttó = forrásigazság, nettó-első bontás. */
export function mapSaleItemsNetFirst(
  items: Array<{
    name_snapshot: string
    quantity: number
    unit_shortform: string | null
    tax_rate_percent: number | null
    total_gross: number
  }>
): NetFirstInvoiceLine[] {
  const targets: GrossTargetLine[] = items.map((i) => ({
    name: i.name_snapshot,
    quantity: Number(i.quantity) || 1,
    unit: i.unit_shortform || 'db',
    vatPercent: normalizeVatPercent(i.tax_rate_percent),
    gross: Number(i.total_gross) || 0
  }))
  const due = targets.reduce((s, t) => s + roundHalfAwayFromZero(t.gross), 0)
  const fitted = fitNetFirstLines(targets, due)
  if (!fitted.ok) throw new Error(fitted.message)
  return fitted.lines
}

/** Domináns ÁFA kulcs (legnagyobb bruttó) — előleghez. */
export function dominantVatPercent(
  lines: Array<{ vatPercent: number; lineGross: number }>,
  fallback = 27
): number {
  const byRate = new Map<number, number>()
  for (const l of lines) {
    byRate.set(l.vatPercent, (byRate.get(l.vatPercent) ?? 0) + Math.abs(l.lineGross))
  }
  let best = fallback
  let bestGross = -1
  for (const [rate, gross] of byRate) {
    if (gross > bestGross) {
      best = rate
      bestGross = gross
    }
  }
  return best
}
