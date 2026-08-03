export interface Bar {
  /** unix epoch másodpercben */
  t: number
  o: number
  h: number
  l: number
  c: number
  v: number
}

export interface BarFile {
  symbol: string
  interval: string
  fetchedAt: string
  timezone: string
  bars: Bar[]
}

export type StrategyId =
  | "orb"
  | "failed_breakout_fade"
  | "vwap_reversion"
  | "momentum_pullback"

export const STRATEGY_LABELS: Record<StrategyId, string> = {
  orb: "ORB breakout",
  failed_breakout_fade: "Failed breakout fade",
  vwap_reversion: "VWAP reversion",
  momentum_pullback: "Momentum pullback",
}

export interface BacktestConfig {
  strategies: StrategyId[]
  /** ORB periódus percben (5m gyertyáknál 15 → 3 gyertya) */
  orbMinutes: number
  /** RVOL filter be/ki + küszöb */
  volumeFilter: boolean
  rvolThreshold: number
  /** VWAP-egyezés filter az ORB entry-hez */
  vwapFilter: boolean
  /**
   * ORB csak a gap irányába (gap ellen → skip).
   * A/B: gap-mellette +0.8R / 71% vs gap-ellen −1.8R / 40% (12 ORB trade).
   */
  gapFilter: boolean
  /** Target R-multiple (stop-táv szorzó) */
  targetR: number
  /** Minimum ORB range pontban — ez alatt skip (zajszűrő) */
  minRangePoints: number
  /** Session vége ET órában (11 = csak a morning session, 16 = teljes nap) */
  cutoffHourEt: number
}

export const DEFAULT_CONFIG: BacktestConfig = {
  strategies: ["orb", "failed_breakout_fade", "vwap_reversion", "momentum_pullback"],
  orbMinutes: 15,
  volumeFilter: true,
  rvolThreshold: 1.2,
  vwapFilter: true,
  gapFilter: true,
  targetR: 1.5,
  minRangePoints: 20,
  cutoffHourEt: 11,
}

export type ExitReason = "target" | "stop" | "cutoff"

export interface SimTrade {
  /** YYYY-MM-DD (ET session nap) */
  date: string
  strategy: StrategyId
  direction: "long" | "short"
  entryTimeEt: string
  exitTimeEt: string
  entry: number
  stop: number
  target: number
  exit: number
  exitReason: ExitReason
  r: number
}

export interface StrategyStats {
  strategy: StrategyId | "combined"
  trades: number
  wins: number
  losses: number
  winRate: number
  netR: number
  avgR: number
  profitFactor: number | null
  maxDrawdownR: number
  longNetR: number
  shortNetR: number
}

export interface BacktestResult {
  symbol: string
  interval: string
  sessionCount: number
  firstDate: string
  lastDate: string
  config: BacktestConfig
  combined: StrategyStats
  perStrategy: StrategyStats[]
  equityR: number[]
  trades: SimTrade[]
}
