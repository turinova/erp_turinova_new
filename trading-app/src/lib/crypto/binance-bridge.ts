/**
 * Binance bridge: crypto signal → USD-M futures order + partial exit gondozás.
 */
import { partialTp1Price } from "./paper"
import {
  cancelAllOrders,
  closePositionMarket,
  getBinanceCreds,
  getAllOpenOrdersDisplay,
  getLastPrice,
  getPositions,
  getSymbolFilters,
  getUsdtEquity,
  limitReduce,
  marketOrder,
  pingAccount,
  roundStep,
  roundTick,
  setLeverage,
  ensureMarginType,
  stopMarketClose,
  takeProfitMarketClose,
  type BinanceCreds,
} from "./binance-futures"
import {
  loadBinanceSettings,
  recordLastError,
  rollDayIfNeeded,
  updateBinanceSettings,
  type BinanceDeskSettings,
  type BinanceLiveTrade,
} from "./binance-settings"
import type { CryptoSnapshot, SymbolSnapshot, TradedSymbol } from "./types"

export const PAIR: Record<TradedSymbol, string> = {
  SOL: "SOLUSDT",
  DOGE: "DOGEUSDT",
}

export type SignalPreview = {
  symbol: TradedSymbol
  kind: string
  entry: number | null
  stop: number | null
  target: number | null
  reason: string
  estRiskUsd: number | null
}

export type DeskState = {
  configured: boolean
  connected: boolean
  error: string | null
  equity: { balance: number; available: number; unrealized: number; asset?: string; multiAssets?: boolean } | null
  positions: Awaited<ReturnType<typeof getPositions>>
  openOrders: Awaited<ReturnType<typeof getAllOpenOrdersDisplay>>
  settings: BinanceDeskSettings
  liveTrades: BinanceLiveTrade[]
  fetchedAt: string
  warnings: string[]
  daily: {
    fires: number
    maxFires: number
    dayPnlUsd: number
    maxLossUsd: number
    killed: boolean
  }
  signalPreview: SignalPreview[]
  lastError: string | null
  lastErrorAt: string | null
}

function totalEquity(eq: { balance: number; unrealized: number }) {
  return eq.balance + eq.unrealized
}

async function applyDailyGuard(equity: { balance: number; available: number; unrealized: number } | null) {
  const eqNow = equity ? totalEquity(equity) : null
  let settings = await rollDayIfNeeded(eqNow)
  if (settings.dayStartEquity == null && eqNow != null) {
    settings = await updateBinanceSettings({ dayStartEquity: eqNow })
  }

  const dayPnl =
    settings.dayStartEquity != null && eqNow != null ? eqNow - settings.dayStartEquity : 0

  if (
    !settings.killedToday &&
    settings.autoTrade &&
    settings.dayStartEquity != null &&
    dayPnl <= -Math.abs(settings.maxDailyLossUsd)
  ) {
    settings = await updateBinanceSettings({
      autoTrade: false,
      killedToday: true,
      lastError: `Napi loss limit (−$${settings.maxDailyLossUsd}) — auto kikapcsolva`,
      lastErrorAt: new Date().toISOString(),
    })
  }

  return { settings, dayPnl }
}

export async function getBinanceDeskState(
  signalPreview: SignalPreview[] = []
): Promise<DeskState> {
  const creds = getBinanceCreds()
  const baseSettings = await loadBinanceSettings()

  if (!creds) {
    return {
      configured: false,
      connected: false,
      error: "Hiányzik BINANCE_API_KEY / BINANCE_API_SECRET az .env.local-ból",
      equity: null,
      positions: [],
      openOrders: [],
      settings: baseSettings,
      liveTrades: baseSettings.liveTrades,
      fetchedAt: new Date().toISOString(),
      warnings: ["Nincs API key"],
      daily: {
        fires: baseSettings.firesToday,
        maxFires: baseSettings.maxDailyFires,
        dayPnlUsd: 0,
        maxLossUsd: baseSettings.maxDailyLossUsd,
        killed: baseSettings.killedToday,
      },
      signalPreview,
      lastError: baseSettings.lastError,
      lastErrorAt: baseSettings.lastErrorAt,
    }
  }

  try {
    const [equity, positions, openOrders] = await Promise.all([
      getUsdtEquity(creds),
      getPositions(creds),
      getAllOpenOrdersDisplay(creds),
    ])
    const { settings, dayPnl } = await applyDailyGuard(equity)
    const warnings: string[] = []
    if (equity.available < 5) {
      warnings.push(
        `Available ${equity.asset ?? ""} margin alacsony ($${equity.available.toFixed(2)}). ` +
          `Ha van wallet balance de available 0: ellenőrizd a Futures szabad margint / nyitott order-eket.`
      )
    } else if (equity.multiAssets) {
      warnings.push(
        `Multi-Assets Mode aktív — sizing ${equity.asset ?? "stable"} wallet + account available alapján.`
      )
    }
    if (settings.autoTrade) {
      warnings.push("AUTO ÉLŐ — a /crypto fire Binance-re mehet.")
    }
    if (settings.killedToday) {
      warnings.push("Napi kill aktív — auto ma nem kapcsolható vissza loss limit miatt (vagy kapcsold kézzel holnap).")
    }
    if (settings.firesToday >= settings.maxDailyFires) {
      warnings.push(`Napi fire limit (${settings.firesToday}/${settings.maxDailyFires}).`)
    }

    return {
      configured: true,
      connected: true,
      error: null,
      equity,
      positions,
      openOrders,
      settings,
      liveTrades: settings.liveTrades,
      fetchedAt: new Date().toISOString(),
      warnings,
      daily: {
        fires: settings.firesToday,
        maxFires: settings.maxDailyFires,
        dayPnlUsd: dayPnl,
        maxLossUsd: settings.maxDailyLossUsd,
        killed: settings.killedToday,
      },
      signalPreview,
      lastError: settings.lastError,
      lastErrorAt: settings.lastErrorAt,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Binance kapcsolat hiba"
    await recordLastError(msg)
    const settings = await loadBinanceSettings()
    return {
      configured: true,
      connected: false,
      error: msg,
      equity: null,
      positions: [],
      openOrders: [],
      settings,
      liveTrades: settings.liveTrades,
      fetchedAt: new Date().toISOString(),
      warnings: [msg],
      daily: {
        fires: settings.firesToday,
        maxFires: settings.maxDailyFires,
        dayPnlUsd: 0,
        maxLossUsd: settings.maxDailyLossUsd,
        killed: settings.killedToday,
      },
      signalPreview,
      lastError: settings.lastError,
      lastErrorAt: settings.lastErrorAt,
    }
  }
}

export async function testBinanceConnection(): Promise<{ ok: boolean; message: string }> {
  const creds = getBinanceCreds()
  if (!creds) return { ok: false, message: "Nincs API key az env-ben" }
  try {
    await pingAccount(creds)
    const eq = await getUsdtEquity(creds)
    return {
      ok: true,
      message: `OK — ${eq.asset} available ≈ $${eq.available.toFixed(2)} (balance $${eq.balance.toFixed(2)})`,
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "ping failed" }
  }
}

function signalKey(symbol: string, kind: string, barTime: number | null): string {
  return `${symbol}:${kind}:${barTime ?? "x"}`
}

export type OpenFromSignalResult = {
  ok: boolean
  skipped?: boolean
  message: string
  trade?: BinanceLiveTrade
}

export async function openFromSymbolSnapshot(
  snap: SymbolSnapshot,
  opts?: { force?: boolean; settings?: BinanceDeskSettings; countFire?: boolean }
): Promise<OpenFromSignalResult> {
  const creds = getBinanceCreds()
  if (!creds) {
    await recordLastError("Nincs Binance API key")
    return { ok: false, message: "Nincs Binance API key" }
  }

  let settings = opts?.settings ?? (await loadBinanceSettings())
  const countFire = opts?.countFire !== false
  const sig = snap.signal
  if (sig.kind === "NONE" || sig.entry == null || sig.stop == null || sig.target == null) {
    return { ok: false, message: "Nincs érvényes signal" }
  }

  if (!settings.symbols.includes(snap.symbol)) {
    return { ok: false, skipped: true, message: `${snap.symbol} ki van kapcsolva a desk beállításokban` }
  }

  if (settings.killedToday && !opts?.force) {
    return { ok: false, skipped: true, message: "Napi kill aktív — ma nincs új auto nyitás" }
  }

  if (countFire && settings.firesToday >= settings.maxDailyFires) {
    const msg = `Napi fire limit (${settings.firesToday}/${settings.maxDailyFires})`
    await recordLastError(msg)
    return { ok: false, skipped: true, message: msg }
  }

  // max 1 nyitott futures pozíció összesen (auto / live)
  const positions = await getPositions(creds)
  const anyOpen = positions.some((p) => p.positionAmt !== 0)
  if (anyOpen) {
    return { ok: false, skipped: true, message: "Már van nyitott futures pozíció — előbb zárd" }
  }

  const pair = PAIR[snap.symbol]
  const key = signalKey(snap.symbol, sig.kind, snap.lastBarT)
  if (!opts?.force && settings.lastOpenedKey === key) {
    return { ok: false, skipped: true, message: "Ezt a signal-t már megnyitottuk (dedup)" }
  }

  const isLong = sig.kind.endsWith("LONG")
  const entry = sig.entry
  const stop = sig.stop
  const target = sig.target
  const stopPct = Math.abs(entry - stop) / entry
  if (stopPct < 1e-8) return { ok: false, message: "Stop távolság ~0" }

  const equity = await getUsdtEquity(creds)
  await applyDailyGuard(equity)
  settings = await loadBinanceSettings()

  const base = Math.max(equity.available, 0)
  if (base < 5) {
    const msg = `Túl kevés available margin ($${base.toFixed(2)}) — utalj Futuresre`
    await recordLastError(msg)
    return { ok: false, message: msg }
  }

  const riskUsd = (base * Math.max(0.5, settings.riskPercent)) / 100
  let notional = riskUsd / stopPct
  let lev = notional / base
  const cap = Math.max(1, settings.leverageCap)
  if (lev > cap) {
    notional = base * cap
    lev = cap
  }
  lev = Math.max(1, Math.min(cap, Math.floor(lev)))

  const filters = await getSymbolFilters(pair)
  let qty = roundStep(notional / entry, filters.stepSize)
  if (qty < filters.minQty) {
    return { ok: false, message: `Qty túl kicsi (${qty}) — növeld a risk%-ot vagy a tőkét` }
  }
  if (qty * entry < filters.minNotional) {
    qty = roundStep(filters.minNotional / entry, filters.stepSize)
  }

  const tp1 = partialTp1Price(entry, stop, target)
  const side = isLong ? "BUY" : "SELL"
  const closeSide = isLong ? "SELL" : "BUY"

  try {
    await ensureMarginType(creds, pair)
    await setLeverage(creds, pair, lev)
    await cancelAllOrders(creds, pair)

    const entryOrder = await marketOrder(creds, { symbol: pair, side, quantity: qty })

    const stopPx = roundTick(stop, filters.tickSize)
    const targetPx = roundTick(target, filters.tickSize)
    const tp1Px = tp1 != null ? roundTick(tp1, filters.tickSize) : null

    let note: string | undefined
    try {
      if (tp1Px != null) {
        const half = roundStep(qty * 0.5, filters.stepSize)
        if (half >= filters.minQty) {
          await limitReduce(creds, { symbol: pair, side: closeSide, quantity: half, price: tp1Px })
        }
        await stopMarketClose(creds, {
          symbol: pair,
          side: closeSide,
          stopPrice: stopPx,
          closePosition: true,
        })
        await takeProfitMarketClose(creds, {
          symbol: pair,
          side: closeSide,
          stopPrice: targetPx,
          closePosition: true,
        })
      } else {
        await stopMarketClose(creds, {
          symbol: pair,
          side: closeSide,
          stopPrice: stopPx,
          closePosition: true,
        })
        await takeProfitMarketClose(creds, {
          symbol: pair,
          side: closeSide,
          stopPrice: targetPx,
          closePosition: true,
        })
      }
    } catch (e) {
      note = `Entry OK, protective orders részben hibás: ${e instanceof Error ? e.message : "stop/tp"}`
    }

    const trade = await persistLiveTrade({
      signalKey: key,
      symbol: snap.symbol,
      pair,
      side: isLong ? "LONG" : "SHORT",
      kind: sig.kind,
      entry,
      stop,
      target,
      tp1: tp1 != null ? roundTick(tp1, filters.tickSize) : null,
      qty,
      leverage: lev,
      riskUsd: qty * entry * stopPct,
      entryOrderId: entryOrder.orderId,
      phase: "open",
      note,
    })

    await updateBinanceSettings({
      lastOpenedKey: key,
      firesToday: countFire ? settings.firesToday + 1 : settings.firesToday,
      lastError: note ?? null,
      lastErrorAt: note ? new Date().toISOString() : settings.lastErrorAt,
    })

    return {
      ok: true,
      message: note
        ? `Nyitva ${pair}, de SL/TP hiba: ${note}`
        : `Nyitva ${pair} ${isLong ? "LONG" : "SHORT"} qty=${qty} lev=${lev}x risk≈$${trade.riskUsd.toFixed(2)}`,
      trade,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "open hiba"
    await recordLastError(msg)
    return { ok: false, message: msg }
  }
}

/** ~min notional SOL long → azonnal zár — bridge smoke, nem számít fire-nek */
export async function runSmokeTest(): Promise<{ ok: boolean; message: string }> {
  const creds = getBinanceCreds()
  if (!creds) return { ok: false, message: "Nincs API key" }

  const pair = "SOLUSDT"
  try {
    const equity = await getUsdtEquity(creds)
    if (equity.available < 5) {
      return {
        ok: false,
        message: `Available $${equity.available.toFixed(2)} — kell min. ~$5 free Futures margin`,
      }
    }
    const positions = await getPositions(creds)
    if (positions.some((p) => p.positionAmt !== 0)) {
      return { ok: false, message: "Van nyitott pozíció — zárd előbb, aztán smoke" }
    }

    const price = await getLastPrice(pair)
    const filters = await getSymbolFilters(pair)
    let qty = roundStep(Math.max(filters.minNotional * 1.15, 6) / price, filters.stepSize)
    if (qty < filters.minQty) qty = filters.minQty

    await ensureMarginType(creds, pair)
    await setLeverage(creds, pair, 5)
    await cancelAllOrders(creds, pair)
    await marketOrder(creds, { symbol: pair, side: "BUY", quantity: qty })
    await new Promise((r) => setTimeout(r, 800))
    const after = await getPositions(creds)
    const pos = after.find((p) => p.symbol === pair)
    if (pos && pos.positionAmt !== 0) {
      await closePositionMarket(creds, pair, pos.positionAmt)
    } else {
      await marketOrder(creds, { symbol: pair, side: "SELL", quantity: qty, reduceOnly: true })
    }

    await persistLiveTrade({
      signalKey: `smoke:${Date.now()}`,
      symbol: "SOL",
      pair,
      side: "LONG",
      kind: "SMOKE",
      entry: price,
      stop: price * 0.99,
      target: price * 1.01,
      tp1: null,
      qty,
      leverage: 5,
      riskUsd: 0,
      entryOrderId: null,
      phase: "closed",
      note: "Smoke test open→close OK",
      smoke: true,
    })
    await updateBinanceSettings({ lastError: null, lastErrorAt: null })

    return {
      ok: true,
      message: `Smoke OK — SOLUSDT qty=${qty} @ ~${price.toFixed(2)} megnyitva és zárva (fee pár cent)`,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "smoke hiba"
    await recordLastError(msg)
    return { ok: false, message: msg }
  }
}

export function buildSignalPreview(
  snapshot: CryptoSnapshot,
  availableUsd: number,
  riskPercent: number
): SignalPreview[] {
  return snapshot.symbols.map((s) => {
    const sig = s.signal
    let estRiskUsd: number | null = null
    if (sig.kind !== "NONE" && sig.entry != null && sig.stop != null && availableUsd > 0) {
      estRiskUsd = (availableUsd * riskPercent) / 100
    }
    return {
      symbol: s.symbol,
      kind: sig.kind,
      entry: sig.entry,
      stop: sig.stop,
      target: sig.target,
      reason: sig.reason,
      estRiskUsd,
    }
  })
}

async function persistLiveTrade(
  partial: Omit<BinanceLiveTrade, "id" | "openedAt"> & { note?: string; smoke?: boolean }
): Promise<BinanceLiveTrade> {
  const settings = await loadBinanceSettings()
  const trade: BinanceLiveTrade = {
    id: `${Date.now()}-${partial.pair}`,
    openedAt: new Date().toISOString(),
    ...partial,
  }
  const others = settings.liveTrades
    .filter((t) => (t.pair !== trade.pair || t.phase === "closed" || t.smoke) && t.id !== trade.id)
    .slice(0, 40)
  await updateBinanceSettings({ liveTrades: [trade, ...others] })
  return trade
}

/** Snapshot új fire-ök → auto open ha be van kapcsolva */
export async function maybeAutoOpenFromSnapshot(snapshot: CryptoSnapshot): Promise<string[]> {
  let settings = await loadBinanceSettings()
  if (!settings.autoTrade) return []
  if (!getBinanceCreds()) return []
  if (settings.killedToday) return ["Napi kill — skip"]

  const logs: string[] = []
  for (const s of snapshot.symbols) {
    if (s.signal.kind === "NONE") continue
    settings = await loadBinanceSettings()
    if (!settings.autoTrade) break
    const r = await openFromSymbolSnapshot(s, { settings, countFire: true })
    logs.push(`${s.symbol}: ${r.message}`)
    if (r.ok) break // max 1 pozíció
  }
  return logs
}

/** TP1 után BE stop + runner TP gondozás */
export async function syncBinanceExits(creds?: BinanceCreds): Promise<string[]> {
  const c = creds ?? getBinanceCreds()
  if (!c) return ["Nincs API key"]
  const settings = await loadBinanceSettings()
  const positions = await getPositions(c)
  const logs: string[] = []
  const nextTrades: BinanceLiveTrade[] = []

  for (const t of settings.liveTrades) {
    if (t.phase === "closed") {
      nextTrades.push(t)
      continue
    }
    const pos = positions.find((p) => p.symbol === t.pair)
    if (!pos || pos.positionAmt === 0) {
      nextTrades.push({ ...t, phase: "closed", note: "Pozíció lezárva (exchange)" })
      logs.push(`${t.pair}: closed`)
      continue
    }

    const absAmt = Math.abs(pos.positionAmt)
    const halfGone = absAmt <= t.qty * 0.6 && t.tp1 != null && t.phase === "open"
    if (halfGone) {
      // TP1 valószínűleg ment — BE stop + TP2 újra
      const isLong = t.side === "LONG"
      const closeSide = isLong ? "SELL" : "BUY"
      const filters = await getSymbolFilters(t.pair)
      try {
        await cancelAllOrders(c, t.pair)
        const be = roundTick(t.entry, filters.tickSize)
        const tp2 = roundTick(t.target, filters.tickSize)
        await stopMarketClose(c, {
          symbol: t.pair,
          side: closeSide,
          stopPrice: be,
          closePosition: true,
        })
        await takeProfitMarketClose(c, {
          symbol: t.pair,
          side: closeSide,
          stopPrice: tp2,
          closePosition: true,
        })
        nextTrades.push({ ...t, phase: "tp1_done", note: "TP1 után stop BE-re" })
        logs.push(`${t.pair}: TP1→BE sync`)
      } catch (e) {
        nextTrades.push({
          ...t,
          note: e instanceof Error ? e.message : "BE sync hiba",
        })
        logs.push(`${t.pair}: BE sync hiba`)
      }
    } else {
      nextTrades.push(t)
    }
  }

  await updateBinanceSettings({ liveTrades: nextTrades })
  return logs
}

export async function closeSymbol(pairOrSymbol: string): Promise<string> {
  const creds = getBinanceCreds()
  if (!creds) throw new Error("Nincs API key")
  const pair =
    pairOrSymbol in PAIR ? PAIR[pairOrSymbol as TradedSymbol] : pairOrSymbol.toUpperCase()
  const positions = await getPositions(creds)
  const pos = positions.find((p) => p.symbol === pair)
  if (!pos || pos.positionAmt === 0) return `${pair}: nincs nyitott pozíció`
  await closePositionMarket(creds, pair, pos.positionAmt)
  const settings = await loadBinanceSettings()
  await updateBinanceSettings({
    liveTrades: settings.liveTrades.map((t) =>
      t.pair === pair && t.phase !== "closed"
        ? { ...t, phase: "closed" as const, note: "Manuális zárás" }
        : t
    ),
  })
  return `${pair}: market close küldve`
}

export async function closeAllPositions(): Promise<string[]> {
  const creds = getBinanceCreds()
  if (!creds) throw new Error("Nincs API key")
  const positions = await getPositions(creds)
  const out: string[] = []
  for (const p of positions) {
    await closePositionMarket(creds, p.symbol, p.positionAmt)
    out.push(`${p.symbol}: closed`)
  }
  const settings = await loadBinanceSettings()
  await updateBinanceSettings({
    liveTrades: settings.liveTrades.map((t) =>
      t.phase !== "closed" ? { ...t, phase: "closed" as const, note: "Close all" } : t
    ),
  })
  return out.length ? out : ["Nincs nyitott pozíció"]
}
