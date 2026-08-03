import type { SupabaseClient } from "@supabase/supabase-js"
import { buildMarketContext } from "./context"
import { fetchCryptoFeed } from "./feed"
import { computeCryptoSnapshot } from "./compute"
import { fetchAndStoreCryptoPanic } from "./news"
import { saveOiSnapshots } from "./oi-history"
import { recordAndEvaluateCryptoSignals } from "./paper"
import {
  ALL_SETUPS_ENABLED,
  type CryptoSnapshot,
  type EnabledSetups,
} from "./types"

/**
 * Egy crypto "tick": feed → OI mentés → hírek → context → snapshot → paper.
 */

const MAX_SIGNALS_PER_DAY = 5
const MAX_DAILY_LOSS_R = 3

export async function runCryptoTick(
  supabase: SupabaseClient,
  opts?: { enabledSetups?: EnabledSetups; recordPaper?: boolean; fetchNews?: boolean }
): Promise<CryptoSnapshot> {
  const feed = await fetchCryptoFeed()
  const enabled = opts?.enabledSetups ?? ALL_SETUPS_ENABLED
  const recordPaper = opts?.recordPaper ?? true
  const fetchNews = opts?.fetchNews ?? true

  try {
    await saveOiSnapshots(supabase, feed)
  } catch (e) {
    console.error("OI snapshot hiba:", e)
  }

  if (fetchNews) {
    try {
      await fetchAndStoreCryptoPanic(supabase)
    } catch (e) {
      console.error("CryptoPanic hiba:", e)
    }
  }

  const { context } = await buildMarketContext(supabase, feed)

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

  const snapshot = computeCryptoSnapshot({
    feed,
    guardrail,
    enabledSetups: enabled,
    marketContext: context,
  })

  if (recordPaper) {
    try {
      const barsBySymbol = {
        SOL: feed.symbols.SOL.bars,
        DOGE: feed.symbols.DOGE.bars,
      }
      const paper = await recordAndEvaluateCryptoSignals(supabase, snapshot, barsBySymbol)
      snapshot.paper = paper
    } catch (e) {
      const msg = e instanceof Error ? e.message : "crypto paper error"
      console.error("Crypto paper trading hiba:", e)
      snapshot.paper = { attempted: 0, saved: 0, errors: [msg] }
    }
  }

  return snapshot
}
