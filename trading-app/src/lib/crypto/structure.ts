import type { Bar } from "../backtest/types"

/**
 * Struktúra-segédek: equal high/low, FVG, session range.
 * Csak OHLCV kell — CVD/orderbook nélkül is használható.
 */

export interface PriceLevel {
  name: string
  level: number
  dir: "long" | "short"
}

export interface FairValueGap {
  dir: "long" | "short"
  /** gap alsó széle */
  bottom: number
  /** gap felső széle */
  top: number
  /** a gapet létrehozó középső/harmadik gyertya ideje */
  formedAt: number
}

export interface SessionRangeSpec {
  id: "asia" | "london" | "us"
  label: string
  /** range formálódás [startMin, endMin) UTC perc a napból */
  rangeStartMin: number
  rangeEndMin: number
  /** breakout ablak vége (UTC perc) */
  windowEndMin: number
}

/** Asia 00–07, London 07–08, US 13:00–13:30 — ICT-szerű killzone-ok. */
export const SESSION_SPECS: SessionRangeSpec[] = [
  {
    id: "us",
    label: "US-open",
    rangeStartMin: 13 * 60,
    rangeEndMin: 13 * 60 + 30,
    windowEndMin: 17 * 60,
  },
  {
    id: "london",
    label: "London",
    rangeStartMin: 7 * 60,
    rangeEndMin: 8 * 60,
    windowEndMin: 13 * 60,
  },
  {
    id: "asia",
    label: "Asia",
    rangeStartMin: 0,
    rangeEndMin: 7 * 60,
    windowEndMin: 13 * 60,
  },
]

/**
 * Equal highs / lows az utolsó `lookback` 5m-es swingből.
 * Két swing max `tolAtr`×ATR-en belül = liquidity pool.
 */
export function findEqualLevels(
  bars5m: Bar[],
  atr: number,
  opts?: { lookback?: number; swing?: number; tolAtr?: number }
): PriceLevel[] {
  const lookback = opts?.lookback ?? 48
  const swing = opts?.swing ?? 2
  const tol = (opts?.tolAtr ?? 0.15) * atr
  if (atr <= 0 || bars5m.length < swing * 2 + 3) return []

  const slice = bars5m.slice(-lookback)
  const swingHighs: number[] = []
  const swingLows: number[] = []

  for (let i = swing; i < slice.length - swing; i++) {
    const h = slice[i].h
    const l = slice[i].l
    let isHigh = true
    let isLow = true
    for (let k = 1; k <= swing; k++) {
      if (slice[i - k].h >= h || slice[i + k].h >= h) isHigh = false
      if (slice[i - k].l <= l || slice[i + k].l <= l) isLow = false
    }
    if (isHigh) swingHighs.push(h)
    if (isLow) swingLows.push(l)
  }

  const out: PriceLevel[] = []
  const eqHigh = findEqualPair(swingHighs, tol, "max")
  if (eqHigh != null) out.push({ name: "equal high", level: eqHigh, dir: "short" })
  const eqLow = findEqualPair(swingLows, tol, "min")
  if (eqLow != null) out.push({ name: "equal low", level: eqLow, dir: "long" })
  return out
}

function findEqualPair(
  swings: number[],
  tol: number,
  pick: "max" | "min"
): number | null {
  let best: number | null = null
  for (let i = 0; i < swings.length; i++) {
    for (let j = i + 1; j < swings.length; j++) {
      if (Math.abs(swings[i] - swings[j]) <= tol) {
        const lvl = pick === "max" ? Math.max(swings[i], swings[j]) : Math.min(swings[i], swings[j])
        if (best == null || (pick === "max" ? lvl > best : lvl < best)) best = lvl
      }
    }
  }
  return best
}

/** Aktív (még nem teljesen kitöltött) FVG-k az utolsó N 5m gyertyán. */
export function findActiveFvgs(bars5m: Bar[], limit = 12): FairValueGap[] {
  const out: FairValueGap[] = []
  if (bars5m.length < 3) return out

  const start = Math.max(2, bars5m.length - 40)
  for (let i = start; i < bars5m.length; i++) {
    const a = bars5m[i - 2]
    const c = bars5m[i]
    // bullish FVG: gap fel — a.high < c.low
    if (a.h < c.l) {
      const gap: FairValueGap = { dir: "long", bottom: a.h, top: c.l, formedAt: c.t }
      if (!isFvgFilled(bars5m, i + 1, gap)) {
        out.push(gap)
        if (out.length >= limit) break
      }
    }
    // bearish FVG: gap le — a.low > c.high
    if (a.l > c.h) {
      const gap: FairValueGap = { dir: "short", bottom: c.h, top: a.l, formedAt: c.t }
      if (!isFvgFilled(bars5m, i + 1, gap)) {
        out.push(gap)
        if (out.length >= limit) break
      }
    }
  }
  return out
}

function isFvgFilled(bars: Bar[], fromIdx: number, gap: FairValueGap): boolean {
  for (let i = fromIdx; i < bars.length; i++) {
    const b = bars[i]
    if (gap.dir === "long" && b.l <= gap.bottom) return true
    if (gap.dir === "short" && b.h >= gap.top) return true
  }
  return false
}

export function sessionRange(
  bars: Bar[],
  todayStart: number,
  spec: SessionRangeSpec
): { high: number; low: number; complete: boolean } | null {
  const utcMin = (t: number) => Math.floor((t - todayStart) / 60)
  const rangeBars = bars.filter(
    (b) =>
      b.t >= todayStart &&
      utcMin(b.t) >= spec.rangeStartMin &&
      utcMin(b.t) < spec.rangeEndMin
  )
  const expected = Math.max(10, Math.floor((spec.rangeEndMin - spec.rangeStartMin) * 0.7))
  if (rangeBars.length < expected) return { high: 0, low: 0, complete: false }
  return {
    high: Math.max(...rangeBars.map((b) => b.h)),
    low: Math.min(...rangeBars.map((b) => b.l)),
    complete: true,
  }
}

/** Reclaim-gyertya volumen vs. előző N átlag — absorption proxy. */
export function volumeConfluence(
  bars: Bar[],
  reclaimBar: Bar,
  lookback = 20,
  minMult = 1.2
): { ok: boolean; mult: number } {
  const idx = bars.findIndex((b) => b.t === reclaimBar.t)
  if (idx < 1) return { ok: false, mult: 0 }
  const window = bars.slice(Math.max(0, idx - lookback), idx)
  if (window.length < 5) return { ok: false, mult: 0 }
  const avg = window.reduce((s, b) => s + b.v, 0) / window.length
  if (avg <= 0) return { ok: false, mult: 0 }
  const mult = reclaimBar.v / avg
  return { ok: mult >= minMult, mult }
}

/** Funding z-score az utolsó értékre. */
export function fundingZScore(history: number[]): number | null {
  if (history.length < 8) return null
  const mean = history.reduce((s, x) => s + x, 0) / history.length
  const variance = history.reduce((s, x) => s + (x - mean) ** 2, 0) / history.length
  const std = Math.sqrt(variance)
  if (std < 1e-12) return 0
  return (history[history.length - 1] - mean) / std
}
