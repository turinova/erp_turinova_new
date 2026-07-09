import { NextResponse } from "next/server"
import { requireApiSession } from "@/lib/auth/require-api-session"
import {
  mapOrganizationRow,
  ORGANIZATION_SELECT,
  profileInputToUpdateRow,
  type OrganizationRow,
} from "@/lib/organizations/org-map"
import { validateOrganizationProfileInput } from "@/lib/organizations/validate-profile"
import type { OrganizationProfileInput } from "@/types/organization"

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
    .from("organizations")
    .select(ORGANIZATION_SELECT)
    .eq("id", session.organization.id)
    .single<OrganizationRow>()

  if (error || !data) {
    console.error("organization GET:", error)
    return NextResponse.json(
      { error: error?.message || "Nem sikerült betölteni a cégadatokat." },
      { status: 500 }
    )
  }

  return NextResponse.json({ profile: mapOrganizationRow(data) })
}

export async function PUT(request: Request) {
  const session = await requireApiSession()
  if (!session.ok) return session.response

  if (session.mode === "mock") {
    return NextResponse.json({ error: "Supabase nincs beállítva." }, { status: 503 })
  }

  const body = (await request.json()) as OrganizationProfileInput
  const validation = validateOrganizationProfileInput(body)
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const { data, error } = await session.supabase
    .from("organizations")
    .update(profileInputToUpdateRow(body))
    .eq("id", session.organization.id)
    .select(ORGANIZATION_SELECT)
    .single<OrganizationRow>()

  if (error || !data) {
    console.error("organization PUT:", error)
    return NextResponse.json(
      { error: error?.message || "Mentés sikertelen." },
      { status: 500 }
    )
  }

  return NextResponse.json({ profile: mapOrganizationRow(data) })
}
