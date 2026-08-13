/**
 * Binance USD-M Futures REST (HMAC).
 * Base: https://fapi.binance.com
 */
import { createHmac } from "crypto"

const BASE = "https://fapi.binance.com"

export type BinanceCreds = { key: string; secret: string }

export function getBinanceCreds(): BinanceCreds | null {
  const key = process.env.BINANCE_API_KEY?.trim()
  const secret = process.env.BINANCE_API_SECRET?.trim()
  if (!key || !secret) return null
  return { key, secret }
}

export function hasBinanceCreds(): boolean {
  return getBinanceCreds() != null
}

export class BinanceApiError extends Error {
  constructor(
    message: string,
    public code?: number,
    public body?: unknown
  ) {
    super(message)
    this.name = "BinanceApiError"
  }
}

/** IP weight cooldown — Too many requests után ne hammereljük a REST-et */
let rateLimitUntil = 0

export function binanceRateLimited(): boolean {
  return Date.now() < rateLimitUntil
}

export function binanceRateLimitRemainingMs(): number {
  return Math.max(0, rateLimitUntil - Date.now())
}

function markRateLimit(msg: string) {
  if (/too many requests|rate limit|-1003/i.test(msg)) {
    rateLimitUntil = Date.now() + 60_000
  }
}

async function signedRequest<T>(
  creds: BinanceCreds,
  method: "GET" | "POST" | "DELETE",
  path: string,
  params: Record<string, string | number | boolean | undefined> = {}
): Promise<T> {
  if (binanceRateLimited()) {
    throw new BinanceApiError(
      `Rate limit cooldown (${Math.ceil(binanceRateLimitRemainingMs() / 1000)}s) — websocket helyett REST szünet`,
      -1003
    )
  }

  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue
    qs.set(k, String(v))
  }
  qs.set("timestamp", String(Date.now()))
  qs.set("recvWindow", "10000")
  const query = qs.toString()
  const signature = createHmac("sha256", creds.secret).update(query).digest("hex")
  const url = `${BASE}${path}?${query}&signature=${signature}`

  const res = await fetch(url, {
    method,
    headers: {
      "X-MBX-APIKEY": creds.key,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    cache: "no-store",
  })

  const text = await res.text()
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    throw new BinanceApiError(`Binance non-JSON: ${text.slice(0, 200)}`, res.status)
  }

  if (!res.ok) {
    const err = json as { code?: number; msg?: string }
    const msg = err?.msg ?? `HTTP ${res.status}`
    markRateLimit(msg)
    throw new BinanceApiError(msg, err?.code, json)
  }
  return json as T
}

async function publicGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const qs = new URLSearchParams(params).toString()
  const url = `${BASE}${path}${qs ? `?${qs}` : ""}`
  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) throw new BinanceApiError(`HTTP ${res.status}`, res.status)
  return (await res.json()) as T
}

export async function getLastPrice(symbol: string): Promise<number> {
  const row = await publicGet<{ price: string }>("/fapi/v1/ticker/price", { symbol })
  return Number(row.price)
}

export type FuturesBalance = {
  asset: string
  balance: number
  availableBalance: number
  crossUnPnl: number
}

export type FuturesPosition = {
  symbol: string
  positionAmt: number
  entryPrice: number
  markPrice: number
  unRealizedProfit: number
  leverage: number
  liquidationPrice: number
  marginType: string
  positionSide: string
}

export type SymbolFilters = {
  stepSize: number
  tickSize: number
  minQty: number
  minNotional: number
}

type ExchangeInfo = {
  symbols: Array<{
    symbol: string
    filters: Array<{ filterType: string; stepSize?: string; tickSize?: string; minQty?: string; notional?: string }>
  }>
}

const filterCache = new Map<string, SymbolFilters>()

export async function getSymbolFilters(symbol: string): Promise<SymbolFilters> {
  const cached = filterCache.get(symbol)
  if (cached) return cached
  const info = await publicGet<ExchangeInfo>("/fapi/v1/exchangeInfo", { symbol })
  const s = info.symbols.find((x) => x.symbol === symbol)
  if (!s) throw new BinanceApiError(`Ismeretlen symbol: ${symbol}`)
  const lot = s.filters.find((f) => f.filterType === "LOT_SIZE")
  const price = s.filters.find((f) => f.filterType === "PRICE_FILTER")
  const notion = s.filters.find((f) => f.filterType === "MIN_NOTIONAL")
  const filters: SymbolFilters = {
    stepSize: Number(lot?.stepSize ?? 0.001),
    tickSize: Number(price?.tickSize ?? 0.01),
    minQty: Number(lot?.minQty ?? 0.001),
    minNotional: Number(notion?.notional ?? 5),
  }
  filterCache.set(symbol, filters)
  return filters
}

export function roundStep(qty: number, step: number): number {
  if (step <= 0) return qty
  const precision = Math.max(0, Math.round(-Math.log10(step)))
  const floored = Math.floor(qty / step) * step
  return Number(floored.toFixed(precision))
}

export function roundTick(price: number, tick: number): number {
  if (tick <= 0) return price
  const precision = Math.max(0, Math.round(-Math.log10(tick)))
  const rounded = Math.round(price / tick) * tick
  return Number(rounded.toFixed(precision))
}

export async function pingAccount(creds: BinanceCreds): Promise<{ ok: true }> {
  await signedRequest(creds, "GET", "/fapi/v2/balance")
  return { ok: true }
}

export async function getBalances(creds: BinanceCreds): Promise<FuturesBalance[]> {
  const rows = await signedRequest<
    Array<{ asset: string; balance: string; availableBalance: string; crossUnPnl: string }>
  >(creds, "GET", "/fapi/v2/balance")
  return rows
    .map((r) => ({
      asset: r.asset,
      balance: Number(r.balance),
      availableBalance: Number(r.availableBalance),
      crossUnPnl: Number(r.crossUnPnl),
    }))
    .filter((r) => r.balance !== 0 || r.availableBalance !== 0 || r.crossUnPnl !== 0)
}

export async function getUsdtEquity(creds: BinanceCreds): Promise<{
  /** Binance: Wallet Balance (account totalWalletBalance) */
  balance: number
  /** Binance: Margin Balance (totalMarginBalance ≈ wallet + uPnL) */
  marginBalance: number
  /** Binance: Available Balance (account-level, Multi-Assets / BNFCR) */
  available: number
  /** Binance: Unrealized PNL */
  unrealized: number
  /** Dominant stable for labels (USDC/USDT) */
  asset: string
  /** Per-asset wallet of dominant stable (debug / compare) */
  assetWallet: number
  multiAssets?: boolean
}> {
  // Multi-Assets / BNFCR: a Futures app account-level mezőket mutat.
  // Per-asset available gyakran 0 — sizinghez az account availableBalance kell.
  const acc = await signedRequest<{
    totalWalletBalance: string
    totalUnrealizedProfit: string
    totalMarginBalance?: string
    availableBalance: string
    multiAssetsMargin?: boolean
    assets: Array<{
      asset: string
      walletBalance: string
      availableBalance: string
      crossUnPnl: string
    }>
  }>(creds, "GET", "/fapi/v2/account")

  const stables = (acc.assets ?? [])
    .filter((a) => a.asset === "USDT" || a.asset === "USDC")
    .map((a) => ({
      asset: a.asset,
      balance: Number(a.walletBalance),
      availableBalance: Number(a.availableBalance),
      crossUnPnl: Number(a.crossUnPnl),
    }))

  const primary =
    [...stables].sort((a, b) => {
      if (b.balance !== a.balance) return b.balance - a.balance
      return b.availableBalance - a.availableBalance
    })[0] ?? null

  const wallet = Number(acc.totalWalletBalance)
  const unrealized = Number(acc.totalUnrealizedProfit)
  const marginFromApi = acc.totalMarginBalance != null ? Number(acc.totalMarginBalance) : NaN
  const marginBalance = Number.isFinite(marginFromApi)
    ? marginFromApi
    : (Number.isFinite(wallet) ? wallet : 0) + (Number.isFinite(unrealized) ? unrealized : 0)

  const accountAvailable = Number(acc.availableBalance)
  const assetAvailable = primary?.availableBalance ?? 0
  const available = Math.max(
    Number.isFinite(accountAvailable) ? accountAvailable : 0,
    Number.isFinite(assetAvailable) ? assetAvailable : 0
  )

  return {
    balance: Number.isFinite(wallet) ? wallet : primary?.balance ?? 0,
    marginBalance: Number.isFinite(marginBalance) ? marginBalance : 0,
    available,
    unrealized: Number.isFinite(unrealized) ? unrealized : primary?.crossUnPnl ?? 0,
    asset: primary?.asset ?? "USDT",
    assetWallet: primary?.balance ?? 0,
    multiAssets: Boolean(acc.multiAssetsMargin),
  }
}

export async function getPositions(creds: BinanceCreds): Promise<FuturesPosition[]> {
  const rows = await signedRequest<
    Array<{
      symbol: string
      positionAmt: string
      entryPrice: string
      markPrice: string
      unRealizedProfit: string
      leverage: string
      liquidationPrice: string
      marginType: string
      positionSide: string
    }>
  >(creds, "GET", "/fapi/v2/positionRisk")
  return rows
    .map((r) => ({
      symbol: r.symbol,
      positionAmt: Number(r.positionAmt),
      entryPrice: Number(r.entryPrice),
      markPrice: Number(r.markPrice),
      unRealizedProfit: Number(r.unRealizedProfit),
      leverage: Number(r.leverage),
      liquidationPrice: Number(r.liquidationPrice),
      marginType: r.marginType,
      positionSide: r.positionSide,
    }))
    .filter((p) => p.positionAmt !== 0)
}

export async function setLeverage(creds: BinanceCreds, symbol: string, leverage: number) {
  return signedRequest(creds, "POST", "/fapi/v1/leverage", {
    symbol,
    leverage: Math.max(1, Math.floor(leverage)),
  })
}

export async function setMarginTypeIsolated(creds: BinanceCreds, symbol: string) {
  try {
    await signedRequest(creds, "POST", "/fapi/v1/marginType", {
      symbol,
      marginType: "ISOLATED",
    })
  } catch (e) {
    // -4046 already isolated
    if (e instanceof BinanceApiError && e.code === -4046) return
    throw e
  }
}

/**
 * BNFCR / Multi-Assets / credit számlákon az ISOLATED tiltott.
 * Próbál isolated-et; ha credit/multi-asset hiba → skip (marad CROSS).
 */
export async function ensureMarginType(
  creds: BinanceCreds,
  symbol: string
): Promise<"ISOLATED" | "CROSSED" | "unchanged"> {
  try {
    await signedRequest(creds, "POST", "/fapi/v1/marginType", {
      symbol,
      marginType: "ISOLATED",
    })
    return "ISOLATED"
  } catch (e) {
    if (!(e instanceof BinanceApiError)) throw e
    // already set
    if (e.code === -4046) return "ISOLATED"
    const msg = (e.message || "").toLowerCase()
    const soft =
      e.code === -4048 || // no need to change
      msg.includes("credit") ||
      msg.includes("multi-asset") ||
      msg.includes("multi assets") ||
      msg.includes("not support") ||
      msg.includes("cannot change")
    if (soft) {
      try {
        await signedRequest(creds, "POST", "/fapi/v1/marginType", {
          symbol,
          marginType: "CROSSED",
        })
        return "CROSSED"
      } catch (e2) {
        if (e2 instanceof BinanceApiError && (e2.code === -4046 || e2.code === -4048)) {
          return "CROSSED"
        }
        // credit account: leave as-is
        return "unchanged"
      }
    }
    throw e
  }
}

export type OrderResult = {
  orderId: number
  symbol: string
  status: string
  side: string
  type: string
  avgPrice?: string
  executedQty?: string
  origQty?: string
}

export async function marketOrder(
  creds: BinanceCreds,
  opts: { symbol: string; side: "BUY" | "SELL"; quantity: number; reduceOnly?: boolean }
): Promise<OrderResult> {
  return signedRequest(creds, "POST", "/fapi/v1/order", {
    symbol: opts.symbol,
    side: opts.side,
    type: "MARKET",
    quantity: opts.quantity,
    reduceOnly: opts.reduceOnly ? "true" : undefined,
  })
}

/** STOP_MARKET close — prefer algo (Binance 2025+), legacy fallback */
export async function stopMarketClose(
  creds: BinanceCreds,
  opts: {
    symbol: string
    side: "BUY" | "SELL"
    stopPrice: number
    quantity?: number
    closePosition?: boolean
    workingType?: "MARK_PRICE" | "CONTRACT_PRICE"
  }
): Promise<OrderResult> {
  try {
    return await placeAlgoConditional(creds, {
      symbol: opts.symbol,
      side: opts.side,
      orderType: "STOP_MARKET",
      triggerPrice: opts.stopPrice,
      quantity: opts.quantity,
      closePosition: opts.closePosition,
      workingType: opts.workingType ?? "MARK_PRICE",
    })
  } catch (e) {
    // legacy path (older accounts / regions)
    try {
      return await signedRequest(creds, "POST", "/fapi/v1/order", {
        symbol: opts.symbol,
        side: opts.side,
        type: "STOP_MARKET",
        stopPrice: opts.stopPrice,
        quantity: opts.closePosition ? undefined : opts.quantity,
        closePosition: opts.closePosition ? "true" : undefined,
        workingType: opts.workingType ?? "MARK_PRICE",
      })
    } catch {
      throw e
    }
  }
}

export async function takeProfitMarketClose(
  creds: BinanceCreds,
  opts: {
    symbol: string
    side: "BUY" | "SELL"
    stopPrice: number
    quantity?: number
    closePosition?: boolean
  }
): Promise<OrderResult> {
  try {
    return await placeAlgoConditional(creds, {
      symbol: opts.symbol,
      side: opts.side,
      orderType: "TAKE_PROFIT_MARKET",
      triggerPrice: opts.stopPrice,
      quantity: opts.quantity,
      closePosition: opts.closePosition,
      workingType: "MARK_PRICE",
    })
  } catch (e) {
    try {
      return await signedRequest(creds, "POST", "/fapi/v1/order", {
        symbol: opts.symbol,
        side: opts.side,
        type: "TAKE_PROFIT_MARKET",
        stopPrice: opts.stopPrice,
        quantity: opts.closePosition ? undefined : opts.quantity,
        closePosition: opts.closePosition ? "true" : undefined,
        workingType: "MARK_PRICE",
      })
    } catch {
      throw e
    }
  }
}

async function placeAlgoConditional(
  creds: BinanceCreds,
  opts: {
    symbol: string
    side: "BUY" | "SELL"
    orderType: "STOP_MARKET" | "TAKE_PROFIT_MARKET"
    triggerPrice: number
    quantity?: number
    closePosition?: boolean
    workingType?: "MARK_PRICE" | "CONTRACT_PRICE"
  }
): Promise<OrderResult> {
  const res = await signedRequest<{
    algoId?: number
    orderId?: number
    symbol: string
    algoStatus?: string
    status?: string
    side: string
    orderType?: string
    type?: string
  }>(creds, "POST", "/fapi/v1/algoOrder", {
    algoType: "CONDITIONAL",
    symbol: opts.symbol,
    side: opts.side,
    type: opts.orderType,
    triggerPrice: opts.triggerPrice,
    quantity: opts.closePosition ? undefined : opts.quantity,
    closePosition: opts.closePosition ? "true" : undefined,
    workingType: opts.workingType ?? "MARK_PRICE",
    reduceOnly: opts.closePosition ? undefined : "true",
  })
  return {
    orderId: Number(res.algoId ?? res.orderId ?? 0),
    symbol: res.symbol,
    status: res.algoStatus ?? res.status ?? "NEW",
    side: res.side,
    type: res.orderType ?? res.type ?? opts.orderType,
  }
}

export async function limitReduce(
  creds: BinanceCreds,
  opts: { symbol: string; side: "BUY" | "SELL"; quantity: number; price: number }
): Promise<OrderResult> {
  return signedRequest(creds, "POST", "/fapi/v1/order", {
    symbol: opts.symbol,
    side: opts.side,
    type: "LIMIT",
    timeInForce: "GTC",
    quantity: opts.quantity,
    price: opts.price,
    reduceOnly: "true",
  })
}

export async function cancelAllOrders(creds: BinanceCreds, symbol: string) {
  try {
    await signedRequest(creds, "DELETE", "/fapi/v1/allOpenOrders", { symbol })
  } catch {
    // empty book ok
  }
  try {
    await signedRequest(creds, "DELETE", "/fapi/v1/algoOpenOrders", { symbol })
  } catch {
    // no algo / empty ok
  }
}

export type DisplayOrder = {
  orderId: number
  symbol: string
  side: string
  type: string
  price: string
  stopPrice: string
  origQty: string
  reduceOnly: boolean
  status: string
  source: "order" | "algo"
  closePosition?: boolean
}

export async function getOpenOrders(
  creds: BinanceCreds,
  symbol?: string
): Promise<DisplayOrder[]> {
  const rows = await signedRequest<
    Array<{
      orderId: number
      symbol: string
      side: string
      type: string
      price: string
      stopPrice: string
      origQty: string
      reduceOnly: boolean
      status: string
      closePosition?: boolean
    }>
  >(creds, "GET", "/fapi/v1/openOrders", symbol ? { symbol } : {})
  return rows.map((r) => ({
    orderId: r.orderId,
    symbol: r.symbol,
    side: r.side,
    type: r.type,
    price: r.price,
    stopPrice: r.stopPrice,
    origQty: r.origQty,
    reduceOnly: !!r.reduceOnly,
    status: r.status,
    source: "order" as const,
    closePosition: r.closePosition,
  }))
}

export async function getOpenAlgoOrders(
  creds: BinanceCreds,
  symbol?: string
): Promise<DisplayOrder[]> {
  try {
    const rows = await signedRequest<
      Array<{
        algoId: number
        symbol: string
        side: string
        orderType: string
        price: string
        triggerPrice: string
        quantity: string
        reduceOnly: boolean
        algoStatus: string
        closePosition: boolean
      }>
    >(creds, "GET", "/fapi/v1/openAlgoOrders", symbol ? { symbol } : {})
    return rows.map((r) => ({
      orderId: r.algoId,
      symbol: r.symbol,
      side: r.side,
      type: r.orderType,
      price: r.price ?? "0",
      stopPrice: r.triggerPrice ?? "0",
      origQty: r.quantity ?? (r.closePosition ? "CLOSE" : "0"),
      reduceOnly: !!r.reduceOnly || !!r.closePosition,
      status: r.algoStatus,
      source: "algo" as const,
      closePosition: r.closePosition,
    }))
  } catch {
    return []
  }
}

/** Sima + algo/conditional SL-TP együtt */
export async function getAllOpenOrdersDisplay(
  creds: BinanceCreds,
  symbol?: string
): Promise<DisplayOrder[]> {
  const [orders, algos] = await Promise.all([
    getOpenOrders(creds, symbol).catch(() => [] as DisplayOrder[]),
    getOpenAlgoOrders(creds, symbol),
  ])
  return [...algos, ...orders]
}

/**
 * openOrders symbol nélkül = súly ~40. Szimbólumonként = ~1.
 * Csak a traded / nyitott párokat kérdezzük.
 */
export async function getOpenOrdersForSymbols(
  creds: BinanceCreds,
  symbols: string[]
): Promise<DisplayOrder[]> {
  const unique = [...new Set(symbols.filter(Boolean))]
  if (unique.length === 0) return []
  const batches = await Promise.all(
    unique.map((symbol) => getAllOpenOrdersDisplay(creds, symbol))
  )
  return batches.flat()
}

export async function closePositionMarket(
  creds: BinanceCreds,
  symbol: string,
  positionAmt: number
): Promise<OrderResult | null> {
  if (positionAmt === 0) return null
  const side = positionAmt > 0 ? "SELL" : "BUY"
  const filters = await getSymbolFilters(symbol)
  const qty = roundStep(Math.abs(positionAmt), filters.stepSize)
  if (qty < filters.minQty) return null
  await cancelAllOrders(creds, symbol)
  return marketOrder(creds, { symbol, side, quantity: qty, reduceOnly: true })
}
