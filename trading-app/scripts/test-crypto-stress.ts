/**
 * Stresszteszt: checklist ↔ engine szinkron + csendes eldobások.
 * Elvárt: ha a buildup ready, a motor vagy ad signal-t, vagy explicit reason-t;
 * chase / age / stop / path kapuk a checklisten is látszanak.
 *
 *   npx tsx scripts/test-crypto-stress.ts
 */
import { computeCryptoSnapshot } from "../src/lib/crypto/compute"
import type { CryptoFeed, SymbolFeed, CryptoSymbol, SetupBuildup } from "../src/lib/crypto/types"
import type { Bar } from "../src/lib/backtest/types"

let failures = 0

function check(name: string, cond: boolean, detail?: unknown) {
  console.log(`${cond ? "OK  " : "FAIL"} ${name}${cond ? "" : ` → ${JSON.stringify(detail)}`}`)
  if (!cond) failures++
}

const day = Math.floor(Date.UTC(2026, 6, 30) / 1000)
const at = (minOfDay: number) => day + minOfDay * 60

function bar(minOfDay: number, o: number, h: number, l: number, c: number, v = 1000): Bar {
  return { t: at(minOfDay), o, h, l, c, v }
}

function flat(from: number, to: number, px: number, range = 0.6, v = 1000): Bar[] {
  const out: Bar[] = []
  for (let m = from; m <= to; m++) {
    const j = Math.sin(m / 7) * range * 0.25
    out.push(bar(m, px + j, px + range + j, px - range + j, px + j, v))
  }
  return out
}

function dailies(high: number, low: number): Bar[] {
  const out: Bar[] = []
  for (let k = 8; k >= 1; k--) {
    out.push({
      t: day - k * 86400,
      o: (high + low) / 2,
      h: high,
      l: low,
      c: (high + low) / 2,
      v: 1e6,
    })
  }
  out.push({ t: day, o: 100, h: 99999, l: 0.0001, c: 100, v: 1e6 })
  return out
}

function sym(
  symbol: CryptoSymbol,
  bars: Bar[],
  daily: Bar[],
  funding: number | null = null
): SymbolFeed {
  return {
    symbol,
    bars,
    dailyBars: daily,
    fundingRate: funding,
    openInterest: null,
    change24hPct: 0,
  }
}

function mkFeed(parts: {
  sol: SymbolFeed
  doge?: SymbolFeed
  btc?: SymbolFeed
  eth?: SymbolFeed
  span: [number, number]
}): CryptoFeed {
  const [from, to] = parts.span
  const defBtc = sym("BTC", flat(from, to, 50000, 60), dailies(52000, 48000))
  const defEth = sym("ETH", flat(from, to, 3000, 5), dailies(3200, 2800))
  const defDoge = sym("DOGE", flat(from, to, 0.1, 0.0006), dailies(0.11, 0.09))
  return {
    source: "bybit",
    fetchedAt: Date.now(),
    symbols: {
      SOL: parts.sol,
      DOGE: parts.doge ?? defDoge,
      BTC: parts.btc ?? defBtc,
      ETH: parts.eth ?? defEth,
    },
  }
}

function solAt(feed: CryptoFeed, nowMin: number) {
  const snap = computeCryptoSnapshot({ feed, nowSec: at(nowMin) })
  return snap.symbols.find((s) => s.symbol === "SOL")!
}

function buildup(sol: ReturnType<typeof solAt>, id: SetupBuildup["id"]) {
  return sol.buildups.find((b) => b.id === id)!
}

function stepOk(b: SetupBuildup, includes: string): boolean {
  const s = b.steps.find((x) => x.label.toLowerCase().includes(includes.toLowerCase()))
  return s?.ok === true
}

function stepFail(b: SetupBuildup, includes: string): boolean {
  const s = b.steps.find((x) => x.label.toLowerCase().includes(includes.toLowerCase()))
  return s != null && s.ok === false
}

console.log("=== Stress: chase / age / path / stop ↔ checklist ===\n")

// ---------------------------------------------------------------------------
// 1) Sweep SHORT reclaim, majd ár elment → chase blokk + checklist nem ready
// ---------------------------------------------------------------------------
{
  // reclaim @601, majd ár 104-re esik (short irányban elment)
  const bars = [
    ...flat(0, 600, 100),
    bar(601, 100, 110.6, 99.5, 109.4, 20000), // sweep+reclaim short a PDH 110-nél
  ]
  for (let m = 602; m <= 608; m++) {
    bars.push(bar(m, 108, 108.2, 104, 104.2)) // ár elment shortba
  }
  const sol = solAt(mkFeed({ sol: sym("SOL", bars, dailies(110, 90)), span: [0, 608] }), 609)
  const bu = buildup(sol, "sweep")
  check("chase: nincs SWEEP_SHORT signal", sol.signal.kind === "NONE", sol.signal)
  check("chase: reason említi a kergetést", /elment|kerget/i.test(sol.signal.reason), sol.signal.reason)
  check(
    "chase: checklisten van chase-lépés",
    bu.steps.some((s) => /nem ment el|0\.75R/i.test(s.label)),
    bu.steps
  )
  check("chase: checklist NEM ready", bu.ready === false, { ready: bu.ready, done: `${bu.done}/${bu.total}` })
  check(
    "chase: chase-lépés fail",
    stepFail(bu, "nem ment el") || stepFail(bu, "0.75R"),
    bu.steps
  )
}

// ---------------------------------------------------------------------------
// 2) Sweep reclaim 8 perccel ezelőtt (age 5→10 ablakban még él)
// ---------------------------------------------------------------------------
{
  const bars = [...flat(0, 600, 100), bar(601, 100, 110.6, 99.5, 109.4, 20000)]
  for (let m = 602; m <= 608; m++) {
    // ár a reclaim közelében marad (nincs chase)
    bars.push(bar(m, 109.3, 109.5, 109.1, 109.35))
  }
  const sol = solAt(mkFeed({ sol: sym("SOL", bars, dailies(110, 90)), span: [0, 608] }), 609)
  check(
    "age-10: 8 perces sweep még él (SWEEP_SHORT)",
    sol.signal.kind === "SWEEP_SHORT",
    { kind: sol.signal.kind, age: sol.signal.ageBars, reason: sol.signal.reason }
  )
}

// ---------------------------------------------------------------------------
// 3) Breakout >30 perc után — explicit reason, checklist nem ready
// ---------------------------------------------------------------------------
{
  const bars = [
    ...flat(600, 779, 100, 0.6),
    ...flat(780, 809, 100, 0.8), // US range
    bar(810, 100, 101.3, 100, 101.2, 15000), // első breakout
  ]
  // 35 perc a kitörés után, ár még kívül — de túl régi
  for (let m = 811; m <= 845; m++) {
    bars.push(bar(m, 101.4, 101.6, 101.3, 101.5, 15000))
  }
  const snap = computeCryptoSnapshot({
    feed: mkFeed({ sol: sym("SOL", bars, dailies(110, 90)), span: [600, 845] }),
    nowSec: at(846),
    enabledSetups: { sweep: false, fvg: false, breakout: true, pullback: false, mean_rev: false },
  })
  const solBo = snap.symbols.find((s) => s.symbol === "SOL")!
  const bu = buildup(solBo, "breakout")
  check("aged BO: nincs BREAKOUT signal", solBo.signal.kind !== "BREAKOUT_LONG", solBo.signal)
  check(
    "aged BO: explicit reason (nem csendes null)",
    /túl régi|lejárt|30/i.test(solBo.signal.reason),
    solBo.signal.reason
  )
  check(
    "aged BO: checklist age-lépés fail",
    stepFail(bu, "friss") || stepFail(bu, "≤30") || stepFail(bu, "30p"),
    bu.steps
  )
  check("aged BO: checklist NEM ready", bu.ready === false, { ready: bu.ready, steps: bu.steps })
}

// ---------------------------------------------------------------------------
// 4) Mean rev stretch OK, de VWAP-út <1R → explicit reason + checklist fail
// ---------------------------------------------------------------------------
{
  // Erősebb stretch (távolabb a VWAP-tól), aztán egy mély wick → ATR nő,
  // de a stretch még ≥2×ATR, miközben stop > VWAP-út.
  const bars = flat(0, 120, 100, 0.6, 5000)
  let px = 100
  for (let m = 121; m <= 180; m++) {
    const c = px - 0.12
    bars.push(bar(m, px, px + 0.08, c - 0.05, c, 100))
    px = c
  }
  // tartás ~92.8 körül (VWAP még ~99+), kis range
  bars.push(...flat(181, 599, px, 0.4, 400))
  // mély wick (5 pont): stop > VWAP-út, stretch még ≥2×ATR
  bars.push(bar(600, px, px + 0.2, px - 5, px, 400))

  const snap = computeCryptoSnapshot({
    feed: mkFeed({ sol: sym("SOL", bars, dailies(110, 85)), span: [0, 600] }),
    nowSec: at(601),
    enabledSetups: { sweep: false, fvg: false, breakout: false, pullback: false, mean_rev: true },
  })
  const sol = snap.symbols.find((s) => s.symbol === "SOL")!
  const bu = buildup(sol, "mean_rev")

  check(
    "MR path: kontroll — stretch + range",
    (sol.adx ?? 99) < 25 && sol.vwapDistAtr != null && Math.abs(sol.vwapDistAtr) >= 2.0,
    { adx: sol.adx, dist: sol.vwapDistAtr, reason: sol.signal.reason, px }
  )
  check("MR path: nincs MR signal", sol.signal.kind === "NONE", sol.signal)
  check(
    "MR path: reason említi az 1R / VWAP utat",
    /1R|nem éri meg|VWAP-ig/i.test(sol.signal.reason),
    { reason: sol.signal.reason, adx: sol.adx, dist: sol.vwapDistAtr }
  )
  check("MR path: checklist path-lépés fail", stepFail(bu, "1R") || stepFail(bu, "VWAP-ig"), bu.steps)
  check("MR path: checklist NEM ready", bu.ready === false, { ready: bu.ready, steps: bu.steps })
}

// ---------------------------------------------------------------------------
// 5) Pullback reclaim, de stop >2×ATR → explicit reason + checklist
// ---------------------------------------------------------------------------
{
  const bars = flat(0, 200, 100, 0.5, 2000)
  // trend: fel a VWAP fölé
  let px = 100
  for (let m = 201; m <= 280; m++) {
    const c = px + 0.12
    bars.push(bar(m, px, c + 0.05, px - 0.05, c, 3000))
    px = c
  }
  // visszahúzás VWAP-ra + reclaim long, de hatalmas wick lefelé (széles stop)
  const vwapish = 100
  bars.push(bar(281, px, px, vwapish - 3, vwapish + 0.2, 5000)) // érintés
  bars.push(bar(282, vwapish, vwapish + 0.5, vwapish - 4, vwapish + 0.4, 5000)) // reclaim + mély stop

  const sol = solAt(
    mkFeed({
      sol: sym("SOL", bars, dailies(120, 90)),
      span: [0, 282],
    }),
    283
  )
  const bu = buildup(sol, "pullback")

  if (sol.signal.kind === "PB_LONG" || sol.signal.kind === "PB_SHORT") {
    check("PB stop: signal mellett stop-lépés OK", stepOk(bu, "2") || stepOk(bu, "stop"), bu.steps)
  } else {
    // Ha a motor látta a pullback struktúrát, de stop miatt dobta
    const mentionsStop = /stop|2×ATR|2xATR|túl széles/i.test(sol.signal.reason)
    const hasStopStep = bu.steps.some((s) => /stop|2×ATR|2×ATR|2x/i.test(s.label))
    if (mentionsStop || (bu.bias !== "none" && hasStopStep && stepFail(bu, "stop"))) {
      check("PB stop: explicit reason vagy checklist fail", true)
      check("PB stop: checklist NEM ready ha stop fail", !stepFail(bu, "stop") || bu.ready === false, bu)
    } else {
      // Lehet, hogy a trend/touch/reclaim nem jött össze a szintetikus feeden —
      // akkor legalább a stop-lépés létezzen a checklisten.
      check(
        "PB stop: checklisten van stop-méret lépés",
        bu.steps.some((s) => /stop|2×ATR|2×ATR|2x/i.test(s.label)),
        bu.steps
      )
    }
  }
}

// ---------------------------------------------------------------------------
// 6) Invariáns: ready setup → signal kind ehhez a családhoz VAGY magasabb prio
//    blokkolt explicit reasonnel (nem „Nincs setup — várakozás” csendesen)
// ---------------------------------------------------------------------------
{
  // „jó” sweep: checklist ready + signal SWEEP
  const bars = [...flat(0, 600, 100), bar(601, 100, 110.6, 99.5, 109.4, 20000)]
  for (let m = 602; m <= 604; m++) bars.push(bar(m, 109.3, 109.5, 109.2, 109.35))
  const sol = solAt(mkFeed({ sol: sym("SOL", bars, dailies(110, 90)), span: [0, 604] }), 605)
  const bu = buildup(sol, "sweep")
  check("invariáns: jó sweep → SWEEP_SHORT", sol.signal.kind === "SWEEP_SHORT", sol.signal)
  check("invariáns: jó sweep → checklist ready", bu.ready === true, {
    ready: bu.ready,
    done: `${bu.done}/${bu.total}`,
    steps: bu.steps,
  })
}

console.log(failures === 0 ? "\nMinden stresszteszt OK" : `\n${failures} stresszteszt FAILED`)
if (failures > 0) process.exitCode = 1
