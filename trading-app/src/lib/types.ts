export type SetupType =
  | "orb_long"
  | "orb_short"
  | "failed_breakout_fade"
  | "vwap_reversion"
  | "momentum_pullback"
  | "skip"

export type Regime = "trend_up" | "trend_down" | "range" | "choppy"

export type TradeResult = "win" | "loss" | "be"

export type VwapSide = "above" | "below" | "at"

export type EmotionTag = "calm" | "fomo" | "revenge" | "hesitant" | "confident"

export interface TradingSettings {
  accountSize: number
  riskPerTradePct: number
  maxTradesPerDay: number
  maxDailyLossR: number
  orbMinutes: number
  isDemoMode: boolean
}

export const DEFAULT_SETTINGS: TradingSettings & { id: string } = {
  id: "",
  accountSize: 5000,
  riskPerTradePct: 1,
  maxTradesPerDay: 2,
  maxDailyLossR: 2,
  orbMinutes: 15,
  isDemoMode: true,
}

export interface TradingSession {
  id: string
  /** YYYY-MM-DD (ET kereskedési nap) */
  date: string
  orbHigh: number | null
  orbLow: number | null
  orbLockedAt: string | null
  vwapSide: VwapSide | null
  regime: Regime | null
  overnightHigh: number | null
  overnightLow: number | null
  notes: string | null
}

export interface Trade {
  id: string
  sessionId: string
  tradedAt: string
  setupType: SetupType
  entryPrice: number | null
  stopPrice: number | null
  targetPrice: number | null
  exitPrice: number | null
  rMultiple: number | null
  result: TradeResult | null
  vwapSide: VwapSide | null
  volumeConfirmed: boolean
  liquiditySwept: boolean
  fvgPresent: boolean
  followedPlan: boolean
  emotionTag: EmotionTag | null
  notes: string | null
  screenshotUrl: string | null
}

export const SETUP_LABELS: Record<SetupType, string> = {
  orb_long: "ORB Long",
  orb_short: "ORB Short",
  failed_breakout_fade: "Failed breakout fade",
  vwap_reversion: "VWAP reversion",
  momentum_pullback: "Momentum pullback",
  skip: "Skip (nem tradelt)",
}

export const REGIME_LABELS: Record<Regime, string> = {
  trend_up: "Trend ↑",
  trend_down: "Trend ↓",
  range: "Range",
  choppy: "Choppy",
}

export const EMOTION_LABELS: Record<EmotionTag, string> = {
  calm: "Nyugodt",
  fomo: "FOMO",
  revenge: "Revenge",
  hesitant: "Bizonytalan",
  confident: "Magabiztos",
}
