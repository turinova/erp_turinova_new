import { NextResponse } from "next/server"
import { createSupabaseServer } from "@/lib/supabase/server"
import { getTodayEtDate } from "@/lib/data"

/**
 * POST /api/sessions — a mai session ORB lock / unlock kezelése.
 * Body: { action: "lock", orbHigh, orbLow, vwapSide? } vagy { action: "unlock" }
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const today = getTodayEtDate()

  if (body.action === "lock") {
    const orbHigh = Number(body.orbHigh)
    const orbLow = Number(body.orbLow)
    if (!isFinite(orbHigh) || !isFinite(orbLow) || orbHigh <= orbLow) {
      return NextResponse.json({ error: "invalid ORB levels" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("trading_sessions")
      .upsert(
        {
          date: today,
          orb_high: orbHigh,
          orb_low: orbLow,
          orb_locked_at: new Date().toISOString(),
          vwap_side: body.vwapSide ?? null,
        },
        { onConflict: "date" }
      )
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ session: data })
  }

  if (body.action === "unlock") {
    const { error } = await supabase
      .from("trading_sessions")
      .update({ orb_locked_at: null })
      .eq("date", today)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 })
}
