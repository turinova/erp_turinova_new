import type { Bar } from "../backtest/types"

/**
 * Crypto modul — az NQ-tól teljesen független típusok.
 * Tradelt coinok: SOL, DOGE. Kontextus: BTC, ETH.
 */

export const TRADED_SYMBOLS = ["SOL", "DOGE"] as const
export const CONTEXT_SYMBOLS = ["BTC", "ETH"] as const
export const ALL_SYMBOLS = ["SOL", "DOGE", "BTC", "ETH"] as const

export type TradedSymbol = (typeof TRADED_SYMBOLS)[number]
export type CryptoSymbol = (typeof ALL_SYMBOLS)[number]

export type CryptoFeedSource = "bybit" | "binance" | "okx"

export interface SymbolFeed {
  symbol: CryptoSymbol
  /** 1m gyertyák, growing order (régi → új), kb. 16 óra */
  bars: Bar[]
  /** napi gyertyák (UTC nap), utolsó = mai (élő) */
  dailyBars: Bar[]
  /** utolsó funding rate (8h periódusra, pl. 0.0001 = 0.01%) — csak perp */
  fundingRate: number | null
  /** open interest coin-ban */
  openInterest: number | null
  /** 24h árváltozás százalékban */
  change24hPct: number | null
}

export interface CryptoFeed {
  source: CryptoFeedSource
  fetchedAt: number
  symbols: Record<CryptoSymbol, SymbolFeed>
}

export type CryptoSignalKind =
  | "SWEEP_LONG"
  | "SWEEP_SHORT"
  | "MR_LONG"
  | "MR_SHORT"
  | "BREAKOUT_LONG"
  | "BREAKOUT_SHORT"
  | "PB_LONG"
  | "PB_SHORT"
  | "NONE"

export const CRYPTO_KIND_LABEL: Record<string, string> = {
  SWEEP_LONG: "Sweep-reclaim LONG",
  SWEEP_SHORT: "Sweep-reclaim SHORT",
  MR_LONG: "VWAP mean-rev LONG",
  MR_SHORT: "VWAP mean-rev SHORT",
  BREAKOUT_LONG: "US-open breakout LONG",
  BREAKOUT_SHORT: "US-open breakout SHORT",
  PB_LONG: "Pullback LONG",
  PB_SHORT: "Pullback SHORT",
}

export type BtcRegime = "risk_on" | "risk_off" | "neutral"

/** A 4 setup-család — ezeket lehet ki/be kapcsolni a UI-n. */
export type CryptoSetupId = "sweep" | "breakout" | "pullback" | "mean_rev"

export const CRYPTO_SETUP_IDS: CryptoSetupId[] = ["sweep", "breakout", "pullback", "mean_rev"]

export const CRYPTO_SETUP_LABEL: Record<CryptoSetupId, string> = {
  sweep: "Sweep-reclaim",
  breakout: "US-open breakout",
  pullback: "Momentum pullback",
  mean_rev: "VWAP mean rev",
}

export type EnabledSetups = Record<CryptoSetupId, boolean>

export const ALL_SETUPS_ENABLED: EnabledSetups = {
  sweep: true,
  breakout: true,
  pullback: true,
  mean_rev: true,
}

export interface BuildupStep {
  label: string
  ok: boolean
  detail?: string
}

export interface SetupBuildup {
  id: CryptoSetupId
  label: string
  /** hány lépés kész / összes */
  done: number
  total: number
  /** a setup irány-hintje, ha már sejthető */
  bias: "long" | "short" | "none"
  steps: BuildupStep[]
  /** true, ha az összes lépés megvan (de a kapuk még blokkolhatnak) */
  ready: boolean
}

export interface CryptoSignal {
  kind: CryptoSignalKind
  entry: number | null
  stop: number | null
  target: number | null
  reason: string
  /** hány 1m gyertyával ezelőtt triggerelt */
  ageBars: number | null
}

export interface SymbolSnapshot {
  symbol: TradedSymbol
  lastPrice: number | null
  lastBarT: number | null
  change24hPct: number | null
  vwap: number | null
  /** ár távolsága a VWAP-tól ATR-ben (előjeles: + = felette) */
  vwapDistAtr: number | null
  /** ATR(14) 5 perces gyertyákon */
  atr: number | null
  rvol: number | null
  adx: number | null
  fundingRate: number | null
  openInterest: number | null
  /** OI változás % az elmúlt ~1 órában (ha van történet) */
  oiDelta1hPct: number | null
  /** OI regime a Δ és ár alapján */
  oiRegime: OiRegime
  /** DOGE katalizátor mód */
  catalystMode: boolean
  prevDayHigh: number | null
  prevDayLow: number | null
  prevWeekHigh: number | null
  prevWeekLow: number | null
  usOpenHigh: number | null
  usOpenLow: number | null
  signal: CryptoSignal
  /** mind a 4 setup aktuális felépülése — vizuális döntéshez */
  buildups: SetupBuildup[]
  /** chart: utolsó ~6 óra 1m gyertya */
  chartBars: Bar[]
  vwapSeries: { t: number; v: number }[]
}

export interface BtcContext {
  regime: BtcRegime
  note: string
  btcPrice: number | null
  btcVwapDistAtr: number | null
  btcChange24hPct: number | null
  ethPrice: number | null
  ethChange24hPct: number | null
  /** hirtelen BTC-mozgás az elmúlt 15 percben (ATR-szorzó) */
  btcShock15m: number | null
}

export interface CryptoSnapshot {
  fetchedAt: number
  source: CryptoFeedSource
  utcDate: string
  utcTime: string
  btc: BtcContext
  symbols: SymbolSnapshot[]
  /** aktív guardrail üzenet (napi limit) vagy null */
  guardrail: string | null
  /** piaci + hír kontextus (settlement, OI, katalizátorok) */
  context: MarketContext
}

export type OiRegime = "trend" | "squeeze" | "unwind" | "capitulation" | "flat" | "unknown"

export type CatalystSeverity = "low" | "med" | "high"

export interface Catalyst {
  id?: string
  source: "cryptopanic" | "manual"
  title: string
  url: string | null
  severity: CatalystSeverity
  tags: string[]
  symbols: string[]
  /** hány perce jelent meg */
  ageMin: number
  publishedAt: string
}

export interface SymbolMarketContext {
  oiDelta1hPct: number | null
  oiDelta4hPct: number | null
  oiRegime: OiRegime
  /** DOGE: katalizátor mód aktív-e */
  catalystMode: boolean
  /** aktuális RVOL küszöb (DOGE-nál 1.0 vagy 1.3) */
  rvolGate: number
  catalysts: Catalyst[]
}

export interface MarketContext {
  settlement: {
    nextUtc: string
    minutesLeft: number
    inFreeze: boolean
  }
  btcCatalysts: Catalyst[]
  sol: SymbolMarketContext
  doge: SymbolMarketContext
}
