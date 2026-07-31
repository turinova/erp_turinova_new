import type { Bar } from "../../backtest/types"

/**
 * Yahoo Finance provider — ingyenes, de kb. 1-10 perc késleltetésű
 * CME adat. Fallbackként mindig elérhető.
 */

const SYMBOL = "NQ=F"

export async function fetchYahooBars(): Promise<{ symbol: string; bars: Bar[] }> {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(SYMBOL)}` +
    `?interval=1m&range=2d&includePrePost=true`

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (trading-app live feed)" },
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`)

  const json = await res.json()
  const result = json?.chart?.result?.[0]
  if (!result) throw new Error("Váratlan Yahoo válaszformátum")

  const ts: number[] = result.timestamp ?? []
  const q = result.indicators?.quote?.[0] ?? {}

  const bars: Bar[] = []
  for (let i = 0; i < ts.length; i++) {
    const o = q.open?.[i]
    const h = q.high?.[i]
    const l = q.low?.[i]
    const c = q.close?.[i]
    if (o == null || h == null || l == null || c == null) continue
    bars.push({
      t: ts[i],
      o: round2(o),
      h: round2(h),
      l: round2(l),
      c: round2(c),
      v: q.volume?.[i] ?? 0,
    })
  }

  return { symbol: SYMBOL, bars }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
