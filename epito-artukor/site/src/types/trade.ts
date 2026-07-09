import type { Trade } from "@/types"

export type TradeRecord = {
  id: string
  orgId: string
  code: Trade
  name: string
  sortOrder: number
}

export type TradeRecordInput = {
  id: string
  name: string
  sortOrder: number
}
