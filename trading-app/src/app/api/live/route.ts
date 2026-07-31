import { NextResponse } from "next/server"
import { createSupabaseServer } from "@/lib/supabase/server"
import { runLiveTick } from "@/lib/live/tick"
import { getTradesForDate } from "@/lib/data"

/** GET /api/live — élő session snapshot (a kliens ~45 mp-enként pollolja). */
export async function GET() {
  const supabase = await createSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  try {
    const { snapshot, settings } = await runLiveTick(supabase)

    // Napi guardrail a journal alapján: limit felett a signal panel elnémul.
    // (Csak a UI-t érinti — a paper napló a tick-ben már rögzített.)
    try {
      const trades = (await getTradesForDate(snapshot.etDate)).filter(
        (t) => t.setupType !== "skip"
      )
      const netR = trades.reduce((sum, t) => sum + (t.rMultiple ?? 0), 0)

      let guardrail: string | null = null
      if (trades.length >= settings.maxTradesPerDay) {
        guardrail = `Napi trade-limit elérve (${trades.length}/${settings.maxTradesPerDay}).`
      } else if (netR <= -settings.maxDailyLossR) {
        guardrail = `Napi veszteséglimit elérve (${netR.toFixed(2)}R / -${settings.maxDailyLossR}R).`
      }

      if (guardrail) {
        snapshot.guardrail = guardrail
        snapshot.signal = {
          kind: "NONE",
          reason: `${guardrail} Ma nincs több entry — a mai nap véget ért.`,
          entry: null,
          stop: null,
          target15: null,
          target20: null,
          contracts: null,
        }
      }
    } catch (e) {
      console.error("Guardrail hiba:", e)
    }

    return NextResponse.json(snapshot)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "live feed error" },
      { status: 502 }
    )
  }
}
