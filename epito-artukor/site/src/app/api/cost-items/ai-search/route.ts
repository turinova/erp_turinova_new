import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { requireApiSession } from "@/lib/auth/require-api-session"
import {
  fetchOrgCategories,
  fetchOrgCostItems,
  fetchOrgUnits,
} from "@/lib/cost-items/cost-items-repository"
import { searchCostItemsWithAi } from "@/lib/cost-items/search-cost-items.server"
import { mapTradeRow, TRADE_SELECT, type TradeRow } from "@/lib/trades/trade-map"
import type { TradeRecord } from "@/types/trade"

async function fetchOrgTradeRecords(
  supabase: SupabaseClient,
  organizationId: string
): Promise<TradeRecord[]> {
  const { data, error } = await supabase
    .from("trades")
    .select(TRADE_SELECT)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })

  if (error) throw error
  return ((data ?? []) as TradeRow[]).map(mapTradeRow)
}

export async function POST(request: Request) {
  const session = await requireApiSession()
  if (!session.ok) return session.response

  if (session.mode === "mock") {
    return NextResponse.json({ error: "Supabase nincs beállítva." }, { status: 503 })
  }

  try {
    const body = (await request.json()) as { query?: string }
    const query = body.query?.trim() ?? ""

    if (query.length < 3) {
      return NextResponse.json({ matches: [], suggestNewItem: false, aiUsed: false })
    }

    const [items, categories, units, trades] = await Promise.all([
      fetchOrgCostItems(session.supabase, session.organization.id),
      fetchOrgCategories(session.supabase, session.organization.id),
      fetchOrgUnits(session.supabase, session.organization.id),
      fetchOrgTradeRecords(session.supabase, session.organization.id),
    ])

    const result = await searchCostItemsWithAi(query, {
      items,
      categories,
      trades,
      units,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("cost-items ai-search:", error)
    return NextResponse.json({ error: "AI keresés sikertelen." }, { status: 500 })
  }
}
