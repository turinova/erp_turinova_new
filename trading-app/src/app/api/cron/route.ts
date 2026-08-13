import { NextResponse, type NextRequest } from "next/server"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import { runLiveTick } from "@/lib/live/tick"
import { runCryptoTick } from "@/lib/crypto/tick"

/**
 * GET /api/cron — a Vercel Cron hívja 5 percenként, 24/7 (lásd vercel.json).
 *
 *  - Crypto tick: mindig fut (a crypto piac sosem zár)
 *  - NQ tick: csak hétköznap 13:00–21:00 UTC között (a CME RTH környéke)
 *
 * Auth: a Vercel automatikusan `Authorization: Bearer <CRON_SECRET>`
 * headert küld, ha a CRON_SECRET env-változó be van állítva a projektben.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const supabase = createSupabaseAdmin()
  const now = new Date()
  const utcHour = now.getUTCHours()
  const weekday = now.getUTCDay() >= 1 && now.getUTCDay() <= 5

  const out: Record<string, unknown> = { ok: true }

  // NQ tick (csak a session környékén)
  if (weekday && utcHour >= 13 && utcHour < 21) {
    try {
      const { snapshot, feed } = await runLiveTick(supabase)
      out.nq = {
        etTime: snapshot.etTime,
        status: snapshot.status,
        source: feed.source,
        lastPrice: snapshot.lastPrice,
        signal: snapshot.signal.kind,
      }
    } catch (e) {
      console.error("NQ cron tick hiba:", e)
      out.nq = { error: e instanceof Error ? e.message : "nq tick error" }
    }
  } else {
    out.nq = { skipped: "CME session-ablakon kívül" }
  }

  // Crypto tick (24/7)
  try {
    const snapshot = await runCryptoTick(supabase)
    out.crypto = {
      utcTime: snapshot.utcTime,
      source: snapshot.source,
      btcRegime: snapshot.btc.regime,
      signals: Object.fromEntries(
        snapshot.symbols.map((s) => [s.symbol, s.signal.kind])
      ),
      guardrail: snapshot.guardrail,
    }
  } catch (e) {
    console.error("Crypto cron tick hiba:", e)
    out.crypto = { error: e instanceof Error ? e.message : "crypto tick error" }
  }

  // Learner: naponta egyszer 00:00–00:09 UTC (5p cron → ~1x/nap)
  try {
    const { getActivePolicy } = await import("@/lib/crypto/learn/store")
    const { runLearner } = await import("@/lib/crypto/learn/run")
    const policy = await getActivePolicy()
    if (utcHour === 0 && now.getUTCMinutes() < 10) {
      const learn = await runLearner(supabase, {
        withAi: process.env.LEARN_ANTHROPIC === "1",
      })
      out.learn = {
        tradesUsed: learn.tradesUsed,
        proposals: learn.proposals.length,
        autoApplied: learn.autoApplied.length,
        autoTighten: policy.autoTighten,
      }
    } else {
      out.learn = { skipped: "nem 00:00–00:09 UTC" }
    }
  } catch (e) {
    console.error("Learner cron hiba:", e)
    out.learn = { error: e instanceof Error ? e.message : "learn error" }
  }

  return NextResponse.json(out)
}
