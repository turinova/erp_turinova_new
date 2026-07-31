import { NextResponse } from "next/server"
import { createSupabaseServer } from "@/lib/supabase/server"
import { createManualCatalyst } from "@/lib/crypto/news"
import type { CatalystSeverity } from "@/lib/crypto/types"

/** POST /api/crypto/news — manuális katalizátor (auth). */
export async function POST(request: Request) {
  const supabase = await createSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  let body: {
    title?: string
    symbols?: string[]
    severity?: CatalystSeverity
    tags?: string[]
    url?: string | null
    hoursValid?: number
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }

  const title = body.title?.trim()
  const symbols = (body.symbols ?? []).map((s) => s.toUpperCase()).filter(Boolean)
  const severity = body.severity ?? "med"

  if (!title || symbols.length === 0) {
    return NextResponse.json({ error: "title és symbols kötelező" }, { status: 400 })
  }
  if (!["low", "med", "high"].includes(severity)) {
    return NextResponse.json({ error: "érvénytelen severity" }, { status: 400 })
  }

  const result = await createManualCatalyst(supabase, {
    title,
    symbols,
    severity,
    tags: body.tags,
    url: body.url,
    hoursValid: body.hoursValid,
  })

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 502 })
  }
  return NextResponse.json({ ok: true, id: result.id })
}
