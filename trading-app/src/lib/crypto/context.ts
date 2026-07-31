import type { SupabaseClient } from "@supabase/supabase-js"
import { dogeCatalystActive, loadActiveCatalysts } from "./news"
import { classifyOiRegime, loadOiDeltas } from "./oi-history"
import { getSettlementInfo } from "./settlement"
import type {
  Catalyst,
  CryptoFeed,
  MarketContext,
  SymbolMarketContext,
} from "./types"

const DOGE_RVOL_BASE = 1.3
const DOGE_RVOL_CATALYST = 1.0

export interface BuiltContext {
  context: MarketContext
  catalysts: Catalyst[]
}

/**
 * Összefűzi a settlementet, OI Δ-t és a híreket egy MarketContext-té.
 */
export async function buildMarketContext(
  supabase: SupabaseClient,
  feed: CryptoFeed,
  nowSec?: number
): Promise<BuiltContext> {
  const settlement = getSettlementInfo(nowSec)
  const catalysts = await loadActiveCatalysts(supabase)

  const [btcD, solD, dogeD] = await Promise.all([
    loadOiDeltas(supabase, "BTC"),
    loadOiDeltas(supabase, "SOL"),
    loadOiDeltas(supabase, "DOGE"),
  ])

  // ha még nincs OI történet, a feed aktuális OI-ja mellett price Δ a 1h bars-ból
  const priceDeltaFromBars = (sym: "SOL" | "DOGE" | "BTC"): number | null => {
    const bars = feed.symbols[sym].bars
    if (bars.length < 60) return null
    const last = bars[bars.length - 1].c
    const ago = bars[bars.length - 60].c
    if (!ago) return null
    return Math.round(((last - ago) / ago) * 10000) / 100
  }

  const mk = (
    sym: "SOL" | "DOGE",
    deltas: typeof solD,
    catalystMode: boolean
  ): SymbolMarketContext => {
    const pxDelta = deltas.priceDelta1hPct ?? priceDeltaFromBars(sym)
    const oiDelta = deltas.oiDelta1hPct
    const oiRegime = classifyOiRegime(oiDelta, pxDelta)
    const symCatalysts = catalysts.filter((c) => c.symbols.includes(sym))
    return {
      oiDelta1hPct: oiDelta,
      oiDelta4hPct: deltas.oiDelta4hPct,
      oiRegime,
      catalystMode,
      rvolGate: sym === "DOGE" ? (catalystMode ? DOGE_RVOL_CATALYST : DOGE_RVOL_BASE) : 0,
      catalysts: symCatalysts,
    }
  }

  const dogeMode = dogeCatalystActive(catalysts)

  const context: MarketContext = {
    settlement,
    btcCatalysts: catalysts.filter((c) => c.symbols.includes("BTC")),
    sol: mk("SOL", solD, false),
    doge: mk("DOGE", dogeD, dogeMode),
  }

  return { context, catalysts }
}

export { DOGE_RVOL_BASE, DOGE_RVOL_CATALYST }
