import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { requireApiSession } from "@/lib/auth/require-api-session"
import { mapTradeRow, TRADE_SELECT, type TradeRow } from "@/lib/trades/trade-map"
import { validateNewTradeInput } from "@/lib/trades/validate-trade"
import type { TradeRecord } from "@/types/trade"

async function fetchOrgTrades(
  supabase: SupabaseClient,
  organizationId: string
): Promise<TradeRecord[]> {
  const { data, error } = await supabase
    .from("trades")
    .select(TRADE_SELECT)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })

  if (error) throw error
  return ((data ?? []) as TradeRow[]).map(mapTradeRow)
}

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
    const trades = await fetchOrgTrades(session.supabase, session.organization.id)
    return NextResponse.json({ trades })
  } catch (error) {
    console.error("trades GET:", error)
    return NextResponse.json({ error: "Hiba a szakágak lekérdezésekor." }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const session = await requireApiSession()
  if (!session.ok) return session.response

  if (session.mode === "mock") {
    return NextResponse.json({ error: "Supabase nincs beállítva." }, { status: 503 })
  }

  const body = (await request.json()) as {
    trades?: { id: string; name: string; sortOrder: number }[]
  }

  const updates = body.trades ?? []
  if (updates.length === 0) {
    return NextResponse.json({ error: "Nincs mentendő szakág." }, { status: 400 })
  }

  try {
    const existing = await fetchOrgTrades(session.supabase, session.organization.id)
    const existingById = new Map(existing.map((t) => [t.id, t]))

    for (const row of updates) {
      const current = existingById.get(row.id)
      if (!current) {
        return NextResponse.json({ error: "Ismeretlen szakág azonosító." }, { status: 400 })
      }
      const name = row.name.trim()
      if (!name) {
        return NextResponse.json(
          { error: `„${current.code}” megnevezése nem lehet üres.` },
          { status: 400 }
        )
      }
    }

    for (const row of updates) {
      const { error } = await session.supabase
        .from("trades")
        .update({
          name: row.name.trim(),
          sort_order: row.sortOrder,
        })
        .eq("id", row.id)
        .eq("organization_id", session.organization.id)

      if (error) throw error
    }

    const trades = await fetchOrgTrades(session.supabase, session.organization.id)
    return NextResponse.json({ trades })
  } catch (error) {
    console.error("trades PUT:", error)
    return NextResponse.json({ error: "Mentés sikertelen." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await requireApiSession()
  if (!session.ok) return session.response

  if (session.mode === "mock") {
    return NextResponse.json({ error: "Supabase nincs beállítva." }, { status: 503 })
  }

  const body = (await request.json()) as { code?: string; name?: string }

  try {
    const existing = await fetchOrgTrades(session.supabase, session.organization.id)
    const validation = validateNewTradeInput(
      body.code ?? "",
      body.name ?? "",
      existing.map((t) => t.code)
    )
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const { data: maxSort } = await session.supabase
      .from("trades")
      .select("sort_order")
      .eq("organization_id", session.organization.id)
      .is("deleted_at", null)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle()

    const sortOrder = (maxSort?.sort_order ?? 0) + 1

    const { data, error } = await session.supabase
      .from("trades")
      .insert({
        organization_id: session.organization.id,
        code: validation.code,
        name: validation.name,
        sort_order: sortOrder,
      })
      .select(TRADE_SELECT)
      .single<TradeRow>()

    if (error || !data) {
      console.error("trades POST:", error)
      return NextResponse.json(
        { error: error?.message || "Hiba a szakág létrehozásakor." },
        { status: 500 }
      )
    }

    return NextResponse.json({ trade: mapTradeRow(data) }, { status: 201 })
  } catch (error) {
    console.error("trades POST:", error)
    return NextResponse.json({ error: "Hiba a szakág létrehozásakor." }, { status: 500 })
  }
}
