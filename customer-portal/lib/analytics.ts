export const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_ID || 'G-TFY51HJF8J'

export const COOKIE_CONSENT_KEY = 'turinova_cookie_consent'
export const COOKIE_CONSENT_EVENT = 'turinova-cookie-consent'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

export function hasAnalyticsConsent(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(COOKIE_CONSENT_KEY) === 'true'
}

export function notifyCookieConsent(accepted: boolean) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(COOKIE_CONSENT_EVENT, { detail: { accepted } })
  )
}

/** Fire a GA4 event when gtag is available (queues via dataLayer otherwise). */
export function analyticsEvent(name: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  if (typeof window.gtag === 'function') {
    window.gtag('event', name, params)
    return
  }
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push(['event', name, params])
}
