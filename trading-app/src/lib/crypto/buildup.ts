import type { Bar } from "../backtest/types"
import {
  CRYPTO_SETUP_LABEL,
  type BtcRegime,
  type OiRegime,
  type SetupBuildup,
} from "./types"
import {
  findActiveFvgs,
  SESSION_SPECS,
  volumeConfluence,
  type FairValueGap,
} from "./structure"

/** Küszöbök — szinkronban a compute.ts-sel. */
const ADX_RANGE_MAX = 25
const MR_DIST_ATR = 2.0
const SWEEP_MIN_DEPTH_ATR = 0.2
const SWEEP_MAX_DEPTH_ATR = 1.5
const BREAKOUT_RVOL_MIN = 1.5
const FUNDING_EXTREME = 0.0005
const FUNDING_Z_EXTREME = 2.0
const SIGNAL_MAX_AGE_BARS = 10
const BREAKOUT_WINDOW_BARS = 30
const CHASE_GUARD_R = 0.75
const PULLBACK_MAX_STOP_ATR = 2
const SWEEP_VOL_MIN = 1.2

export interface BuildupCtx {
  bars: Bar[]
  bars5m?: Bar[]
  last: Bar
  atr: number
  adx: number | null
  rvol: number | null
  vwap: number
  vwapSeries: { t: number; v: number }[]
  funding: number | null
  fundingZ?: number | null
  btcRegime: BtcRegime
  prevDayHigh: number | null
  prevDayLow: number | null
  prevWeekHigh: number | null
  prevWeekLow: number | null
  equalHigh?: number | null
  equalLow?: number | null
  fvgs?: FairValueGap[]
  usOpenHigh: number | null
  usOpenLow: number | null
  londonHigh?: number | null
  londonLow?: number | null
  asiaHigh?: number | null
  asiaLow?: number | null
  nowMin: number
  todayStart: number
  oiRegime?: OiRegime
  settlementFreeze?: boolean
  dogeRvolMin?: number | null
}

export function computeBuildups(ctx: BuildupCtx): SetupBuildup[] {
  const base = [
    sweepBuildup(ctx),
    fvgBuildup(ctx),
    breakoutBuildup(ctx),
    pullbackBuildup(ctx),
    meanRevBuildup(ctx),
  ]
  if (ctx.settlementFreeze) {
    return base.map((b) => {
      const steps = [
        {
          label: "Nincs funding settlement freeze",
          ok: false,
          detail: "±10p a 00/08/16 UTC körül",
        },
        ...b.steps,
      ]
      return {
        ...b,
        steps,
        done: steps.filter((s) => s.ok).length,
        total: steps.length,
        ready: false,
      }
    })
  }
  return base
}

function pack(
  id: SetupBuildup["id"],
  steps: SetupBuildup["steps"],
  bias: SetupBuildup["bias"]
): SetupBuildup {
  const done = steps.filter((s) => s.ok).length
  return {
    id,
    label: CRYPTO_SETUP_LABEL[id],
    done,
    total: steps.length,
    bias,
    steps,
    ready: done === steps.length,
  }
}

function longOk(ctx: BuildupCtx): boolean {
  if (ctx.btcRegime === "risk_off") return false
  if (ctx.fundingZ != null) return ctx.fundingZ < FUNDING_Z_EXTREME
  return !(ctx.funding != null && ctx.funding > FUNDING_EXTREME)
}

function shortOk(ctx: BuildupCtx): boolean {
  if (ctx.btcRegime === "risk_on") return false
  if (ctx.fundingZ != null) return ctx.fundingZ > -FUNDING_Z_EXTREME
  return !(ctx.funding != null && ctx.funding < -FUNDING_EXTREME)
}

function chaseOk(dir: "long" | "short", entry: number, stop: number, lastC: number): boolean {
  const risk = Math.abs(entry - stop)
  if (risk <= 0) return false
  const moved = dir === "long" ? lastC - entry : entry - lastC
  return moved <= CHASE_GUARD_R * risk
}

function sweepBuildup(ctx: BuildupCtx): SetupBuildup {
  const recent = ctx.bars.slice(-SIGNAL_MAX_AGE_BARS)
  const levels = [
    ctx.prevDayHigh != null ? { name: "prev day high", level: ctx.prevDayHigh, dir: "short" as const } : null,
    ctx.prevWeekHigh != null ? { name: "prev week high", level: ctx.prevWeekHigh, dir: "short" as const } : null,
    ctx.equalHigh != null ? { name: "equal high", level: ctx.equalHigh, dir: "short" as const } : null,
    ctx.prevDayLow != null ? { name: "prev day low", level: ctx.prevDayLow, dir: "long" as const } : null,
    ctx.prevWeekLow != null ? { name: "prev week low", level: ctx.prevWeekLow, dir: "long" as const } : null,
    ctx.equalLow != null ? { name: "equal low", level: ctx.equalLow, dir: "long" as const } : null,
  ].filter((x): x is { name: string; level: number; dir: "long" | "short" } => x != null)

  const hasLevel = levels.length > 0
  let near = false
  let swept = false
  let reclaimed = false
  let bias: "long" | "short" | "none" = "none"
  let levelName = "—"
  let reclaimBar: Bar | null = null

  for (const { name, level, dir } of levels) {
    const prox = Math.abs(ctx.last.c - level) / ctx.atr
    if (prox <= 1.0) {
      near = true
      if (bias === "none") {
        bias = dir
        levelName = name
      }
    }
    for (let i = recent.length - 1; i >= 0; i--) {
      const b = recent[i]
      if (dir === "short") {
        const depth = (b.h - level) / ctx.atr
        if (b.h > level && depth >= SWEEP_MIN_DEPTH_ATR && depth <= SWEEP_MAX_DEPTH_ATR) {
          swept = true
          bias = "short"
          levelName = name
          if (b.c < level && !reclaimed) {
            reclaimed = true
            reclaimBar = b
          }
        }
      } else {
        const depth = (level - b.l) / ctx.atr
        if (b.l < level && depth >= SWEEP_MIN_DEPTH_ATR && depth <= SWEEP_MAX_DEPTH_ATR) {
          swept = true
          bias = "long"
          levelName = name
          if (b.c > level && !reclaimed) {
            reclaimed = true
            reclaimBar = b
          }
        }
      }
    }
  }

  const gateOk = bias === "long" ? longOk(ctx) : bias === "short" ? shortOk(ctx) : true
  const oiOk = !(bias === "long" && ctx.oiRegime === "squeeze")

  let noChase = true
  let chaseDetail: string | undefined
  if (reclaimed && reclaimBar && (bias === "long" || bias === "short")) {
    const entry = reclaimBar.c
    const stop =
      bias === "short" ? reclaimBar.h + 0.1 * ctx.atr : reclaimBar.l - 0.1 * ctx.atr
    noChase = chaseOk(bias, entry, stop, ctx.last.c)
    if (!noChase) chaseDetail = `>${CHASE_GUARD_R}R a reclaim óta`
  }

  const vol = reclaimBar ? volumeConfluence(ctx.bars, reclaimBar, 20, SWEEP_VOL_MIN) : { ok: true, mult: 0 }

  return pack(
    "sweep",
    [
      { label: "Prev day/week / EQH-EQL szint", ok: hasLevel, detail: levelName !== "—" ? levelName : undefined },
      {
        label: "Ár a szint közelében (≤1×ATR)",
        ok: near || swept,
        detail: levelName !== "—" ? levelName : undefined,
      },
      { label: "Wick átszúrja a szintet", ok: swept },
      { label: "Close vissza a szint mögé (reclaim)", ok: reclaimed },
      {
        label: `Volumen absorption (≥${SWEEP_VOL_MIN}×)`,
        ok: !reclaimed || vol.ok,
        detail: reclaimBar ? `${vol.mult.toFixed(2)}×` : undefined,
      },
      {
        label: `Ár nem ment el (≤${CHASE_GUARD_R}R)`,
        ok: !reclaimed || noChase,
        detail: chaseDetail,
      },
      {
        label: "BTC + funding kapu OK",
        ok: gateOk,
        detail: !gateOk ? (bias === "long" ? "long tiltva" : "short tiltva") : undefined,
      },
      {
        label: "OI nem squeeze (long kitörés ellen)",
        ok: oiOk,
        detail: ctx.oiRegime ?? "unknown",
      },
    ],
    bias
  )
}

function fvgBuildup(ctx: BuildupCtx): SetupBuildup {
  const fvgs = ctx.fvgs ?? findActiveFvgs(ctx.bars5m ?? [])
  const hasGap = fvgs.length > 0
  const recent = ctx.bars.slice(-SIGNAL_MAX_AGE_BARS)
  let tapped = false
  let reclaimed = false
  let bias: "long" | "short" | "none" = "none"
  let detail: string | undefined

  for (const gap of fvgs) {
    for (const b of recent) {
      if (gap.dir === "long" && b.l <= gap.top && b.l >= gap.bottom - 0.1 * ctx.atr) {
        tapped = true
        bias = "long"
        detail = `${gap.bottom.toFixed(2)}–${gap.top.toFixed(2)}`
        if (b.c > gap.bottom && b.c > b.o) reclaimed = true
      }
      if (gap.dir === "short" && b.h >= gap.bottom && b.h <= gap.top + 0.1 * ctx.atr) {
        tapped = true
        bias = "short"
        detail = `${gap.bottom.toFixed(2)}–${gap.top.toFixed(2)}`
        if (b.c < gap.top && b.c < b.o) reclaimed = true
      }
    }
  }

  const gateOk = bias === "long" ? longOk(ctx) : bias === "short" ? shortOk(ctx) : true

  return pack(
    "fvg",
    [
      { label: "Aktív 5m FVG van", ok: hasGap, detail: hasGap ? `${fvgs.length} db` : undefined },
      { label: "Ár megérinti a gapet (tap)", ok: tapped, detail },
      { label: "Close vissza irányba (reclaim)", ok: reclaimed },
      {
        label: "BTC + funding kapu OK",
        ok: gateOk,
        detail: !gateOk ? (bias === "long" ? "long tiltva" : "short tiltva") : undefined,
      },
    ],
    bias
  )
}

function breakoutBuildup(ctx: BuildupCtx): SetupBuildup {
  type Cand = {
    spec: (typeof SESSION_SPECS)[number]
    high: number
    low: number
    broke: "long" | "short" | null
    fresh: boolean
    barsSince: number | null
    noChase: boolean
  }

  const cands: Cand[] = []
  for (const spec of SESSION_SPECS) {
    const high =
      spec.id === "us" ? ctx.usOpenHigh : spec.id === "london" ? ctx.londonHigh ?? null : ctx.asiaHigh ?? null
    const low =
      spec.id === "us" ? ctx.usOpenLow : spec.id === "london" ? ctx.londonLow ?? null : ctx.asiaLow ?? null
    const inWindow = ctx.nowMin >= spec.rangeEndMin && ctx.nowMin <= spec.windowEndMin
    if (high == null || low == null || !inWindow) continue

    const windowBars = ctx.bars.filter(
      (b) =>
        b.t >= ctx.todayStart + spec.rangeEndMin * 60 &&
        b.t <= ctx.todayStart + spec.windowEndMin * 60
    )
    let first: { bar: Bar; dir: "long" | "short"; barsSince: number } | null = null
    for (let i = 0; i < windowBars.length; i++) {
      const b = windowBars[i]
      if (b.c > high) {
        first = { bar: b, dir: "long", barsSince: windowBars.length - 1 - i }
        break
      }
      if (b.c < low) {
        first = { bar: b, dir: "short", barsSince: windowBars.length - 1 - i }
        break
      }
    }
    const fresh = first != null && first.barsSince <= BREAKOUT_WINDOW_BARS
    let noChase = true
    if (first && fresh) {
      const entry = first.bar.c
      const stop =
        first.dir === "long"
          ? Math.max(low, entry - 1.5 * ctx.atr)
          : Math.min(high, entry + 1.5 * ctx.atr)
      noChase = chaseOk(first.dir, entry, stop, ctx.last.c)
    }
    cands.push({
      spec,
      high,
      low,
      broke: first?.dir ?? null,
      fresh: first == null ? true : fresh,
      barsSince: first?.barsSince ?? null,
      noChase,
    })
  }

  const best = cands.find((c) => c.broke != null) ?? cands[0] ?? null
  const anyRange = cands.length > 0 || ctx.usOpenHigh != null || ctx.asiaHigh != null || ctx.londonHigh != null
  const rvolOk = ctx.rvol != null && ctx.rvol >= BREAKOUT_RVOL_MIN
  const broke = best?.broke ?? null
  const gateOk = broke === "long" ? longOk(ctx) : broke === "short" ? shortOk(ctx) : true
  const oiOk = !(broke === "long" && ctx.oiRegime === "squeeze")

  return pack(
    "breakout",
    [
      {
        label: "Session range kész (Asia/London/US)",
        ok: anyRange,
        detail: best ? `${best.spec.label} ${best.low}–${best.high}` : undefined,
      },
      {
        label: "Breakout ablak nyitva",
        ok: best != null,
        detail: best?.spec.label,
      },
      {
        label: "Close a range-en kívül",
        ok: broke != null,
        detail: broke ?? undefined,
      },
      {
        label: `Kitörés friss (≤${BREAKOUT_WINDOW_BARS}p)`,
        ok: best == null || best.broke == null || best.fresh,
        detail: best?.barsSince != null ? `${best.barsSince}p` : undefined,
      },
      {
        label: `RVOL ≥ ${BREAKOUT_RVOL_MIN}`,
        ok: rvolOk,
        detail: ctx.rvol != null ? ctx.rvol.toFixed(2) : "?",
      },
      {
        label: `Ár nem ment el (≤${CHASE_GUARD_R}R)`,
        ok: best == null || best.broke == null || !best.fresh || best.noChase,
      },
      {
        label: "BTC + funding kapu OK",
        ok: gateOk,
        detail: !gateOk ? (broke === "long" ? "long tiltva" : "short tiltva") : undefined,
      },
      {
        label: "OI nem squeeze (long kitörés ellen)",
        ok: oiOk,
        detail: ctx.oiRegime ?? "unknown",
      },
    ],
    broke ?? "none"
  )
}

function pullbackBuildup(ctx: BuildupCtx): SetupBuildup {
  const todayBars = ctx.bars.filter((b) => b.t >= ctx.todayStart)
  const enoughBars = todayBars.length >= 60
  const vwapByT = new Map(ctx.vwapSeries.map((p) => [p.t, p.v]))
  let maxAbove = 0
  let maxBelow = 0
  for (const b of todayBars) {
    const v = vwapByT.get(b.t)
    if (v == null) continue
    maxAbove = Math.max(maxAbove, (b.h - v) / ctx.atr)
    maxBelow = Math.max(maxBelow, (v - b.l) / ctx.atr)
  }
  const trend: "long" | "short" | "none" =
    maxAbove >= 1.5 && ctx.last.c > ctx.vwap
      ? "long"
      : maxBelow >= 1.5 && ctx.last.c < ctx.vwap
        ? "short"
        : "none"

  const recent = ctx.bars.slice(-SIGNAL_MAX_AGE_BARS)
  const touched = recent.some((b) => {
    const v = vwapByT.get(b.t)
    return v != null && b.l <= v && b.h >= v
  })
  const lastV = vwapByT.get(ctx.last.t)
  const reclaim =
    trend === "long"
      ? lastV != null && ctx.last.c > lastV && ctx.last.c > ctx.last.o
      : trend === "short"
        ? lastV != null && ctx.last.c < lastV && ctx.last.c < ctx.last.o
        : false
  const gateOk = trend === "long" ? longOk(ctx) : trend === "short" ? shortOk(ctx) : true

  let stopOk = true
  let stopDetail: string | undefined
  if (reclaim && (trend === "long" || trend === "short")) {
    const entry = ctx.last.c
    const recentLow = Math.min(...recent.map((b) => b.l))
    const recentHigh = Math.max(...recent.map((b) => b.h))
    const stop = trend === "long" ? recentLow - 0.1 * ctx.atr : recentHigh + 0.1 * ctx.atr
    const risk = Math.abs(entry - stop)
    stopOk = risk > 0 && risk <= PULLBACK_MAX_STOP_ATR * ctx.atr
    if (!stopOk && risk > 0) stopDetail = `${(risk / ctx.atr).toFixed(1)}×ATR`
  }

  return pack(
    "pullback",
    [
      { label: "Elég mai gyertya (≥60 perc)", ok: enoughBars },
      {
        label: "Trend elmozdulás (≥1.5×ATR a VWAP-tól)",
        ok: trend !== "none",
        detail: trend !== "none" ? trend : `max +${maxAbove.toFixed(1)} / -${maxBelow.toFixed(1)}`,
      },
      {
        label: `VWAP megérintve (utolsó ${SIGNAL_MAX_AGE_BARS} perc)`,
        ok: touched,
      },
      { label: "Close vissza trendirányba", ok: reclaim },
      {
        label: `Stop méret OK (≤${PULLBACK_MAX_STOP_ATR}×ATR)`,
        ok: !reclaim || stopOk,
        detail: stopDetail,
      },
      {
        label: "BTC + funding kapu OK",
        ok: gateOk,
        detail: !gateOk ? (trend === "long" ? "long tiltva" : "short tiltva") : undefined,
      },
    ],
    trend
  )
}

function meanRevBuildup(ctx: BuildupCtx): SetupBuildup {
  const rangeMarket = ctx.adx != null && ctx.adx < ADX_RANGE_MAX
  const dist = (ctx.last.c - ctx.vwap) / ctx.atr
  const stretched = Math.abs(dist) >= MR_DIST_ATR
  const bias: "long" | "short" | "none" = stretched ? (dist < 0 ? "long" : "short") : "none"
  const gateOk = bias === "long" ? longOk(ctx) : bias === "short" ? shortOk(ctx) : true

  let pathOk = false
  let pathDetail: string | undefined
  if (stretched && (bias === "long" || bias === "short")) {
    const recent = ctx.bars.slice(-SIGNAL_MAX_AGE_BARS)
    const entry = ctx.last.c
    const stop =
      bias === "long"
        ? Math.min(...recent.map((b) => b.l)) - 0.75 * ctx.atr
        : Math.max(...recent.map((b) => b.h)) + 0.75 * ctx.atr
    const risk = Math.abs(entry - stop)
    const toVwap = Math.abs(ctx.vwap - entry)
    pathOk = risk > 0 && toVwap >= risk
    if (!pathOk) pathDetail = `út ${toVwap.toFixed(2)} < stop ${risk.toFixed(2)}`
  }

  return pack(
    "mean_rev",
    [
      {
        label: `Range piac (ADX < ${ADX_RANGE_MAX})`,
        ok: rangeMarket,
        detail: ctx.adx != null ? `ADX ${ctx.adx.toFixed(0)}` : "?",
      },
      {
        label: `Ár ≥ ${MR_DIST_ATR}×ATR-re a VWAP-tól`,
        ok: stretched,
        detail: `${dist >= 0 ? "+" : ""}${dist.toFixed(1)}×ATR`,
      },
      {
        label: "Út a VWAP-ig megéri (≥1R)",
        ok: !stretched || pathOk,
        detail: pathDetail,
      },
      {
        label: "BTC + funding kapu OK",
        ok: gateOk,
        detail: !gateOk ? (bias === "long" ? "long tiltva" : "short tiltva") : undefined,
      },
    ],
    bias
  )
}
