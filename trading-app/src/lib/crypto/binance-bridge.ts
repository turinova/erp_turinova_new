/**
 * Binance bridge: crypto signal → USD-M futures order.
 * Survivor default: A+ FVG/SWEEP, risk~2%, lev≤10×, cooldown/coin;
 * exit: ~35% @ 1.25R → SL@BE+fee → ATR trail @ 2R → runner @ target (matchPaperExit).
 */
import {
  cancelAllOrders,
  closePositionMarket,
  getBinanceCreds,
  getOpenOrdersForSymbols,
  getLastPrice,
  getPositions,
  getSymbolFilters,
  getUsdtEquity,
  binanceRateLimited,
  binanceRateLimitRemainingMs,
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
  dailyLossLimitUsd,
  loadBinanceSettings,
  recordLastError,
  rollDayIfNeeded,
  updateBinanceSettings,
  type BinanceDeskSettings,
  type BinanceLiveTrade,
} from "./binance-settings"
import { getActivePolicy } from "./learn/store"
import { partialTp1Price } from "./paper"
import { DEFAULT_TP1_FRAC } from "./paper-costs"
import { fetchCryptoFeed, getCachedFeedMeta } from "./feed"
import {
  beStopPrice,
  chandelierTrail,
  effectiveLeverageCap,
  finalizeEntryStop,
  mfeR,
  ratchetStop,
  TRAIL_ACTIVATE_R,
  TRAIL_ATR_MULT,
} from "./stop-policy"
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

export type DeskHealthCheck = {
  id: string
  ok: boolean
  label: string
  detail?: string
}

export type DeskHealth = {
  ok: boolean
  feedSource: string | null
  feedAgeSec: number | null
  feedIsBinance: boolean
  checks: DeskHealthCheck[]
}

export type DeskState = {
  configured: boolean
  connected: boolean
  error: string | null
  equity: {
    balance: number
    available: number
    unrealized: number
    marginBalance?: number
    asset?: string
    assetWallet?: number
    multiAssets?: boolean
  } | null
  positions: Awaited<ReturnType<typeof getPositions>>
  openOrders: Awaited<ReturnType<typeof getOpenOrdersForSymbols>>
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
  health: DeskHealth
}

function totalEquity(eq: {
  balance: number
  unrealized: number
  marginBalance?: number
}) {
  // Binance Futures: Margin Balance (napi kill / day PnL ehhez igazodik)
  if (eq.marginBalance != null && Number.isFinite(eq.marginBalance)) {
    return eq.marginBalance
  }
  return eq.balance + eq.unrealized
}

async function applyDailyGuard(equity: { balance: number; available: number; unrealized: number } | null) {
  const eqNow = equity ? totalEquity(equity) : null
  let settings = await rollDayIfNeeded(eqNow)
  if (settings.dayStartEquity == null && eqNow != null) {
    settings = await updateBinanceSettings({ dayStartEquity: eqNow })
  }

  // Rossz / hiányzó baseline (0, negatív, Multi-Assets glitch) → állítsuk újra
  if (
    settings.dayStartEquity == null ||
    !Number.isFinite(settings.dayStartEquity) ||
    settings.dayStartEquity <= 1
  ) {
    if (eqNow != null && eqNow > 1) {
      settings = await updateBinanceSettings({
        dayStartEquity: eqNow,
        killedToday: false,
      })
    }
  } else if (
    eqNow != null &&
    eqNow > 20 &&
    (settings.dayStartEquity > eqNow * 2.5 || eqNow > settings.dayStartEquity * 2.5)
  ) {
    settings = await updateBinanceSettings({
      dayStartEquity: eqNow,
      killedToday: false,
      lastError: null,
      lastErrorAt: null,
    })
  }

  const dayPnl =
    settings.dayStartEquity != null && eqNow != null ? eqNow - settings.dayStartEquity : 0

  const lossLimit = dailyLossLimitUsd(settings)
  if (
    !settings.killedToday &&
    settings.autoTrade &&
    settings.dayStartEquity != null &&
    dayPnl <= -lossLimit
  ) {
    settings = await updateBinanceSettings({
      autoTrade: false,
      killedToday: true,
      lastError: `Napi loss limit (−$${lossLimit.toFixed(2)}; max $${settings.maxDailyLossUsd} / ${settings.maxDailyLossPct}% ) — auto kikapcsolva`,
      lastErrorAt: new Date().toISOString(),
    })
  }

  return { settings, dayPnl }
}

function buildDeskHealth(input: {
  configured: boolean
  connected: boolean
  error: string | null
  equity: DeskState["equity"]
  settings: BinanceDeskSettings
  feedSource?: string | null
  feedAgeSec?: number | null
}): DeskHealth {
  const meta = getCachedFeedMeta()
  const feedSource = input.feedSource ?? meta?.source ?? null
  const feedAgeSec = input.feedAgeSec ?? meta?.ageSec ?? null
  const feedIsBinance = feedSource === "binance"

  const checks: DeskHealthCheck[] = []
  checks.push({
    id: "api_key",
    ok: input.configured,
    label: "API kulcs az env-ben",
    detail: input.configured ? "BINANCE_API_KEY + SECRET" : "Hiányzik",
  })
  checks.push({
    id: "api_connected",
    ok: input.connected,
    label: "Binance Futures REST él",
    detail: input.connected ? "account/positions OK" : input.error ?? "nincs kapcsolat",
  })

  const eq = input.equity
  const availableOk = eq != null && eq.available >= 5
  checks.push({
    id: "available",
    ok: availableOk,
    label: "Available margin ≥ $5",
    detail: eq ? `$${eq.available.toFixed(2)}` : "nincs adat",
  })

  const baseline = input.settings.dayStartEquity
  const baselineOk = baseline != null && Number.isFinite(baseline) && baseline > 1
  checks.push({
    id: "day_baseline",
    ok: baselineOk,
    label: "Napi equity baseline OK",
    detail: baselineOk ? `$${baseline!.toFixed(2)}` : `rossz/hiányzik (${baseline ?? "null"})`,
  })

  const feedFresh = feedAgeSec != null && feedAgeSec < 60
  checks.push({
    id: "feed_source",
    ok: feedIsBinance && feedFresh,
    label: "Signal feed = Binance (friss)",
    detail: feedSource
      ? `${feedSource}${feedAgeSec != null ? ` · ${feedAgeSec}s` : ""}${
          feedIsBinance ? "" : " — nem Binance, spread rizikó"
        }`
      : "még nincs feed cache",
  })

  checks.push({
    id: "survivor_mode",
    ok:
      input.settings.autoOnlyGradeA === true &&
      input.settings.matchPaperExit !== false &&
      input.settings.riskPercent <= 3 &&
      input.settings.leverageCap <= 10,
    label: "Survivor mód (A+ · risk≤3% · lev≤10×)",
    detail: `A+ ${input.settings.autoOnlyGradeA ? "BE" : "KI"} · risk ${input.settings.riskPercent}% · lev ${input.settings.leverageCap}x · cooldown ${input.settings.cooldownMinutes ?? 0}p`,
  })

  const ok = checks.every((c) => c.ok)
  return { ok, feedSource, feedAgeSec, feedIsBinance, checks }
}

const DESK_CACHE_MS = 8_000
let deskStateCache: { at: number; state: DeskState } | null = null

export async function getBinanceDeskState(
  signalPreview: SignalPreview[] = [],
  opts?: { force?: boolean; refreshFeed?: boolean }
): Promise<DeskState> {
  const creds = getBinanceCreds()
  const baseSettings = await loadBinanceSettings()

  // Signal feed health: Binance-first, opcionális friss pull
  let feedSource: string | null = null
  let feedAgeSec: number | null = null
  try {
    if (opts?.refreshFeed || !getCachedFeedMeta()) {
      const feed = await fetchCryptoFeed({ preferBinance: true, bypassCache: !!opts?.refreshFeed })
      feedSource = feed.source
      feedAgeSec = 0
    } else {
      const meta = getCachedFeedMeta()!
      feedSource = meta.source
      feedAgeSec = meta.ageSec
    }
  } catch (e) {
    feedSource = null
    feedAgeSec = null
    console.warn("[desk] feed health:", e instanceof Error ? e.message : e)
  }

  if (!creds) {
    const health = buildDeskHealth({
      configured: false,
      connected: false,
      error: "Nincs API key",
      equity: null,
      settings: baseSettings,
      feedSource,
      feedAgeSec,
    })
    return {
      configured: false,
      connected: false,
      error: "Hiányzik BINANCE_API_KEY / BINANCE_API_SECRET (Vercel env vagy .env.local)",
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
        maxLossUsd: dailyLossLimitUsd(baseSettings),
        killed: baseSettings.killedToday,
      },
      signalPreview,
      lastError: baseSettings.lastError,
      lastErrorAt: baseSettings.lastErrorAt,
      health,
    }
  }

  const now = Date.now()
  if (
    !opts?.force &&
    deskStateCache &&
    now - deskStateCache.at < DESK_CACHE_MS
  ) {
    const health = buildDeskHealth({
      configured: true,
      connected: deskStateCache.state.connected,
      error: deskStateCache.state.error,
      equity: deskStateCache.state.equity,
      settings: baseSettings,
      feedSource,
      feedAgeSec,
    })
    return {
      ...deskStateCache.state,
      settings: baseSettings,
      liveTrades: baseSettings.liveTrades,
      signalPreview: signalPreview.length
        ? signalPreview
        : deskStateCache.state.signalPreview,
      lastError: baseSettings.lastError,
      lastErrorAt: baseSettings.lastErrorAt,
      health,
    }
  }

  // Rate limit alatt: stale cache, ne újabb REST burst
  if (binanceRateLimited() && deskStateCache) {
    const health = buildDeskHealth({
      configured: true,
      connected: false,
      error: "rate limit",
      equity: deskStateCache.state.equity,
      settings: baseSettings,
      feedSource,
      feedAgeSec,
    })
    return {
      ...deskStateCache.state,
      connected: false,
      error: `Binance rate limit — ${Math.ceil(binanceRateLimitRemainingMs() / 1000)}s cooldown`,
      settings: baseSettings,
      liveTrades: baseSettings.liveTrades,
      warnings: [
        ...(deskStateCache.state.warnings ?? []),
        "REST cooldown — lassabb poll / websocket ajánlott",
      ],
      lastError: baseSettings.lastError,
      lastErrorAt: baseSettings.lastErrorAt,
      health,
    }
  }

  try {
    const [equity, positions] = await Promise.all([
      getUsdtEquity(creds),
      getPositions(creds),
    ])
    const orderSymbols = [
      ...new Set([
        ...baseSettings.symbols.map((s) => `${s}USDT`),
        ...positions.map((p) => p.symbol),
        ...baseSettings.liveTrades
          .filter((t) => t.phase !== "closed")
          .map((t) => t.pair),
      ]),
    ]
    const openOrders = await getOpenOrdersForSymbols(creds, orderSymbols)
    const { settings, dayPnl } = await applyDailyGuard(equity)
    const warnings: string[] = []
    if (equity.available < 5) {
      warnings.push(
        `Available margin alacsony ($${equity.available.toFixed(2)}). ` +
          `Ha van wallet de available 0: ellenőrizd a Futures szabad margint / nyitott order-eket.`
      )
    } else if (equity.multiAssets) {
      warnings.push(
        `Multi-Assets / BNFCR — számok = Binance Futures account (Wallet / Margin / Available), nem csak ${equity.asset} dust.`
      )
    }
    if (settings.autoTrade) {
      warnings.push("AUTO ÉLŐ — a /crypto fire Binance-re mehet (paper-szerű setupok).")
      warnings.push(
        settings.matchPaperExit
          ? "Exit: paper mód — 50% @ 1R → SL BE → 50% @ target."
          : "Exit: full size eredeti SL → full TP."
      )
      if (settings.autoOnlyGradeA) {
        warnings.push(
          `A+ auto filter BE — csak FVG/SWEEP + RVOL ≥ ${settings.autoMinRvol}`
        )
      } else {
        warnings.push("Paper parity: PB / MR / breakout / FVG / sweep mind mehet (ha van signal).")
      }
    }
    if (settings.killedToday) {
      warnings.push("Napi kill aktív — auto ma nem kapcsolható vissza loss limit miatt (vagy kapcsold kézzel holnap).")
    }
    if (settings.firesToday >= settings.maxDailyFires) {
      warnings.push(`Napi fire limit (${settings.firesToday}/${settings.maxDailyFires}).`)
    }

    const state: DeskState = {
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
        maxLossUsd: dailyLossLimitUsd(settings),
        killed: settings.killedToday,
      },
      signalPreview,
      lastError: settings.lastError,
      lastErrorAt: settings.lastErrorAt,
      health: buildDeskHealth({
        configured: true,
        connected: true,
        error: null,
        equity,
        settings,
        feedSource,
        feedAgeSec,
      }),
    }
    deskStateCache = { at: Date.now(), state }
    // Rate-limit lastError törlése sikeres poll után
    if (settings.lastError && /too many requests|rate limit/i.test(settings.lastError)) {
      void updateBinanceSettings({ lastError: null, lastErrorAt: null })
      state.lastError = null
      state.lastErrorAt = null
    }
    return state
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Binance kapcsolat hiba"
    // Rate limit spam ne írja tele a lastError-t minden 3s-ban
    if (!/too many requests|rate limit|cooldown/i.test(msg)) {
      await recordLastError(msg)
    } else {
      await recordLastError(
        "Binance IP rate limit — desk poll lassítva, ~60s cooldown. Ne frissítsd spamelve."
      )
    }
    const settings = await loadBinanceSettings()
    const healthFail = buildDeskHealth({
      configured: true,
      connected: false,
      error: msg,
      equity: deskStateCache?.state.equity ?? null,
      settings,
      feedSource,
      feedAgeSec,
    })
    if (deskStateCache) {
      return {
        ...deskStateCache.state,
        connected: false,
        error: msg,
        settings,
        liveTrades: settings.liveTrades,
        warnings: [msg],
        lastError: settings.lastError,
        lastErrorAt: settings.lastErrorAt,
        signalPreview: signalPreview.length
          ? signalPreview
          : deskStateCache.state.signalPreview,
        health: healthFail,
      }
    }
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
        maxLossUsd: dailyLossLimitUsd(settings),
        killed: settings.killedToday,
      },
      signalPreview,
      lastError: settings.lastError,
      lastErrorAt: settings.lastErrorAt,
      health: healthFail,
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
      message: `OK — Wallet $${eq.balance.toFixed(2)} · Margin $${eq.marginBalance.toFixed(2)} · Available $${eq.available.toFixed(2)} (${eq.asset}${eq.multiAssets ? ", multi-assets" : ""})`,
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

  // A+ auto: csak FVG/SWEEP + min RVOL (force / manuális átugorja)
  if (!opts?.force && settings.autoOnlyGradeA) {
    let policy = null as Awaited<ReturnType<typeof getActivePolicy>> | null
    try {
      policy = await getActivePolicy()
    } catch {
      policy = null
    }
    const allowed = policy?.autoKindPrefixes?.length
      ? policy.autoKindPrefixes
      : ["FVG_", "SWEEP_"]
    const gradeA = allowed.some((p) => sig.kind.startsWith(p))
    if (!gradeA) {
      return {
        ok: false,
        skipped: true,
        message: `A+ filter: ${sig.kind} nem auto (csak ${allowed.join("/")})`,
      }
    }
    if (policy?.disabledKinds.includes(sig.kind)) {
      return { ok: false, skipped: true, message: `Policy tilt: ${sig.kind}` }
    }
    const barH = snap.lastBarT
      ? Math.floor(new Date(snap.lastBarT * 1000).getUTCHours() / 4) * 4
      : null
    if (barH != null && policy?.blockedHourBuckets.includes(barH)) {
      return {
        ok: false,
        skipped: true,
        message: `Policy: UTC ${barH}:00 bucket tiltva`,
      }
    }
    const minR = Math.max(
      0.5,
      policy?.autoMinRvol ?? settings.autoMinRvol ?? 1
    )
    if (snap.rvol == null || snap.rvol < minR) {
      return {
        ok: false,
        skipped: true,
        message: `A+ filter: RVOL ${snap.rvol?.toFixed(2) ?? "?"} < ${minR}`,
      }
    }
  }

  if (settings.killedToday && !opts?.force) {
    return { ok: false, skipped: true, message: "Napi kill aktív — ma nincs új auto nyitás" }
  }

  // Cooldown / coin — overtrade ellen (force átugorja)
  const cooldownMin = Math.max(0, settings.cooldownMinutes ?? 0)
  if (!opts?.force && cooldownMin > 0) {
    const lastAt = settings.lastOpenAtBySymbol?.[snap.symbol as "SOL" | "DOGE"]
    if (lastAt) {
      const elapsedMin = (Date.now() - new Date(lastAt).getTime()) / 60_000
      if (elapsedMin < cooldownMin) {
        return {
          ok: false,
          skipped: true,
          message: `Cooldown ${snap.symbol}: ${Math.ceil(cooldownMin - elapsedMin)}p még (${cooldownMin}p / coin)`,
        }
      }
    }
  }

  if (countFire && settings.firesToday >= settings.maxDailyFires) {
    const msg = `Napi fire limit (${settings.firesToday}/${settings.maxDailyFires})`
    await recordLastError(msg)
    return { ok: false, skipped: true, message: msg }
  }

  // coinonként max 1 nyitott pozíció (SOL + DOGE mehet párhuzamosan, mint a paper)
  const pair = PAIR[snap.symbol]
  const positions = await getPositions(creds)
  const sameOpen = positions.some((p) => p.symbol === pair && p.positionAmt !== 0)
  if (sameOpen) {
    return {
      ok: false,
      skipped: true,
      message: `${pair} már nyitva — előbb zárd (másik coin mehet)`,
    }
  }

  const key = signalKey(snap.symbol, sig.kind, snap.lastBarT)
  const openedKeys = settings.openedSignalKeys ?? []
  if (
    !opts?.force &&
    (settings.lastOpenedKey === key ||
      openedKeys.includes(key) ||
      settings.liveTrades.some((t) => t.signalKey === key))
  ) {
    return { ok: false, skipped: true, message: "Ezt a signal-t már megnyitottuk (dedup)" }
  }

  const isLong = sig.kind.endsWith("LONG")
  const dir = isLong ? ("long" as const) : ("short" as const)
  const entry = sig.entry
  const atr =
    snap.atr != null && snap.atr > 0 ? snap.atr : Math.abs(entry - sig.stop) / 0.85

  // Safety: újra alkalmazzuk a stop padlót (régi/szűk signal ne menjen élőbe)
  const floored = finalizeEntryStop({
    entry,
    structuralStop: sig.stop,
    atr,
    dir,
    symbol: snap.symbol,
  })
  if (!floored.ok) {
    return { ok: false, skipped: true, message: `Stop padló: ${floored.reason}` }
  }
  const stop = floored.stop
  // Target 2R a padlós riskre, ha a signal target az eredeti riskhez volt kötve
  const origRisk = Math.abs(entry - sig.stop) || floored.risk
  const targetDist = Math.abs(sig.target - entry)
  const target =
    origRisk > 0 && Math.abs(targetDist / origRisk - 2) < 0.15
      ? isLong
        ? entry + 2 * floored.risk
        : entry - 2 * floored.risk
      : sig.target

  const stopPct = floored.stopPct
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

  // BNFCR / Multi-Assets: Binance nem engedi a 100% available lekötését
  const marginBudget = base * 0.75
  const riskUsd = (base * Math.max(0.5, settings.riskPercent)) / 100
  let notional = riskUsd / stopPct
  let lev = notional / marginBudget
  const cap = effectiveLeverageCap(stopPct, Math.max(1, settings.leverageCap))
  if (lev > cap) {
    notional = marginBudget * cap
    lev = cap
  }
  lev = Math.max(1, Math.min(cap, Math.floor(lev)))
  if (notional / lev > marginBudget) {
    notional = marginBudget * lev
  }

  const filters = await getSymbolFilters(pair)
  let qty = roundStep(notional / entry, filters.stepSize)
  if (qty < filters.minQty) {
    return { ok: false, message: `Qty túl kicsi (${qty}) — növeld a risk%-ot vagy a tőkét` }
  }
  if (qty * entry < filters.minNotional) {
    qty = roundStep(filters.minNotional / entry, filters.stepSize)
  }
  // qty újraszámolás után is tartsuk a margin keretet
  while (qty > filters.minQty && (qty * entry) / lev > marginBudget) {
    qty = roundStep(qty - filters.stepSize, filters.stepSize)
  }
  if (qty < filters.minQty || qty * entry < filters.minNotional) {
    const msg = `Margin keret túl szűk (budget ~$${marginBudget.toFixed(0)}) — csökkentsd a lev cap-et vagy növeld a tőkét`
    await recordLastError(msg)
    return { ok: false, message: msg }
  }

  const side = isLong ? "BUY" : "SELL"
  const closeSide = isLong ? "SELL" : "BUY"
  const tp1R = Math.max(0.5, settings.tp1R ?? 1.25)
  const tp1Frac = Math.min(0.9, Math.max(0.1, settings.tp1Frac ?? DEFAULT_TP1_FRAC))
  const runnerOnly = settings.runnerOnlyTrail === true
  const tp1Raw = partialTp1Price(entry, stop, target, tp1R)
  const usePartial = settings.matchPaperExit !== false && tp1Raw != null

  try {
    await ensureMarginType(creds, pair)
    await setLeverage(creds, pair, lev)
    await cancelAllOrders(creds, pair)

    const entryOrder = await marketOrder(creds, { symbol: pair, side, quantity: qty })

    const stopPx = roundTick(stop, filters.tickSize)
    const targetPx = roundTick(target, filters.tickSize)
    const tp1Px = tp1Raw != null ? roundTick(tp1Raw, filters.tickSize) : null

    let note: string | undefined
    let tp1: number | null = null
    try {
      if (usePartial && tp1Px != null) {
        const scaleQty = roundStep(qty * tp1Frac, filters.stepSize)
        const rest = roundStep(Math.max(0, qty - scaleQty), filters.stepSize)
        if (scaleQty >= filters.minQty && rest >= filters.minQty) {
          tp1 = tp1Px
          await takeProfitMarketClose(creds, {
            symbol: pair,
            side: closeSide,
            stopPrice: tp1Px,
            quantity: scaleQty,
          })
          if (!runnerOnly) {
            await takeProfitMarketClose(creds, {
              symbol: pair,
              side: closeSide,
              stopPrice: targetPx,
              quantity: rest,
            })
          }
          await stopMarketClose(creds, {
            symbol: pair,
            side: closeSide,
            stopPrice: stopPx,
            closePosition: true,
          })
          const pct = Math.round(tp1Frac * 100)
          note = runnerOnly
            ? `Exit: ${pct}%@${tp1R}R → SL@BE+fee → trail-only runner`
            : `Exit: ${pct}%@${tp1R}R → SL@BE+fee → trail → ${100 - pct}%@TP`
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
          note = "Exit: full SL→TP (qty túl kicsi partialhoz)"
        }
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
        note = "Exit: full SL→TP"
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
      stopLive: stop,
      target,
      tp1,
      qty,
      leverage: lev,
      riskUsd: qty * entry * stopPct,
      entryOrderId: entryOrder.orderId,
      phase: "open",
      atrAtEntry: atr,
      beStop: null,
      highWater: entry,
      lowWater: entry,
      note: note ?? "opened",
    })

    const nextKeys = [...new Set([key, ...(settings.openedSignalKeys ?? [])])].slice(0, 80)
    const sym = snap.symbol as "SOL" | "DOGE"
    await updateBinanceSettings({
      lastOpenedKey: key,
      openedSignalKeys: nextKeys,
      lastOpenAtBySymbol: { [sym]: new Date().toISOString() },
      firesToday: countFire ? settings.firesToday + 1 : settings.firesToday,
      lastError: note?.includes("hibás") ? note : null,
      lastErrorAt: note?.includes("hibás") ? new Date().toISOString() : settings.lastErrorAt,
    })

    return {
      ok: true,
      message: note?.includes("hibás")
        ? `Nyitva ${pair}, de SL/TP hiba: ${note}`
        : `Nyitva ${pair} ${isLong ? "LONG" : "SHORT"} qty=${qty} lev=${lev}x risk≈$${trade.riskUsd.toFixed(2)} (${usePartial && tp1 ? "paper exit" : "full SL→TP"})`,
      trade,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "open hiba"
    await recordLastError(msg)
    // ne spamelje ugyanazt a fire-t minden tickben (rate limit + margin hiba)
    const sticky =
      /margin is insufficient/i.test(msg) ||
      /insufficient/i.test(msg) ||
      /too many requests/i.test(msg)
    if (sticky) {
      const nextKeys = [...new Set([key, ...(settings.openedSignalKeys ?? [])])].slice(0, 80)
      await updateBinanceSettings({ lastOpenedKey: key, openedSignalKeys: nextKeys })
    }
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
      stopLive: price * 0.99,
      target: price * 1.01,
      tp1: null,
      qty,
      leverage: 5,
      riskUsd: 0,
      entryOrderId: null,
      phase: "closed",
      atrAtEntry: null,
      beStop: null,
      highWater: price,
      lowWater: price,
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

/** Snapshot új fire-ök → auto open ha be van kapcsolva (minden paper-szerű signal) */
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
    if (settings.firesToday >= settings.maxDailyFires) {
      logs.push(`Fire limit ${settings.firesToday}/${settings.maxDailyFires}`)
      break
    }
    const r = await openFromSymbolSnapshot(s, { settings, countFire: true })
    logs.push(`${s.symbol}: ${r.message}`)
    // ne álljunk meg az első sikernél — másik coin is mehet (max 1 / symbol)
  }
  return logs
}

/**
 * Exit sync:
 * - lezárt pozíciók jelölése
 * - paper partial: TP1 után SL → BE+fee; MFE≥activateR → ATR chandelier trail (ratchet)
 */
export async function syncBinanceExits(
  creds?: BinanceCreds,
  snapshot?: CryptoSnapshot | null
): Promise<string[]> {
  const c = creds ?? getBinanceCreds()
  if (!c) return ["Nincs API key"]
  const settings = await loadBinanceSettings()
  const positions = await getPositions(c)
  const logs: string[] = []
  const nextTrades: BinanceLiveTrade[] = []
  const feeBuf = settings.beFeeBufferPct ?? BE_FEE_BUFFER_PCT_FALLBACK
  const trailOn = settings.trailEnabled !== false
  const activateR = settings.trailActivateR ?? TRAIL_ACTIVATE_R
  const trailMult = settings.trailAtrMult ?? TRAIL_ATR_MULT
  const runnerOnly = settings.runnerOnlyTrail === true
  const tp1Frac = Math.min(0.9, Math.max(0.1, settings.tp1Frac ?? DEFAULT_TP1_FRAC))
  /** Remaining qty threshold after TP1 fill (tolerance for step rounding) */
  const afterTp1QtyMax = Math.max(0.55, 1 - tp1Frac + 0.1)

  for (const t of settings.liveTrades) {
    if (t.phase === "closed" || t.smoke) {
      nextTrades.push(t)
      continue
    }
    const pos = positions.find((p) => p.symbol === t.pair)
    if (!pos || pos.positionAmt === 0) {
      nextTrades.push({ ...t, phase: "closed", note: t.note ?? "Pozíció lezárva (exchange)" })
      logs.push(`${t.pair}: closed`)
      continue
    }

    const isLong = t.side === "LONG"
    const dir = isLong ? ("long" as const) : ("short" as const)
    const absAmt = Math.abs(pos.positionAmt)
    const mark = pos.markPrice > 0 ? pos.markPrice : pos.entryPrice
    let highWater = Math.max(t.highWater ?? t.entry, mark)
    let lowWater = Math.min(t.lowWater ?? t.entry, mark)

    const atrLive = atrForTrade(t, snapshot) ?? Math.abs(t.entry - t.stop) / 0.85
    let stopLive = t.stopLive ?? t.stop
    let phase = t.phase
    let beStop = t.beStop
    let note = t.note

    // TP1 fill: remaining ≤ (1 − frac + tol) → BE+fee
    if (
      settings.matchPaperExit &&
      phase === "open" &&
      t.tp1 != null &&
      absAmt <= t.qty * afterTp1QtyMax + 1e-9
    ) {
      try {
        const filters = await getSymbolFilters(t.pair)
        const closeSide = isLong ? "SELL" : "BUY"
        beStop = roundTick(beStopPrice(t.entry, dir, feeBuf), filters.tickSize)
        stopLive = beStop
        await cancelAllOrders(c, t.pair)
        await stopMarketClose(c, {
          symbol: t.pair,
          side: closeSide,
          stopPrice: beStop,
          closePosition: true,
        })
        if (!runnerOnly) {
          const targetPx = roundTick(t.target, filters.tickSize)
          await takeProfitMarketClose(c, {
            symbol: t.pair,
            side: closeSide,
            stopPrice: targetPx,
            closePosition: true,
          })
        }
        phase = "tp1_done"
        note = runnerOnly
          ? "TP1 kész → SL@BE+fee · runner trail-only"
          : "TP1 kész → SL@BE+fee + TP2 (paper parity)"
        logs.push(`${t.pair}: tp1→BE+fee`)
      } catch (e) {
        const msg = e instanceof Error ? e.message : "tp1 sync hiba"
        nextTrades.push({ ...t, highWater, lowWater, note: `TP1 sync hiba: ${msg}` })
        logs.push(`${t.pair}: ${msg}`)
        continue
      }
    }

    // Trail: csak TP1 után, MFE ≥ activateR
    if (
      trailOn &&
      settings.matchPaperExit &&
      (phase === "tp1_done" || phase === "trailing") &&
      atrLive > 0
    ) {
      const extreme = isLong ? highWater : lowWater
      const mfe = mfeR({ entry: t.entry, stop: t.stop, extreme, dir })
      const floorStop = beStop ?? beStopPrice(t.entry, dir, feeBuf)

      if (mfe >= activateR || phase === "trailing") {
        const trail = chandelierTrail({ extreme, atr: atrLive, dir, mult: trailMult })
        const candidate = ratchetStop(floorStop, trail, dir)
        const nextStop = ratchetStop(stopLive, candidate, dir)
        const improved = isLong ? nextStop > stopLive + 1e-12 : nextStop < stopLive - 1e-12

        if (improved) {
          try {
            const filters = await getSymbolFilters(t.pair)
            const closeSide = isLong ? "SELL" : "BUY"
            const stopPx = roundTick(nextStop, filters.tickSize)
            // Ne helyezzünk SL-t a mark rossz oldalára
            const safe =
              isLong ? stopPx < mark * 0.9995 : stopPx > mark * 1.0005
            if (safe) {
              await cancelAllOrders(c, t.pair)
              await stopMarketClose(c, {
                symbol: t.pair,
                side: closeSide,
                stopPrice: stopPx,
                closePosition: true,
              })
              if (!runnerOnly) {
                const targetPx = roundTick(t.target, filters.tickSize)
                await takeProfitMarketClose(c, {
                  symbol: t.pair,
                  side: closeSide,
                  stopPrice: targetPx,
                  closePosition: true,
                })
              }
              stopLive = stopPx
              phase = "trailing"
              note = `Trail SL@${stopPx} (MFE ${mfe.toFixed(2)}R, ATR×${trailMult})`
              logs.push(`${t.pair}: trail→${stopPx}`)
            }
          } catch (e) {
            const msg = e instanceof Error ? e.message : "trail sync hiba"
            logs.push(`${t.pair}: ${msg}`)
            nextTrades.push({
              ...t,
              phase,
              stopLive,
              beStop,
              highWater,
              lowWater,
              atrAtEntry: t.atrAtEntry ?? atrLive,
              note: `Trail sync hiba: ${msg}`,
            })
            continue
          }
        } else if (phase === "tp1_done" && mfe >= activateR) {
          phase = "trailing"
          note = note ?? `Trail armed @ ${mfe.toFixed(2)}R`
        }
      }
    }

    nextTrades.push({
      ...t,
      phase,
      stopLive,
      beStop,
      highWater,
      lowWater,
      atrAtEntry: t.atrAtEntry ?? atrLive,
      note,
    })
  }

  await updateBinanceSettings({ liveTrades: nextTrades })
  return logs
}

const BE_FEE_BUFFER_PCT_FALLBACK = 0.0008

function atrForTrade(t: BinanceLiveTrade, snapshot?: CryptoSnapshot | null): number | null {
  if (snapshot) {
    const sym = snapshot.symbols.find(
      (s) => s.symbol === t.symbol || PAIR[s.symbol as TradedSymbol] === t.pair
    )
    if (sym?.atr != null && sym.atr > 0) return sym.atr
  }
  return t.atrAtEntry != null && t.atrAtEntry > 0 ? t.atrAtEntry : null
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
