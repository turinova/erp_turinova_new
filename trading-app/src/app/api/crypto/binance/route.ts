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
import { loadBinanceSettings, updateBinanceSettings, applySurvivorDeskDefaults } from "@/lib/crypto/binance-settings"
import type { TradedSymbol } from "@/lib/crypto/types"

async function requireUser() {
  const supabase = await createSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, user }
}

async function withPreview(includePreview: boolean, refreshFeed = false) {
  if (!includePreview) return getBinanceDeskState([], { refreshFeed })
  try {
    const supabase = await createSupabaseServer()
    const settings = await loadBinanceSettings()
    const snapshot = await runCryptoTick(supabase, {
      recordPaper: false,
      fetchNews: false,
    })
    const state = await getBinanceDeskState([], { refreshFeed })
    const preview = buildSignalPreview(
      snapshot,
      state.equity?.available ?? 0,
      settings.riskPercent
    )
    return { ...state, signalPreview: preview }
  } catch {
    return getBinanceDeskState([], { refreshFeed })
  }
}

/** GET /api/crypto/binance — desk állapot + opcionális exit sync + signal preview */
export async function GET(request: NextRequest) {
  try {
    const { user } = await requireUser()
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

    const sync = request.nextUrl.searchParams.get("sync") === "1"
    const preview = request.nextUrl.searchParams.get("preview") !== "0"
    const refreshFeed = request.nextUrl.searchParams.get("health") === "1"
    let syncLogs: string[] = []
    if (sync) {
      try {
        syncLogs = await syncBinanceExits()
      } catch (e) {
        syncLogs = [e instanceof Error ? e.message : "sync hiba"]
      }
    }

    const state = await withPreview(preview && sync, refreshFeed)
    return NextResponse.json({ ...state, syncLogs })
  } catch (e) {
    console.error("[api/crypto/binance GET]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "binance desk hiba" },
      { status: 500 }
    )
  }
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
      autoOnlyGradeA?: boolean
    autoMinRvol?: number
    matchPaperExit?: boolean
    trailEnabled?: boolean
    beFeeBufferPct?: number
    trailActivateR?: number
    trailAtrMult?: number
    tp1R?: number
    tp1Frac?: number
    runnerOnlyTrail?: boolean
    maxDailyLossPct?: number
    cooldownMinutes?: number
    applySurvivor?: boolean
  }

  const action = body.action ?? "ping"

  try {
    if (action === "ping" || action === "test") {
      const r = await testBinanceConnection()
      return NextResponse.json(r)
    }

    if (action === "settings") {
      if (body.applySurvivor === true) {
        const settings = await applySurvivorDeskDefaults()
        const state = await getBinanceDeskState()
        return NextResponse.json({
          ok: true,
          message: "Survivor preset alkalmazva (2% · 10x · A+ · cooldown 90p · trail 2R)",
          ...state,
          settings,
        })
      }
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
              { error: "Napi kill aktív — előbb „Kill reset ma”, aztán auto." },
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
      if (typeof body.maxDailyLossPct === "number") patch.maxDailyLossPct = body.maxDailyLossPct
      if (typeof body.cooldownMinutes === "number") patch.cooldownMinutes = body.cooldownMinutes
      if (body.symbols) patch.symbols = body.symbols
      if (typeof body.autoOnlyGradeA === "boolean") patch.autoOnlyGradeA = body.autoOnlyGradeA
      if (typeof body.autoMinRvol === "number") patch.autoMinRvol = body.autoMinRvol
      if (typeof body.matchPaperExit === "boolean") patch.matchPaperExit = body.matchPaperExit
      if (typeof body.trailEnabled === "boolean") patch.trailEnabled = body.trailEnabled
      if (typeof body.beFeeBufferPct === "number") patch.beFeeBufferPct = body.beFeeBufferPct
      if (typeof body.trailActivateR === "number") patch.trailActivateR = body.trailActivateR
      if (typeof body.trailAtrMult === "number") patch.trailAtrMult = body.trailAtrMult
      if (typeof body.tp1R === "number") patch.tp1R = body.tp1R
      if (typeof body.tp1Frac === "number") patch.tp1Frac = body.tp1Frac
      if (typeof body.runnerOnlyTrail === "boolean") patch.runnerOnlyTrail = body.runnerOnlyTrail
      const settings = await updateBinanceSettings(patch)
      const state = await getBinanceDeskState()
      return NextResponse.json({ ok: true, ...state, settings })
    }

    if (action === "resetKill") {
      const settings = await updateBinanceSettings({
        killedToday: false,
        lastError: null,
        lastErrorAt: null,
        dayStartEquity: null,
        autoTrade: false,
      })
      const state = await getBinanceDeskState()
      return NextResponse.json({
        ok: true,
        message: "Napi kill törölve — dayStart újraáll. Auto még KI (kapcsold be ha kell).",
        ...state,
        settings,
      })
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
