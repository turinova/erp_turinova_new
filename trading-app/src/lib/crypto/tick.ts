import type { SupabaseClient } from "@supabase/supabase-js"
import { buildMarketContext } from "./context"
import { fetchCryptoFeed } from "./feed"
import { computeCryptoSnapshot } from "./compute"
import { fetchAndStoreCryptoPanic } from "./news"
import { saveOiSnapshots } from "./oi-history"
import { recordAndEvaluateCryptoSignals } from "./paper"
import { maybeAutoOpenFromSnapshot, syncBinanceExits } from "./binance-bridge"
import { getActivePolicy } from "./learn/store"
import {
  ALL_SETUPS_ENABLED,
  type CryptoSnapshot,
  type EnabledSetups,
} from "./types"

/**
 * Egy crypto "tick": feed → OI mentés → hírek → context → snapshot → paper.
 */

/** 2 coin × több setup (sweep/FVG/session/PB/MR) — 5 túl szűk volt 24/7-re */
const MAX_SIGNALS_PER_DAY = 15
const MAX_DAILY_LOSS_R = 3

export async function runCryptoTick(
  supabase: SupabaseClient,
  opts?: { enabledSetups?: EnabledSetups; recordPaper?: boolean; fetchNews?: boolean }
): Promise<CryptoSnapshot> {
  // Binance-first: a fire/paper entry a Binance markhoz igazodik (OKX/Bybit fallback)
  const feed = await fetchCryptoFeed({ preferBinance: true })
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

  let policyGates:
    | {
        disabledKinds: string[]
        solRvolFvgMin: number
        blockedHourBuckets: number[]
      }
    | undefined
  try {
    const policy = await getActivePolicy()
    policyGates = {
      disabledKinds: policy.disabledKinds,
      solRvolFvgMin: policy.solRvolFvgMin,
      blockedHourBuckets: policy.blockedHourBuckets,
    }
  } catch (e) {
    console.warn("Policy load hiba:", e)
  }

  let guardrail: string | null = null
  try {
    const utcDate = new Date().toISOString().slice(0, 10)
    const { data: today } = await supabase
      .from("crypto_signals")
      .select("status, r_multiple")
      .eq("date", utcDate)

    if (today) {
      const closed = today.filter((s) => s.status !== "open")
      if (closed.length >= MAX_SIGNALS_PER_DAY) {
        guardrail = `Napi signal limit (${MAX_SIGNALS_PER_DAY})`
      } else {
        const dayR = closed.reduce((sum, s) => sum + Number(s.r_multiple ?? 0), 0)
        if (dayR <= -MAX_DAILY_LOSS_R) {
          guardrail = `Napi loss limit (${MAX_DAILY_LOSS_R}R)`
        }
      }
    }
  } catch {
    /* ignore */
  }

  const snapshot = computeCryptoSnapshot({
    feed,
    guardrail,
    enabledSetups: enabled,
    marketContext: context,
    policyGates,
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

  try {
    await syncBinanceExits(undefined, snapshot)
    const logs = await maybeAutoOpenFromSnapshot(snapshot)
    if (logs.length) console.log("Binance auto:", logs.join(" | "))
  } catch (e) {
    console.error("Binance bridge hiba:", e)
  }

  return snapshot
}
