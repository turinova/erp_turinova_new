import { NextResponse } from "next/server"
import type { CostItemStatus } from "@/types"
import { requireApiSession } from "@/lib/auth/require-api-session"
import {
  COST_ITEM_SELECT,
  mapCostItemRow,
  type CostItemRow,
} from "@/lib/cost-items/cost-item-map"
import { fetchOrgCostItems, fetchOrgTrades } from "@/lib/cost-items/cost-items-repository"

type BulkStatusBody = {
  action: "status"
  ids: string[]
  status: CostItemStatus
}

type BulkPricesBody = {
  action: "prices"
  ids: string[]
  percentChange: number
  target: "material" | "labor" | "both"
}

type BulkDeleteBody = {
  action: "delete"
  ids: string[]
}

type BulkBody = BulkStatusBody | BulkPricesBody | BulkDeleteBody

export async function POST(request: Request) {
  const session = await requireApiSession()
  if (!session.ok) return session.response

  if (session.mode === "mock") {
    return NextResponse.json({ error: "Supabase nincs beállítva." }, { status: 503 })
  }

  const body = (await request.json()) as BulkBody
  const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : []

  if (!ids.length) {
    return NextResponse.json({ error: "Nincs kijelölt tétel." }, { status: 400 })
  }

  try {
    if (body.action === "delete") {
      const { error } = await session.supabase
        .from("cost_items")
        .update({ deleted_at: new Date().toISOString() })
        .eq("organization_id", session.organization.id)
        .in("id", ids)

      if (error) throw error
      return NextResponse.json({ ok: true, count: ids.length })
    }

    if (body.action === "status") {
      const { error } = await session.supabase
        .from("cost_items")
        .update({ status: body.status })
        .eq("organization_id", session.organization.id)
        .in("id", ids)
        .is("deleted_at", null)

      if (error) throw error

      const items = await fetchOrgCostItems(session.supabase, session.organization.id)
      return NextResponse.json({
        items: items.filter((item) => ids.includes(item.id)),
      })
    }

    if (body.action === "prices") {
      const { data: rows, error: fetchError } = await session.supabase
        .from("cost_items")
        .select(COST_ITEM_SELECT)
        .eq("organization_id", session.organization.id)
        .in("id", ids)
        .is("deleted_at", null)

      if (fetchError) throw fetchError

      const factor = 1 + body.percentChange / 100
      const trades = await fetchOrgTrades(session.supabase, session.organization.id)
      const tradeById = new Map(
        (
          await session.supabase
            .from("cost_items")
            .select("id, trade_id")
            .in("id", ids)
        ).data?.map((r) => [r.id as string, r.trade_id as string]) ?? []
      )
      const codeByTradeId = new Map(trades.map((t) => [t.id, t.code]))

      const updated: ReturnType<typeof mapCostItemRow>[] = []

      for (const row of (rows ?? []) as CostItemRow[]) {
        const material =
          body.target === "labor"
            ? row.material_unit_price
            : Math.round(row.material_unit_price * factor)
        const labor =
          body.target === "material"
            ? row.labor_unit_price
            : Math.round(row.labor_unit_price * factor)

        const { data, error } = await session.supabase
          .from("cost_items")
          .update({
            material_unit_price: material,
            labor_unit_price: labor,
          })
          .eq("id", row.id)
          .select(COST_ITEM_SELECT)
          .single<CostItemRow>()

        if (error || !data) throw error

        const tradeId = tradeById.get(row.id)
        const tradeCode = tradeId ? codeByTradeId.get(tradeId) : undefined
        if (!tradeCode) continue
        updated.push(mapCostItemRow(data, tradeCode))
      }

      return NextResponse.json({ items: updated })
    }

    return NextResponse.json({ error: "Ismeretlen művelet." }, { status: 400 })
  } catch (error) {
    console.error("cost-items bulk:", error)
    return NextResponse.json({ error: "Hiba a tömeges művelet során." }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const session = await requireApiSession()
  if (!session.ok) return session.response

  if (session.mode === "mock") {
    return NextResponse.json({ error: "Supabase nincs beállítva." }, { status: 503 })
  }

  const body = (await request.json()) as {
    id: string
    materialUnitPrice?: number
    laborUnitPrice?: number
  }

  if (!body.id) {
    return NextResponse.json({ error: "Hiányzó tétel azonosító." }, { status: 400 })
  }

  try {
    const { data: current, error: fetchError } = await session.supabase
      .from("cost_items")
      .select(COST_ITEM_SELECT)
      .eq("organization_id", session.organization.id)
      .eq("id", body.id)
      .is("deleted_at", null)
      .maybeSingle<CostItemRow>()

    if (fetchError) throw fetchError
    if (!current) {
      return NextResponse.json({ error: "A tétel nem található." }, { status: 404 })
    }

    const material = Math.round(body.materialUnitPrice ?? current.material_unit_price)
    const labor = Math.round(body.laborUnitPrice ?? current.labor_unit_price)

    const { data, error } = await session.supabase
      .from("cost_items")
      .update({
        material_unit_price: material,
        labor_unit_price: labor,
      })
      .eq("id", body.id)
      .select(COST_ITEM_SELECT)
      .single<CostItemRow>()

    if (error || !data) throw error

    const { data: tradeRow } = await session.supabase
      .from("trades")
      .select("code")
      .eq("id", data.trade_id)
      .maybeSingle()

    if (!tradeRow?.code) {
      return NextResponse.json({ error: "Hiányzó szakág." }, { status: 500 })
    }

    const costItem = mapCostItemRow(data, tradeRow.code)

    return NextResponse.json({ costItem })
  } catch (error) {
    console.error("cost-items PATCH:", error)
    return NextResponse.json({ error: "Hiba az ár frissítésekor." }, { status: 500 })
  }
}
