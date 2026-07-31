import type { VwapSide } from "./types"

export type OrbSignal = "LONG_VALID" | "SHORT_VALID" | "SKIP"

export interface OrbSignalResult {
  signal: OrbSignal
  reason: string
  stop: number | null
  target15: number | null
  target20: number | null
}

interface OrbInput {
  orbHigh: number
  orbLow: number
  price: number
  vwapSide: VwapSide
  volumeConfirmed: boolean
}

/**
 * ORB döntési logika (Fázis 1, kézi inputokból):
 * long csak ORB high felett + VWAP felett + volume megerősítéssel,
 * short tükörben. Minden más: skip.
 */
export function getOrbSignal({
  orbHigh,
  orbLow,
  price,
  vwapSide,
  volumeConfirmed,
}: OrbInput): OrbSignalResult {
  const range = orbHigh - orbLow

  if (range <= 0) {
    return {
      signal: "SKIP",
      reason: "Érvénytelen ORB range (high ≤ low).",
      stop: null,
      target15: null,
      target20: null,
    }
  }

  if (price > orbHigh) {
    if (vwapSide !== "above") {
      return skip("Ár az ORB high felett, de nincs VWAP-egyezés (ár nincs VWAP felett).")
    }
    if (!volumeConfirmed) {
      return skip("Breakout VWAP-egyezéssel, de nincs volume megerősítés (RVOL < 1.2).")
    }
    const risk = price - orbLow
    return {
      signal: "LONG_VALID",
      reason: "Ár az ORB high felett, VWAP felett, volume OK.",
      stop: orbLow,
      target15: round2(price + 1.5 * risk),
      target20: round2(price + 2 * risk),
    }
  }

  if (price < orbLow) {
    if (vwapSide !== "below") {
      return skip("Ár az ORB low alatt, de nincs VWAP-egyezés (ár nincs VWAP alatt).")
    }
    if (!volumeConfirmed) {
      return skip("Breakdown VWAP-egyezéssel, de nincs volume megerősítés (RVOL < 1.2).")
    }
    const risk = orbHigh - price
    return {
      signal: "SHORT_VALID",
      reason: "Ár az ORB low alatt, VWAP alatt, volume OK.",
      stop: orbHigh,
      target15: round2(price - 1.5 * risk),
      target20: round2(price - 2 * risk),
    }
  }

  return skip("Ár az ORB range-en belül — nincs breakout.")
}

function skip(reason: string): OrbSignalResult {
  return { signal: "SKIP", reason, stop: null, target15: null, target20: null }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
