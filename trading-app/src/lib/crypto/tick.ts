import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchCryptoFeed } from "./feed"
import { computeCryptoSnapshot } from "./compute"
import { recordAndEvaluateCryptoSignals } from "./paper"
import type { CryptoSnapshot } from "./types"

/**
 * Egy crypto "tick": feed → guardrail → snapshot → paper napló.
 * Ezt futtatja a /api/crypto (böngésző-poll) és a /api/cron (24/7) is.
 */

// Napi limitek (UTC nap, a két coin együtt)
const MAX_SIGNALS_PER_DAY = 5
const MAX_DAILY_LOSS_R = 3

export async function runCryptoTick(supabase: SupabaseClient): Promise<CryptoSnapshot> {
  const feed = await fetchCryptoFeed()

  // Guardrail az aznapi crypto_signals alapján
  let guardrail: string | null = null
  try {
    const utcDate = new Date().toISOString().slice(0, 10)
    const { data: today } = await supabase
      .from("crypto_signals")
      .select("status, r_multiple")
      .eq("date", utcDate)

    if (today) {
      const closed = today.filter((s) => s.status !== "open")
      const netR = closed.reduce((sum, s) => sum + Number(s.r_multiple ?? 0), 0)
      if (today.length >= MAX_SIGNALS_PER_DAY) {
        guardrail = `Napi signal-limit elérve (${today.length}/${MAX_SIGNALS_PER_DAY}) — ma nincs több crypto entry.`
      } else if (netR <= -MAX_DAILY_LOSS_R) {
        guardrail = `Napi veszteséglimit elérve (${netR.toFixed(2)}R / -${MAX_DAILY_LOSS_R}R) — ma nincs több crypto entry.`
      }
    }
  } catch (e) {
    console.error("Crypto guardrail hiba:", e)
  }

  const snapshot = computeCryptoSnapshot({ feed, guardrail })

  try {
    const barsBySymbol: Record<string, { t: number; o: number; h: number; l: number; c: number; v: number }[]> = {
      SOL: feed.symbols.SOL.bars,
      DOGE: feed.symbols.DOGE.bars,
    }
    await recordAndEvaluateCryptoSignals(supabase, snapshot, barsBySymbol)
  } catch (e) {
    console.error("Crypto paper trading hiba:", e)
  }

  return snapshot
}
