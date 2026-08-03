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
 * Sorrend: Bybit → OKX → Binance.
 * A Binance (és néha a Bybit) US-régiókból 451-et adhat; ezért a Vercel
 * functionök Frankfurtban (fra1) futnak, és van OKX fallback.
 */

const PAIR: Record<CryptoSymbol, string> = {
  SOL: "SOLUSDT",
  DOGE: "DOGEUSDT",
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
}

const OKX_INST: Record<CryptoSymbol, string> = {
  SOL: "SOL-USDT-SWAP",
  DOGE: "DOGE-USDT-SWAP",
  BTC: "BTC-USDT-SWAP",
  ETH: "ETH-USDT-SWAP",
}

const CACHE_MS = 30_000
let cache: { at: number; data: CryptoFeed } | null = null

type Provider = { name: CryptoFeedSource; run: () => Promise<CryptoFeed> }

export async function fetchCryptoFeed(): Promise<CryptoFeed> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data

  const providers: Provider[] = [
    { name: "bybit", run: fetchBybit },
    { name: "okx", run: fetchOkx },
    { name: "binance", run: fetchBinance },
  ]

  const errors: string[] = []
  for (const p of providers) {
    try {
      const data = await p.run()
      cache = { at: Date.now(), data }
      return data
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`${p.name} feed hiba:`, msg)
      errors.push(`${p.name}: ${msg}`)
    }
  }

  throw new Error(`Crypto feed elérhetetlen (${errors.join(" | ")})`)
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
      const [kline1m, klineDaily, tickers, fundingHist] = await Promise.all([
        bybitJson(`/v5/market/kline?category=linear&symbol=${pair}&interval=1&limit=1000`),
        bybitJson(`/v5/market/kline?category=linear&symbol=${pair}&interval=D&limit=15`),
        bybitJson(`/v5/market/tickers?category=linear&symbol=${pair}`),
        bybitJson(
          `/v5/market/funding/history?category=linear&symbol=${pair}&limit=30`
        ).catch(() => null),
      ])

      const tick = (tickers as { list?: Record<string, string>[] })?.list?.[0] ?? {}
      const histList = (fundingHist as { list?: { fundingRate?: string }[] } | null)?.list ?? []
      // Bybit: legújabb elöl → fordítsuk régi→új-ra
      const fundingHistory = histList
        .map((r) => Number(r.fundingRate))
        .filter((n) => Number.isFinite(n))
        .reverse()

      symbols[sym] = {
        symbol: sym,
        bars: bybitKlinesToBars(kline1m),
        dailyBars: bybitKlinesToBars(klineDaily),
        fundingRate: tick.fundingRate != null ? Number(tick.fundingRate) : null,
        fundingHistory: fundingHistory.length ? fundingHistory : undefined,
        openInterest: tick.openInterest != null ? Number(tick.openInterest) : null,
        change24hPct: tick.price24hPcnt != null ? Number(tick.price24hPcnt) * 100 : null,
      }
    })
  )

  return { source: "bybit", fetchedAt: Date.now(), symbols }
}

// ---------------------------------------------------------------
// OKX swap (jobb geo-lefedés, mint a Binance US-tiltás)
// ---------------------------------------------------------------

async function okxJson(path: string): Promise<unknown> {
  const res = await fetch(`https://www.okx.com${path}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  })
  if (!res.ok) throw new Error(`OKX HTTP ${res.status}`)
  const json = await res.json()
  if (json.code !== "0") throw new Error(`OKX code ${json.code}: ${json.msg}`)
  return json.data
}

function okxCandlesToBars(rows: unknown): Bar[] {
  // OKX: [ts, o, h, l, c, vol, volCcy, volCcyQuote, confirm] — legújabb elöl
  const list = (rows as string[][]) ?? []
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

async function fetchOkxCandles1m(inst: string): Promise<Bar[]> {
  // OKX recent max 300/request — 3 oldal ≈ 15 óra
  const all: Bar[] = []
  let before: string | undefined
  for (let page = 0; page < 3; page++) {
    const q = before
      ? `/api/v5/market/history-candles?instId=${inst}&bar=1m&limit=300&after=${before}`
      : `/api/v5/market/candles?instId=${inst}&bar=1m&limit=300`
    const rows = (await okxJson(q)) as string[][]
    if (!rows.length) break
    const chunk = okxCandlesToBars(rows)
    all.unshift(...chunk)
    before = rows[rows.length - 1]?.[0]
    if (rows.length < 300) break
  }
  // dedup time
  const byT = new Map<number, Bar>()
  for (const b of all) byT.set(b.t, b)
  return [...byT.values()].sort((a, b) => a.t - b.t)
}

async function fetchOkx(): Promise<CryptoFeed> {
  const symbols = {} as Record<CryptoSymbol, SymbolFeed>

  await Promise.all(
    ALL_SYMBOLS.map(async (sym) => {
      const inst = OKX_INST[sym]
      const [bars1m, candlesDaily, ticker, funding, oi, fundHist] = await Promise.all([
        fetchOkxCandles1m(inst),
        okxJson(`/api/v5/market/candles?instId=${inst}&bar=1Dutc&limit=15`),
        okxJson(`/api/v5/market/ticker?instId=${inst}`),
        okxJson(`/api/v5/public/funding-rate?instId=${inst}`),
        okxJson(`/api/v5/public/open-interest?instId=${inst}`),
        okxJson(`/api/v5/public/funding-rate-history?instId=${inst}&limit=30`).catch(() => null),
      ])

      const tick = ((ticker as Record<string, string>[]) ?? [])[0] ?? {}
      const fund = ((funding as Record<string, string>[]) ?? [])[0] ?? {}
      const oiRow = ((oi as Record<string, string>[]) ?? [])[0] ?? {}
      const histRows = (fundHist as { fundingRate?: string }[] | null) ?? []
      const fundingHistory = histRows
        .map((r) => Number(r.fundingRate))
        .filter((n) => Number.isFinite(n))
        .reverse()

      const last = Number(tick.last)
      const open24 = Number(tick.open24h)
      const change24hPct =
        open24 > 0 && Number.isFinite(last) ? ((last - open24) / open24) * 100 : null

      symbols[sym] = {
        symbol: sym,
        bars: bars1m,
        dailyBars: okxCandlesToBars(candlesDaily),
        fundingRate: fund.fundingRate != null ? Number(fund.fundingRate) : null,
        fundingHistory: fundingHistory.length ? fundingHistory : undefined,
        openInterest: oiRow.oi != null ? Number(oiRow.oi) : null,
        change24hPct,
      }
    })
  )

  return { source: "okx", fetchedAt: Date.now(), symbols }
}

// ---------------------------------------------------------------
// Binance USDT-M futures (utolsó fallback — US-ból gyakran 451)
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
      const [kline1m, klineDaily, premium, ticker24h, oi, fundHist] = await Promise.all([
        binanceJson(`/fapi/v1/klines?symbol=${pair}&interval=1m&limit=1000`),
        binanceJson(`/fapi/v1/klines?symbol=${pair}&interval=1d&limit=15`),
        binanceJson(`/fapi/v1/premiumIndex?symbol=${pair}`),
        binanceJson(`/fapi/v1/ticker/24hr?symbol=${pair}`),
        binanceJson(`/fapi/v1/openInterest?symbol=${pair}`),
        binanceJson(`/fapi/v1/fundingRate?symbol=${pair}&limit=30`).catch(() => null),
      ])

      const prem = premium as { lastFundingRate?: string }
      const t24 = ticker24h as { priceChangePercent?: string }
      const oiRow = oi as { openInterest?: string }
      const histRows = (fundHist as { fundingRate?: string }[] | null) ?? []
      const fundingHistory = histRows
        .map((r) => Number(r.fundingRate))
        .filter((n) => Number.isFinite(n))

      symbols[sym] = {
        symbol: sym,
        bars: binanceKlinesToBars(kline1m),
        dailyBars: binanceKlinesToBars(klineDaily),
        fundingRate: prem.lastFundingRate != null ? Number(prem.lastFundingRate) : null,
        fundingHistory: fundingHistory.length ? fundingHistory : undefined,
        openInterest: oiRow.openInterest != null ? Number(oiRow.openInterest) : null,
        change24hPct: t24.priceChangePercent != null ? Number(t24.priceChangePercent) : null,
      }
    })
  )

  return { source: "binance", fetchedAt: Date.now(), symbols }
}
