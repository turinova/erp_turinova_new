import { NextResponse } from "next/server"
import { createSupabaseServer } from "@/lib/supabase/server"

/** PUT /api/settings — a beállítás-sor frissítése. */
export async function PUT(request: Request) {
  const supabase = await createSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const body = await request.json()

  const { error } = await supabase
    .from("trading_settings")
    .update({
      account_size: Number(body.accountSize),
      risk_per_trade_pct: Number(body.riskPerTradePct),
      max_trades_per_day: Number(body.maxTradesPerDay),
      max_daily_loss_r: Number(body.maxDailyLossR),
      orb_minutes: Number(body.orbMinutes),
      is_demo_mode: !!body.isDemoMode,
      updated_at: new Date().toISOString(),
    })
    .eq("id", body.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
