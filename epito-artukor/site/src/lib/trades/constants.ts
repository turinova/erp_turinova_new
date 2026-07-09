import type { Trade } from "@/types"
import type { TradeRecord } from "@/types/trade"

export const TRADE_CODES: Trade[] = [
  "epitomester",
  "nyilaszaró",
  "gepeszet",
  "elektromos",
  "riaszto",
]

export const DEFAULT_TRADE_RECORDS: TradeRecord[] = [
  { id: "trade-epitomester", orgId: "org-1", code: "epitomester", name: "Építőmester", sortOrder: 1 },
  { id: "trade-nyilaszaró", orgId: "org-1", code: "nyilaszaró", name: "Nyílászáró", sortOrder: 2 },
  { id: "trade-gepeszet", orgId: "org-1", code: "gepeszet", name: "Gépészet", sortOrder: 3 },
  { id: "trade-elektromos", orgId: "org-1", code: "elektromos", name: "Elektromos", sortOrder: 4 },
  { id: "trade-riaszto", orgId: "org-1", code: "riaszto", name: "Riasztó", sortOrder: 5 },
]
