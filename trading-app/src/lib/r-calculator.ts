/**
 * R-multiple: (exit - entry) / (entry - stop).
 * Long és short irányra is helyes előjelet ad, mert shortnál
 * az (entry - stop) negatív.
 */
export function computeR(
  entry: number | null,
  stop: number | null,
  exit: number | null
): number | null {
  if (entry == null || stop == null || exit == null) return null
  const risk = entry - stop
  if (risk === 0) return null
  return Math.round(((exit - entry) / risk) * 100) / 100
}

/** MNQ: 1 pont = 2 USD, tick = 0.25 pont (0.50 USD) */
export const MNQ_POINT_VALUE = 2

export function riskInUsd(entry: number, stop: number, contracts = 1): number {
  return Math.abs(entry - stop) * MNQ_POINT_VALUE * contracts
}

/** Hány kontrakt fér bele a kockázati keretbe az adott stop-távval. */
export function positionSize(
  accountSize: number,
  riskPerTradePct: number,
  entry: number,
  stop: number
): number {
  const budget = accountSize * (riskPerTradePct / 100)
  const perContract = riskInUsd(entry, stop, 1)
  if (perContract === 0) return 0
  return Math.floor(budget / perContract)
}
