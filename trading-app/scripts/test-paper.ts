/**
 * Paper trading kiértékelő + Tradovate kontrakt-roll gyorsteszt
 * szintetikus adatokon. Futtatás: npx tsx scripts/test-paper.ts
 */
import { evaluateSignal, type SignalRow } from "../src/lib/live/paper"
import { frontMonthSymbol } from "../src/lib/live/providers/tradovate"
import type { Bar } from "../src/lib/backtest/types"

let failures = 0

function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${ok ? "" : ` → kapott: ${JSON.stringify(actual)}, várt: ${JSON.stringify(expected)}`}`)
  if (!ok) failures++
}

// 2026-07-30 10:00 ET = 14:00 UTC
const base = Math.floor(Date.UTC(2026, 6, 30, 14, 0) / 1000)
const bar = (minOffset: number, o: number, h: number, l: number, c: number): Bar => ({
  t: base + minOffset * 60,
  o,
  h,
  l,
  c,
  v: 1000,
})
const signal = (kind: string, entry: number, stop: number, target: number): SignalRow => ({
  id: "test",
  date: "2026-07-30",
  kind,
  bar_time: new Date(base * 1000).toISOString(),
  entry,
  stop,
  target,
})

// 1) LONG win: target elérve
{
  const r = evaluateSignal(
    signal("ORB_LONG", 100, 90, 120),
    [bar(1, 100, 110, 99, 108), bar(2, 108, 121, 107, 119)],
    "2026-07-30"
  )
  check("LONG win státusz", r?.status, "win")
  check("LONG win R", r?.r_multiple, 2)
}

// 2) LONG loss: stop elérve
{
  const r = evaluateSignal(
    signal("ORB_LONG", 100, 90, 120),
    [bar(1, 100, 102, 89, 91)],
    "2026-07-30"
  )
  check("LONG loss státusz", r?.status, "loss")
  check("LONG loss R", r?.r_multiple, -1)
}

// 3) Konzervatív: stop ÉS target ugyanabban a gyertyában → loss
{
  const r = evaluateSignal(
    signal("ORB_LONG", 100, 90, 120),
    [bar(1, 100, 125, 88, 110)],
    "2026-07-30"
  )
  check("Same-bar konzervatív → loss", r?.status, "loss")
}

// 4) SHORT win: target (lefelé) elérve
{
  const r = evaluateSignal(
    signal("ORB_SHORT", 100, 110, 80),
    [bar(1, 100, 101, 79, 82)],
    "2026-07-30"
  )
  check("SHORT win státusz", r?.status, "win")
  check("SHORT win R", r?.r_multiple, 2)
}

// 5) Nyitva marad: se stop, se target, session még tart
{
  const r = evaluateSignal(
    signal("ORB_LONG", 100, 90, 120),
    [bar(1, 100, 105, 98, 103)],
    "2026-07-30"
  )
  check("Nyitva marad (null)", r, null)
}

// 6) EOD zárás: 15:55 ET után záróáron (15:55 ET = 19:55 UTC = base + 355 perc)
{
  const r = evaluateSignal(
    signal("ORB_LONG", 100, 90, 120),
    [bar(1, 100, 105, 98, 103), bar(355, 103, 106, 102, 105)],
    "2026-07-30"
  )
  check("EOD expired státusz", r?.status, "expired")
  check("EOD expired R", r?.r_multiple, 0.5)
}

// 7) Régi signal, elfogyott gyertyák → expired az utolsó ismert áron
{
  const r = evaluateSignal(
    signal("ORB_LONG", 100, 90, 120),
    [bar(1, 100, 105, 98, 103)],
    "2026-07-31"
  )
  check("Régi signal expired", r?.status, "expired")
  check("Régi signal R", r?.r_multiple, 0.3)
}

// 8) Tradovate front-month szimbólum
{
  check("2026-07-31 → MNQU6", frontMonthSymbol(new Date("2026-07-31")), "MNQU6")
  check("2026-09-14 (roll után) → MNQZ6", frontMonthSymbol(new Date("2026-09-14")), "MNQZ6")
  check("2026-12-20 (roll után) → MNQH7", frontMonthSymbol(new Date("2026-12-20")), "MNQH7")
  check("2026-01-05 → MNQH6", frontMonthSymbol(new Date("2026-01-05")), "MNQH6")
}

console.log(failures === 0 ? "\nMinden teszt zöld." : `\n${failures} teszt bukott!`)
process.exit(failures === 0 ? 0 : 1)
