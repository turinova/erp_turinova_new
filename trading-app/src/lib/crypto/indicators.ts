import type { Bar } from "../backtest/types"

/** 1m gyertyák aggregálása N percesre (UTC-hez igazítva). */
export function aggregate(bars: Bar[], minutes: number): Bar[] {
  const out: Bar[] = []
  let cur: Bar | null = null
  const bucketSec = minutes * 60
  for (const b of bars) {
    const bucket = Math.floor(b.t / bucketSec) * bucketSec
    if (!cur || cur.t !== bucket) {
      if (cur) out.push(cur)
      cur = { t: bucket, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v }
    } else {
      cur.h = Math.max(cur.h, b.h)
      cur.l = Math.min(cur.l, b.l)
      cur.c = b.c
      cur.v += b.v
    }
  }
  if (cur) out.push(cur)
  return out
}

/** ATR Wilder-simítással. Az utolsó értéket adja vissza, vagy null-t ha kevés az adat. */
export function atr(bars: Bar[], period = 14): number | null {
  if (bars.length < period + 1) return null
  const trs: number[] = []
  for (let i = 1; i < bars.length; i++) {
    const b = bars[i]
    const pc = bars[i - 1].c
    trs.push(Math.max(b.h - b.l, Math.abs(b.h - pc), Math.abs(b.l - pc)))
  }
  let val = trs.slice(0, period).reduce((s, x) => s + x, 0) / period
  for (let i = period; i < trs.length; i++) {
    val = (val * (period - 1) + trs[i]) / period
  }
  return val
}

/** ADX(14) Wilder szerint. Az utolsó értéket adja vissza, vagy null-t ha kevés az adat. */
export function adx(bars: Bar[], period = 14): number | null {
  // ADX-hez min. ~2×period gyertya kell (DI-smoothing + DX-smoothing)
  if (bars.length < period * 2 + 1) return null

  const plusDm: number[] = []
  const minusDm: number[] = []
  const trs: number[] = []
  for (let i = 1; i < bars.length; i++) {
    const up = bars[i].h - bars[i - 1].h
    const down = bars[i - 1].l - bars[i].l
    plusDm.push(up > down && up > 0 ? up : 0)
    minusDm.push(down > up && down > 0 ? down : 0)
    const pc = bars[i - 1].c
    trs.push(Math.max(bars[i].h - bars[i].l, Math.abs(bars[i].h - pc), Math.abs(bars[i].l - pc)))
  }

  const smooth = (arr: number[]): number[] => {
    const out: number[] = []
    let val = arr.slice(0, period).reduce((s, x) => s + x, 0)
    out.push(val)
    for (let i = period; i < arr.length; i++) {
      val = val - val / period + arr[i]
      out.push(val)
    }
    return out
  }

  const sTr = smooth(trs)
  const sPlus = smooth(plusDm)
  const sMinus = smooth(minusDm)

  const dxs: number[] = []
  for (let i = 0; i < sTr.length; i++) {
    if (sTr[i] === 0) {
      dxs.push(0)
      continue
    }
    const pdi = (100 * sPlus[i]) / sTr[i]
    const mdi = (100 * sMinus[i]) / sTr[i]
    const sum = pdi + mdi
    dxs.push(sum === 0 ? 0 : (100 * Math.abs(pdi - mdi)) / sum)
  }

  if (dxs.length < period) return null
  let val = dxs.slice(0, period).reduce((s, x) => s + x, 0) / period
  for (let i = period; i < dxs.length; i++) {
    val = (val * (period - 1) + dxs[i]) / period
  }
  return val
}

/** EMA az utolsó gyertyára, vagy null ha kevés az adat. */
export function ema(values: number[], period: number): number | null {
  if (values.length < period) return null
  const k = 2 / (period + 1)
  let val = values.slice(0, period).reduce((s, x) => s + x, 0) / period
  for (let i = period; i < values.length; i++) {
    val = values[i] * k + val * (1 - k)
  }
  return val
}

/**
 * UTC-naphoz horgonyzott session VWAP sorozat.
 * Minden gyertyára visszaadja az aznapi kumulatív VWAP-ot.
 */
export function sessionVwapSeries(bars: Bar[]): { t: number; v: number }[] {
  const out: { t: number; v: number }[] = []
  let day = -1
  let cumPv = 0
  let cumV = 0
  for (const b of bars) {
    const barDay = Math.floor(b.t / 86400)
    if (barDay !== day) {
      day = barDay
      cumPv = 0
      cumV = 0
    }
    const typical = (b.h + b.l + b.c) / 3
    cumPv += typical * b.v
    cumV += b.v
    out.push({ t: b.t, v: cumV > 0 ? cumPv / cumV : b.c })
  }
  return out
}

/**
 * RVOL: az aktuális 5 perces gyertya volumen-üteme a megelőző 20 db teljes
 * 5m gyertya átlagához képest. Az utolsó gyertya jellemzően részleges,
 * ezért percarányosan vetítjük ki (különben mindig alulbecsülnénk).
 * A crypto 24/7 megy, ezért gördülő átlagot használunk.
 */
export function rollingRvol(bars1m: Bar[], lookback = 20): number | null {
  if (bars1m.length === 0) return null
  const bucketSec = 300
  const lastBucket = Math.floor(bars1m[bars1m.length - 1].t / bucketSec) * bucketSec
  const inLast = bars1m.filter((b) => b.t >= lastBucket)
  const full = aggregate(bars1m.filter((b) => b.t < lastBucket), 5)
  if (full.length < lookback) return null
  const prev = full.slice(-lookback)
  const avgPerMin = prev.reduce((s, b) => s + b.v, 0) / prev.length / 5
  if (avgPerMin <= 0) return null
  const lastPerMin = inLast.reduce((s, b) => s + b.v, 0) / inLast.length
  return lastPerMin / avgPerMin
}
