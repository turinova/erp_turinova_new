import type { TradeRecord } from "@/types/trade"
import { DEFAULT_TRADE_RECORDS } from "@/lib/trades/constants"
import { loadTrades } from "@/lib/data/trades-store"

let cachedTrades: TradeRecord[] | null = null

export function getCachedTrades(): TradeRecord[] | null {
  return cachedTrades
}

export function setCachedTrades(trades: TradeRecord[]): void {
  cachedTrades = [...trades].sort((a, b) => a.sortOrder - b.sortOrder)
}

export function clearTradesCache(): void {
  cachedTrades = null
}

export function getTradesListSync(): TradeRecord[] {
  if (cachedTrades) return cachedTrades
  if (typeof window !== "undefined") return loadTrades()
  return DEFAULT_TRADE_RECORDS
}
