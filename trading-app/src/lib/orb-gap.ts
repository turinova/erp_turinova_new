/**
 * ORB gap-alignment filter.
 *
 * Historikus NQ 5m A/B (49 session, 2026-05-20→07-30, VWAP+RVOL≥1.2+min20):
 *   gap-irányba: n=7, win 71%, netR +0.8, avgR +0.11, PF 1.66
 *   gap ellen:   n=5, win 40%, netR −1.8, avgR −0.37
 * ATR sáv / retest / first-bar / RVOL≥1.5 ugyanezen mintán NEM javított —
 * ezért csak ez a filter került be.
 */

/** |gap| ≤ ennyi pont → "flat", mindkét ORB irány élhet */
export const GAP_FLAT_POINTS = 10

export type GapDir = "up" | "down" | "flat"

export function gapDirection(
  gapPts: number | null,
  flatPts = GAP_FLAT_POINTS
): GapDir | null {
  if (gapPts == null || !Number.isFinite(gapPts)) return null
  if (gapPts > flatPts) return "up"
  if (gapPts < -flatPts) return "down"
  return "flat"
}

/** true = ORB kitörés a gap ellen megy → tiltandó */
export function gapBlocksOrb(
  gapDir: GapDir | null,
  breakout: "up" | "down" | "long" | "short"
): boolean {
  if (gapDir == null || gapDir === "flat") return false
  const orbUp = breakout === "up" || breakout === "long"
  if (gapDir === "up" && !orbUp) return true
  if (gapDir === "down" && orbUp) return true
  return false
}

export function formatGapReason(gapPts: number, gapDir: GapDir): string {
  const pts = Math.abs(gapPts).toFixed(1)
  if (gapDir === "flat") return `Gap flat (±${pts} pont) — mindkét ORB irány élhet`
  return `Gap ${gapDir === "up" ? "fel" : "le"} ${pts} pont — ORB csak gap-iránnyal`
}
