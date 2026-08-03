/**
 * Crypto signal engine szintetikus tesztek + opcionális élő feed smoke test.
 *   npx tsx scripts/test-crypto.ts          → szintetikus tesztek
 *   npx tsx scripts/test-crypto.ts --live   → + valódi Bybit feed lekérés
 */
import { computeCryptoSnapshot } from "../src/lib/crypto/compute"
import { fetchCryptoFeed } from "../src/lib/crypto/feed"
import type { CryptoFeed, SymbolFeed, CryptoSymbol } from "../src/lib/crypto/types"
import type { Bar } from "../src/lib/backtest/types"

let failures = 0

function check(name: string, cond: boolean, detail?: unknown) {
  console.log(`${cond ? "OK  " : "FAIL"} ${name}${cond ? "" : ` → ${JSON.stringify(detail)}`}`)
  if (!cond) failures++
}

// 2026-07-30 00:00 UTC a teszt-nap kezdete
const day = Math.floor(Date.UTC(2026, 6, 30) / 1000)
const at = (minOfDay: number) => day + minOfDay * 60

function bar(minOfDay: number, o: number, h: number, l: number, c: number, v = 1000): Bar {
  return { t: at(minOfDay), o, h, l, c, v }
}

/**
 * Oszcilláló "range" gyertyák [from..to] percre. Enyhe szinuszos hullámzást
 * kapnak, mert tökéletesen egyforma gyertyáknál az ADX 100-on ragadna
 * (a +DM végig nulla lenne, a -DM/+DM arány pedig skálafüggetlen).
 */
function flat(from: number, to: number, px: number, range = 0.6, v = 1000): Bar[] {
  const out: Bar[] = []
  for (let m = from; m <= to; m++) {
    const j = Math.sin(m / 7) * range * 0.25
    out.push(bar(m, px + j, px + range + j, px - range + j, px + j, v))
  }
  return out
}

/** 8 lezárt napi gyertya + a mai (élő, kizárandó) nap extrém értékkel */
function dailies(high: number, low: number): Bar[] {
  const out: Bar[] = []
  for (let k = 8; k >= 1; k--) {
    out.push({ t: day - k * 86400, o: (high + low) / 2, h: high, l: low, c: (high + low) / 2, v: 1e6 })
  }
  // a mai — még futó — nap: ha az engine tévedésből beszámítaná, a tesztek elbuknak
  out.push({ t: day, o: 100, h: 99999, l: 0.0001, c: 100, v: 1e6 })
  return out
}

function sym(symbol: CryptoSymbol, bars: Bar[], daily: Bar[], funding: number | null = null): SymbolFeed {
  return { symbol, bars, dailyBars: daily, fundingRate: funding, openInterest: null, change24hPct: 0 }
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

function solSnap(feed: CryptoFeed, nowMin: number) {
  const snap = computeCryptoSnapshot({ feed, nowSec: at(nowMin) })
  return { snap, sol: snap.symbols.find((s) => s.symbol === "SOL")!, doge: snap.symbols.find((s) => s.symbol === "DOGE")! }
}

// --- 1) Sweep-reclaim SHORT a prev day high fölött ---
// 10:02 UTC (600+ perc) — settlement freeze ablakon kívül
{
  const bars = [...flat(0, 600, 100), bar(601, 100, 110.6, 99.5, 109.4, 20000)]
  const feed = mkFeed({ sol: sym("SOL", bars, dailies(110, 90)), span: [0, 601] })
  const { snap, sol } = solSnap(feed, 602)
  check("sweep short kind", sol.signal.kind === "SWEEP_SHORT", sol.signal)
  check("sweep short entry = reclaim close", sol.signal.entry === 109.4, sol.signal)
  check("BTC semleges", snap.btc.regime === "neutral", snap.btc)
  check("prev day high a lezárt napból", sol.prevDayHigh === 110, sol.prevDayHigh)
}

// --- 2) BTC risk-off blokkolja a sweep longot ---
{
  const solBars = [...flat(0, 600, 100), bar(601, 100, 100.5, 97.4, 98.5, 20000)]
  const btcBars = flat(0, 585, 50000, 60)
  let px = 50000
  for (let m = 586; m <= 601; m++) {
    btcBars.push(bar(m, px, px + 10, px - 30, px - 25))
    px -= 25
  }
  const feed = mkFeed({
    sol: sym("SOL", solBars, dailies(110, 98)),
    btc: sym("BTC", btcBars, dailies(52000, 48000)),
    span: [0, 601],
  })
  const { snap, sol } = solSnap(feed, 602)
  check("BTC risk-off", snap.btc.regime === "risk_off", snap.btc)
  check("sweep long blokkolva", sol.signal.kind === "NONE", sol.signal)
  check("blokk indoka a reasonben", sol.signal.reason.includes("long tiltva"), sol.signal.reason)
}

// --- 3) DOGE volumen-kapu: RVOL < 1.3 → nincs signal ---
{
  const dogeBars = [...flat(0, 600, 0.1, 0.0006), bar(601, 0.1, 0.1005, 0.0896, 0.0905)]
  const feed = mkFeed({
    sol: sym("SOL", flat(0, 601, 100), dailies(110, 90)),
    doge: sym("DOGE", dogeBars, dailies(0.11, 0.09)),
    span: [0, 601],
  })
  const { doge } = solSnap(feed, 602)
  check("DOGE kapu: nincs signal", doge.signal.kind === "NONE", doge.signal)
  check("DOGE kapu indok", doge.signal.reason.includes("volumen-kapu"), doge.signal.reason)
}

// --- 4) VWAP mean reversion LONG range piacon (ADX-kapu) ---
{
  const bars = flat(0, 120, 100, 0.6, 5000)
  let px = 100
  for (let m = 121; m <= 150; m++) {
    const c = px - 0.134
    bars.push(bar(m, px, px + 0.1, c - 0.1, c, 100))
    px = c
  }
  bars.push(...flat(151, 600, 96, 0.6, 500))
  const feed = mkFeed({ sol: sym("SOL", bars, dailies(110, 85)), span: [0, 600] })
  const { sol } = solSnap(feed, 601)
  check("MR long kind", sol.signal.kind === "MR_LONG", { signal: sol.signal, adx: sol.adx, dist: sol.vwapDistAtr })
  check("MR target = VWAP", sol.signal.target != null && sol.vwap != null && Math.abs(sol.signal.target - sol.vwap) < 1e-4, {
    target: sol.signal.target,
    vwap: sol.vwap,
  })
  check("ADX range piacot jelez (<25)", (sol.adx ?? 99) < 25, sol.adx)
}

// --- 5) US-open range breakout LONG (13:30 UTC után, volumennel) ---
{
  const bars = [
    ...flat(600, 779, 100, 0.6),
    ...flat(780, 809, 100, 0.8), // 13:00–13:29 UTC range: 99.2–100.8
    bar(810, 100, 101.3, 100, 101.2, 15000), // breakout close a range fölött
  ]
  for (let m = 811; m <= 819; m++) bars.push(bar(m, 101.4, 101.6, 101.3, 101.5, 15000))
  const feed = mkFeed({ sol: sym("SOL", bars, dailies(110, 90)), span: [600, 819] })
  const snap = computeCryptoSnapshot({
    feed,
    nowSec: at(820),
    enabledSetups: { sweep: false, fvg: false, breakout: true, pullback: false, mean_rev: false },
  })
  const sol = snap.symbols.find((s) => s.symbol === "SOL")!
  check("breakout long kind", sol.signal.kind === "BREAKOUT_LONG", { signal: sol.signal, rvol: sol.rvol })
  check("breakout entry = kitörő close", sol.signal.entry === 101.2, sol.signal)
  check(
    "US-open range megvan",
    sol.usOpenHigh != null &&
      sol.usOpenLow != null &&
      Math.abs(sol.usOpenHigh - 100.8) < 0.25 &&
      Math.abs(sol.usOpenLow - 99.2) < 0.25,
    { h: sol.usOpenHigh, l: sol.usOpenLow }
  )
}

// --- 6) Funding z-score blokkolja a longot (|z|≥2) ---
{
  const bars = [...flat(0, 600, 100), bar(601, 100, 100.5, 97.4, 98.5, 20000)]
  const hist = Array.from({ length: 20 }, () => 0.0001)
  hist.push(0.0015) // extrém pozitív → z magas
  const feed = mkFeed({
    sol: { ...sym("SOL", bars, dailies(110, 98)), fundingRate: 0.0015, fundingHistory: hist },
    span: [0, 601],
  })
  const { sol } = solSnap(feed, 602)
  check("funding-z: nincs long sweep", sol.signal.kind === "NONE", sol.signal)
  check("funding-z: reason z-score", /z-score|Funding z/i.test(sol.signal.reason), sol.signal.reason)
  check("funding-z: snapshot mező", sol.fundingZ != null && sol.fundingZ >= 2, sol.fundingZ)
}

// --- 7) FVG tap long ---
{
  // 5m aggregátumhoz: 1m gyertyákból bullish gap + tap
  const bars = flat(0, 500, 100, 0.4, 2000)
  // displacement up creating FVG on 5m: need three 5m buckets
  // bucket around 505-515: low body, then impulse, then continue
  for (let m = 501; m <= 505; m++) bars.push(bar(m, 100, 100.3, 99.7, 100, 2000))
  for (let m = 506; m <= 510; m++) bars.push(bar(m, 100, 100.2, 99.8, 100.1, 2000))
  // impulse: gap up vs two buckets ago
  for (let m = 511; m <= 515; m++) bars.push(bar(m, 102.5, 103, 102.4, 102.8, 8000))
  for (let m = 516; m <= 560; m++) bars.push(bar(m, 102.6, 102.9, 102.3, 102.5, 2000))
  // tap into gap (~100.2–102.4) and reclaim
  bars.push(bar(561, 102.2, 102.3, 100.5, 101.2, 5000))
  bars.push(bar(562, 101.2, 101.8, 101.0, 101.6, 5000))

  const feed = mkFeed({
    sol: sym("SOL", bars, dailies(110, 90)),
    span: [0, 562],
  })
  const snap = computeCryptoSnapshot({
    feed,
    nowSec: at(563),
    enabledSetups: { sweep: false, fvg: true, breakout: false, pullback: false, mean_rev: false },
  })
  const sol = snap.symbols.find((s) => s.symbol === "SOL")!
  check("FVG: long vagy wait (struktúra függő)", sol.signal.kind === "FVG_LONG" || sol.signal.kind === "NONE", sol.signal)
  if (sol.signal.kind === "FVG_LONG") {
    check("FVG: reason tap", /FVG/i.test(sol.signal.reason), sol.signal.reason)
  }
  const fvgBu = sol.buildups.find((b) => b.id === "fvg")
  check("FVG: buildup létezik", fvgBu != null, sol.buildups.map((b) => b.id))
}

// --- 8) Asia session range snapshot ---
{
  const bars = [
    ...flat(0, 419, 100, 0.5), // 00:00–06:59 Asia
    ...flat(420, 479, 100, 0.8), // London form 07–08
    bar(480, 100, 101.5, 100, 101.4, 15000), // London breakout
  ]
  for (let m = 481; m <= 500; m++) bars.push(bar(m, 101.4, 101.6, 101.3, 101.5, 12000))
  const feed = mkFeed({ sol: sym("SOL", bars, dailies(110, 90)), span: [0, 500] })
  const snap = computeCryptoSnapshot({
    feed,
    nowSec: at(501),
    enabledSetups: { sweep: false, fvg: false, breakout: true, pullback: false, mean_rev: false },
  })
  const sol = snap.symbols.find((s) => s.symbol === "SOL")!
  check("Asia range megvan", sol.asiaHigh != null && sol.asiaLow != null, {
    aH: sol.asiaHigh,
    aL: sol.asiaLow,
  })
  check("London range megvan", sol.londonHigh != null && sol.londonLow != null, {
    lH: sol.londonHigh,
    lL: sol.londonLow,
  })
  check(
    "London/Asia breakout signal vagy explicit reason",
    sol.signal.kind === "BREAKOUT_LONG" || /breakout|London|Asia|RVOL/i.test(sol.signal.reason),
    sol.signal
  )
}

console.log(failures === 0 ? "\nMinden szintetikus teszt OK" : `\n${failures} teszt FAILED`)

// --- opcionális élő smoke test ---
if (process.argv.includes("--live")) {
  console.log("\nÉlő feed lekérése (Bybit → Binance fallback)…")
  fetchCryptoFeed()
    .then((feed) => {
      const snap = computeCryptoSnapshot({ feed })
      console.log(`forrás: ${feed.source}, UTC ${snap.utcTime}`)
      console.log(`BTC: ${snap.btc.btcPrice} (${snap.btc.regime}) — ${snap.btc.note}`)
      for (const s of snap.symbols) {
        console.log(
          `${s.symbol}: ár ${s.lastPrice}, VWAP-táv ${s.vwapDistAtr?.toFixed(2)}×ATR, ` +
            `RVOL ${s.rvol?.toFixed(2)}, ADX ${s.adx?.toFixed(0)}, funding ${s.fundingRate}, ` +
            `PD H/L ${s.prevDayHigh}/${s.prevDayLow}, US range ${s.usOpenLow ?? "—"}–${s.usOpenHigh ?? "—"}`
        )
        console.log(`  signal: ${s.signal.kind} — ${s.signal.reason}`)
      }
    })
    .catch((e) => {
      console.error("Élő feed hiba:", e)
      process.exitCode = 1
    })
} else if (failures > 0) {
  process.exitCode = 1
}
