/**
 * Gap-alignment egységteszt + ORB A/B smoke:
 *   npx -y tsx scripts/test-orb-gap.ts
 */
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { runBacktest } from "../src/lib/backtest/engine"
import { DEFAULT_CONFIG, type BarFile } from "../src/lib/backtest/types"
import {
  gapBlocksOrb,
  gapDirection,
  GAP_FLAT_POINTS,
} from "../src/lib/orb-gap"

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

async function main() {
  assert(gapDirection(null) === null, "null gap")
  assert(gapDirection(0) === "flat", "zero flat")
  assert(gapDirection(GAP_FLAT_POINTS) === "flat", "edge flat")
  assert(gapDirection(GAP_FLAT_POINTS + 0.1) === "up", "up")
  assert(gapDirection(-(GAP_FLAT_POINTS + 0.1)) === "down", "down")
  assert(!gapBlocksOrb("flat", "long"), "flat allows long")
  assert(!gapBlocksOrb("up", "long"), "up allows long")
  assert(gapBlocksOrb("up", "short"), "up blocks short")
  assert(gapBlocksOrb("down", "long"), "down blocks long")
  assert(!gapBlocksOrb("down", "short"), "down allows short")
  console.log("unit OK")

  const raw = await readFile(join(process.cwd(), "data", "bars-NQ-5m.json"), "utf-8")
  const barFile = JSON.parse(raw) as BarFile
  const withGap = runBacktest(barFile, {
    ...DEFAULT_CONFIG,
    strategies: ["orb"],
    gapFilter: true,
  })
  const noGap = runBacktest(barFile, {
    ...DEFAULT_CONFIG,
    strategies: ["orb"],
    gapFilter: false,
  })
  const orbG = withGap.combined
  const orbN = noGap.combined
  console.log(
    `ORB gap ON:  n=${orbG.trades} win%=${orbG.winRate.toFixed(0)} netR=${orbG.netR} avgR=${orbG.avgR} PF=${orbG.profitFactor}`
  )
  console.log(
    `ORB gap OFF: n=${orbN.trades} win%=${orbN.winRate.toFixed(0)} netR=${orbN.netR} avgR=${orbN.avgR} PF=${orbN.profitFactor}`
  )
  assert(orbG.trades < orbN.trades, "gap filter should reduce trade count")
  assert(orbG.netR > orbN.netR, "gap filter should improve ORB netR on this sample")
  console.log("A/B OK — gap filter improves ORB netR on current bars")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
