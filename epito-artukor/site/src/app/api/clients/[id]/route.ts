import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { requireApiSession } from "@/lib/auth/require-api-session"
import {
  clientInputToUpdateRow,
  type ClientWriteInput,
} from "@/lib/clients/client-map"
import {
  fetchClientByCode,
  fetchClientById,
  fetchOrgClients,
  syncClientContacts,
} from "@/lib/clients/clients-repository"
import { validateClientInput } from "@/lib/clients/validate-client"

type RouteContext = { params: Promise<{ id: string }> }

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function resolveClient(
  supabase: SupabaseClient,
  organizationId: string,
  idOrCode: string
) {
  if (UUID_RE.test(idOrCode)) {
    return fetchClientById(supabase, organizationId, idOrCode)
  }
  return fetchClientByCode(supabase, organizationId, idOrCode)
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await requireApiSession()
  if (!session.ok) return session.response

  if (session.mode === "mock") {
    return NextResponse.json({ error: "Supabase nincs beállítva." }, { status: 503 })
  }

  const { id } = await context.params

  try {
    const client = await resolveClient(session.supabase, session.organization.id, id)
    if (!client) {
      return NextResponse.json({ error: "Az ügyfél nem található." }, { status: 404 })
    }
    return NextResponse.json({ client })
  } catch (error) {
    console.error("clients GET [id]:", error)
    return NextResponse.json({ error: "Hiba az ügyfél lekérdezésekor." }, { status: 500 })
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const session = await requireApiSession()
  if (!session.ok) return session.response

  if (session.mode === "mock") {
    return NextResponse.json({ error: "Supabase nincs beállítva." }, { status: 503 })
  }

  const { id } = await context.params
  const body = (await request.json()) as ClientWriteInput

  try {
    const current = await resolveClient(session.supabase, session.organization.id, id)
    if (!current) {
      return NextResponse.json({ error: "Az ügyfél nem található." }, { status: 404 })
    }

    const existing = await fetchOrgClients(session.supabase, session.organization.id)
    const validation = validateClientInput(body, { existing, editingId: current.id })
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const { error } = await session.supabase
      .from("clients")
      .update(clientInputToUpdateRow(body))
      .eq("id", current.id)
      .eq("organization_id", session.organization.id)
      .is("deleted_at", null)

    if (error) {
      console.error("clients PUT:", error)
      return NextResponse.json(
        { error: error.message || "Hiba az ügyfél mentésekor." },
        { status: 500 }
      )
    }

    await syncClientContacts(session.supabase, current.id, body)

    const client = await fetchClientById(session.supabase, session.organization.id, current.id)
    return NextResponse.json({ client })
  } catch (error) {
    console.error("clients PUT:", error)
    return NextResponse.json({ error: "Hiba az ügyfél mentésekor." }, { status: 500 })
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
    const current = await resolveClient(session.supabase, session.organization.id, id)
    if (!current) {
      return NextResponse.json({ error: "Az ügyfél nem található." }, { status: 404 })
    }

    const { error } = await session.supabase
      .from("clients")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", current.id)
      .eq("organization_id", session.organization.id)

    if (error) {
      console.error("clients DELETE:", error)
      return NextResponse.json(
        { error: error.message || "Hiba az ügyfél törlésekor." },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("clients DELETE:", error)
    return NextResponse.json({ error: "Hiba az ügyfél törlésekor." }, { status: 500 })
  }
}
