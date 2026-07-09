/**
 * Egyszerű in-memory PIN-lockout a publikus token-es végpontokhoz:
 * 3 hibás kód → 15 perc zárolás tokenenként.
 * (Serverless környezetben példányonkénti — későbbi iteráció: DB-alapú.)
 */
const MAX_ATTEMPTS = 3
const LOCKOUT_MS = 15 * 60 * 1000

type Entry = { fails: number; lockedUntil: number }

const attempts = new Map<string, Entry>()

export function isPinLocked(token: string): boolean {
  const e = attempts.get(token)
  if (!e) return false
  if (e.lockedUntil > Date.now()) return true
  if (e.lockedUntil > 0) attempts.delete(token)
  return false
}

export function recordPinFailure(token: string): void {
  const e = attempts.get(token) ?? { fails: 0, lockedUntil: 0 }
  e.fails += 1
  if (e.fails >= MAX_ATTEMPTS) {
    e.lockedUntil = Date.now() + LOCKOUT_MS
    e.fails = 0
  }
  attempts.set(token, e)
}

export function clearPinFailures(token: string): void {
  attempts.delete(token)
}
