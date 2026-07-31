import { NextResponse } from "next/server"
import { createSupabaseServer } from "@/lib/supabase/server"
import { runBacktest } from "@/lib/backtest/engine"
import { loadBars } from "@/lib/backtest/load-bars"
import { DEFAULT_CONFIG, type BacktestConfig } from "@/lib/backtest/types"

/** POST /api/backtest — backtest futtatása a megadott konfigurációval. */
export async function POST(request: Request) {
  const supabase = await createSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const barFile = await loadBars()
  if (!barFile) {
    return NextResponse.json(
      {
        error:
          "Nincs adatfájl (data/bars-NQ-5m.json). Futtasd: npm run fetch-data",
      },
      { status: 404 }
    )
  }

  const body = await request.json().catch(() => ({}))
  const config: BacktestConfig = {
    ...DEFAULT_CONFIG,
    ...body,
    strategies:
      Array.isArray(body.strategies) && body.strategies.length > 0
        ? body.strategies
        : DEFAULT_CONFIG.strategies,
  }

  const result = runBacktest(barFile, config)
  return NextResponse.json(result)
}
