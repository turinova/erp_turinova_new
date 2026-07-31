import type {
  BacktestConfig,
  BacktestResult,
  Bar,
  BarFile,
  ExitReason,
  SimTrade,
  StrategyId,
  StrategyStats,
} from "./types"

/**
 * Egyszerűsített, konzervatív szimulációs modell 5 perces gyertyákon:
 * - entry mindig a jelzést adó gyertya ZÁRÓ árán
 * - stop fill a stop áron, target fill a target áron
 * - ha egy gyertyán belül a stop ÉS a target is elérhető lett volna,
 *   a STOP-ot számoljuk (worst case)
 * - cutoff-kor (pl. 11:00 ET) minden nyitott pozíció a záró áron zár
 */

interface SessionBar extends Bar {
  /** percek 0:00 ET-től (pl. 9:30 → 570) */
  etMinutes: number
  etTime: string
  /** hányadik RTH gyertya a session-ben */
  slot: number
  vwap: number
}

interface Session {
  date: string
  bars: SessionBar[]
  orbHigh: number
  orbLow: number
  orbRange: number
  /** az ORB utáni első gyertya indexe */
  orbEndIdx: number
  /** slot → átlagvolumen az előző max. 20 session azonos slotjából */
  rvol: (idx: number) => number
}

import { RTH_OPEN_MIN as RTH_OPEN, toEt } from "../et-time"

/** RTH session-ökre bontás + VWAP + RVOL előkészítés. */
export function buildSessions(barFile: BarFile, config: BacktestConfig): Session[] {
  const cutoffMin = config.cutoffHourEt * 60
  const byDate = new Map<string, SessionBar[]>()

  for (const bar of barFile.bars) {
    const et = toEt(bar.t)
    if (et.minutes < RTH_OPEN || et.minutes >= cutoffMin) continue
    const list = byDate.get(et.date) ?? []
    list.push({
      ...bar,
      etMinutes: et.minutes,
      etTime: et.time,
      slot: Math.floor((et.minutes - RTH_OPEN) / 5),
      vwap: 0,
    })
    byDate.set(et.date, list)
  }

  const sessions: Session[] = []
  const volHistory: number[][] = [] // sessionenként: slot → volumen

  const orbBarCount = Math.max(1, Math.round(config.orbMinutes / 5))

  for (const [date, bars] of [...byDate.entries()].sort()) {
    bars.sort((a, b) => a.t - b.t)
    // hiányos session (ünnepnap, fél nap, mai csonka nap) kihagyása
    if (bars.length < orbBarCount + 3) continue

    // VWAP
    let cumPV = 0
    let cumV = 0
    for (const b of bars) {
      const typical = (b.h + b.l + b.c) / 3
      cumPV += typical * b.v
      cumV += b.v
      b.vwap = cumV > 0 ? cumPV / cumV : b.c
    }

    const orbBars = bars.slice(0, orbBarCount)
    const orbHigh = Math.max(...orbBars.map((b) => b.h))
    const orbLow = Math.min(...orbBars.map((b) => b.l))

    // RVOL: az előző max. 20 session azonos slotjának átlagvolumene
    const history = volHistory.slice(-20)
    const rvol = (idx: number) => {
      const slot = bars[idx].slot
      const samples = history
        .map((h) => h[slot])
        .filter((v): v is number => v != null && v > 0)
      if (samples.length < 5) return 1 // nincs elég adat → nem szűrünk
      const avg = samples.reduce((a, b) => a + b, 0) / samples.length
      return avg > 0 ? bars[idx].v / avg : 1
    }

    sessions.push({
      date,
      bars,
      orbHigh,
      orbLow,
      orbRange: orbHigh - orbLow,
      orbEndIdx: orbBarCount,
      rvol,
    })

    const slotVols: number[] = []
    for (const b of bars) slotVols[b.slot] = b.v
    volHistory.push(slotVols)
  }

  return sessions
}

/** Pozíció menedzselés entry után: stop/target/cutoff. */
function manageTrade(
  session: Session,
  entryIdx: number,
  direction: "long" | "short",
  entry: number,
  stop: number,
  target: number
): { exit: number; exitIdx: number; exitReason: ExitReason } {
  const bars = session.bars
  for (let i = entryIdx + 1; i < bars.length; i++) {
    const b = bars[i]
    if (direction === "long") {
      if (b.l <= stop) return { exit: stop, exitIdx: i, exitReason: "stop" }
      if (b.h >= target) return { exit: target, exitIdx: i, exitReason: "target" }
    } else {
      if (b.h >= stop) return { exit: stop, exitIdx: i, exitReason: "stop" }
      if (b.l <= target) return { exit: target, exitIdx: i, exitReason: "target" }
    }
  }
  const last = bars[bars.length - 1]
  return { exit: last.c, exitIdx: bars.length - 1, exitReason: "cutoff" }
}

function makeTrade(
  session: Session,
  strategy: StrategyId,
  direction: "long" | "short",
  entryIdx: number,
  entry: number,
  stop: number,
  targetR: number
): SimTrade | null {
  const risk = direction === "long" ? entry - stop : stop - entry
  if (risk <= 0) return null
  const target = direction === "long" ? entry + targetR * risk : entry - targetR * risk
  const { exit, exitIdx, exitReason } = manageTrade(
    session,
    entryIdx,
    direction,
    entry,
    stop,
    target
  )
  const r =
    direction === "long" ? (exit - entry) / risk : (entry - exit) / risk
  return {
    date: session.date,
    strategy,
    direction,
    entryTimeEt: session.bars[entryIdx].etTime,
    exitTimeEt: session.bars[exitIdx].etTime,
    entry: round2(entry),
    stop: round2(stop),
    target: round2(target),
    exit: round2(exit),
    exitReason,
    r: Math.round(r * 100) / 100,
  }
}

/** ORB breakout — az első záró-ár szerinti kitörés a range-ből, filterekkel. */
function runOrb(session: Session, config: BacktestConfig): SimTrade[] {
  if (session.orbRange < config.minRangePoints) return []

  for (let i = session.orbEndIdx; i < session.bars.length; i++) {
    const b = session.bars[i]
    const brokeUp = b.c > session.orbHigh
    const brokeDown = b.c < session.orbLow
    if (!brokeUp && !brokeDown) continue

    const direction = brokeUp ? "long" : "short"
    if (config.vwapFilter) {
      if (direction === "long" && b.c <= b.vwap) return []
      if (direction === "short" && b.c >= b.vwap) return []
    }
    if (config.volumeFilter && session.rvol(i) < config.rvolThreshold) return []

    const stop = direction === "long" ? session.orbLow : session.orbHigh
    const trade = makeTrade(session, "orb", direction, i, b.c, stop, config.targetR)
    return trade ? [trade] : []
  }
  return []
}

/**
 * Failed breakout fade — kitörés utáni visszazárás a range-be
 * (max. 6 gyertyán belül) → belépés az ellenkező irányba.
 */
function runFade(session: Session, config: BacktestConfig): SimTrade[] {
  if (session.orbRange < config.minRangePoints) return []
  const bars = session.bars

  for (let i = session.orbEndIdx; i < bars.length; i++) {
    const b = bars[i]
    const brokeUp = b.c > session.orbHigh
    const brokeDown = b.c < session.orbLow
    if (!brokeUp && !brokeDown) continue

    // kitörés történt — figyeljük, visszazár-e a range-be
    let extreme = brokeUp ? b.h : b.l
    for (let j = i + 1; j <= Math.min(i + 6, bars.length - 1); j++) {
      const bj = bars[j]
      extreme = brokeUp ? Math.max(extreme, bj.h) : Math.min(extreme, bj.l)

      const failedUp = brokeUp && bj.c < session.orbHigh
      const failedDown = brokeDown && bj.c > session.orbLow
      if (!failedUp && !failedDown) continue

      const direction = failedUp ? "short" : "long"
      const stop = extreme
      const trade = makeTrade(
        session,
        "failed_breakout_fade",
        direction,
        j,
        bj.c,
        stop,
        config.targetR
      )
      return trade ? [trade] : []
    }
    return [] // kitört és nem zárt vissza időben → nincs fade setup
  }
  return []
}

/**
 * VWAP reversion — range napokon (10:30 ET-ig nincs záró-ár szerinti kitörés):
 * ha az ár 0.6×ORB-range-re eltávolodik a VWAP-tól, belépés vissza a VWAP felé.
 * Megjegyzés: NQ-n a 15p ORB-t az esetek nagy részében kitörik 10:30-ig,
 * ezért ez a setup ritka (~2 nap / 50 session) — ez nem hiba, hanem adat.
 */
function runVwapReversion(session: Session, config: BacktestConfig): SimTrade[] {
  if (session.orbRange < config.minRangePoints) return []
  const bars = session.bars
  const tenThirty = 10 * 60 + 30

  // kitörés-ellenőrzés 10:30-ig
  for (const b of bars) {
    if (b.etMinutes >= tenThirty) break
    if (b.c > session.orbHigh || b.c < session.orbLow) return []
  }

  const dev = 0.6 * session.orbRange
  for (let i = session.orbEndIdx; i < bars.length; i++) {
    const b = bars[i]
    if (b.etMinutes < 10 * 60) continue

    const distance = b.c - b.vwap
    if (Math.abs(distance) < dev) continue

    const direction = distance > 0 ? "short" : "long"
    const stop =
      direction === "short"
        ? b.c + 0.5 * session.orbRange
        : b.c - 0.5 * session.orbRange
    // target: vissza a VWAP-ra
    const risk = 0.5 * session.orbRange
    const targetR = Math.abs(distance) / risk
    const trade = makeTrade(
      session,
      "vwap_reversion",
      direction,
      i,
      b.c,
      stop,
      Math.min(targetR, config.targetR * 1.5)
    )
    return trade ? [trade] : []
  }
  return []
}

/**
 * Momentum pullback — érvényes ORB kitörés UTÁN az első VWAP-visszateszt,
 * ami a trend irányába zár → folytatólagos belépés.
 */
function runMomentumPullback(session: Session, config: BacktestConfig): SimTrade[] {
  if (session.orbRange < config.minRangePoints) return []
  const bars = session.bars

  for (let i = session.orbEndIdx; i < bars.length; i++) {
    const b = bars[i]
    const brokeUp = b.c > session.orbHigh
    const brokeDown = b.c < session.orbLow
    if (!brokeUp && !brokeDown) continue

    // kitörés után keressük az első VWAP-visszatesztet
    for (let j = i + 1; j < bars.length; j++) {
      const bj = bars[j]
      if (brokeUp) {
        // ha közben a range alá esik vissza, a trend érvénytelen
        if (bj.c < session.orbLow) return []
        if (bj.l <= bj.vwap && bj.c > bj.vwap) {
          const trade = makeTrade(
            session,
            "momentum_pullback",
            "long",
            j,
            bj.c,
            bj.l,
            config.targetR
          )
          return trade ? [trade] : []
        }
      } else {
        if (bj.c > session.orbHigh) return []
        if (bj.h >= bj.vwap && bj.c < bj.vwap) {
          const trade = makeTrade(
            session,
            "momentum_pullback",
            "short",
            j,
            bj.c,
            bj.h,
            config.targetR
          )
          return trade ? [trade] : []
        }
      }
    }
    return []
  }
  return []
}

const STRATEGY_RUNNERS: Record<
  StrategyId,
  (s: Session, c: BacktestConfig) => SimTrade[]
> = {
  orb: runOrb,
  failed_breakout_fade: runFade,
  vwap_reversion: runVwapReversion,
  momentum_pullback: runMomentumPullback,
}

export function runBacktest(barFile: BarFile, config: BacktestConfig): BacktestResult {
  const sessions = buildSessions(barFile, config)
  const trades: SimTrade[] = []

  for (const session of sessions) {
    for (const strategy of config.strategies) {
      trades.push(...STRATEGY_RUNNERS[strategy](session, config))
    }
  }

  trades.sort((a, b) =>
    `${a.date} ${a.entryTimeEt}`.localeCompare(`${b.date} ${b.entryTimeEt}`)
  )

  const perStrategy = config.strategies.map((s) =>
    computeStats(s, trades.filter((t) => t.strategy === s))
  )
  const combined = computeStats("combined", trades)

  let equity = 0
  const equityR = trades.map((t) => Math.round((equity += t.r) * 100) / 100)

  return {
    symbol: barFile.symbol,
    interval: barFile.interval,
    sessionCount: sessions.length,
    firstDate: sessions[0]?.date ?? "",
    lastDate: sessions[sessions.length - 1]?.date ?? "",
    config,
    combined,
    perStrategy,
    equityR,
    trades,
  }
}

function computeStats(
  strategy: StrategyId | "combined",
  trades: SimTrade[]
): StrategyStats {
  const wins = trades.filter((t) => t.r > 0)
  const losses = trades.filter((t) => t.r < 0)
  const netR = sum(trades.map((t) => t.r))
  const sumWin = sum(wins.map((t) => t.r))
  const sumLoss = Math.abs(sum(losses.map((t) => t.r)))

  let peak = 0
  let equity = 0
  let maxDd = 0
  for (const t of trades) {
    equity += t.r
    peak = Math.max(peak, equity)
    maxDd = Math.max(maxDd, peak - equity)
  }

  return {
    strategy,
    trades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: trades.length > 0 ? (wins.length / (wins.length + losses.length || 1)) * 100 : 0,
    netR,
    avgR: trades.length > 0 ? Math.round((netR / trades.length) * 100) / 100 : 0,
    profitFactor: sumLoss > 0 ? Math.round((sumWin / sumLoss) * 100) / 100 : null,
    maxDrawdownR: Math.round(maxDd * 100) / 100,
    longNetR: sum(trades.filter((t) => t.direction === "long").map((t) => t.r)),
    shortNetR: sum(trades.filter((t) => t.direction === "short").map((t) => t.r)),
  }
}

function sum(ns: number[]): number {
  return Math.round(ns.reduce((a, b) => a + b, 0) * 100) / 100
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
