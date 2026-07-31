import type { Bar } from "../backtest/types"
import {
  CRYPTO_SETUP_LABEL,
  type BtcRegime,
  type OiRegime,
  type SetupBuildup,
} from "./types"

/** Küszöbök — szinkronban a compute.ts-sel. */
const ADX_RANGE_MAX = 25
const MR_DIST_ATR = 2.0
const SWEEP_MIN_DEPTH_ATR = 0.2
const SWEEP_MAX_DEPTH_ATR = 1.5
const BREAKOUT_RVOL_MIN = 1.5
const FUNDING_EXTREME = 0.0005
const SIGNAL_MAX_AGE_BARS = 5
const US_RANGE_END_MIN = 13 * 60 + 30
const US_WINDOW_END_MIN = 17 * 60

export interface BuildupCtx {
  bars: Bar[]
  last: Bar
  atr: number
  adx: number | null
  rvol: number | null
  vwap: number
  vwapSeries: { t: number; v: number }[]
  funding: number | null
  btcRegime: BtcRegime
  prevDayHigh: number | null
  prevDayLow: number | null
  prevWeekHigh: number | null
  prevWeekLow: number | null
  usOpenHigh: number | null
  usOpenLow: number | null
  nowMin: number
  todayStart: number
  oiRegime?: OiRegime
  settlementFreeze?: boolean
  /** ha DOGE: aktuális RVOL küszöb */
  dogeRvolMin?: number | null
}

export function computeBuildups(ctx: BuildupCtx): SetupBuildup[] {
  const base = [sweepBuildup(ctx), breakoutBuildup(ctx), pullbackBuildup(ctx), meanRevBuildup(ctx)]
  // settlement freeze: minden ready=false-nak tűnik a checklist elején
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
  return ctx.btcRegime !== "risk_off" && !(ctx.funding != null && ctx.funding > FUNDING_EXTREME)
}

function shortOk(ctx: BuildupCtx): boolean {
  return ctx.btcRegime !== "risk_on" && !(ctx.funding != null && ctx.funding < -FUNDING_EXTREME)
}

function sweepBuildup(ctx: BuildupCtx): SetupBuildup {
  const recent = ctx.bars.slice(-SIGNAL_MAX_AGE_BARS)
  const levels = [
    ctx.prevDayHigh != null ? { name: "prev day high", level: ctx.prevDayHigh, dir: "short" as const } : null,
    ctx.prevWeekHigh != null ? { name: "prev week high", level: ctx.prevWeekHigh, dir: "short" as const } : null,
    ctx.prevDayLow != null ? { name: "prev day low", level: ctx.prevDayLow, dir: "long" as const } : null,
    ctx.prevWeekLow != null ? { name: "prev week low", level: ctx.prevWeekLow, dir: "long" as const } : null,
  ].filter((x): x is { name: string; level: number; dir: "long" | "short" } => x != null)

  const hasLevel = levels.length > 0
  let near = false
  let swept = false
  let reclaimed = false
  let bias: "long" | "short" | "none" = "none"
  let levelName = "—"

  for (const { name, level, dir } of levels) {
    const prox = Math.abs(ctx.last.c - level) / ctx.atr
    if (prox <= 1.0) {
      near = true
      if (bias === "none") {
        bias = dir
        levelName = name
      }
    }
    for (const b of recent) {
      if (dir === "short") {
        const depth = (b.h - level) / ctx.atr
        if (b.h > level && depth >= SWEEP_MIN_DEPTH_ATR && depth <= SWEEP_MAX_DEPTH_ATR) {
          swept = true
          bias = "short"
          levelName = name
          if (b.c < level) reclaimed = true
        }
      } else {
        const depth = (level - b.l) / ctx.atr
        if (b.l < level && depth >= SWEEP_MIN_DEPTH_ATR && depth <= SWEEP_MAX_DEPTH_ATR) {
          swept = true
          bias = "long"
          levelName = name
          if (b.c > level) reclaimed = true
        }
      }
    }
  }

  const gateOk = bias === "long" ? longOk(ctx) : bias === "short" ? shortOk(ctx) : true
  const oiOk = !(bias === "long" && ctx.oiRegime === "squeeze")

  return pack(
    "sweep",
    [
      { label: "Prev day/week szint megvan", ok: hasLevel },
      { label: "Ár a szint közelében (≤1×ATR)", ok: near || swept, detail: levelName !== "—" ? levelName : undefined },
      { label: "Wick átszúrja a szintet", ok: swept },
      { label: "Close vissza a szint mögé (reclaim)", ok: reclaimed },
      {
        label: "BTC + funding kapu OK",
        ok: gateOk,
        detail: !gateOk
          ? bias === "long"
            ? "long tiltva"
            : "short tiltva"
          : undefined,
      },
      {
        label: "OI nem squeeze (long chase ellen)",
        ok: oiOk,
        detail: ctx.oiRegime ?? "unknown",
      },
    ],
    bias
  )
}

function breakoutBuildup(ctx: BuildupCtx): SetupBuildup {
  const inWindow = ctx.nowMin >= US_RANGE_END_MIN && ctx.nowMin <= US_WINDOW_END_MIN
  const rangeReady = ctx.usOpenHigh != null && ctx.usOpenLow != null
  let broke: "long" | "short" | null = null
  if (rangeReady && ctx.last.c > ctx.usOpenHigh!) broke = "long"
  else if (rangeReady && ctx.last.c < ctx.usOpenLow!) broke = "short"
  const rvolOk = ctx.rvol != null && ctx.rvol >= BREAKOUT_RVOL_MIN
  const gateOk = broke === "long" ? longOk(ctx) : broke === "short" ? shortOk(ctx) : true
  const oiOk = !(broke === "long" && ctx.oiRegime === "squeeze")

  return pack(
    "breakout",
    [
      {
        label: "US-open range kész (13:00–13:30 UTC)",
        ok: rangeReady,
        detail: rangeReady ? `${ctx.usOpenLow}–${ctx.usOpenHigh}` : ctx.nowMin < US_RANGE_END_MIN ? "még formálódik" : "nincs",
      },
      {
        label: "Breakout ablak nyitva (13:30–17:00 UTC)",
        ok: inWindow,
      },
      {
        label: "Close a range-en kívül",
        ok: broke != null,
        detail: broke ?? undefined,
      },
      {
        label: `RVOL ≥ ${BREAKOUT_RVOL_MIN}`,
        ok: rvolOk,
        detail: ctx.rvol != null ? ctx.rvol.toFixed(2) : "?",
      },
      {
        label: "BTC + funding kapu OK",
        ok: gateOk,
        detail: !gateOk ? (broke === "long" ? "long tiltva" : "short tiltva") : undefined,
      },
      {
        label: "OI nem squeeze (long chase ellen)",
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

  return pack(
    "pullback",
    [
      { label: "Elég mai gyertya (≥60 perc)", ok: enoughBars },
      {
        label: "Trend elmozdulás (≥1.5×ATR a VWAP-tól)",
        ok: trend !== "none",
        detail: trend !== "none" ? trend : `max +${maxAbove.toFixed(1)} / -${maxBelow.toFixed(1)}`,
      },
      { label: "VWAP megérintve (utolsó 5 perc)", ok: touched },
      { label: "Close vissza trendirányba", ok: reclaim },
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
  // target (VWAP) legalább 1R távolságra — stop becslés: 0.75 ATR + recent range ~ egyszerűsítve ATR
  const pathOk = stretched // a pontos R-szám a signalnál dől el; itt a stretch a fő feltétel

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
        ok: pathOk,
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
