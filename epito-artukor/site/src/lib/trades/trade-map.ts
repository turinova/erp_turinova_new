import type { Trade } from "@/types"
import type { TradeRecord } from "@/types/trade"

export type TradeRow = {
  id: string
  organization_id: string
  code: string
  name: string
  sort_order: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export const TRADE_SELECT =
  "id, organization_id, code, name, sort_order, created_at, updated_at, deleted_at"

export function mapTradeRow(row: TradeRow): TradeRecord {
  return {
    id: row.id,
    orgId: row.organization_id,
    code: row.code as Trade,
    name: row.name,
    sortOrder: row.sort_order,
  }
}

export function normalizeTradeName(name: string): string {
  return name.trim()
}
