import type { Bar } from "../backtest/types"
import { computeBuildups, type BuildupCtx } from "./buildup"
import { DOGE_RVOL_BASE, DOGE_RVOL_CATALYST } from "./context"
import { adx, aggregate, atr, rollingRvol, sessionVwapSeries } from "./indicators"
import { getSettlementInfo } from "./settlement"
import {
  findActiveFvgs,
  findEqualLevels,
  fundingZScore,
  sessionRange,
  SESSION_SPECS,
  volumeConfluence,
} from "./structure"
import {
  ALL_SETUPS_ENABLED,
  TRADED_SYMBOLS,
  type BtcContext,
  type BtcRegime,
  type CryptoFeed,
  type CryptoSignal,
  type CryptoSnapshot,
  type EnabledSetups,
  type MarketContext,
  type OiRegime,
  type SymbolFeed,
  type SymbolSnapshot,
  type TradedSymbol,
} from "./types"

/**
 * Crypto signal engine — SOL + DOGE, BTC/ETH kontextussal.
 *
 * Setupok (prioritási sorrendben):
 *   1. SWEEP    — prev day/week H/L + equal H/L sweep + reclaim (+ volumen)
 *   2. FVG      — 5m fair value gap tap + reclaim
 *   3. BREAKOUT — Asia / London / US-open session range breakout
 *   4. PB       — momentum pullback: kitörés utáni VWAP-visszateszt
 *   5. MR       — VWAP mean reversion (csak ha ADX < 25, azaz range piac)
 *
 * Kapuk:
 *   - Funding settlement ±10p → minden setup tiltva
 *   - BTC-rezsim: long csak ha nem risk_off, short csak ha nem risk_on
 *   - DOGE: RVOL kapu (1.3 / 1.0 katalizátor módban)
 *   - OI squeeze → long sweep/breakout tiltva
 *   - Funding: z-score |z|≥2 elsődleges; fallback abszolút 0.05%/8h
 *   - Chase guard (≤0.75R), breakout életkor (≤30p), MR út ≥1R, PB stop ≤2×ATR
 */

const NO_SIGNAL: CryptoSignal = { kind: "NONE", entry: null, stop: null, target: null, reason: "", ageBars: null }

// Küszöbök
const ADX_RANGE_MAX = 25
const MR_DIST_ATR = 2.0
const SWEEP_MIN_DEPTH_ATR = 0.2
const SWEEP_MAX_DEPTH_ATR = 1.5
const BREAKOUT_RVOL_MIN = 1.5
const FUNDING_EXTREME = 0.0005 // 0.05% / 8h — fallback, ha nincs z-score
const FUNDING_Z_EXTREME = 2.0
const SIGNAL_MAX_AGE_BARS = 10
const BREAKOUT_WINDOW_BARS = 30
const CHASE_GUARD_R = 0.75
const PULLBACK_MAX_STOP_ATR = 2
const SWEEP_VOL_MIN = 1.2

const EMPTY_CONTEXT: MarketContext = {
  settlement: { nextUtc: "00:00", minutesLeft: 0, inFreeze: false },
  btcCatalysts: [],
  sol: {
    oiDelta1hPct: null,
    oiDelta4hPct: null,
    oiRegime: "unknown",
    catalystMode: false,
    rvolGate: 0,
    catalysts: [],
  },
  doge: {
    oiDelta1hPct: null,
    oiDelta4hPct: null,
    oiRegime: "unknown",
    catalystMode: false,
    rvolGate: DOGE_RVOL_BASE,
    catalysts: [],
  },
}

export interface CryptoComputeInput {
  feed: CryptoFeed
  /** teszteléshez: szimulált "most" unix sec */
  nowSec?: number
  guardrail?: string | null
  /** melyik setupokat futtassa az engine — default: mind */
  enabledSetups?: EnabledSetups
  /** OI + hír + settlement kontextus */
  marketContext?: MarketContext
}

export function computeCryptoSnapshot(input: CryptoComputeInput): CryptoSnapshot {
  const now = input.nowSec ?? Math.floor(Date.now() / 1000)
  const d = new Date(now * 1000)
  const utcDate = d.toISOString().slice(0, 10)
  const utcTime = d.toISOString().slice(11, 16)
  const enabled = input.enabledSetups ?? ALL_SETUPS_ENABLED
  const marketContext: MarketContext = {
    ...(input.marketContext ?? EMPTY_CONTEXT),
    settlement: getSettlementInfo(now),
  }
  // OI/hír mezőket a hívótól tartjuk meg (ha adott)
  if (input.marketContext) {
    marketContext.btcCatalysts = input.marketContext.btcCatalysts
    marketContext.sol = input.marketContext.sol
    marketContext.doge = input.marketContext.doge
  }

  const btc = computeBtcContext(input.feed.symbols.BTC, input.feed.symbols.ETH, now)

  const symbols = TRADED_SYMBOLS.map((sym) =>
    computeSymbol(
      input.feed.symbols[sym],
      sym,
      btc,
      now,
      input.guardrail ?? null,
      enabled,
      marketContext
    )
  )

  return {
    fetchedAt: input.feed.fetchedAt,
    source: input.feed.source,
    utcDate,
    utcTime,
    btc,
    symbols,
    guardrail: input.guardrail ?? null,
    context: marketContext,
  }
}

// ---------------------------------------------------------------
// BTC/ETH kontextus
// ---------------------------------------------------------------

function computeBtcContext(btcFeed: SymbolFeed, ethFeed: SymbolFeed, now: number): BtcContext {
  const bars = btcFeed.bars.filter((b) => b.t <= now)
  const last = bars[bars.length - 1] ?? null
  const bars5m = aggregate(bars, 5)
  const atr5 = atr(bars5m)
  const vwapSeries = sessionVwapSeries(bars)
  const vwap = vwapSeries[vwapSeries.length - 1]?.v ?? null

  let vwapDistAtr: number | null = null
  if (last && vwap != null && atr5 != null && atr5 > 0) {
    vwapDistAtr = (last.c - vwap) / atr5
  }

  // 15 perces hirtelen mozgás ATR-szorzóban
  let shock: number | null = null
  if (last && atr5 != null && atr5 > 0 && bars.length > 15) {
    const ago = bars[bars.length - 16]
    shock = (last.c - ago.c) / atr5
  }

  let regime: BtcRegime = "neutral"
  let note = "BTC semleges (VWAP körül)"
  if (shock != null && shock <= -1.5) {
    regime = "risk_off"
    note = `BTC hirtelen esik (${shock.toFixed(1)}×ATR / 15p) — long signalok tiltva`
  } else if (shock != null && shock >= 1.5) {
    regime = "risk_on"
    note = `BTC hirtelen emelkedik (+${shock.toFixed(1)}×ATR / 15p) — short signalok tiltva`
  } else if (vwapDistAtr != null && vwapDistAtr > 0.5) {
    regime = "risk_on"
    note = "BTC a napi VWAP felett — long irány preferált"
  } else if (vwapDistAtr != null && vwapDistAtr < -0.5) {
    regime = "risk_off"
    note = "BTC a napi VWAP alatt — short irány preferált"
  }

  const ethBars = ethFeed.bars.filter((b) => b.t <= now)
  const ethLast = ethBars[ethBars.length - 1] ?? null

  return {
    regime,
    note,
    btcPrice: last?.c ?? null,
    btcVwapDistAtr: vwapDistAtr,
    btcChange24hPct: btcFeed.change24hPct,
    ethPrice: ethLast?.c ?? null,
    ethChange24hPct: ethFeed.change24hPct,
    btcShock15m: shock,
  }
}


// ---------------------------------------------------------------
// Symbol snapshot + signalok
// ---------------------------------------------------------------

function computeSymbol(
  feed: SymbolFeed,
  symbol: TradedSymbol,
  btc: BtcContext,
  now: number,
  guardrail: string | null,
  enabled: EnabledSetups,
  market: MarketContext
): SymbolSnapshot {
  const bars = feed.bars.filter((b) => b.t <= now)
  const last = bars[bars.length - 1] ?? null
  const bars5m = aggregate(bars, 5)
  const atr5 = atr(bars5m)
  const adx5 = adx(bars5m)
  const rvol = rollingRvol(bars)
  const vwapSeries = sessionVwapSeries(bars)
  const vwap = vwapSeries[vwapSeries.length - 1]?.v ?? null
  const fundingZ = fundingZScore(feed.fundingHistory ?? [])

  let vwapDistAtr: number | null = null
  if (last && vwap != null && atr5 != null && atr5 > 0) {
    vwapDistAtr = (last.c - vwap) / atr5
  }

  const todayStart = Math.floor(now / 86400) * 86400
  const fullDays = feed.dailyBars.filter((b) => b.t < todayStart)
  const prevDay = fullDays[fullDays.length - 1] ?? null
  const prevWeekDays = fullDays.slice(-7)
  const prevWeekHigh = prevWeekDays.length ? Math.max(...prevWeekDays.map((b) => b.h)) : null
  const prevWeekLow = prevWeekDays.length ? Math.min(...prevWeekDays.map((b) => b.l)) : null

  const nowMin = Math.floor((now - todayStart) / 60)
  const usSpec = SESSION_SPECS.find((s) => s.id === "us")!
  const londonSpec = SESSION_SPECS.find((s) => s.id === "london")!
  const asiaSpec = SESSION_SPECS.find((s) => s.id === "asia")!
  const usRange = nowMin >= usSpec.rangeEndMin ? sessionRange(bars, todayStart, usSpec) : null
  const londonRange = nowMin >= londonSpec.rangeEndMin ? sessionRange(bars, todayStart, londonSpec) : null
  const asiaRange = nowMin >= asiaSpec.rangeEndMin ? sessionRange(bars, todayStart, asiaSpec) : null
  const usOpenHigh = usRange?.complete ? usRange.high : null
  const usOpenLow = usRange?.complete ? usRange.low : null
  const londonHigh = londonRange?.complete ? londonRange.high : null
  const londonLow = londonRange?.complete ? londonRange.low : null
  const asiaHigh = asiaRange?.complete ? asiaRange.high : null
  const asiaLow = asiaRange?.complete ? asiaRange.low : null

  const equalLevels = atr5 != null && atr5 > 0 ? findEqualLevels(bars5m, atr5) : []
  const equalHigh = equalLevels.find((l) => l.dir === "short")?.level ?? null
  const equalLow = equalLevels.find((l) => l.dir === "long")?.level ?? null
  const fvgs = findActiveFvgs(bars5m)

  let signal = NO_SIGNAL
  const symCtx = symbol === "SOL" ? market.sol : market.doge
  const dogeRvolMin = symCtx.catalystMode ? DOGE_RVOL_CATALYST : DOGE_RVOL_BASE
  const oiRegime: OiRegime = symCtx.oiRegime
  const catalystMode = symbol === "DOGE" ? symCtx.catalystMode : false

  if (market.settlement.inFreeze) {
    signal = {
      ...NO_SIGNAL,
      reason: `Funding settlement ablak (±10p a ${market.settlement.nextUtc} UTC körül) — nincs új entry`,
    }
  } else if (guardrail) {
    signal = { ...NO_SIGNAL, reason: guardrail }
  } else if (last && atr5 != null && atr5 > 0 && vwap != null) {
    if (symbol === "DOGE" && (rvol == null || rvol < dogeRvolMin)) {
      signal = {
        ...NO_SIGNAL,
        reason: catalystMode
          ? `DOGE volumen-kapu (katalizátor mód): RVOL ${rvol?.toFixed(2) ?? "?"} < ${dogeRvolMin}`
          : `DOGE volumen-kapu: RVOL ${rvol?.toFixed(2) ?? "?"} < ${dogeRvolMin} — katalizátor nélkül nem tradelünk`,
      }
    } else {
      const ctx: SignalCtx = {
        bars,
        bars5m,
        last,
        atr: atr5,
        adx: adx5,
        rvol,
        vwap,
        vwapSeries,
        funding: feed.fundingRate,
        fundingZ,
        btcRegime: btc.regime,
        prevDayHigh: prevDay?.h ?? null,
        prevDayLow: prevDay?.l ?? null,
        prevWeekHigh,
        prevWeekLow,
        equalLevels,
        fvgs,
        usOpenHigh,
        usOpenLow,
        londonHigh,
        londonLow,
        asiaHigh,
        asiaLow,
        nowMin,
        todayStart,
        oiRegime,
      }

      signal =
        (enabled.sweep ? trySweep(ctx) : null) ??
        (enabled.fvg ? tryFvg(ctx) : null) ??
        (enabled.breakout ? trySessionBreakouts(ctx) : null) ??
        (enabled.pullback ? tryPullback(ctx) : null) ??
        (enabled.mean_rev ? tryMeanReversion(ctx) : null) ??
        { ...NO_SIGNAL, reason: waitReason(ctx) }
    }
  } else {
    signal = { ...NO_SIGNAL, reason: "Kevés adat (ATR/VWAP még nem számolható)" }
  }

  let buildups: SymbolSnapshot["buildups"] = []
  if (last && atr5 != null && atr5 > 0 && vwap != null) {
    const bctx: BuildupCtx = {
      bars,
      bars5m,
      last,
      atr: atr5,
      adx: adx5,
      rvol,
      vwap,
      vwapSeries,
      funding: feed.fundingRate,
      fundingZ,
      btcRegime: btc.regime,
      prevDayHigh: prevDay?.h ?? null,
      prevDayLow: prevDay?.l ?? null,
      prevWeekHigh,
      prevWeekLow,
      equalHigh,
      equalLow,
      fvgs,
      usOpenHigh,
      usOpenLow,
      londonHigh,
      londonLow,
      asiaHigh,
      asiaLow,
      nowMin,
      todayStart,
      oiRegime,
      settlementFreeze: market.settlement.inFreeze,
      dogeRvolMin: symbol === "DOGE" ? dogeRvolMin : null,
    }
    buildups = computeBuildups(bctx)
  }

  const chartBars = bars.slice(-360)
  const chartFromT = chartBars[0]?.t ?? 0

  return {
    symbol,
    lastPrice: last?.c ?? null,
    lastBarT: last?.t ?? null,
    change24hPct: feed.change24hPct,
    vwap,
    vwapDistAtr,
    atr: atr5,
    rvol,
    adx: adx5,
    fundingRate: feed.fundingRate,
    fundingZ,
    openInterest: feed.openInterest,
    oiDelta1hPct: symCtx.oiDelta1hPct,
    oiRegime,
    catalystMode,
    prevDayHigh: prevDay?.h ?? null,
    prevDayLow: prevDay?.l ?? null,
    prevWeekHigh,
    prevWeekLow,
    usOpenHigh,
    usOpenLow,
    asiaHigh,
    asiaLow,
    londonHigh,
    londonLow,
    equalHigh,
    equalLow,
    signal,
    buildups,
    chartBars,
    vwapSeries: vwapSeries.filter((p) => p.t >= chartFromT),
  }
}

interface SignalCtx {
  bars: Bar[]
  bars5m: Bar[]
  last: Bar
  atr: number
  adx: number | null
  rvol: number | null
  vwap: number
  vwapSeries: { t: number; v: number }[]
  funding: number | null
  fundingZ: number | null
  btcRegime: BtcRegime
  prevDayHigh: number | null
  prevDayLow: number | null
  prevWeekHigh: number | null
  prevWeekLow: number | null
  equalLevels: ReturnType<typeof findEqualLevels>
  fvgs: ReturnType<typeof findActiveFvgs>
  usOpenHigh: number | null
  usOpenLow: number | null
  londonHigh: number | null
  londonLow: number | null
  asiaHigh: number | null
  asiaLow: number | null
  nowMin: number
  todayStart: number
  oiRegime: OiRegime
}

function directionBlock(
  ctx: SignalCtx,
  dir: "long" | "short",
  kind?: "sweep" | "breakout" | "other"
): string | null {
  if (dir === "long" && ctx.btcRegime === "risk_off") return "BTC risk-off — long tiltva"
  if (dir === "short" && ctx.btcRegime === "risk_on") return "BTC risk-on — short tiltva"

  if (ctx.fundingZ != null) {
    if (dir === "long" && ctx.fundingZ >= FUNDING_Z_EXTREME)
      return `Funding z-score ${ctx.fundingZ.toFixed(1)} — long oldal túlzsúfolt`
    if (dir === "short" && ctx.fundingZ <= -FUNDING_Z_EXTREME)
      return `Funding z-score ${ctx.fundingZ.toFixed(1)} — short oldal túlzsúfolt`
  } else {
    if (dir === "long" && ctx.funding != null && ctx.funding > FUNDING_EXTREME)
      return "Extrém pozitív funding — a long oldal túlzsúfolt"
    if (dir === "short" && ctx.funding != null && ctx.funding < -FUNDING_EXTREME)
      return "Extrém negatív funding — a short oldal túlzsúfolt"
  }

  if (dir === "long" && (kind === "sweep" || kind === "breakout") && ctx.oiRegime === "squeeze") {
    return "OI squeeze (ár↑ OI↓) — long kitörés chase veszély"
  }
  return null
}

function fundingNote(ctx: SignalCtx, dir: "long" | "short"): string {
  if (ctx.fundingZ != null) {
    if (dir === "short" && ctx.fundingZ >= FUNDING_Z_EXTREME)
      return ` + funding z=${ctx.fundingZ.toFixed(1)} — squeeze-konfluencia`
    if (dir === "long" && ctx.fundingZ <= -FUNDING_Z_EXTREME)
      return ` + funding z=${ctx.fundingZ.toFixed(1)} — squeeze-konfluencia`
    return ""
  }
  if (ctx.funding == null) return ""
  const pct = (ctx.funding * 100).toFixed(3)
  if (dir === "short" && ctx.funding > FUNDING_EXTREME)
    return ` + funding extrém pozitív (${pct}%) — squeeze-konfluencia`
  if (dir === "long" && ctx.funding < -FUNDING_EXTREME)
    return ` + funding extrém negatív (${pct}%) — squeeze-konfluencia`
  return ""
}

function trySweep(ctx: SignalCtx): CryptoSignal | null {
  const recent = ctx.bars.slice(-SIGNAL_MAX_AGE_BARS)

  const shortLevels: { name: string; level: number }[] = []
  if (ctx.prevDayHigh != null) shortLevels.push({ name: "prev day high", level: ctx.prevDayHigh })
  if (ctx.prevWeekHigh != null && ctx.prevWeekHigh !== ctx.prevDayHigh)
    shortLevels.push({ name: "prev week high", level: ctx.prevWeekHigh })
  for (const eq of ctx.equalLevels.filter((l) => l.dir === "short")) {
    if (!shortLevels.some((s) => Math.abs(s.level - eq.level) < 0.05 * ctx.atr)) {
      shortLevels.push({ name: eq.name, level: eq.level })
    }
  }

  const longLevels: { name: string; level: number }[] = []
  if (ctx.prevDayLow != null) longLevels.push({ name: "prev day low", level: ctx.prevDayLow })
  if (ctx.prevWeekLow != null && ctx.prevWeekLow !== ctx.prevDayLow)
    longLevels.push({ name: "prev week low", level: ctx.prevWeekLow })
  for (const eq of ctx.equalLevels.filter((l) => l.dir === "long")) {
    if (!longLevels.some((s) => Math.abs(s.level - eq.level) < 0.05 * ctx.atr)) {
      longLevels.push({ name: eq.name, level: eq.level })
    }
  }

  for (const { name, level } of shortLevels) {
    for (let i = recent.length - 1; i >= 0; i--) {
      const b = recent[i]
      const depth = (b.h - level) / ctx.atr
      if (b.h > level && b.c < level && depth >= SWEEP_MIN_DEPTH_ATR && depth <= SWEEP_MAX_DEPTH_ATR) {
        const block = directionBlock(ctx, "short", "sweep")
        if (block) return { ...NO_SIGNAL, reason: `Sweep short setup a(z) ${name} szinten, de: ${block}` }
        const vol = volumeConfluence(ctx.bars, b, 20, SWEEP_VOL_MIN)
        if (!vol.ok)
          return {
            ...NO_SIGNAL,
            reason: `Sweep short a(z) ${name} szinten, de gyenge volumen (${vol.mult.toFixed(2)}× < ${SWEEP_VOL_MIN}×) — nincs absorption`,
          }
        const entry = b.c
        const stop = b.h + 0.1 * ctx.atr
        const risk = stop - entry
        if (risk <= 0) continue
        if (entry - ctx.last.c > CHASE_GUARD_R * risk)
          return { ...NO_SIGNAL, reason: `Sweep short volt a(z) ${name} szinten, de az ár már elment — nem kergetjük` }
        return {
          kind: "SWEEP_SHORT",
          entry,
          stop: round(stop),
          target: round(entry - 2 * risk),
          reason: `Liquidity sweep a(z) ${name} (${level}) fölé + reclaim (vol ${vol.mult.toFixed(1)}×)${fundingNote(ctx, "short")}`,
          ageBars: recent.length - 1 - i,
        }
      }
    }
  }

  for (const { name, level } of longLevels) {
    for (let i = recent.length - 1; i >= 0; i--) {
      const b = recent[i]
      const depth = (level - b.l) / ctx.atr
      if (b.l < level && b.c > level && depth >= SWEEP_MIN_DEPTH_ATR && depth <= SWEEP_MAX_DEPTH_ATR) {
        const block = directionBlock(ctx, "long", "sweep")
        if (block) return { ...NO_SIGNAL, reason: `Sweep long setup a(z) ${name} szinten, de: ${block}` }
        const vol = volumeConfluence(ctx.bars, b, 20, SWEEP_VOL_MIN)
        if (!vol.ok)
          return {
            ...NO_SIGNAL,
            reason: `Sweep long a(z) ${name} szinten, de gyenge volumen (${vol.mult.toFixed(2)}× < ${SWEEP_VOL_MIN}×) — nincs absorption`,
          }
        const entry = b.c
        const stop = b.l - 0.1 * ctx.atr
        const risk = entry - stop
        if (risk <= 0) continue
        if (ctx.last.c - entry > CHASE_GUARD_R * risk)
          return { ...NO_SIGNAL, reason: `Sweep long volt a(z) ${name} szinten, de az ár már elment — nem kergetjük` }
        return {
          kind: "SWEEP_LONG",
          entry,
          stop: round(stop),
          target: round(entry + 2 * risk),
          reason: `Liquidity sweep a(z) ${name} (${level}) alá + reclaim (vol ${vol.mult.toFixed(1)}×)${fundingNote(ctx, "long")}`,
          ageBars: recent.length - 1 - i,
        }
      }
    }
  }

  return null
}

function tryFvg(ctx: SignalCtx): CryptoSignal | null {
  if (!ctx.fvgs.length) return null
  const recent = ctx.bars.slice(-SIGNAL_MAX_AGE_BARS)

  for (const gap of [...ctx.fvgs].reverse()) {
    for (let i = recent.length - 1; i >= 0; i--) {
      const b = recent[i]
      if (gap.dir === "long") {
        // tap: low belép a gapbe, close vissza a gap teteje fölé / gap belsejéből fel
        if (b.l <= gap.top && b.l >= gap.bottom - 0.1 * ctx.atr && b.c > gap.bottom && b.c > b.o) {
          const block = directionBlock(ctx, "long")
          if (block) return { ...NO_SIGNAL, reason: `FVG long tap, de: ${block}` }
          const entry = b.c
          const stop = Math.min(b.l, gap.bottom) - 0.1 * ctx.atr
          const risk = entry - stop
          if (risk <= 0 || risk > 2 * ctx.atr) continue
          if (ctx.last.c - entry > CHASE_GUARD_R * risk)
            return { ...NO_SIGNAL, reason: "FVG long tap volt, de az ár már elment — nem kergetjük" }
          return {
            kind: "FVG_LONG",
            entry,
            stop: round(stop),
            target: round(entry + 2 * risk),
            reason: `Bullish FVG tap (${round(gap.bottom)}–${round(gap.top)}) + reclaim${fundingNote(ctx, "long")}`,
            ageBars: recent.length - 1 - i,
          }
        }
      } else {
        if (b.h >= gap.bottom && b.h <= gap.top + 0.1 * ctx.atr && b.c < gap.top && b.c < b.o) {
          const block = directionBlock(ctx, "short")
          if (block) return { ...NO_SIGNAL, reason: `FVG short tap, de: ${block}` }
          const entry = b.c
          const stop = Math.max(b.h, gap.top) + 0.1 * ctx.atr
          const risk = stop - entry
          if (risk <= 0 || risk > 2 * ctx.atr) continue
          if (entry - ctx.last.c > CHASE_GUARD_R * risk)
            return { ...NO_SIGNAL, reason: "FVG short tap volt, de az ár már elment — nem kergetjük" }
          return {
            kind: "FVG_SHORT",
            entry,
            stop: round(stop),
            target: round(entry - 2 * risk),
            reason: `Bearish FVG tap (${round(gap.bottom)}–${round(gap.top)}) + reclaim${fundingNote(ctx, "short")}`,
            ageBars: recent.length - 1 - i,
          }
        }
      }
    }
  }
  return null
}

function trySessionBreakouts(ctx: SignalCtx): CryptoSignal | null {
  // prioritás: US → London → Asia (aktuális ablakban)
  for (const spec of SESSION_SPECS) {
    const sig = tryOneSessionBreakout(ctx, spec)
    if (sig) return sig
  }
  return null
}

function tryOneSessionBreakout(ctx: SignalCtx, spec: (typeof SESSION_SPECS)[number]): CryptoSignal | null {
  const high =
    spec.id === "us" ? ctx.usOpenHigh : spec.id === "london" ? ctx.londonHigh : ctx.asiaHigh
  const low = spec.id === "us" ? ctx.usOpenLow : spec.id === "london" ? ctx.londonLow : ctx.asiaLow
  if (high == null || low == null) return null
  if (ctx.nowMin < spec.rangeEndMin || ctx.nowMin > spec.windowEndMin) return null

  const windowBars = ctx.bars.filter(
    (b) =>
      b.t >= ctx.todayStart + spec.rangeEndMin * 60 &&
      b.t <= ctx.todayStart + spec.windowEndMin * 60
  )

  let breakout: { bar: Bar; dir: "long" | "short"; idx: number } | null = null
  for (let i = 0; i < windowBars.length; i++) {
    const b = windowBars[i]
    if (b.c > high) {
      breakout = { bar: b, dir: "long", idx: i }
      break
    }
    if (b.c < low) {
      breakout = { bar: b, dir: "short", idx: i }
      break
    }
  }
  if (!breakout) return null

  const barsSince = windowBars.length - 1 - breakout.idx
  if (barsSince > BREAKOUT_WINDOW_BARS)
    return {
      ...NO_SIGNAL,
      reason: `${spec.label} breakout ${breakout.dir} megvolt, de túl régi (${barsSince}p > ${BREAKOUT_WINDOW_BARS}p) — nem vesszük`,
      ageBars: barsSince,
    }

  if (ctx.rvol == null || ctx.rvol < BREAKOUT_RVOL_MIN)
    return {
      ...NO_SIGNAL,
      reason: `${spec.label} breakout ${breakout.dir}, de RVOL ${ctx.rvol?.toFixed(2) ?? "?"} < ${BREAKOUT_RVOL_MIN} — volumen nélkül nem érvényes`,
    }

  const block = directionBlock(ctx, breakout.dir, "breakout")
  if (block) return { ...NO_SIGNAL, reason: `${spec.label} breakout ${breakout.dir}, de: ${block}` }

  const entry = breakout.bar.c
  const stop =
    breakout.dir === "long" ? Math.max(low, entry - 1.5 * ctx.atr) : Math.min(high, entry + 1.5 * ctx.atr)
  const risk = Math.abs(entry - stop)
  if (risk <= 0) return null

  const moved = breakout.dir === "long" ? ctx.last.c - entry : entry - ctx.last.c
  if (moved > CHASE_GUARD_R * risk)
    return {
      ...NO_SIGNAL,
      reason: `${spec.label} breakout ${breakout.dir} megvolt, de az ár már elment — nem kergetjük`,
    }

  return {
    kind: breakout.dir === "long" ? "BREAKOUT_LONG" : "BREAKOUT_SHORT",
    entry,
    stop: round(stop),
    target: round(breakout.dir === "long" ? entry + 2 * risk : entry - 2 * risk),
    reason: `${spec.label} range breakout ${breakout.dir} (range: ${low}–${high}, RVOL ${ctx.rvol.toFixed(2)})`,
    ageBars: barsSince,
  }
}

function tryPullback(ctx: SignalCtx): CryptoSignal | null {
  const todayBars = ctx.bars.filter((b) => b.t >= ctx.todayStart)
  if (todayBars.length < 60) return null

  const vwapByT = new Map(ctx.vwapSeries.map((p) => [p.t, p.v]))
  let maxAbove = 0
  let maxBelow = 0
  for (const b of todayBars) {
    const v = vwapByT.get(b.t)
    if (v == null) continue
    maxAbove = Math.max(maxAbove, (b.h - v) / ctx.atr)
    maxBelow = Math.max(maxBelow, (v - b.l) / ctx.atr)
  }

  const dir: "long" | "short" | null =
    maxAbove >= 1.5 && ctx.last.c > ctx.vwap ? "long" : maxBelow >= 1.5 && ctx.last.c < ctx.vwap ? "short" : null
  if (!dir) return null

  const recent = ctx.bars.slice(-SIGNAL_MAX_AGE_BARS)
  const touched = recent.some((b) => {
    const v = vwapByT.get(b.t)
    return v != null && b.l <= v && b.h >= v
  })
  if (!touched) return null

  const lastV = vwapByT.get(ctx.last.t)
  if (lastV == null) return null

  if (dir === "long" && !(ctx.last.c > lastV && ctx.last.c > ctx.last.o)) return null
  if (dir === "short" && !(ctx.last.c < lastV && ctx.last.c < ctx.last.o)) return null

  const block = directionBlock(ctx, dir)
  if (block) return { ...NO_SIGNAL, reason: `Pullback ${dir} setup a VWAP-nál, de: ${block}` }

  const entry = ctx.last.c
  const recentLow = Math.min(...recent.map((b) => b.l))
  const recentHigh = Math.max(...recent.map((b) => b.h))
  const stop = dir === "long" ? recentLow - 0.1 * ctx.atr : recentHigh + 0.1 * ctx.atr
  const risk = Math.abs(entry - stop)
  if (risk <= 0) return null
  if (risk > PULLBACK_MAX_STOP_ATR * ctx.atr)
    return {
      ...NO_SIGNAL,
      reason: `Pullback ${dir} setup a VWAP-nál, de a stop túl széles (${(risk / ctx.atr).toFixed(1)}×ATR > ${PULLBACK_MAX_STOP_ATR}×ATR)`,
    }

  return {
    kind: dir === "long" ? "PB_LONG" : "PB_SHORT",
    entry,
    stop: round(stop),
    target: round(dir === "long" ? entry + 2 * risk : entry - 2 * risk),
    reason: `Momentum pullback ${dir}: trend után VWAP-visszateszt, close vissza trendirányba`,
    ageBars: 0,
  }
}

function tryMeanReversion(ctx: SignalCtx): CryptoSignal | null {
  if (ctx.adx == null || ctx.adx >= ADX_RANGE_MAX) return null

  const dist = (ctx.last.c - ctx.vwap) / ctx.atr
  if (Math.abs(dist) < MR_DIST_ATR) return null

  const dir: "long" | "short" = dist < 0 ? "long" : "short"
  const block = directionBlock(ctx, dir)
  if (block)
    return {
      ...NO_SIGNAL,
      reason: `Mean reversion ${dir} setup (${Math.abs(dist).toFixed(1)}×ATR a VWAP-tól), de: ${block}`,
    }

  const recent = ctx.bars.slice(-SIGNAL_MAX_AGE_BARS)
  const entry = ctx.last.c
  const stop =
    dir === "long"
      ? Math.min(...recent.map((b) => b.l)) - 0.75 * ctx.atr
      : Math.max(...recent.map((b) => b.h)) + 0.75 * ctx.atr
  const risk = Math.abs(entry - stop)
  if (risk <= 0) return null

  const toVwap = Math.abs(ctx.vwap - entry)
  if (toVwap < risk)
    return {
      ...NO_SIGNAL,
      reason: `Mean reversion ${dir} setup (${Math.abs(dist).toFixed(1)}×ATR a VWAP-tól), de az út a VWAP-ig nem éri meg (<1R)`,
    }

  return {
    kind: dir === "long" ? "MR_LONG" : "MR_SHORT",
    entry,
    stop: round(stop),
    target: round(ctx.vwap),
    reason: `VWAP mean reversion ${dir}: ár ${Math.abs(dist).toFixed(1)}×ATR-re a VWAP-tól, ADX ${ctx.adx.toFixed(0)} (range piac)${fundingNote(ctx, dir)}`,
    ageBars: 0,
  }
}

function waitReason(ctx: SignalCtx): string {
  const parts: string[] = []
  if (ctx.adx != null) parts.push(`ADX ${ctx.adx.toFixed(0)}`)
  if (ctx.rvol != null) parts.push(`RVOL ${ctx.rvol.toFixed(2)}`)
  if (ctx.fundingZ != null) parts.push(`fundZ ${ctx.fundingZ.toFixed(1)}`)
  const dist = (ctx.last.c - ctx.vwap) / ctx.atr
  parts.push(`VWAP-táv ${dist >= 0 ? "+" : ""}${dist.toFixed(1)}×ATR`)
  return `Nincs setup — várakozás (${parts.join(", ")})`
}

function round(n: number): number {
  return Math.round(n * 1e6) / 1e6
}
