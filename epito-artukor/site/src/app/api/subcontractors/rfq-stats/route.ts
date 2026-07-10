import { NextResponse } from "next/server"
import { requireApiSession } from "@/lib/auth/require-api-session"
import { fetchSubcontractorRfqStats } from "@/lib/server/list-stats-db"

export async function GET() {
  const session = await requireApiSession()
  if (!session.ok) return session.response

  if (session.mode === "mock") {
    return NextResponse.json({ error: "Supabase nincs beállítva." }, { status: 503 })
  }

  try {
    const stats = await fetchSubcontractorRfqStats(
      session.supabase,
      session.organization.id
    )
    return NextResponse.json({ stats }, {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
      },
    })
  } catch (error) {
    console.error("subcontractors/rfq-stats GET:", error)
    return NextResponse.json({ error: "Hiba a statisztikák lekérdezésekor." }, { status: 500 })
  }
}
