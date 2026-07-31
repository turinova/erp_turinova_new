import { NextResponse } from "next/server"
import { createSupabaseServer } from "@/lib/supabase/server"
import { getTodayEtDate } from "@/lib/data"
import { computeR } from "@/lib/r-calculator"

const SETUPS = [
  "orb_long",
  "orb_short",
  "failed_breakout_fade",
  "vwap_reversion",
  "momentum_pullback",
  "skip",
]

/** POST /api/trades — új trade rögzítése a mai sessionhöz (session auto-create). */
export async function POST(request: Request) {
  const supabase = await createSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const body = await request.json()

  if (!SETUPS.includes(body.setupType)) {
    return NextResponse.json({ error: "invalid setup type" }, { status: 400 })
  }

  // Mai session lekérése vagy létrehozása
  const today = getTodayEtDate()
  const { data: session, error: sessionError } = await supabase
    .from("trading_sessions")
    .upsert({ date: today }, { onConflict: "date", ignoreDuplicates: false })
    .select()
    .single()

  if (sessionError || !session) {
    return NextResponse.json(
      { error: sessionError?.message ?? "session error" },
      { status: 500 }
    )
  }

  const num = (v: unknown) => {
    const n = Number(v)
    return isFinite(n) && v !== "" && v != null ? n : null
  }

  const entry = num(body.entryPrice)
  const stop = num(body.stopPrice)
  const exit = num(body.exitPrice)
  const r = computeR(entry, stop, exit)
  const result = r == null ? null : r > 0 ? "win" : r < 0 ? "loss" : "be"

  const { data, error } = await supabase
    .from("trades")
    .insert({
      session_id: session.id,
      setup_type: body.setupType,
      entry_price: entry,
      stop_price: stop,
      target_price: num(body.targetPrice),
      exit_price: exit,
      result,
      vwap_side: body.vwapSide ?? null,
      volume_confirmed: !!body.volumeConfirmed,
      liquidity_swept: !!body.liquiditySwept,
      fvg_present: !!body.fvgPresent,
      followed_plan: body.followedPlan !== false,
      emotion_tag: body.emotionTag ?? null,
      notes: body.notes || null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ trade: data })
}
