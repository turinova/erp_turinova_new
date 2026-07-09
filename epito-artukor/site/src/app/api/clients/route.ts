import { NextResponse } from "next/server"
import type { ClientStatus, ClientType } from "@/types/clients"
import { requireApiSession } from "@/lib/auth/require-api-session"
import {
  clientInputToInsertRow,
  CLIENT_SELECT,
  type ClientRow,
  type ClientWriteInput,
} from "@/lib/clients/client-map"
import {
  fetchClientById,
  fetchOrgClients,
  syncClientContacts,
} from "@/lib/clients/clients-repository"
import { validateClientInput } from "@/lib/clients/validate-client"

function applyFilters(
  items: Awaited<ReturnType<typeof fetchOrgClients>>,
  params: URLSearchParams
) {
  let rows = [...items]
  const status = params.get("status")
  const clientType = params.get("clientType")
  const q = params.get("q")?.trim().toLowerCase()

  if (status && status !== "all") {
    rows = rows.filter((c) => c.status === (status as ClientStatus))
  }
  if (clientType && clientType !== "all") {
    rows = rows.filter((c) => c.clientType === (clientType as ClientType))
  }
  if (q) {
    rows = rows.filter(
      (c) =>
        c.displayName.toLowerCase().includes(q) ||
        c.legalName.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.taxNumber?.includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q))
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
    const items = await fetchOrgClients(session.supabase, session.organization.id)
    const filtered = applyFilters(items, new URL(request.url).searchParams)
    return NextResponse.json({ clients: filtered })
  } catch (error) {
    console.error("clients GET:", error)
    return NextResponse.json({ error: "Hiba az ügyfelek lekérdezésekor." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await requireApiSession()
  if (!session.ok) return session.response

  if (session.mode === "mock") {
    return NextResponse.json({ error: "Supabase nincs beállítva." }, { status: 503 })
  }

  const body = (await request.json()) as ClientWriteInput

  try {
    const existing = await fetchOrgClients(session.supabase, session.organization.id)
    const validation = validateClientInput(body, { existing })
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const { data, error } = await session.supabase
      .from("clients")
      .insert(clientInputToInsertRow(session.organization.id, body))
      .select(CLIENT_SELECT)
      .single<ClientRow>()

    if (error || !data) {
      console.error("clients POST:", error)
      return NextResponse.json(
        { error: error?.message || "Hiba az ügyfél létrehozásakor." },
        { status: 500 }
      )
    }

    await syncClientContacts(session.supabase, data.id, body)

    const client = await fetchClientById(session.supabase, session.organization.id, data.id)
    return NextResponse.json({ client }, { status: 201 })
  } catch (error) {
    console.error("clients POST:", error)
    return NextResponse.json({ error: "Hiba az ügyfél létrehozásakor." }, { status: 500 })
  }
}
