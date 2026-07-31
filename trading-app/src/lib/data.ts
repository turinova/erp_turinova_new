import { createSupabaseServer } from "./supabase/server"
import type {
  Trade,
  TradingSession,
  TradingSettings,
} from "./types"

/* eslint-disable @typescript-eslint/no-explicit-any */

export function mapSession(row: any): TradingSession {
  return {
    id: row.id,
    date: row.date,
    orbHigh: row.orb_high != null ? Number(row.orb_high) : null,
    orbLow: row.orb_low != null ? Number(row.orb_low) : null,
    orbLockedAt: row.orb_locked_at,
    vwapSide: row.vwap_side,
    regime: row.regime,
    overnightHigh: row.overnight_high != null ? Number(row.overnight_high) : null,
    overnightLow: row.overnight_low != null ? Number(row.overnight_low) : null,
    notes: row.notes,
  }
}

export function mapTrade(row: any): Trade {
  return {
    id: row.id,
    sessionId: row.session_id,
    tradedAt: row.traded_at,
    setupType: row.setup_type,
    entryPrice: row.entry_price != null ? Number(row.entry_price) : null,
    stopPrice: row.stop_price != null ? Number(row.stop_price) : null,
    targetPrice: row.target_price != null ? Number(row.target_price) : null,
    exitPrice: row.exit_price != null ? Number(row.exit_price) : null,
    rMultiple: row.r_multiple != null ? Number(row.r_multiple) : null,
    result: row.result,
    vwapSide: row.vwap_side,
    volumeConfirmed: row.volume_confirmed,
    liquiditySwept: row.liquidity_swept,
    fvgPresent: row.fvg_present,
    followedPlan: row.followed_plan,
    emotionTag: row.emotion_tag,
    notes: row.notes,
    screenshotUrl: row.screenshot_url,
  }
}

export function mapSettings(row: any): TradingSettings & { id: string } {
  return {
    id: row.id,
    accountSize: Number(row.account_size),
    riskPerTradePct: Number(row.risk_per_trade_pct),
    maxTradesPerDay: row.max_trades_per_day,
    maxDailyLossR: Number(row.max_daily_loss_r),
    orbMinutes: row.orb_minutes,
    isDemoMode: row.is_demo_mode,
  }
}

/** A kereskedési nap ET (New York) szerint — YYYY-MM-DD. */
export function getTodayEtDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(new Date())
}

export async function getSettings(): Promise<(TradingSettings & { id: string }) | null> {
  const supabase = await createSupabaseServer()
  const { data } = await supabase
    .from("trading_settings")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()
  return data ? mapSettings(data) : null
}

export async function getAllSessions(): Promise<TradingSession[]> {
  const supabase = await createSupabaseServer()
  const { data } = await supabase
    .from("trading_sessions")
    .select("*")
    .order("date", { ascending: false })
  return (data ?? []).map(mapSession)
}

export async function getTodaySession(): Promise<TradingSession | null> {
  const supabase = await createSupabaseServer()
  const { data } = await supabase
    .from("trading_sessions")
    .select("*")
    .eq("date", getTodayEtDate())
    .maybeSingle()
  return data ? mapSession(data) : null
}

export async function getAllTrades(): Promise<Trade[]> {
  const supabase = await createSupabaseServer()
  const { data } = await supabase
    .from("trades")
    .select("*")
    .order("traded_at", { ascending: false })
  return (data ?? []).map(mapTrade)
}

export async function getTradesForDate(date: string): Promise<Trade[]> {
  const supabase = await createSupabaseServer()
  const { data: session } = await supabase
    .from("trading_sessions")
    .select("id")
    .eq("date", date)
    .maybeSingle()
  if (!session) return []
  const { data } = await supabase
    .from("trades")
    .select("*")
    .eq("session_id", session.id)
    .order("traded_at", { ascending: false })
  return (data ?? []).map(mapTrade)
}
