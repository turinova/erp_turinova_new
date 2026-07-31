/**
 * Élő signal engine szintetikus tesztek: VWAP reversion, momentum pullback,
 * ORB entry-ablak. Futtatás: npx tsx scripts/test-signals.ts
 */
import { computeLiveSnapshot } from "../src/lib/live/compute"
import type { LiveFeed } from "../src/lib/live/fetch-live"
import type { Bar } from "../src/lib/backtest/types"

let failures = 0

function check(name: string, actual: unknown, expected: unknown) {
  const ok = actual === expected
  console.log(
    `${ok ? "OK  " : "FAIL"} ${name}${ok ? "" : ` → kapott: ${JSON.stringify(actual)}, várt: ${JSON.stringify(expected)}`}`
  )
  if (!ok) failures++
}

// 2026-07-30 (csütörtök) 9:30 ET = 13:30 UTC
const open = Math.floor(Date.UTC(2026, 6, 30, 13, 30) / 1000)
const at = (minAfterOpen: number) => open + minAfterOpen * 60

function bar(minAfterOpen: number, o: number, h: number, l: number, c: number): Bar {
  return { t: at(minAfterOpen), o, h, l, c, v: 1000 }
}

function snapshotOf(bars: Bar[], nowMinAfterOpen: number) {
  const feed: LiveFeed = {
    symbol: "TEST",
    source: "yahoo",
    fetchedAt: Date.now(),
    bars,
  }
  return computeLiveSnapshot({
    feed,
    history: null,
    orbMinutes: 15,
    accountSize: 5000,
    riskPerTradePct: 1,
    cutoffHourEt: 16,
    nowSec: at(nowMinAfterOpen),
  })
}

// --- 1) VWAP reversion: range nap, az ár 10:30 után elnyúlik a VWAP-tól ---
{
  const bars: Bar[] = []
  // ORB (9:30-9:44): széles range 95-105, záró 100
  for (let i = 0; i < 15; i++) bars.push(bar(i, 100, 105, 95, 100))
  // 9:45-12:00: az ár 96 körül ül (range-en belül, VWAP lehúzva)
  for (let i = 15; i <= 150; i++) bars.push(bar(i, 96, 96.4, 95.6, 96))
  // 12:01-12:05: gyors elnyúlás felfelé, de kitörés (>105 záró) nélkül
  const rise = [100, 101.5, 102.5, 103, 103.4]
  rise.forEach((c, k) => bars.push(bar(151 + k, c - 0.5, c + 0.3, c - 0.8, c)))

  const snap = snapshotOf(bars, 156)
  check("VWAP reversion kind", snap.signal.kind, "VWAP_SHORT")
  check("VWAP reversion target = VWAP", snap.signal.target20, snap.vwap)
}

// --- 2) Momentum pullback: kitörés + elfutás, órákkal később VWAP-visszateszt ---
{
  const bars: Bar[] = []
  // ORB (9:30-9:44): szűk range 100-102
  for (let i = 0; i < 15; i++) bars.push(bar(i, 101, 102, 100, 101))
  // 9:45: kitörés felfelé (záró 103)
  bars.push(bar(15, 101.8, 103.2, 101.7, 103))
  // 9:46-12:00: trend 106 körül (VWAP felkúszik ~105.5-re)
  for (let i = 16; i <= 150; i++) bars.push(bar(i, 106, 106.3, 105.7, 106))
  // 12:01: VWAP-visszateszt — alj a VWAP alatt, záró felette
  bars.push(bar(151, 105.9, 106, 105.2, 105.8))
  // 12:02: trend tartja magát
  bars.push(bar(152, 105.8, 106, 105.7, 105.9))

  const snap = snapshotOf(bars, 153)
  check("Pullback kind", snap.signal.kind, "PB_LONG")
  check("Pullback entry = visszateszt záró", snap.signal.entry, 105.8)
  check("Pullback stop = visszateszt alj", snap.signal.stop, 105.2)
}

// --- 3) ORB entry-ablak: 30 percen túli kitörésre nincs ORB signal ---
{
  const bars: Bar[] = []
  for (let i = 0; i < 15; i++) bars.push(bar(i, 101, 102, 100, 101))
  bars.push(bar(15, 101.8, 103.2, 101.7, 103)) // kitörés 9:45
  // 9:46-11:00: ár az ORB felett marad, VWAP felett, de visszateszt nélkül
  for (let i = 16; i <= 90; i++) bars.push(bar(i, 103.5, 103.8, 103.3, 103.6))

  const snap = snapshotOf(bars, 91)
  check("ORB ablak lezárult → NONE", snap.signal.kind, "NONE")
  check(
    "ORB ablak indoklás",
    snap.signal.reason.includes("entry-ablak lezárult"),
    true
  )
}

// --- 4) Friss kitörés (ablakon belül) továbbra is ad ORB signalt ---
{
  const bars: Bar[] = []
  for (let i = 0; i < 15; i++) bars.push(bar(i, 101, 102, 100, 101))
  bars.push(bar(15, 101.8, 103.2, 101.7, 103)) // kitörés 9:45
  bars.push(bar(16, 103, 103.4, 102.8, 103.2))

  const snap = snapshotOf(bars, 17)
  check("Friss ORB signal", snap.signal.kind, "ORB_LONG")
  check("ORB entry horgony", snap.signal.entry, 103)
}

console.log(failures === 0 ? "\nMinden teszt zöld." : `\n${failures} teszt bukott!`)
process.exit(failures === 0 ? 0 : 1)
