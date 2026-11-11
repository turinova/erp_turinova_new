/**
 * Nettó-első ÁFA bontás (Számlázz.hu 260):
 * áfa = kerekít(nettó × kulcs / 100), bruttó = nettó + áfa.
 * A bruttó a forrásigazság; a nettót úgy keressük, hogy ez a szabály teljesüljön.
 */

const STANDARD_VAT_PERCENTS = [0, 5, 18, 27] as const

export function roundHalfAwayFromZero(x: number): number {
  const sign = x < 0 ? -1 : 1
  return sign * Math.floor(Math.abs(x) + 0.5 + 1e-9)
}

export function normalizeVatPercent(raw: unknown, fallback = 27): number {
  const n = Number(raw)
  if (raw == null || raw === '' || !Number.isFinite(n)) return fallback
  return Math.round(Math.abs(n) * 100) / 100
}

export function vatFromNet(net: number, vatPercent: number): number {
  if (vatPercent === 0 || net === 0) return 0
  return roundHalfAwayFromZero((net * vatPercent) / 100)
}

/** Számlázz ellenőrzés: az ÁFA a nettó × kulcs egy érvényes kerekítése. */
export function isValidVatForNet(
  net: number,
  vat: number,
  vatPercent: number
): boolean {
  return Math.abs(vat - (net * vatPercent) / 100) <= 0.5 + 1e-9
}

/** Az a nettó, amelyre nettó + áfa(nettó) pontosan a bruttó; ha nincs ilyen: null. */
export function exactNetForGross(
  gross: number,
  vatPercent: number
): number | null {
  if (!Number.isInteger(gross)) return null
  if (vatPercent === 0 || gross === 0) return gross
  const sign = gross < 0 ? -1 : 1
  const g = Math.abs(gross)
  const base = Math.round(g / (1 + vatPercent / 100))
  for (let n = Math.max(0, base - 2); n <= base + 2; n++) {
    if (n + vatFromNet(n, vatPercent) === g) return sign * n
  }
  return null
}

export function isNetFirstReachable(gross: number, vatPercent: number): boolean {
  return exactNetForGross(gross, vatPercent) != null
}

/**
 * Megjelenítési bontás: nettó + áfa = bruttó mindig.
 * `exact` = a Számlázz-szabály is teljesül (a bruttók ~79%-ánál 27%-on).
 */
export function splitGross(
  grossRaw: number,
  vatPercent: number
): { net: number; vat: number; gross: number; exact: boolean } {
  const gross = roundHalfAwayFromZero(grossRaw)
  const exactNet = exactNetForGross(gross, vatPercent)
  if (exactNet != null) {
    return { net: exactNet, vat: gross - exactNet, gross, exact: true }
  }
  const net = roundHalfAwayFromZero(gross / (1 + vatPercent / 100))
  return { net, vat: gross - net, gross, exact: false }
}

/**
 * ÁFA kulcs a tárolt nettó/bruttó párból (szabás, él, megmunkálás sorokhoz,
 * ahol a kulcs nincs külön mentve). Kis összegnél a fallback nyer.
 */
export function inferVatPercent(
  net: number,
  gross: number,
  fallback: number
): number {
  const n = Math.abs(Number(net) || 0)
  const g = Math.abs(Number(gross) || 0)
  if (n < 500 || g < n) return fallback
  const raw = ((g - n) / n) * 100
  for (const p of STANDARD_VAT_PERCENTS) {
    if (Math.abs(raw - p) <= 0.6) return p
  }
  return fallback
}
