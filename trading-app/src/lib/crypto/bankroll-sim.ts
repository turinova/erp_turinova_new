/**
 * Paper signalok → dollár bankroll szimuláció.
 *
 * paper: nettó R × risk$ (fee már az R-ben)
 * liveAdj: bruttó R × risk$ − abszolút Binance-szerű fee/slip a notionalon
 *          + bridge sizing (margin 75%, lev cap, szűk stop → ≤10x)
 *          + max 1 pozíció / symbol (SOL+DOGE párhuzamosan mehet)
 */

import {
  DEFAULT_FEE_BPS_PER_SIDE,
  DEFAULT_SLIP_BPS_PER_FILL,
} from "./paper-costs"
import { effectiveLeverageCap, TIGHT_STOP_PCT } from "./stop-policy"

export type SimTradeInput = {
  id: string
  symbol: string
  kind: string
  bar_time: string
  entry: number
  stop: number
  r_multiple: number
  /** bruttó R — live-adj market PnL-hez */
  r_multiple_gross?: number | null
  status: string
  exited_at?: string | null
}

export type RiskMode = "percent" | "fixed"
export type SimMode = "paper" | "liveAdj"

export type SimParams = {
  startUsd: number
  riskMode: RiskMode
  /** percent módban: 0–100 (pl. 8 = 8%) */
  riskPercent: number
  /** fixed módban: dollár / 1R */
  riskFixedUsd: number
  leverageCap: number
  compound: boolean
  /** max available margin használat (0–1), default 0.75 */
  marginUsePct: number
  /**
   * paper: max egyidejű open globálisan
   * liveAdj: figyelmen kívül — per-symbol limitet használ
   */
  maxConcurrent: number
  /** liveAdj: max 1 nyitott / symbol (desk parity) */
  maxConcurrentPerSymbol: number
  mode: SimMode
  /** live-adj taker fee bps / side */
  feeBpsPerSide: number
  /** live-adj slip bps / fill touch */
  slipBpsPerFill: number
  /** round-trip touch count (entry+exit ≈ 2; partial is ~2) */
  feeTouches: number
}

export type SimStep = {
  id: string
  symbol: string
  kind: string
  bar_time: string
  rMultiple: number
  /** élő-adj: gross R amiből a market PnL jött */
  rMultipleUsed: number
  stopPct: number
  targetRiskUsd: number
  actualRiskUsd: number
  notional: number
  leverageUsed: number
  capped: boolean
  skippedConcurrent: boolean
  marketPnlUsd: number
  feeUsd: number
  pnlUsd: number
  equityBefore: number
  equityAfter: number
  ruined: boolean
}

export type SetupAgg = {
  key: string
  trades: number
  wins: number
  netUsd: number
  netR: number
}

export type SimResult = {
  steps: SimStep[]
  equityPath: number[]
  finalEquity: number
  startUsd: number
  netPnl: number
  totalFeesUsd: number
  ruined: boolean
  ruinedAtIndex: number | null
  cappedCount: number
  skippedConcurrentCount: number
  setupRace: SetupAgg[]
  mode: SimMode
}

export const DEFAULT_SIM_PARAMS: SimParams = {
  startUsd: 100,
  riskMode: "percent",
  riskPercent: 2,
  riskFixedUsd: 10,
  leverageCap: 10,
  compound: true,
  marginUsePct: 0.75,
  maxConcurrent: 1,
  maxConcurrentPerSymbol: 1,
  mode: "paper",
  feeBpsPerSide: DEFAULT_FEE_BPS_PER_SIDE,
  slipBpsPerFill: DEFAULT_SLIP_BPS_PER_FILL,
  feeTouches: 2,
}

/** Desk survivor preset live-adj-hez */
export const LIVE_ADJ_DEFAULTS: Partial<SimParams> = {
  mode: "liveAdj",
  leverageCap: 10,
  riskPercent: 2,
  marginUsePct: 0.75,
  maxConcurrentPerSymbol: 1,
  compound: true,
}

const SETUP_FAMILY: Record<string, string> = {
  SWEEP_LONG: "Sweep",
  SWEEP_SHORT: "Sweep",
  MR_LONG: "VWAP MR",
  MR_SHORT: "VWAP MR",
  BREAKOUT_LONG: "Breakout",
  BREAKOUT_SHORT: "Breakout",
  PB_LONG: "Pullback",
  PB_SHORT: "Pullback",
  FVG_LONG: "FVG",
  FVG_SHORT: "FVG",
}

export function setupFamily(kind: string): string {
  return SETUP_FAMILY[kind] ?? kind
}

function tradeEndMs(t: SimTradeInput): number {
  if (t.exited_at) return new Date(t.exited_at).getTime()
  return new Date(t.bar_time).getTime() + 60 * 60 * 1000
}

function absFeeUsd(
  notional: number,
  params: SimParams
): number {
  if (notional <= 0) return 0
  const bps = params.feeBpsPerSide + params.slipBpsPerFill
  return (notional * (bps / 10_000)) * Math.max(1, params.feeTouches)
}

export function simulateBankroll(trades: SimTradeInput[], params: SimParams): SimResult {
  const ordered = [...trades].sort(
    (a, b) => new Date(a.bar_time).getTime() - new Date(b.bar_time).getTime()
  )

  let equity = Math.max(0, params.startUsd)
  const steps: SimStep[] = []
  const equityPath: number[] = [equity]
  let ruined = false
  let ruinedAtIndex: number | null = null
  let cappedCount = 0
  let skippedConcurrentCount = 0
  let totalFeesUsd = 0

  const setupMap = new Map<string, SetupAgg>()
  const openIntervals: Array<{ start: number; end: number; symbol: string }> = []

  const marginFrac = Math.min(1, Math.max(0.1, params.marginUsePct ?? 0.75))
  const liveAdj = params.mode === "liveAdj"
  const maxConcGlobal = Math.max(1, Math.floor(params.maxConcurrent ?? 1))
  const maxConcSym = Math.max(1, Math.floor(params.maxConcurrentPerSymbol ?? 1))

  for (let i = 0; i < ordered.length; i++) {
    const t = ordered[i]
    const entry = Number(t.entry)
    const stop = Number(t.stop)
    const rNet = Number(t.r_multiple)
    const rGross =
      t.r_multiple_gross != null && Number.isFinite(Number(t.r_multiple_gross))
        ? Number(t.r_multiple_gross)
        : rNet
    const rUsed = liveAdj ? rGross : rNet
    const stopPct = entry > 0 ? Math.abs(entry - stop) / entry : 0
    const startMs = new Date(t.bar_time).getTime()
    const endMs = tradeEndMs(t)

    const equityBefore = equity
    const pushFlat = (opts: {
      skippedConcurrent: boolean
      ruinedFlag: boolean
    }) => {
      steps.push({
        id: t.id,
        symbol: t.symbol,
        kind: t.kind,
        bar_time: t.bar_time,
        rMultiple: rNet,
        rMultipleUsed: rUsed,
        stopPct,
        targetRiskUsd: 0,
        actualRiskUsd: 0,
        notional: 0,
        leverageUsed: 0,
        capped: false,
        skippedConcurrent: opts.skippedConcurrent,
        marketPnlUsd: 0,
        feeUsd: 0,
        pnlUsd: 0,
        equityBefore,
        equityAfter: equityBefore,
        ruined: opts.ruinedFlag,
      })
      equityPath.push(equityBefore)
    }

    if (ruined || equityBefore <= 0) {
      pushFlat({ skippedConcurrent: false, ruinedFlag: true })
      continue
    }

    const overlapping = openIntervals.filter((iv) => startMs < iv.end && endMs > iv.start)
    const skip = liveAdj
      ? overlapping.filter((iv) => iv.symbol === t.symbol).length >= maxConcSym
      : overlapping.length >= maxConcGlobal

    if (skip) {
      skippedConcurrentCount++
      pushFlat({ skippedConcurrent: true, ruinedFlag: false })
      continue
    }

    const baseForRisk = params.compound ? equityBefore : params.startUsd
    const targetRiskUsd =
      params.riskMode === "percent"
        ? (baseForRisk * Math.max(0, params.riskPercent)) / 100
        : Math.max(0, params.riskFixedUsd)

    let actualRiskUsd = targetRiskUsd
    let notional = 0
    let leverageUsed = 0
    let capped = false
    const marginBudget = equityBefore * marginFrac

    if (stopPct > 1e-12 && targetRiskUsd > 0 && marginBudget > 0) {
      notional = targetRiskUsd / stopPct
      leverageUsed = notional / marginBudget
      const baseCap = Math.max(1, params.leverageCap)
      const cap = liveAdj ? effectiveLeverageCap(stopPct, baseCap) : baseCap
      if (leverageUsed > cap) {
        notional = marginBudget * cap
        actualRiskUsd = notional * stopPct
        leverageUsed = cap
        capped = true
        cappedCount++
      }
      const lev = Math.max(1, leverageUsed)
      if (notional / lev > marginBudget) {
        notional = marginBudget * lev
        actualRiskUsd = notional * stopPct
        capped = true
        cappedCount++
      }
    } else {
      actualRiskUsd = 0
      notional = 0
      leverageUsed = 0
    }

    const marketPnlUsd = actualRiskUsd * rUsed
    const feeUsd = liveAdj ? absFeeUsd(notional, params) : 0
    const pnlUsd = marketPnlUsd - feeUsd
    totalFeesUsd += feeUsd

    let equityAfter = equityBefore + pnlUsd
    if (equityAfter <= 0) {
      equityAfter = 0
      ruined = true
      ruinedAtIndex = i
    }
    equity = equityAfter
    openIntervals.push({ start: startMs, end: endMs, symbol: t.symbol })

    steps.push({
      id: t.id,
      symbol: t.symbol,
      kind: t.kind,
      bar_time: t.bar_time,
      rMultiple: rNet,
      rMultipleUsed: rUsed,
      stopPct,
      targetRiskUsd,
      actualRiskUsd,
      notional,
      leverageUsed,
      capped,
      skippedConcurrent: false,
      marketPnlUsd,
      feeUsd,
      pnlUsd,
      equityBefore,
      equityAfter,
      ruined: equityAfter <= 0,
    })
    equityPath.push(equityAfter)

    const key = `${t.symbol} · ${setupFamily(t.kind)}`
    const agg = setupMap.get(key) ?? { key, trades: 0, wins: 0, netUsd: 0, netR: 0 }
    agg.trades++
    if (pnlUsd > 0) agg.wins++
    agg.netUsd += pnlUsd
    agg.netR += rNet
    setupMap.set(key, agg)
  }

  const setupRace = [...setupMap.values()].sort((a, b) => b.netUsd - a.netUsd)

  return {
    steps,
    equityPath,
    finalEquity: equity,
    startUsd: params.startUsd,
    netPnl: equity - params.startUsd,
    totalFeesUsd,
    ruined,
    ruinedAtIndex,
    cappedCount,
    skippedConcurrentCount,
    setupRace,
    mode: params.mode,
  }
}

export { TIGHT_STOP_PCT }
