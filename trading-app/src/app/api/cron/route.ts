import { NextResponse, type NextRequest } from "next/server"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import { runLiveTick } from "@/lib/live/tick"

/**
 * GET /api/cron — a Vercel Cron hívja (lásd vercel.json), hogy a paper
 * trading adatgyűjtés akkor is fusson, ha az app nincs nyitva a böngészőben.
 *
 * Auth: a Vercel automatikusan `Authorization: Bearer <CRON_SECRET>`
 * headert küld, ha a CRON_SECRET env-változó be van állítva a projektben.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  try {
    const supabase = createSupabaseAdmin()
    const { snapshot, feed } = await runLiveTick(supabase)

    return NextResponse.json({
      ok: true,
      etDate: snapshot.etDate,
      etTime: snapshot.etTime,
      status: snapshot.status,
      source: feed.source,
      orbLocked: snapshot.orbLocked,
      lastPrice: snapshot.lastPrice,
      signal: snapshot.signal.kind,
      reason: snapshot.signal.reason,
    })
  } catch (e) {
    console.error("Cron tick hiba:", e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "cron error" },
      { status: 502 }
    )
  }
}
