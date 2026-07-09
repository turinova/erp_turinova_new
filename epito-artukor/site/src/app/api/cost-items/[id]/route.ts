import { NextResponse } from "next/server"
import type { CostItemInput } from "@/types"
import { requireApiSession } from "@/lib/auth/require-api-session"
import {
  costItemInputToUpdateRow,
  COST_ITEM_SELECT,
  mapCostItemRow,
  type CostItemRow,
} from "@/lib/cost-items/cost-item-map"
import {
  fetchOrgCategories,
  fetchOrgCostItems,
  fetchOrgTrades,
  fetchOrgUnits,
  fetchCostItemById,
  fetchTradeIdByCode,
} from "@/lib/cost-items/cost-items-repository"
import {
  normalizeIncomingIdentifier,
  resolveCostItemFields,
} from "@/lib/cost-items/resolve-identifier.server"
import { validateCostItemInput } from "@/lib/cost-items/validate-cost-item"

type RouteContext = { params: Promise<{ id: string }> }

export async function PUT(request: Request, context: RouteContext) {
  const session = await requireApiSession()
  if (!session.ok) return session.response

  if (session.mode === "mock") {
    return NextResponse.json({ error: "Supabase nincs beállítva." }, { status: 503 })
  }

  const { id } = await context.params
  const body = normalizeIncomingIdentifier((await request.json()) as CostItemInput)

  try {
    const current = await fetchCostItemById(session.supabase, session.organization.id, id)
    if (!current) {
      return NextResponse.json({ error: "A tétel nem található." }, { status: 404 })
    }

    const [existing, categories, units, trades] = await Promise.all([
      fetchOrgCostItems(session.supabase, session.organization.id),
      fetchOrgCategories(session.supabase, session.organization.id),
      fetchOrgUnits(session.supabase, session.organization.id),
      fetchOrgTrades(session.supabase, session.organization.id),
    ])

    const validation = validateCostItemInput(
      { ...body, id },
      {
        existing,
        categories,
        units,
        trades,
        editingId: id,
      }
    )
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

    const resolved = resolveCostItemFields({ ...body, id }, existing, categories, false)

    const duplicate = existing.find(
      (item) =>
        item.id !== id &&
        item.identifier.toLowerCase() === resolved.identifier.toLowerCase()
    )
    if (duplicate) {
      return NextResponse.json(
        { error: "Már létezik tétel ezzel a tételszámmal." },
        { status: 400 }
      )
    }

    const { data, error } = await session.supabase
      .from("cost_items")
      .update(costItemInputToUpdateRow(tradeId, { ...body, id }, resolved))
      .eq("id", id)
      .eq("organization_id", session.organization.id)
      .is("deleted_at", null)
      .select(COST_ITEM_SELECT)
      .single<CostItemRow>()

    if (error || !data) {
      console.error("cost-items PUT:", error)
      return NextResponse.json(
        { error: error?.message || "Hiba a tétel mentésekor." },
        { status: 500 }
      )
    }

    return NextResponse.json({ costItem: mapCostItemRow(data, body.trade) })
  } catch (error) {
    console.error("cost-items PUT:", error)
    return NextResponse.json({ error: "Hiba a tétel mentésekor." }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await requireApiSession()
  if (!session.ok) return session.response

  if (session.mode === "mock") {
    return NextResponse.json({ error: "Supabase nincs beállítva." }, { status: 503 })
  }

  const { id } = await context.params

  try {
    const current = await fetchCostItemById(session.supabase, session.organization.id, id)
    if (!current) {
      return NextResponse.json({ error: "A tétel nem található." }, { status: 404 })
    }

    const { error } = await session.supabase
      .from("cost_items")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("organization_id", session.organization.id)

    if (error) {
      console.error("cost-items DELETE:", error)
      return NextResponse.json(
        { error: error.message || "Hiba a tétel törlésekor." },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("cost-items DELETE:", error)
    return NextResponse.json({ error: "Hiba a tétel törlésekor." }, { status: 500 })
  }
}
