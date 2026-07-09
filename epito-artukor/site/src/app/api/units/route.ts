import { NextResponse } from "next/server"
import { requireApiSession } from "@/lib/auth/require-api-session"
import { mapUnitRow, normalizeUnitCode, normalizeUnitName, type UnitRow } from "@/lib/units/unit-map"

export async function GET() {
  const session = await requireApiSession()
  if (!session.ok) return session.response

  if (session.mode === "mock") {
    return NextResponse.json(
      { error: "Supabase nincs beállítva — mock módban a kliens localStorage-t használ." },
      { status: 503 }
    )
  }

  const { data, error } = await session.supabase
    .from("units")
    .select("id, organization_id, code, name, sort_order, created_at, updated_at, deleted_at")
    .eq("organization_id", session.organization.id)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })

  if (error) {
    console.error("units GET:", error)
    return NextResponse.json(
      { error: error.message || "Hiba a mértékegységek lekérdezésekor." },
      { status: 500 }
    )
  }

  const units = ((data ?? []) as UnitRow[]).map(mapUnitRow)
  return NextResponse.json({ units })
}

export async function POST(request: Request) {
  const session = await requireApiSession()
  if (!session.ok) return session.response

  if (session.mode === "mock") {
    return NextResponse.json({ error: "Supabase nincs beállítva." }, { status: 503 })
  }

  const body = (await request.json()) as { code?: string; name?: string }
  const code = normalizeUnitCode(body.code ?? "")
  const name = normalizeUnitName(body.name ?? "")

  if (!code || !name) {
    return NextResponse.json(
      { error: "A kód és a név megadása kötelező." },
      { status: 400 }
    )
  }

  const { data: existingCode } = await session.supabase
    .from("units")
    .select("id")
    .eq("organization_id", session.organization.id)
    .ilike("code", code)
    .is("deleted_at", null)
    .maybeSingle()

  if (existingCode) {
    return NextResponse.json(
      { error: "Már létezik mértékegység ezzel a kóddal." },
      { status: 400 }
    )
  }

  const { data: existingName } = await session.supabase
    .from("units")
    .select("id")
    .eq("organization_id", session.organization.id)
    .ilike("name", name)
    .is("deleted_at", null)
    .maybeSingle()

  if (existingName) {
    return NextResponse.json(
      { error: "Már létezik mértékegység ezzel a névvel." },
      { status: 400 }
    )
  }

  const { data: maxSort } = await session.supabase
    .from("units")
    .select("sort_order")
    .eq("organization_id", session.organization.id)
    .is("deleted_at", null)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()

  const sortOrder = (maxSort?.sort_order ?? 0) + 1

  const { data, error } = await session.supabase
    .from("units")
    .insert({
      organization_id: session.organization.id,
      code,
      name,
      sort_order: sortOrder,
    })
    .select("id, organization_id, code, name, sort_order, created_at, updated_at, deleted_at")
    .single<UnitRow>()

  if (error || !data) {
    console.error("units POST:", error)
    return NextResponse.json(
      { error: error?.message || "Hiba a mértékegység létrehozásakor." },
      { status: 500 }
    )
  }

  return NextResponse.json({ unit: mapUnitRow(data) }, { status: 201 })
}
