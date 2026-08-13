/**
 * Stresszteszt: crypto paper partial TP + paper-v2 net R
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

console.log("=== Partial TP stress (50% @ 1R + BE + 50% @ 2R) · paper-v2 ===\n")

// LONG: entry 100, stop 90 → risk 10; TP1=110, TP2=120
const long = signal("SWEEP_LONG", 100, 90, 120)

// 1) Full stop before TP1 → -1R gross
{
  const r = evaluateCryptoSignal(long, [bar(1, 100, 101, 89, 92)], base + 3600)
  check("pre-TP1 stop → loss", r?.status, "loss")
  check("pre-TP1 stop → -1R gross", r?.r_multiple_gross, -1)
  check("pre-TP1 exit_reason", r?.exit_reason, "stop")
  checkCond("pre-TP1 net < gross", (r?.r_multiple ?? 0) < (r?.r_multiple_gross ?? 0), r)
}

// 2) Gap through TP2
{
  const r = evaluateCryptoSignal(long, [bar(1, 100, 121, 99, 118)], base + 3600)
  check("gap to TP2 → win", r?.status, "win")
  check("gap to TP2 → +2R gross", r?.r_multiple_gross, 2)
  check("gap exit_reason", r?.exit_reason, "gap_target")
}

// 3) TP1 then TP2 → blended +1.5R gross
{
  const r = evaluateCryptoSignal(
    long,
    [bar(1, 100, 111, 99, 110), bar(2, 110, 121, 109, 119)],
    base + 3600
  )
  check("TP1→TP2 → win", r?.status, "win")
  check("TP1→TP2 → +1.5R gross", r?.r_multiple_gross, 1.5)
  check("TP1→TP2 exit_reason", r?.exit_reason, "tp1_then_tp2")
  checkCond("TP1→TP2 scale flag", r?.scale_plan === "partial_1r_be_2r" || r?.partial === true, r)
}

// 4) TP1 then BE → +0.5R gross
{
  const r = evaluateCryptoSignal(
    long,
    [bar(1, 100, 111, 99, 110), bar(2, 110, 111, 99.5, 100.2)],
    base + 3600
  )
  check("TP1→BE → win (banked)", r?.status, "win")
  check("TP1→BE → +0.5R gross", r?.r_multiple_gross, 0.5)
  check("TP1→BE exit_reason", r?.exit_reason, "tp1_then_be")
}

// 5) Same bar: TP1 and stop → stop first
{
  const r = evaluateCryptoSignal(long, [bar(1, 100, 111, 89, 95)], base + 3600)
  check("same-bar TP1+stop → loss (konzervatív)", r?.status, "loss")
  check("same-bar TP1+stop → -1R gross", r?.r_multiple_gross, -1)
}

// 6) After TP1, same bar BE + TP2 → BE first
{
  const r = evaluateCryptoSignal(
    long,
    [bar(1, 100, 111, 99, 110), bar(2, 110, 121, 99, 118)],
    base + 3600
  )
  check("post-TP1 same-bar BE+TP2 → BE first", r?.status, "win")
  check("post-TP1 same-bar BE+TP2 → +0.5R gross", r?.r_multiple_gross, 0.5)
}

// 7) SHORT
{
  const short = signal("SWEEP_SHORT", 100, 110, 80)
  const r = evaluateCryptoSignal(
    short,
    [bar(1, 100, 101, 89, 90), bar(2, 90, 91, 79, 81)],
    base + 3600
  )
  check("SHORT TP1→TP2 → win", r?.status, "win")
  check("SHORT TP1→TP2 → +1.5R gross", r?.r_multiple_gross, 1.5)
}

// 8) Target closer than 1R
{
  const mr = signal("MR_LONG", 100, 90, 105)
  const r = evaluateCryptoSignal(mr, [bar(1, 100, 106, 99, 105)], base + 3600)
  check("short-target → no partial, win", r?.status, "win")
  check("short-target → +0.5R gross", r?.r_multiple_gross, 0.5)
  check("short-target exit_reason", r?.exit_reason, "target_lt_1r")
}

// 9) TP1 then expire
{
  const r = evaluateCryptoSignal(
    long,
    [bar(1, 100, 111, 99, 110), bar(2, 110, 112, 102, 103)],
    base + 13 * 3600
  )
  checkCond("TP1→expire → expired banked", r?.status === "expired", r?.status)
  check("TP1→expire → +0.65R gross", r?.r_multiple_gross, 0.65)
  check("TP1→expire exit_reason", r?.exit_reason, "tp1_then_expire")
  checkCond("eval_version paper-v2", r?.eval_version === "paper-v2", r?.eval_version)
}

// 10) data gap: no bars after signal, past deadline
{
  const r = evaluateCryptoSignal(long, [bar(0, 100, 100, 100, 100)], base + 13 * 3600)
  check("data_gap → expired", r?.status, "expired")
  check("data_gap reason", r?.exit_reason, "data_gap")
}

console.log(failures === 0 ? "\nMinden partial stresszteszt OK" : `\n${failures} FAILED`)
if (failures > 0) process.exitCode = 1
