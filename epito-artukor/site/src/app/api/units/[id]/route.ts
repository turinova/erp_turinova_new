import { NextResponse } from "next/server"
import { requireApiSession } from "@/lib/auth/require-api-session"
import { mapUnitRow, normalizeUnitCode, normalizeUnitName, type UnitRow } from "@/lib/units/unit-map"

type RouteContext = { params: Promise<{ id: string }> }

export async function PUT(request: Request, context: RouteContext) {
  const session = await requireApiSession()
  if (!session.ok) return session.response

  if (session.mode === "mock") {
    return NextResponse.json({ error: "Supabase nincs beállítva." }, { status: 503 })
  }

  const { id } = await context.params
  const body = (await request.json()) as { code?: string; name?: string }
  const code = normalizeUnitCode(body.code ?? "")
  const name = normalizeUnitName(body.name ?? "")

  if (!code || !name) {
    return NextResponse.json(
      { error: "A kód és a név megadása kötelező." },
      { status: 400 }
    )
  }

  const { data: current } = await session.supabase
    .from("units")
    .select("id")
    .eq("id", id)
    .eq("organization_id", session.organization.id)
    .is("deleted_at", null)
    .maybeSingle()

  if (!current) {
    return NextResponse.json({ error: "A mértékegység nem található." }, { status: 404 })
  }

  const { data: existingCode } = await session.supabase
    .from("units")
    .select("id")
    .eq("organization_id", session.organization.id)
    .ilike("code", code)
    .neq("id", id)
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
    .neq("id", id)
    .is("deleted_at", null)
    .maybeSingle()

  if (existingName) {
    return NextResponse.json(
      { error: "Már létezik mértékegység ezzel a névvel." },
      { status: 400 }
    )
  }

  const { data, error } = await session.supabase
    .from("units")
    .update({ code, name })
    .eq("id", id)
    .eq("organization_id", session.organization.id)
    .select("id, organization_id, code, name, sort_order, created_at, updated_at, deleted_at")
    .single<UnitRow>()

  if (error || !data) {
    console.error("units PUT:", error)
    return NextResponse.json(
      { error: error?.message || "Hiba a mértékegység mentésekor." },
      { status: 500 }
    )
  }

  return NextResponse.json({ unit: mapUnitRow(data) })
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await requireApiSession()
  if (!session.ok) return session.response

  if (session.mode === "mock") {
    return NextResponse.json({ error: "Supabase nincs beállítva." }, { status: 503 })
  }

  const { id } = await context.params

  const { data: current } = await session.supabase
    .from("units")
    .select("id")
    .eq("id", id)
    .eq("organization_id", session.organization.id)
    .is("deleted_at", null)
    .maybeSingle()

  if (!current) {
    return NextResponse.json({ error: "A mértékegység nem található." }, { status: 404 })
  }

  const { error } = await session.supabase
    .from("units")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", session.organization.id)

  if (error) {
    console.error("units DELETE:", error)
    return NextResponse.json(
      { error: error.message || "Hiba a mértékegység törlésekor." },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
