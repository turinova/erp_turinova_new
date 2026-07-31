/**
 * Gyors engine-teszt CLI-ből (nem megy production buildbe):
 *   npx -y tsx scripts/test-backtest.ts
 */
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { runBacktest } from "../src/lib/backtest/engine"
import { DEFAULT_CONFIG, type BarFile } from "../src/lib/backtest/types"

async function main() {
  const raw = await readFile(join(process.cwd(), "data", "bars-NQ-5m.json"), "utf-8")
  const barFile = JSON.parse(raw) as BarFile

  for (const label of ["filterek BE", "filterek KI"]) {
    const config = {
      ...DEFAULT_CONFIG,
      volumeFilter: label === "filterek BE",
      vwapFilter: label === "filterek BE",
    }
    const r = runBacktest(barFile, config)
    console.log(`\n=== ${label} · ${r.sessionCount} session (${r.firstDate} → ${r.lastDate}) ===`)
    for (const s of [...r.perStrategy, r.combined]) {
      console.log(
        `${String(s.strategy).padEnd(22)} trades:${String(s.trades).padStart(3)}  ` +
          `win%:${s.winRate.toFixed(0).padStart(3)}  netR:${s.netR.toFixed(1).padStart(7)}  ` +
          `avgR:${s.avgR.toFixed(2).padStart(6)}  PF:${s.profitFactor ?? "—"}  maxDD:${s.maxDrawdownR}`
      )
    }
  }
}

main()
