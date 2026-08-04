/**
 * Stresszteszt: crypto paper partial TP
 *   50% @ 1R → stop BE-re → 50% @ 2R (vagy BE / expire)
 *
 *   npx tsx scripts/test-crypto-paper-partial.ts
 */
import { evaluateCryptoSignal, type CryptoSignalRow } from "../src/lib/crypto/paper"
import type { Bar } from "../src/lib/backtest/types"

let failures = 0

function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  console.log(
    `${ok ? "OK  " : "FAIL"} ${name}${ok ? "" : ` → kapott: ${JSON.stringify(actual)}, várt: ${JSON.stringify(expected)}`}`
  )
  if (!ok) failures++
}

function checkCond(name: string, cond: boolean, detail?: unknown) {
  console.log(`${cond ? "OK  " : "FAIL"} ${name}${cond ? "" : ` → ${JSON.stringify(detail)}`}`)
  if (!cond) failures++
}

const base = Math.floor(Date.UTC(2026, 7, 4, 12, 0) / 1000)
const bar = (minOffset: number, o: number, h: number, l: number, c: number): Bar => ({
  t: base + minOffset * 60,
  o,
  h,
  l,
  c,
  v: 1000,
})

const signal = (kind: string, entry: number, stop: number, target: number): CryptoSignalRow => ({
  id: "t",
  symbol: "SOL",
  kind,
  bar_time: new Date(base * 1000).toISOString(),
  entry,
  stop,
  target,
})

console.log("=== Partial TP stress (50% @ 1R + BE + 50% @ 2R) ===\n")

// LONG: entry 100, stop 90 → risk 10; TP1=110, TP2=120
const long = signal("SWEEP_LONG", 100, 90, 120)

// 1) Full stop before TP1 → -1R
{
  const r = evaluateCryptoSignal(long, [bar(1, 100, 101, 89, 92)], base + 3600)
  check("pre-TP1 stop → loss", r?.status, "loss")
  check("pre-TP1 stop → -1R", r?.r_multiple, -1)
}

// 2) Hit TP2 without visiting TP1 as separate (gap through) → full +2R still OK
{
  const r = evaluateCryptoSignal(long, [bar(1, 100, 121, 99, 118)], base + 3600)
  check("gap to TP2 → win", r?.status, "win")
  check("gap to TP2 → +2R (full)", r?.r_multiple, 2)
}

// 3) TP1 then TP2 → blended +1.5R (0.5*1 + 0.5*2)
{
  const r = evaluateCryptoSignal(
    long,
    [bar(1, 100, 111, 99, 110), bar(2, 110, 121, 109, 119)],
    base + 3600
  )
  check("TP1→TP2 → win", r?.status, "win")
  check("TP1→TP2 → +1.5R", r?.r_multiple, 1.5)
  checkCond("TP1→TP2 scale flag", r?.scale_plan === "partial_1r_be_2r" || r?.partial === true, r)
}

// 4) TP1 then BE → +0.5R (half banked, half scratch)
{
  const r = evaluateCryptoSignal(
    long,
    [bar(1, 100, 111, 99, 110), bar(2, 110, 111, 99.5, 100.2)],
    base + 3600
  )
  check("TP1→BE → win (banked)", r?.status, "win")
  check("TP1→BE → +0.5R", r?.r_multiple, 0.5)
}

// 5) Same bar: TP1 and stop both touchable before TP1 taken → stop first
{
  const r = evaluateCryptoSignal(long, [bar(1, 100, 111, 89, 95)], base + 3600)
  check("same-bar TP1+stop → loss (konzervatív)", r?.status, "loss")
  check("same-bar TP1+stop → -1R", r?.r_multiple, -1)
}

// 6) After TP1, same bar BE + TP2 → BE first (konzervatív) → +0.5R
{
  const r = evaluateCryptoSignal(
    long,
    [bar(1, 100, 111, 99, 110), bar(2, 110, 121, 99, 118)],
    base + 3600
  )
  check("post-TP1 same-bar BE+TP2 → BE first", r?.status, "win")
  check("post-TP1 same-bar BE+TP2 → +0.5R", r?.r_multiple, 0.5)
}

// 7) SHORT: entry 100, stop 110, target 80; TP1=90
{
  const short = signal("SWEEP_SHORT", 100, 110, 80)
  const r = evaluateCryptoSignal(
    short,
    [bar(1, 100, 101, 89, 90), bar(2, 90, 91, 79, 81)],
    base + 3600
  )
  check("SHORT TP1→TP2 → win", r?.status, "win")
  check("SHORT TP1→TP2 → +1.5R", r?.r_multiple, 1.5)
}

// 8) Target closer than 1R (MR-szerű) → nincs partial, full target
{
  const mr = signal("MR_LONG", 100, 90, 105) // target only +0.5R
  const r = evaluateCryptoSignal(mr, [bar(1, 100, 106, 99, 105)], base + 3600)
  check("short-target → no partial, win", r?.status, "win")
  check("short-target → +0.5R full", r?.r_multiple, 0.5)
}

// 9) TP1 then expire at +0.3R on remainder → 0.5*1 + 0.5*0.3 = 0.65
{
  const r = evaluateCryptoSignal(
    long,
    [bar(1, 100, 111, 99, 110), bar(2, 110, 112, 102, 103)],
    base + 13 * 3600 // past 12h hold
  )
  checkCond("TP1→expire → expired banked", r?.status === "expired", r?.status)
  check("TP1→expire → +0.65R", r?.r_multiple, 0.65)
}

console.log(failures === 0 ? "\nMinden partial stresszteszt OK" : `\n${failures} FAILED`)
if (failures > 0) process.exitCode = 1
