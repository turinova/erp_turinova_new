/**
 * Historikus NQ futures gyertyák letöltése a Yahoo Finance chart API-ról.
 * Ingyenes, kulcs nélküli — korlát: 5m gyertyákból ~60 nap érhető el.
 *
 * Futtatás:  npm run fetch-data
 * Kimenet:   data/bars-NQ-5m.json
 */

import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const SYMBOL = "NQ=F"
const INTERVAL = "5m"
const RANGE = "60d"

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, "..", "data")
const outFile = join(outDir, "bars-NQ-5m.json")

const url =
  `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(SYMBOL)}` +
  `?interval=${INTERVAL}&range=${RANGE}&includePrePost=true`

console.log(`Letöltés: ${SYMBOL} ${INTERVAL} / ${RANGE} ...`)

const res = await fetch(url, {
  headers: { "User-Agent": "Mozilla/5.0 (trading-app backtest data fetch)" },
})
if (!res.ok) {
  console.error(`HTTP ${res.status} — a Yahoo elutasította a kérést.`)
  process.exit(1)
}

const json = await res.json()
const result = json?.chart?.result?.[0]
if (!result) {
  console.error("Váratlan válaszformátum:", JSON.stringify(json).slice(0, 300))
  process.exit(1)
}

const ts = result.timestamp ?? []
const q = result.indicators?.quote?.[0] ?? {}

const bars = []
for (let i = 0; i < ts.length; i++) {
  const o = q.open?.[i]
  const h = q.high?.[i]
  const l = q.low?.[i]
  const c = q.close?.[i]
  const v = q.volume?.[i]
  // Yahoo hézagos gyertyákat is ad (null) — ezeket kihagyjuk
  if (o == null || h == null || l == null || c == null) continue
  bars.push({
    t: ts[i], // unix epoch (sec)
    o: round2(o),
    h: round2(h),
    l: round2(l),
    c: round2(c),
    v: v ?? 0,
  })
}

function round2(n) {
  return Math.round(n * 100) / 100
}

await mkdir(outDir, { recursive: true })
await writeFile(
  outFile,
  JSON.stringify(
    {
      symbol: SYMBOL,
      interval: INTERVAL,
      fetchedAt: new Date().toISOString(),
      timezone: result.meta?.exchangeTimezoneName ?? "America/New_York",
      bars,
    },
    null,
    0
  )
)

const first = new Date(bars[0].t * 1000).toISOString().slice(0, 10)
const last = new Date(bars[bars.length - 1].t * 1000).toISOString().slice(0, 10)
console.log(`OK: ${bars.length} gyertya (${first} → ${last}) → ${outFile}`)
