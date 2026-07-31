import type { Bar } from "../backtest/types"
import {
  ALL_SYMBOLS,
  type CryptoFeed,
  type CryptoFeedSource,
  type CryptoSymbol,
  type SymbolFeed,
} from "./types"

/**
 * Publikus, kulcs nélküli perp piaci adat.
 * Elsődleges: Bybit v5 (kline + tickers, ebben funding és OI is van).
 * Fallback: Binance USDT-M futures (kline + premiumIndex).
 * Mindkettő ingyenes és valós idejű.
 */

const PAIR: Record<CryptoSymbol, string> = {
  SOL: "SOLUSDT",
  DOGE: "DOGEUSDT",
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
}

const CACHE_MS = 30_000
let cache: { at: number; data: CryptoFeed } | null = null

export async function fetchCryptoFeed(): Promise<CryptoFeed> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data

  let data: CryptoFeed
  try {
    data = await fetchBybit()
  } catch (e) {
    console.error("Bybit feed hiba, Binance fallback:", e)
    data = await fetchBinance()
  }

  cache = { at: Date.now(), data }
  return data
}

// ---------------------------------------------------------------
// Bybit v5
// ---------------------------------------------------------------

async function bybitJson(path: string): Promise<unknown> {
  const res = await fetch(`https://api.bybit.com${path}`, { cache: "no-store" })
  if (!res.ok) throw new Error(`Bybit HTTP ${res.status}`)
  const json = await res.json()
  if (json.retCode !== 0) throw new Error(`Bybit retCode ${json.retCode}: ${json.retMsg}`)
  return json.result
}

function bybitKlinesToBars(result: unknown): Bar[] {
  const list = (result as { list?: string[][] })?.list ?? []
  // A Bybit csökkenő sorrendben adja (legújabb elöl) → megfordítjuk
  const bars: Bar[] = []
  for (let i = list.length - 1; i >= 0; i--) {
    const row = list[i]
    bars.push({
      t: Math.floor(Number(row[0]) / 1000),
      o: Number(row[1]),
      h: Number(row[2]),
      l: Number(row[3]),
      c: Number(row[4]),
      v: Number(row[5]),
    })
  }
  return bars
}

async function fetchBybit(): Promise<CryptoFeed> {
  const symbols = {} as Record<CryptoSymbol, SymbolFeed>

  await Promise.all(
    ALL_SYMBOLS.map(async (sym) => {
      const pair = PAIR[sym]
      const [kline1m, klineDaily, tickers] = await Promise.all([
        bybitJson(`/v5/market/kline?category=linear&symbol=${pair}&interval=1&limit=1000`),
        bybitJson(`/v5/market/kline?category=linear&symbol=${pair}&interval=D&limit=15`),
        bybitJson(`/v5/market/tickers?category=linear&symbol=${pair}`),
      ])

      const tick = (tickers as { list?: Record<string, string>[] })?.list?.[0] ?? {}

      symbols[sym] = {
        symbol: sym,
        bars: bybitKlinesToBars(kline1m),
        dailyBars: bybitKlinesToBars(klineDaily),
        fundingRate: tick.fundingRate != null ? Number(tick.fundingRate) : null,
        openInterest: tick.openInterest != null ? Number(tick.openInterest) : null,
        change24hPct: tick.price24hPcnt != null ? Number(tick.price24hPcnt) * 100 : null,
      }
    })
  )

  return { source: "bybit", fetchedAt: Date.now(), symbols }
}

// ---------------------------------------------------------------
// Binance USDT-M futures (fallback)
// ---------------------------------------------------------------

async function binanceJson(path: string): Promise<unknown> {
  const res = await fetch(`https://fapi.binance.com${path}`, { cache: "no-store" })
  if (!res.ok) throw new Error(`Binance HTTP ${res.status}`)
  return res.json()
}

function binanceKlinesToBars(rows: unknown): Bar[] {
  return ((rows as (string | number)[][]) ?? []).map((r) => ({
    t: Math.floor(Number(r[0]) / 1000),
    o: Number(r[1]),
    h: Number(r[2]),
    l: Number(r[3]),
    c: Number(r[4]),
    v: Number(r[5]),
  }))
}

async function fetchBinance(): Promise<CryptoFeed> {
  const symbols = {} as Record<CryptoSymbol, SymbolFeed>

  await Promise.all(
    ALL_SYMBOLS.map(async (sym) => {
      const pair = PAIR[sym]
      const [kline1m, klineDaily, premium, ticker24h] = await Promise.all([
        binanceJson(`/fapi/v1/klines?symbol=${pair}&interval=1m&limit=1000`),
        binanceJson(`/fapi/v1/klines?symbol=${pair}&interval=1d&limit=15`),
        binanceJson(`/fapi/v1/premiumIndex?symbol=${pair}`),
        binanceJson(`/fapi/v1/ticker/24hr?symbol=${pair}`),
      ])

      const prem = premium as { lastFundingRate?: string }
      const t24 = ticker24h as { priceChangePercent?: string }

      symbols[sym] = {
        symbol: sym,
        bars: binanceKlinesToBars(kline1m),
        dailyBars: binanceKlinesToBars(klineDaily),
        fundingRate: prem.lastFundingRate != null ? Number(prem.lastFundingRate) : null,
        openInterest: null,
        change24hPct: t24.priceChangePercent != null ? Number(t24.priceChangePercent) : null,
      }
    })
  )

  return { source: "binance", fetchedAt: Date.now(), symbols }
}
