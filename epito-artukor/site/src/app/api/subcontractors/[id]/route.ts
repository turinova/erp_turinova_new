import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { requireApiSession } from "@/lib/auth/require-api-session"
import { fetchOrgTrades } from "@/lib/cost-items/cost-items-repository"
import {
  subcontractorInputToUpdateRow,
  type SubcontractorWriteInput,
} from "@/lib/subcontractors/subcontractor-map"
import {
  fetchOrgSubcontractors,
  fetchSubcontractorByCode,
  fetchSubcontractorById,
  syncSubcontractorRelations,
} from "@/lib/subcontractors/subcontractors-repository"
import { validateSubcontractorInput } from "@/lib/subcontractors/validate-subcontractor"

type RouteContext = { params: Promise<{ id: string }> }

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function resolveSubcontractor(
  supabase: SupabaseClient,
  organizationId: string,
  idOrCode: string
) {
  if (UUID_RE.test(idOrCode)) {
    return fetchSubcontractorById(supabase, organizationId, idOrCode)
  }
  return fetchSubcontractorByCode(supabase, organizationId, idOrCode)
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await requireApiSession()
  if (!session.ok) return session.response

  if (session.mode === "mock") {
    return NextResponse.json({ error: "Supabase nincs beállítva." }, { status: 503 })
  }

  const { id } = await context.params

  try {
    const subcontractor = await resolveSubcontractor(
      session.supabase,
      session.organization.id,
      id
    )
    if (!subcontractor) {
      return NextResponse.json({ error: "A partner nem található." }, { status: 404 })
    }
    return NextResponse.json({ subcontractor })
  } catch (error) {
    console.error("subcontractors GET [id]:", error)
    return NextResponse.json({ error: "Hiba a partner lekérdezésekor." }, { status: 500 })
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const session = await requireApiSession()
  if (!session.ok) return session.response

  if (session.mode === "mock") {
    return NextResponse.json({ error: "Supabase nincs beállítva." }, { status: 503 })
  }

  const { id } = await context.params
  const body = (await request.json()) as SubcontractorWriteInput

  try {
    const current = await resolveSubcontractor(session.supabase, session.organization.id, id)
    if (!current) {
      return NextResponse.json({ error: "A partner nem található." }, { status: 404 })
    }

    const [existing, trades] = await Promise.all([
      fetchOrgSubcontractors(session.supabase, session.organization.id),
      fetchOrgTrades(session.supabase, session.organization.id),
    ])

    const validation = validateSubcontractorInput(body, {
      existing,
      tradeCodes: trades.map((t) => t.code),
      editingId: current.id,
    })
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const { error } = await session.supabase
      .from("subcontractors")
      .update(subcontractorInputToUpdateRow(body))
      .eq("id", current.id)
      .eq("organization_id", session.organization.id)
      .is("deleted_at", null)

    if (error) {
      console.error("subcontractors PUT:", error)
      return NextResponse.json(
        { error: error.message || "Hiba a partner mentésekor." },
        { status: 500 }
      )
    }

    await syncSubcontractorRelations(
      session.supabase,
      session.organization.id,
      current.id,
      body
    )

    const subcontractor = await fetchSubcontractorById(
      session.supabase,
      session.organization.id,
      current.id
    )

    return NextResponse.json({ subcontractor })
  } catch (error) {
    console.error("subcontractors PUT:", error)
    return NextResponse.json({ error: "Hiba a partner mentésekor." }, { status: 500 })
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
    const current = await resolveSubcontractor(session.supabase, session.organization.id, id)
    if (!current) {
      return NextResponse.json({ error: "A partner nem található." }, { status: 404 })
    }

    const { error } = await session.supabase
      .from("subcontractors")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", current.id)
      .eq("organization_id", session.organization.id)

    if (error) {
      console.error("subcontractors DELETE:", error)
      return NextResponse.json(
        { error: error.message || "Hiba a partner törlésekor." },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("subcontractors DELETE:", error)
    return NextResponse.json({ error: "Hiba a partner törlésekor." }, { status: 500 })
  }
}
