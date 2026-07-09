import { NextResponse } from "next/server"
import type { CostItemInput } from "@/types"
import { requireApiSession } from "@/lib/auth/require-api-session"
import {
  costItemInputToInsertRow,
  COST_ITEM_SELECT,
  mapCostItemRow,
  type CostItemRow,
} from "@/lib/cost-items/cost-item-map"
import {
  fetchOrgCategories,
  fetchOrgCostItems,
  fetchOrgTrades,
  fetchOrgUnits,
  fetchTradeIdByCode,
} from "@/lib/cost-items/cost-items-repository"
import {
  normalizeIncomingIdentifier,
  resolveCostItemFields,
} from "@/lib/cost-items/resolve-identifier.server"
import { validateCostItemInput } from "@/lib/cost-items/validate-cost-item"

export async function GET() {
  const session = await requireApiSession()
  if (!session.ok) return session.response

  if (session.mode === "mock") {
    return NextResponse.json(
      { error: "Supabase nincs beállítva — mock módban a kliens localStorage-t használ." },
      { status: 503 }
    )
  }

  try {
    const items = await fetchOrgCostItems(session.supabase, session.organization.id)
    return NextResponse.json({ items })
  } catch (error) {
    console.error("cost-items GET:", error)
    return NextResponse.json(
      { error: "Hiba a tételek lekérdezésekor." },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const session = await requireApiSession()
  if (!session.ok) return session.response

  if (session.mode === "mock") {
    return NextResponse.json({ error: "Supabase nincs beállítva." }, { status: 503 })
  }

  const body = normalizeIncomingIdentifier((await request.json()) as CostItemInput)

  try {
    const [existing, categories, units, trades] = await Promise.all([
      fetchOrgCostItems(session.supabase, session.organization.id),
      fetchOrgCategories(session.supabase, session.organization.id),
      fetchOrgUnits(session.supabase, session.organization.id),
      fetchOrgTrades(session.supabase, session.organization.id),
    ])

    const validation = validateCostItemInput(body, {
      existing,
      categories,
      units,
      trades,
    })
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const tradeId = await fetchTradeIdByCode(
      session.supabase,
      session.organization.id,
      body.trade
    )
    if (!tradeId) {
      return NextResponse.json({ error: "Érvénytelen szakág." }, { status: 400 })
    }

    const resolved = resolveCostItemFields(body, existing, categories, true)

    const duplicate = existing.find(
      (item) => item.identifier.toLowerCase() === resolved.identifier.toLowerCase()
    )
    if (duplicate) {
      return NextResponse.json(
        { error: "Már létezik tétel ezzel a tételszámmal." },
        { status: 400 }
      )
    }

    const { data, error } = await session.supabase
      .from("cost_items")
      .insert(
        costItemInputToInsertRow(session.organization.id, tradeId, body, resolved)
      )
      .select(COST_ITEM_SELECT)
      .single<CostItemRow>()

    if (error || !data) {
      console.error("cost-items POST:", error)
      return NextResponse.json(
        { error: error?.message || "Hiba a tétel létrehozásakor." },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { costItem: mapCostItemRow(data, body.trade) },
      { status: 201 }
    )
  } catch (error) {
    console.error("cost-items POST:", error)
    return NextResponse.json({ error: "Hiba a tétel létrehozásakor." }, { status: 500 })
  }
}
