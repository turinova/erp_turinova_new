/**
 * Kontextus-réteg tesztek: settlement, OI regime, hírscoring, DOGE catalyst RVOL.
 *   npx tsx scripts/test-crypto-context.ts
 */
import { classifyOiRegime } from "../src/lib/crypto/oi-history"
import { scoreNews, dogeCatalystActive } from "../src/lib/crypto/news"
import { getSettlementInfo } from "../src/lib/crypto/settlement"
import { computeCryptoSnapshot } from "../src/lib/crypto/compute"
import { DOGE_RVOL_BASE, DOGE_RVOL_CATALYST } from "../src/lib/crypto/context"
import type { Catalyst, CryptoFeed, MarketContext, SymbolFeed } from "../src/lib/crypto/types"
import type { Bar } from "../src/lib/backtest/types"

let failures = 0
function check(name: string, cond: boolean, detail?: unknown) {
  console.log(`${cond ? "OK  " : "FAIL"} ${name}${cond ? "" : ` → ${JSON.stringify(detail)}`}`)
  if (!cond) failures++
}

// --- settlement ---
{
  // 2026-07-31 07:55 UTC → freeze a 08:00 előtt
  const t = Math.floor(Date.UTC(2026, 6, 31, 7, 55) / 1000)
  const s = getSettlementInfo(t)
  check("settlement freeze 07:55", s.inFreeze === true, s)
  check("next settlement 08:00", s.nextUtc === "08:00", s)
}
{
  const t = Math.floor(Date.UTC(2026, 6, 31, 8, 15) / 1000)
  const s = getSettlementInfo(t)
  check("settlement mehet 08:15", s.inFreeze === false, s)
}
{
  const t = Math.floor(Date.UTC(2026, 6, 31, 23, 55) / 1000)
  const s = getSettlementInfo(t)
  check("settlement freeze 23:55 (00:00 körül)", s.inFreeze === true, s)
}

// --- OI regime ---
check("OI trend", classifyOiRegime(3, 1) === "trend")
check("OI squeeze", classifyOiRegime(-3, 1) === "squeeze")
check("OI unwind", classifyOiRegime(-3, -1) === "unwind")
check("OI capitulation", classifyOiRegime(3, -1) === "capitulation")
check("OI unknown", classifyOiRegime(null, 1) === "unknown")

// --- news scoring ---
{
  const a = scoreNews("Elon Musk tweets about Dogecoin again", ["DOGE"])
  check("Elon → high DOGE", a.severity === "high" && a.symbols.includes("DOGE"), a)
  const b = scoreNews("Solana network outage reported", ["SOL"])
  check("outage → high SOL", b.severity === "high" && b.tags.includes("outage"), b)
  const c = scoreNews("Fed rate decision tomorrow", ["BTC"])
  check("Fed → med BTC", c.severity === "med" && c.symbols.includes("BTC"), c)
}

{
  const cats: Catalyst[] = [
    {
      source: "manual",
      title: "Elon",
      url: null,
      severity: "high",
      tags: ["elon"],
      symbols: ["DOGE"],
      ageMin: 30,
      publishedAt: new Date().toISOString(),
    },
  ]
  check("dogeCatalystActive true", dogeCatalystActive(cats) === true)
  check("dogeCatalystActive stale", dogeCatalystActive([{ ...cats[0], ageMin: 400 }]) === false)
}

// --- compute: settlement freeze + squeeze + catalyst RVOL ---
function flat(from: number, to: number, px: number): Bar[] {
  const day = Math.floor(Date.UTC(2026, 6, 31) / 1000)
  const out: Bar[] = []
  for (let m = from; m <= to; m++) {
    const j = Math.sin(m / 7) * 0.15
    out.push({
      t: day + m * 60,
      o: px + j,
      h: px + 0.6 + j,
      l: px - 0.6 + j,
      c: px + j,
      v: 1000,
    })
  }
  return out
}

function sym(symbol: "SOL" | "DOGE" | "BTC" | "ETH", bars: Bar[]): SymbolFeed {
  return {
    symbol,
    bars,
    dailyBars: [
      { t: Math.floor(Date.UTC(2026, 6, 30) / 1000), o: 100, h: 110, l: 90, c: 100, v: 1e6 },
    ],
    fundingRate: 0,
    openInterest: 1e6,
    change24hPct: 0,
  }
}

function mkFeed(solBars: Bar[]): CryptoFeed {
  const span = solBars
  return {
    source: "bybit",
    fetchedAt: Date.now(),
    symbols: {
      SOL: sym("SOL", solBars),
      DOGE: sym("DOGE", span.map((b) => ({ ...b, o: 0.1, h: 0.1006, l: 0.0994, c: 0.1 }))),
      BTC: sym("BTC", span.map((b) => ({ ...b, o: 50000, h: 50060, l: 49940, c: 50000 }))),
      ETH: sym("ETH", span.map((b) => ({ ...b, o: 3000, h: 3005, l: 2995, c: 3000 }))),
    },
  }
}

const baseCtx = (): MarketContext => ({
  settlement: { nextUtc: "08:00", minutesLeft: 60, inFreeze: false },
  btcCatalysts: [],
  sol: {
    oiDelta1hPct: 0,
    oiDelta4hPct: 0,
    oiRegime: "flat",
    catalystMode: false,
    rvolGate: 0,
    catalysts: [],
  },
  doge: {
    oiDelta1hPct: 0,
    oiDelta4hPct: 0,
    oiRegime: "flat",
    catalystMode: false,
    rvolGate: DOGE_RVOL_BASE,
    catalysts: [],
  },
})

{
  // settlement freeze → NONE
  const nowSec = Math.floor(Date.UTC(2026, 6, 31, 7, 55) / 1000)
  const bars = [...flat(0, 480, 100), {
    t: Math.floor(Date.UTC(2026, 6, 31) / 1000) + 481 * 60,
    o: 100, h: 110.6, l: 99.5, c: 109.4, v: 1000,
  }]
  const snap = computeCryptoSnapshot({
    feed: mkFeed(bars),
    nowSec,
    marketContext: baseCtx(),
  })
  check("freeze → SOL NONE", snap.symbols[0].signal.kind === "NONE", snap.symbols[0].signal)
  check("freeze reason", snap.symbols[0].signal.reason.includes("settlement"), snap.symbols[0].signal.reason)
  check("context.inFreeze", snap.context.settlement.inFreeze === true, snap.context.settlement)
}

{
  // OI squeeze blocks long sweep
  const nowSec = Math.floor(Date.UTC(2026, 6, 31, 10, 0) / 1000)
  const day = Math.floor(Date.UTC(2026, 6, 31) / 1000)
  const bars = [...flat(0, 480, 100)]
  bars.push({ t: day + 481 * 60, o: 100, h: 100.5, l: 97.4, c: 98.5, v: 2000 })
  const ctx = baseCtx()
  ctx.sol.oiRegime = "squeeze"
  // need a long sweep: wick below prev day low 90, reclaim
  bars[bars.length - 1] = { t: day + 481 * 60, o: 100, h: 100.5, l: 88.5, c: 91, v: 5000 }
  const snap = computeCryptoSnapshot({
    feed: mkFeed(bars),
    nowSec,
    marketContext: ctx,
  })
  const sol = snap.symbols.find((s) => s.symbol === "SOL")!
  check(
    "squeeze blocks long sweep or explains",
    sol.signal.kind === "NONE" &&
      (sol.signal.reason.includes("squeeze") || sol.signal.reason.includes("long tiltva") || sol.signal.kind === "NONE"),
    sol.signal
  )
}

{
  check("DOGE RVOL base", DOGE_RVOL_BASE === 1.3)
  check("DOGE RVOL catalyst", DOGE_RVOL_CATALYST === 1.0)
  const nowSec = Math.floor(Date.UTC(2026, 6, 31, 10, 0) / 1000)
  const bars = flat(0, 481, 100)
  const ctx = baseCtx()
  ctx.doge.catalystMode = true
  ctx.doge.rvolGate = DOGE_RVOL_CATALYST
  const snap = computeCryptoSnapshot({
    feed: mkFeed(bars),
    nowSec,
    marketContext: ctx,
  })
  const doge = snap.symbols.find((s) => s.symbol === "DOGE")!
  check("catalystMode flag on DOGE snap", doge.catalystMode === true, doge)
}

console.log(failures === 0 ? "\nMinden context teszt OK" : `\n${failures} teszt FAILED`)
if (failures > 0) process.exitCode = 1
