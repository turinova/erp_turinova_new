/**
 * Funding settlement ablak: Bybit/Binance perp jellemzően 00:00 / 08:00 / 16:00 UTC.
 * ±FREEZE_MIN percben nincs új entry (zaj + likvidáció-hullám).
 */

export const SETTLEMENT_HOURS_UTC = [0, 8, 16] as const
export const SETTLEMENT_FREEZE_MIN = 10

export interface SettlementInfo {
  nextUtc: string
  minutesLeft: number
  inFreeze: boolean
}

export function getSettlementInfo(nowSec?: number): SettlementInfo {
  const now = nowSec != null ? new Date(nowSec * 1000) : new Date()
  const utcMin = now.getUTCHours() * 60 + now.getUTCMinutes() + now.getUTCSeconds() / 60

  let bestDist = Infinity
  let nextHour = 0
  let minutesLeft = 0

  for (const h of SETTLEMENT_HOURS_UTC) {
    const settleMin = h * 60
    // távolság a legközelebbi settlementhez (előre és hátra a freeze miatt)
    let forward = settleMin - utcMin
    if (forward < 0) forward += 24 * 60
    if (forward < bestDist) {
      bestDist = forward
      nextHour = h
      minutesLeft = forward
    }
  }

  // freeze: settlement előtt vagy után FREEZE_MIN percen belül
  let inFreeze = false
  let freezeHour: number | null = null
  for (const h of SETTLEMENT_HOURS_UTC) {
    const settleMin = h * 60
    let dist = Math.abs(utcMin - settleMin)
    dist = Math.min(dist, 24 * 60 - dist)
    if (dist <= SETTLEMENT_FREEZE_MIN) {
      inFreeze = true
      freezeHour = h
      break
    }
  }

  const labelHour = freezeHour ?? nextHour
  const nextUtc = `${String(labelHour).padStart(2, "0")}:00`
  return {
    nextUtc,
    minutesLeft: Math.round(minutesLeft),
    inFreeze,
  }
}
