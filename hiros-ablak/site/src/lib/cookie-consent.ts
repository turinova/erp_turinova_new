export const COOKIE_CONSENT_STORAGE_KEY = "hirosablak_cookie_consent"

export type CookieConsent = {
  necessary: true
  statistics: boolean
  marketing: boolean
  ts: number
}

export function createCookieConsent(
  statistics: boolean,
  marketing: boolean
): CookieConsent {
  return {
    necessary: true,
    statistics,
    marketing,
    ts: Date.now(),
  }
}

export function parseStoredConsent(raw: string | null): CookieConsent | null {
  if (!raw) return null
  try {
    const data = JSON.parse(raw) as Partial<CookieConsent>
    if (data.necessary !== true) return null
    return {
      necessary: true,
      statistics: Boolean(data.statistics),
      marketing: Boolean(data.marketing),
      ts: typeof data.ts === "number" ? data.ts : Date.now(),
    }
  } catch {
    return null
  }
}

export function readCookieConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null
  return parseStoredConsent(localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY))
}

export function writeCookieConsent(consent: CookieConsent): void {
  if (typeof window === "undefined") return
  localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(consent))
}
