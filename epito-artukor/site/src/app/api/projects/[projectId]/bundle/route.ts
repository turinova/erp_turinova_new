import { NextResponse } from "next/server"
import { requireApiSession } from "@/lib/auth/require-api-session"
import { loadBundleFromDb } from "@/lib/server/projects-bundle-db"

type RouteContext = { params: Promise<{ projectId: string }> }

/** Egy projekt teljes bundle szelete — részletes oldal / árajánlat szerkesztő. */
export async function GET(_request: Request, context: RouteContext) {
  const session = await requireApiSession()
  if (!session.ok) return session.response

  if (session.mode === "mock") {
    return NextResponse.json({ error: "Supabase nincs beállítva." }, { status: 503 })
  }

  const { projectId } = await context.params

  try {
    const bundle = await loadBundleFromDb(session.supabase, session.organization.id, {
      projectId,
    })
    return NextResponse.json(bundle, {
      headers: {
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    })
  } catch (error) {
    console.error("projects/[projectId]/bundle GET:", error)
    const message = error instanceof Error ? error.message : "Betöltési hiba"
    const status = message.includes("nem található") ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
