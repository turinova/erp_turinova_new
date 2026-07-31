import type { SupabaseClient } from "@supabase/supabase-js"
import type { CryptoFeed, CryptoSymbol, OiRegime } from "./types"
import { ALL_SYMBOLS } from "./types"

/**
 * OI idősor: a cron/tick elmenti a pillanatnyi open interestet,
 * majd Δ1h / Δ4h-t számol a történetből.
 */

export interface OiDeltas {
  oiDelta1hPct: number | null
  oiDelta4hPct: number | null
  /** ár változás % az 1h OI mintához igazítva (ha van ár a snapshotban) */
  priceDelta1hPct: number | null
}

export async function saveOiSnapshots(
  supabase: SupabaseClient,
  feed: CryptoFeed
): Promise<void> {
  const rows = ALL_SYMBOLS.map((sym) => {
    const s = feed.symbols[sym]
    if (s.openInterest == null) return null
    const last = s.bars[s.bars.length - 1]
    return {
      symbol: sym,
      open_interest: s.openInterest,
      funding_rate: s.fundingRate,
      price: last?.c ?? null,
      source: feed.source,
    }
  }).filter((r): r is NonNullable<typeof r> => r != null)

  if (rows.length === 0) return
  const { error } = await supabase.from("crypto_oi_snapshots").insert(rows)
  if (error) console.error("OI snapshot mentés hiba:", error.message)
}

export async function loadOiDeltas(
  supabase: SupabaseClient,
  symbol: CryptoSymbol
): Promise<OiDeltas> {
  const now = Date.now()
  const { data, error } = await supabase
    .from("crypto_oi_snapshots")
    .select("open_interest, price, captured_at")
    .eq("symbol", symbol)
    .gte("captured_at", new Date(now - 5 * 3600 * 1000).toISOString())
    .order("captured_at", { ascending: false })
    .limit(80)

  if (error || !data || data.length === 0) {
    return { oiDelta1hPct: null, oiDelta4hPct: null, priceDelta1hPct: null }
  }

  const latest = data[0]
  const latestOi = Number(latest.open_interest)
  const latestPrice = latest.price != null ? Number(latest.price) : null
  const latestT = new Date(latest.captured_at).getTime()

  const findNear = (targetAgeMs: number) => {
    const target = latestT - targetAgeMs
    let best: (typeof data)[0] | null = null
    let bestDiff = Infinity
    for (const row of data) {
      const t = new Date(row.captured_at).getTime()
      const diff = Math.abs(t - target)
      // max ±20 perc toleranciával
      if (diff < bestDiff && diff < 20 * 60_000) {
        best = row
        bestDiff = diff
      }
    }
    return best
  }

  const h1 = findNear(3600_000)
  const h4 = findNear(4 * 3600_000)

  const pct = (from: number, to: number) =>
    from > 0 ? Math.round(((to - from) / from) * 10000) / 100 : null

  const oiDelta1hPct = h1 ? pct(Number(h1.open_interest), latestOi) : null
  const oiDelta4hPct = h4 ? pct(Number(h4.open_interest), latestOi) : null
  let priceDelta1hPct: number | null = null
  if (h1?.price != null && latestPrice != null) {
    priceDelta1hPct = pct(Number(h1.price), latestPrice)
  }

  return { oiDelta1hPct, oiDelta4hPct, priceDelta1hPct }
}

/** OI + ár együttes értelmezése. */
export function classifyOiRegime(
  oiDelta1hPct: number | null,
  priceDelta1hPct: number | null
): OiRegime {
  if (oiDelta1hPct == null || priceDelta1hPct == null) return "unknown"
  const oiUp = oiDelta1hPct >= 1.5
  const oiDown = oiDelta1hPct <= -1.5
  const pxUp = priceDelta1hPct >= 0.3
  const pxDown = priceDelta1hPct <= -0.3

  if (pxUp && oiUp) return "trend"
  if (pxUp && oiDown) return "squeeze"
  if (pxDown && oiDown) return "unwind"
  if (pxDown && oiUp) return "capitulation"
  return "flat"
}
