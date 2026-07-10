import { NextResponse } from "next/server"
import { requireApiSession } from "@/lib/auth/require-api-session"
import { fetchClientProjectCounts } from "@/lib/server/list-stats-db"

export async function GET() {
  const session = await requireApiSession()
  if (!session.ok) return session.response

  if (session.mode === "mock") {
    return NextResponse.json({ error: "Supabase nincs beállítva." }, { status: 503 })
  }

  try {
    const counts = await fetchClientProjectCounts(
      session.supabase,
      session.organization.id
    )
    return NextResponse.json(counts, {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
      },
    })
  } catch (error) {
    console.error("clients/project-counts GET:", error)
    return NextResponse.json({ error: "Hiba a számlálók lekérdezésekor." }, { status: 500 })
  }
}
