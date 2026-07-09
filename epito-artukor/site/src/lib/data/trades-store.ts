import type { TradeRecord } from "@/types/trade"
import { DEFAULT_TRADE_RECORDS } from "@/lib/trades/constants"

/** In-memory cache — a DB (/api/trades) az egyetlen forrás, a provider tölti fel. */
let tradesCacheLocal: TradeRecord[] | null = null

export function loadTrades(): TradeRecord[] {
  return tradesCacheLocal ?? [...DEFAULT_TRADE_RECORDS]
}

export function saveTrades(trades: TradeRecord[]): void {
  tradesCacheLocal = trades
}

