/**
 * Paper signalok → dollár bankroll szimuláció.
 * 1R = amennyit egy vesztes trade elvesz (risk $).
 * PnL = risk$ × r_multiple, leverage cap korlátozhatja a méretet.
 */

export type SimTradeInput = {
  id: string
  symbol: string
  kind: string
  bar_time: string
  entry: number
  stop: number
  r_multiple: number
  status: string
}

export type RiskMode = "percent" | "fixed"

export type SimParams = {
  startUsd: number
  riskMode: RiskMode
  /** percent módban: 0–100 (pl. 8 = 8%) */
  riskPercent: number
  /** fixed módban: dollár / 1R */
  riskFixedUsd: number
  leverageCap: number
  compound: boolean
}

export type SimStep = {
  id: string
  symbol: string
  kind: string
  bar_time: string
  rMultiple: number
  stopPct: number
  targetRiskUsd: number
  actualRiskUsd: number
  notional: number
  leverageUsed: number
  capped: boolean
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
  ruined: boolean
  ruinedAtIndex: number | null
  cappedCount: number
  setupRace: SetupAgg[]
}

export const DEFAULT_SIM_PARAMS: SimParams = {
  startUsd: 100,
  riskMode: "percent",
  riskPercent: 8,
  riskFixedUsd: 10,
  leverageCap: 40,
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

  const setupMap = new Map<string, SetupAgg>()

  for (let i = 0; i < ordered.length; i++) {
    const t = ordered[i]
    const entry = Number(t.entry)
    const stop = Number(t.stop)
    const r = Number(t.r_multiple)
    const stopPct = entry > 0 ? Math.abs(entry - stop) / entry : 0

    const equityBefore = equity
    if (ruined || equityBefore <= 0) {
      steps.push({
        id: t.id,
        symbol: t.symbol,
        kind: t.kind,
        bar_time: t.bar_time,
        rMultiple: r,
        stopPct,
        targetRiskUsd: 0,
        actualRiskUsd: 0,
        notional: 0,
        leverageUsed: 0,
        capped: false,
        pnlUsd: 0,
        equityBefore,
        equityAfter: equityBefore,
        ruined: true,
      })
      equityPath.push(equityBefore)
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

    if (stopPct > 1e-12 && targetRiskUsd > 0) {
      notional = targetRiskUsd / stopPct
      leverageUsed = notional / equityBefore
      const cap = Math.max(1, params.leverageCap)
      if (leverageUsed > cap) {
        notional = equityBefore * cap
        actualRiskUsd = notional * stopPct
        leverageUsed = cap
        capped = true
        cappedCount++
      }
    } else {
      actualRiskUsd = 0
      notional = 0
      leverageUsed = 0
    }

    const pnlUsd = actualRiskUsd * r
    let equityAfter = equityBefore + pnlUsd
    if (equityAfter <= 0) {
      equityAfter = 0
      ruined = true
      ruinedAtIndex = i
    }
    equity = equityAfter

    steps.push({
      id: t.id,
      symbol: t.symbol,
      kind: t.kind,
      bar_time: t.bar_time,
      rMultiple: r,
      stopPct,
      targetRiskUsd,
      actualRiskUsd,
      notional,
      leverageUsed,
      capped,
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
    agg.netR += r
    setupMap.set(key, agg)
  }

  const setupRace = [...setupMap.values()].sort((a, b) => b.netUsd - a.netUsd)

  return {
    steps,
    equityPath,
    finalEquity: equity,
    startUsd: params.startUsd,
    netPnl: equity - params.startUsd,
    ruined,
    ruinedAtIndex,
    cappedCount,
    setupRace,
  }
}
