/**
 * Élő pipeline gyorsteszt: Yahoo 1m fetch → snapshot számítás → kiírás.
 * Futtatás: npx tsx scripts/test-live.ts
 */
import { fetchLiveBars } from "../src/lib/live/fetch-live"
import { computeLiveSnapshot } from "../src/lib/live/compute"
import { loadBars } from "../src/lib/backtest/load-bars"

async function main() {
  const [feed, history] = await Promise.all([fetchLiveBars(), loadBars()])
  console.log(`Feed: ${feed.symbol}, ${feed.bars.length} db 1m gyertya`)

  // opcionális szimulált időpont: npx tsx scripts/test-live.ts 2026-07-30T14:30:00Z
  const atArg = process.argv[2]
  const nowSec = atArg ? Math.floor(new Date(atArg).getTime() / 1000) : undefined

  const snap = computeLiveSnapshot({
    feed,
    history,
    orbMinutes: 15,
    accountSize: 5000,
    riskPerTradePct: 1,
    cutoffHourEt: 16,
    nowSec,
  })

  console.log("--- SNAPSHOT ---")
  console.log("Státusz:      ", snap.status, `(${snap.etDate} ${snap.etTime} ET)`)
  console.log("Chart gyertyák:", snap.bars.length)
  console.log("ORB:          ", snap.orbLocked ? `${snap.orbHigh} / ${snap.orbLow}` : "még nem rögzült")
  console.log("Overnight H/L:", snap.overnightHigh, "/", snap.overnightLow)
  console.log("Utolsó ár:    ", snap.lastPrice, `(${snap.lastBarEt} ET)`)
  console.log("VWAP:         ", snap.vwap, `(${snap.vwapSide})`)
  console.log("RVOL:         ", snap.rvol)
  console.log("Signal:       ", snap.signal.kind, "—", snap.signal.reason)
  if (snap.signal.entry != null) {
    console.log(
      `  entry ${snap.signal.entry} | stop ${snap.signal.stop} | t1.5 ${snap.signal.target15} | t2 ${snap.signal.target20} | méret ${snap.signal.contracts} MNQ`
    )
  }
  console.log("Megjegyzés:   ", snap.dataNote)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
