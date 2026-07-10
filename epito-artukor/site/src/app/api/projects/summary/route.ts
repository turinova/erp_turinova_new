import { NextResponse } from "next/server"
import { requireApiSession } from "@/lib/auth/require-api-session"
import { loadBundleFromDb } from "@/lib/server/projects-bundle-db"
import { buildProjectsSummaryPayload } from "@/lib/server/projects-summary-build"

/** Projektlista — csak projektek + előre számolt összegzések (nincs quote line a kliensen). */
export async function GET() {
  const session = await requireApiSession()
  if (!session.ok) return session.response

  if (session.mode === "mock") {
    return NextResponse.json({ error: "Supabase nincs beállítva." }, { status: 503 })
  }

  try {
    const bundle = await loadBundleFromDb(session.supabase, session.organization.id)
    const payload = buildProjectsSummaryPayload(bundle)
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    })
  } catch (error) {
    console.error("projects/summary GET:", error)
    return NextResponse.json({ error: "Hiba a projektlista betöltésekor." }, { status: 500 })
  }
}
