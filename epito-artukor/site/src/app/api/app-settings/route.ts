import { NextResponse } from "next/server"
import { requireApiSession } from "@/lib/auth/require-api-session"
import { fetchOrgTrades } from "@/lib/cost-items/cost-items-repository"
import {
  fetchOrgAppSettings,
  upsertOrgAppSettings,
} from "@/lib/app-settings/app-settings-repository"
import { validateAppSettingsInput } from "@/lib/app-settings/validate-app-settings"
import type { AppSettingsInput } from "@/types/app-settings"

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
    const settings = await fetchOrgAppSettings(session.supabase, session.organization.id)
    return NextResponse.json({ settings })
  } catch (error) {
    console.error("app-settings GET:", error)
    return NextResponse.json({ error: "Hiba a beállítások lekérdezésekor." }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const session = await requireApiSession()
  if (!session.ok) return session.response

  if (session.mode === "mock") {
    return NextResponse.json({ error: "Supabase nincs beállítva." }, { status: 503 })
  }

  const body = (await request.json()) as AppSettingsInput

  try {
    const trades = await fetchOrgTrades(session.supabase, session.organization.id)
    const validation = validateAppSettingsInput(
      body,
      trades.map((t) => t.code)
    )
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const settings = await upsertOrgAppSettings(
      session.supabase,
      session.organization.id,
      validation.normalized
    )

    return NextResponse.json({ settings })
  } catch (error) {
    console.error("app-settings PUT:", error)
    return NextResponse.json({ error: "Hiba a beállítások mentésekor." }, { status: 500 })
  }
}
