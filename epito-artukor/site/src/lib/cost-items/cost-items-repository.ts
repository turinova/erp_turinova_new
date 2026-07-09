import type { SupabaseClient } from "@supabase/supabase-js"
import type { Category, CostItem, Trade, Unit } from "@/types"
import { mapCategoryRow, type CategoryRow, CATEGORY_SELECT } from "@/lib/categories/category-map"
import {
  COST_ITEM_SELECT,
  mapCostItemRow,
  type CostItemRow,
} from "@/lib/cost-items/cost-item-map"
import { mapUnitRow, type UnitRow } from "@/lib/units/unit-map"

export type TradeRef = { id: string; code: Trade }

export async function fetchOrgTrades(
  supabase: SupabaseClient,
  organizationId: string
): Promise<TradeRef[]> {
  const { data, error } = await supabase
    .from("trades")
    .select("id, code")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })

  if (error) throw error
  return (data ?? []) as TradeRef[]
}

export async function fetchOrgCategories(
  supabase: SupabaseClient,
  organizationId: string
): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select(CATEGORY_SELECT)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })

  if (error) throw error
  return ((data ?? []) as CategoryRow[]).map(mapCategoryRow)
}

export async function fetchOrgUnits(
  supabase: SupabaseClient,
  organizationId: string
): Promise<Unit[]> {
  const { data, error } = await supabase
    .from("units")
    .select("id, organization_id, code, name, sort_order, created_at, updated_at, deleted_at")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })

  if (error) throw error
  return ((data ?? []) as UnitRow[]).map(mapUnitRow)
}

export async function fetchOrgCostItems(
  supabase: SupabaseClient,
  organizationId: string
): Promise<CostItem[]> {
  const [trades, { data, error }] = await Promise.all([
    fetchOrgTrades(supabase, organizationId),
    supabase
      .from("cost_items")
      .select(COST_ITEM_SELECT)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("identifier", { ascending: true }),
  ])

  if (error) throw error

  const tradeById = new Map(trades.map((t) => [t.id, t.code]))
  return ((data ?? []) as CostItemRow[]).map((row) => {
    const tradeCode = tradeById.get(row.trade_id)
    if (!tradeCode) {
      throw new Error(`Hiányzó szakág a tételhez: ${row.id}`)
    }
    return mapCostItemRow(row, tradeCode)
  })
}

export async function fetchTradeIdByCode(
  supabase: SupabaseClient,
  organizationId: string,
  tradeCode: Trade
): Promise<string | null> {
  const { data, error } = await supabase
    .from("trades")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("code", tradeCode)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) throw error
  return data?.id ?? null
}

export async function fetchCostItemById(
  supabase: SupabaseClient,
  organizationId: string,
  id: string
): Promise<CostItem | null> {
  const { data, error } = await supabase
    .from("cost_items")
    .select(COST_ITEM_SELECT)
    .eq("organization_id", organizationId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<CostItemRow>()

  if (error) throw error
  if (!data) return null

  const tradeId = data.trade_id
  const { data: tradeRow, error: tradeError } = await supabase
    .from("trades")
    .select("code")
    .eq("id", tradeId)
    .maybeSingle()

  if (tradeError) throw tradeError
  if (!tradeRow?.code) return null

  return mapCostItemRow(data, tradeRow.code as Trade)
}
