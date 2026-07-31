import { NextResponse, type NextRequest } from "next/server"
import { createSupabaseServer } from "@/lib/supabase/server"
import { runCryptoTick } from "@/lib/crypto/tick"
import {
  ALL_SETUPS_ENABLED,
  CRYPTO_SETUP_IDS,
  type CryptoSetupId,
  type EnabledSetups,
} from "@/lib/crypto/types"

/**
 * GET /api/crypto — élő crypto snapshot.
 * Query: ?setups=sweep,breakout,pullback,mean_rev  (kihagyott = kikapcsolva)
 * Ha nincs setups param → mind be van kapcsolva.
 */
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const enabled = parseSetups(request.nextUrl.searchParams.get("setups"))

  try {
    const snapshot = await runCryptoTick(supabase, { enabledSetups: enabled })
    return NextResponse.json(snapshot)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "crypto feed error" },
      { status: 502 }
    )
  }
}

function parseSetups(raw: string | null): EnabledSetups {
  if (raw == null || raw.trim() === "") return { ...ALL_SETUPS_ENABLED }
  const set = new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  )
  const out = { ...ALL_SETUPS_ENABLED }
  for (const id of CRYPTO_SETUP_IDS) {
    out[id as CryptoSetupId] = set.has(id)
  }
  return out
}
