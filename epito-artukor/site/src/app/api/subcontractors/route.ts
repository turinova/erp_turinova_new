import { NextResponse } from "next/server"
import type { Trade } from "@/types"
import { requireApiSession } from "@/lib/auth/require-api-session"
import { fetchOrgTrades } from "@/lib/cost-items/cost-items-repository"
import {
  subcontractorInputToInsertRow,
  SUBCONTRACTOR_SELECT,
  type SubcontractorRow,
  type SubcontractorWriteInput,
} from "@/lib/subcontractors/subcontractor-map"
import {
  fetchOrgSubcontractors,
  fetchSubcontractorById,
  syncSubcontractorRelations,
} from "@/lib/subcontractors/subcontractors-repository"
import { validateSubcontractorInput } from "@/lib/subcontractors/validate-subcontractor"

function applyFilters(
  items: Awaited<ReturnType<typeof fetchOrgSubcontractors>>,
  params: URLSearchParams
) {
  let rows = [...items]
  const trade = params.get("trade")
  const status = params.get("status")
  const tier = params.get("tier")
  const q = params.get("q")?.trim().toLowerCase()

  if (trade && trade !== "all") {
    rows = rows.filter((s) => s.trades.includes(trade as Trade))
  }
  if (status && status !== "all") {
    rows = rows.filter((s) => s.status === status)
  }
  if (tier && tier !== "all") {
    rows = rows.filter((s) => s.tier === tier)
  }
  if (q) {
    rows = rows.filter(
      (s) =>
        s.displayName.toLowerCase().includes(q) ||
        s.legalName.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.phone?.includes(q) ||
        s.taxNumber?.includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q))
    )
  }

  return rows
}

export async function GET(request: Request) {
  const session = await requireApiSession()
  if (!session.ok) return session.response

  if (session.mode === "mock") {
    return NextResponse.json(
      { error: "Supabase nincs beállítva — mock módban a kliens localStorage-t használ." },
      { status: 503 }
    )
  }

  try {
    const items = await fetchOrgSubcontractors(session.supabase, session.organization.id)
    const filtered = applyFilters(items, new URL(request.url).searchParams)
    return NextResponse.json({ subcontractors: filtered })
  } catch (error) {
    console.error("subcontractors GET:", error)
    return NextResponse.json({ error: "Hiba a partnerek lekérdezésekor." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await requireApiSession()
  if (!session.ok) return session.response

  if (session.mode === "mock") {
    return NextResponse.json({ error: "Supabase nincs beállítva." }, { status: 503 })
  }

  const body = (await request.json()) as SubcontractorWriteInput

  try {
    const [existing, trades] = await Promise.all([
      fetchOrgSubcontractors(session.supabase, session.organization.id),
      fetchOrgTrades(session.supabase, session.organization.id),
    ])

    const validation = validateSubcontractorInput(body, {
      existing,
      tradeCodes: trades.map((t) => t.code),
    })
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const { data, error } = await session.supabase
      .from("subcontractors")
      .insert(subcontractorInputToInsertRow(session.organization.id, body))
      .select(SUBCONTRACTOR_SELECT)
      .single<SubcontractorRow>()

    if (error || !data) {
      console.error("subcontractors POST:", error)
      return NextResponse.json(
        { error: error?.message || "Hiba a partner létrehozásakor." },
        { status: 500 }
      )
    }

    await syncSubcontractorRelations(
      session.supabase,
      session.organization.id,
      data.id,
      body
    )

    const subcontractor = await fetchSubcontractorById(
      session.supabase,
      session.organization.id,
      data.id
    )

    return NextResponse.json({ subcontractor }, { status: 201 })
  } catch (error) {
    console.error("subcontractors POST:", error)
    return NextResponse.json({ error: "Hiba a partner létrehozásakor." }, { status: 500 })
  }
}
