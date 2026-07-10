import { NextResponse } from "next/server"
import type { QuoteLine } from "@/types/projects"
import { requireApiSession } from "@/lib/auth/require-api-session"
import { patchQuoteLineInDb } from "@/lib/server/quote-line-patch"

type RouteContext = { params: Promise<{ id: string }> }

/** Egy árajánlat-sor részleges frissítése — nem kell teljes bundle PUT. */
export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireApiSession()
  if (!session.ok) return session.response

  if (session.mode === "mock") {
    return NextResponse.json({ error: "Supabase nincs beállítva." }, { status: 503 })
  }

  const { id } = await context.params

  try {
    const patch = (await request.json()) as Partial<QuoteLine>
    await patchQuoteLineInDb(session.supabase, session.organization.id, id, patch)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("quote-lines PATCH:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Frissítés sikertelen." },
      { status: 400 }
    )
  }
}
