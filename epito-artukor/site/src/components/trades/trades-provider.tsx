"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import type { Trade } from "@/types"
import type { TradeRecord } from "@/types/trade"
import { DEFAULT_TRADE_RECORDS } from "@/lib/trades/constants"
import { setCachedTrades } from "@/lib/trades/trades-cache"

type TradesContextValue = {
  trades: TradeRecord[]
  loading: boolean
  refreshTrades: () => Promise<void>
}

const TradesContext = createContext<TradesContextValue>({
  trades: DEFAULT_TRADE_RECORDS,
  loading: true,
  refreshTrades: async () => {},
})

async function fetchTradesFromApi(): Promise<TradeRecord[] | null> {
  const res = await fetch("/api/trades")
  if (res.status === 503) return null
  const data = (await res.json()) as { trades?: TradeRecord[] }
  if (!res.ok || !data.trades) return null
  return data.trades
}

export function TradesProvider({ children }: { children: React.ReactNode }) {
  const [trades, setTrades] = useState<TradeRecord[]>(DEFAULT_TRADE_RECORDS)
  const [loading, setLoading] = useState(true)

  const refreshTrades = useCallback(async () => {
    try {
      const fromApi = await fetchTradesFromApi()
      if (fromApi) {
        setTrades(fromApi)
        setCachedTrades(fromApi)
        return
      }
      setTrades(DEFAULT_TRADE_RECORDS)
      setCachedTrades(DEFAULT_TRADE_RECORDS)
    } catch {
      setTrades(DEFAULT_TRADE_RECORDS)
      setCachedTrades(DEFAULT_TRADE_RECORDS)
    }
  }, [])

  useEffect(() => {
    void (async () => {
      setLoading(true)
      await refreshTrades()
      setLoading(false)
    })()
  }, [refreshTrades])

  const value = useMemo(
    () => ({ trades, loading, refreshTrades }),
    [trades, loading, refreshTrades]
  )

  return <TradesContext.Provider value={value}>{children}</TradesContext.Provider>
}

export function useTrades() {
  return useContext(TradesContext)
}

export function useTradeOptions(): { id: Trade; label: string }[] {
  const { trades } = useTrades()
  return useMemo(
    () => trades.map((t) => ({ id: t.code, label: t.name })),
    [trades]
  )
}

export async function persistTradesSupabase(
  trades: TradeRecord[]
): Promise<{ ok: true; trades: TradeRecord[] } | { ok: false; error: string }> {
  const res = await fetch("/api/trades", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      trades: trades.map((t) => ({ id: t.id, name: t.name, sortOrder: t.sortOrder })),
    }),
  })
  const data = (await res.json()) as { trades?: TradeRecord[]; error?: string }
  if (!res.ok || !data.trades) {
    return { ok: false, error: data.error ?? "Mentés sikertelen." }
  }
  setCachedTrades(data.trades)
  return { ok: true, trades: data.trades }
}

export async function createTradeSupabase(
  code: string,
  name: string
): Promise<{ ok: true; trade: TradeRecord } | { ok: false; error: string }> {
  const res = await fetch("/api/trades", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, name }),
  })
  const data = (await res.json()) as { trade?: TradeRecord; error?: string }
  if (!res.ok || !data.trade) {
    return { ok: false, error: data.error ?? "Létrehozás sikertelen." }
  }
  return { ok: true, trade: data.trade }
}
