import { NextResponse } from "next/server"
import type { ProjectDataBundle } from "@/types/projects"
import { requireApiSession } from "@/lib/auth/require-api-session"
import { loadBundleFromDb, syncBundleToDb } from "@/lib/server/projects-bundle-db"

/** Projekt-domain adatok — a Supabase az egyetlen forrás. */
export async function GET() {
  const session = await requireApiSession()
  if (!session.ok) return session.response

  if (session.mode === "mock") {
    return NextResponse.json({ error: "Supabase nincs beállítva." }, { status: 503 })
  }

  try {
    const bundle = await loadBundleFromDb(session.supabase, session.organization.id)
    return NextResponse.json(bundle)
  } catch (error) {
    console.error("projects-bundle GET:", error)
    return NextResponse.json({ error: "Hiba a projektadatok betöltésekor." }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const session = await requireApiSession()
  if (!session.ok) return session.response

  if (session.mode === "mock") {
    return NextResponse.json({ error: "Supabase nincs beállítva." }, { status: 503 })
  }

  try {
    const bundle = (await request.json()) as ProjectDataBundle
    await syncBundleToDb(session.supabase, session.organization.id, bundle)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("projects-bundle PUT:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 400 }
    )
  }
}
