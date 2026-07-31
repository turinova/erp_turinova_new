import { NextResponse } from "next/server"
import { createSupabaseServer } from "@/lib/supabase/server"
import { runCryptoTick } from "@/lib/crypto/tick"

/** GET /api/crypto — élő crypto snapshot (SOL + DOGE, BTC/ETH kontextus). */
export async function GET() {
  const supabase = await createSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  try {
    const snapshot = await runCryptoTick(supabase)
    return NextResponse.json(snapshot)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "crypto feed error" },
      { status: 502 }
    )
  }
}
