import { NextResponse, type NextRequest } from "next/server"
import { createSupabaseServer } from "@/lib/supabase/server"
import { runCryptoTick } from "@/lib/crypto/tick"
import {
  buildSignalPreview,
  closeAllPositions,
  closeSymbol,
  getBinanceDeskState,
  openFromSymbolSnapshot,
  runSmokeTest,
  syncBinanceExits,
  testBinanceConnection,
} from "@/lib/crypto/binance-bridge"
import { loadBinanceSettings, updateBinanceSettings } from "@/lib/crypto/binance-settings"
import type { TradedSymbol } from "@/lib/crypto/types"

async function requireUser() {
  const supabase = await createSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

async function withPreview(includePreview: boolean) {
  if (!includePreview) return getBinanceDeskState([])
  try {
    const supabase = await createSupabaseServer()
    const settings = await loadBinanceSettings()
    const snapshot = await runCryptoTick(supabase, {
      recordPaper: false,
      fetchNews: false,
    })
    const state = await getBinanceDeskState()
    const preview = buildSignalPreview(
      snapshot,
      state.equity?.available ?? 0,
      settings.riskPercent
    )
    return { ...state, signalPreview: preview }
  } catch {
    return getBinanceDeskState([])
  }
}

/** GET /api/crypto/binance — desk állapot + opcionális exit sync + signal preview */
export async function GET(request: NextRequest) {
  const { user } = await requireUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const sync = request.nextUrl.searchParams.get("sync") === "1"
  const preview = request.nextUrl.searchParams.get("preview") !== "0"
  let syncLogs: string[] = []
  if (sync) {
    try {
      syncLogs = await syncBinanceExits()
    } catch (e) {
      syncLogs = [e instanceof Error ? e.message : "sync hiba"]
    }
  }

  const state = await withPreview(preview && sync)
  return NextResponse.json({ ...state, syncLogs })
}

/** POST /api/crypto/binance — actions */
export async function POST(request: NextRequest) {
  const { supabase, user } = await requireUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as {
    action?: string
    autoTrade?: boolean
    riskPercent?: number
    leverageCap?: number
    maxDailyFires?: number
    maxDailyLossUsd?: number
    symbols?: ("SOL" | "DOGE")[]
    symbol?: string
    confirmAuto?: boolean
  }

  const action = body.action ?? "ping"

  try {
    if (action === "ping" || action === "test") {
      const r = await testBinanceConnection()
      return NextResponse.json(r)
    }

    if (action === "settings") {
      const patch: Parameters<typeof updateBinanceSettings>[0] = {}
      if (typeof body.autoTrade === "boolean") {
        if (body.autoTrade === true) {
          if (!body.confirmAuto) {
            return NextResponse.json(
              { error: "Auto BE-hez confirmAuto: true kell (UI megerősítés)" },
              { status: 400 }
            )
          }
          const cur = await loadBinanceSettings()
          if (cur.killedToday) {
            return NextResponse.json(
              { error: "Napi kill aktív — auto ma nem kapcsolható be. Holnap újra, vagy állítsd a limitet." },
              { status: 400 }
            )
          }
        }
        patch.autoTrade = body.autoTrade
      }
      if (typeof body.riskPercent === "number") patch.riskPercent = body.riskPercent
      if (typeof body.leverageCap === "number") patch.leverageCap = body.leverageCap
      if (typeof body.maxDailyFires === "number") patch.maxDailyFires = body.maxDailyFires
      if (typeof body.maxDailyLossUsd === "number") patch.maxDailyLossUsd = body.maxDailyLossUsd
      if (body.symbols) patch.symbols = body.symbols
      const settings = await updateBinanceSettings(patch)
      const state = await getBinanceDeskState()
      return NextResponse.json({ ok: true, ...state, settings })
    }

    if (action === "smoke") {
      const result = await runSmokeTest()
      const state = await getBinanceDeskState()
      return NextResponse.json({ ...state, ...result })
    }

    if (action === "sync") {
      const logs = await syncBinanceExits()
      const state = await getBinanceDeskState()
      return NextResponse.json({ ok: true, logs, ...state })
    }

    if (action === "close") {
      if (!body.symbol) return NextResponse.json({ error: "symbol kell" }, { status: 400 })
      const message = await closeSymbol(body.symbol)
      const state = await getBinanceDeskState()
      return NextResponse.json({ ok: true, message, ...state })
    }

    if (action === "closeAll") {
      const logs = await closeAllPositions()
      const state = await getBinanceDeskState()
      return NextResponse.json({ ok: true, logs, ...state })
    }

    if (action === "openLive") {
      const symbol = (body.symbol ?? "SOL") as TradedSymbol
      const snapshot = await runCryptoTick(supabase, {
        recordPaper: false,
        fetchNews: false,
      })
      const row = snapshot.symbols.find((s) => s.symbol === symbol)
      if (!row) return NextResponse.json({ error: "nincs symbol" }, { status: 400 })
      const result = await openFromSymbolSnapshot(row, { force: true, countFire: true })
      const state = await getBinanceDeskState()
      return NextResponse.json({ ...result, ...state })
    }

    return NextResponse.json({ error: `ismeretlen action: ${action}` }, { status: 400 })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "binance action hiba" },
      { status: 502 }
    )
  }
}
