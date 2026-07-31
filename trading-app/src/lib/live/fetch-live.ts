import type { Bar } from "../backtest/types"
import { fetchYahooBars } from "./providers/yahoo"
import { fetchTradovateBars, isTradovateConfigured } from "./providers/tradovate"

/**
 * Élő adatforrás diszpécser.
 *
 * - Ha a Tradovate env-változók be vannak állítva → valós idejű
 *   Tradovate feed (hiba esetén automatikus Yahoo fallback).
 * - Egyébként → Yahoo Finance (ingyenes, ~1-10 perc késleltetés).
 */

export type FeedSource = "tradovate" | "yahoo"

export interface LiveFeed {
  symbol: string
  source: FeedSource
  fetchedAt: number
  bars: Bar[]
}

const CACHE_MS = 30_000

let cache: { at: number; data: LiveFeed } | null = null

export async function fetchLiveBars(): Promise<LiveFeed> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data

  let data: LiveFeed
  if (isTradovateConfigured()) {
    try {
      const { symbol, bars } = await fetchTradovateBars()
      data = { symbol, source: "tradovate", fetchedAt: Date.now(), bars }
    } catch (e) {
      console.error("Tradovate feed hiba, Yahoo fallback:", e)
      const { symbol, bars } = await fetchYahooBars()
      data = { symbol, source: "yahoo", fetchedAt: Date.now(), bars }
    }
  } else {
    const { symbol, bars } = await fetchYahooBars()
    data = { symbol, source: "yahoo", fetchedAt: Date.now(), bars }
  }

  cache = { at: Date.now(), data }
  return data
}
