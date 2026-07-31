import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchLiveBars, type LiveFeed } from "./fetch-live"
import { computeLiveSnapshot, type LiveSnapshot } from "./compute"
import { recordAndEvaluateSignals } from "./paper"
import { loadBars } from "../backtest/load-bars"
import { mapSettings } from "../data"
import { DEFAULT_SETTINGS, type TradingSettings } from "../types"

/**
 * Egy élő "tick": feed lekérés → snapshot számítás → auto session-lock →
 * paper trading mentés/kiértékelés. Ezt futtatja a /api/live (böngészős
 * pollozás, user-session klienssel) és a /api/cron (Vercel cron,
 * service role klienssel) is.
 */
export async function runLiveTick(supabase: SupabaseClient): Promise<{
  snapshot: LiveSnapshot
  settings: TradingSettings
  feed: LiveFeed
}> {
  const [feed, history, settingsRes] = await Promise.all([
    fetchLiveBars(),
    loadBars(),
    supabase
      .from("trading_settings")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])
  const settings = settingsRes.data ? mapSettings(settingsRes.data) : DEFAULT_SETTINGS

  const snapshot = computeLiveSnapshot({
    feed,
    history,
    orbMinutes: settings.orbMinutes,
    accountSize: settings.accountSize,
    riskPerTradePct: settings.riskPerTradePct,
    cutoffHourEt: 16,
  })

  // Auto session-lock: ha az ORB rögzült és a mai DB-sorban még nincs,
  // elmentjük — a journal így magától folytonos marad.
  if (snapshot.orbLocked && snapshot.orbHigh != null && snapshot.orbLow != null) {
    const { data: existing } = await supabase
      .from("trading_sessions")
      .select("id, orb_locked_at")
      .eq("date", snapshot.etDate)
      .maybeSingle()

    if (!existing?.orb_locked_at) {
      await supabase.from("trading_sessions").upsert(
        {
          date: snapshot.etDate,
          orb_high: snapshot.orbHigh,
          orb_low: snapshot.orbLow,
          orb_locked_at: new Date().toISOString(),
          vwap_side: snapshot.vwapSide,
          overnight_high: snapshot.overnightHigh,
          overnight_low: snapshot.overnightLow,
        },
        { onConflict: "date" }
      )
    }
  }

  // Paper trading: signal mentése + nyitott signalok kiértékelése.
  // Hiba esetén nem borítjuk a ticket (pl. ha a 002-es SQL még nem fut le).
  try {
    await recordAndEvaluateSignals(supabase, snapshot, feed.bars, feed.source)
  } catch (e) {
    console.error("Paper trading hiba:", e)
  }

  return { snapshot, settings, feed }
}
