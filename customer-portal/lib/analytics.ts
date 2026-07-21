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

function ensureGtagStub() {
  if (typeof window === 'undefined') return
  window.dataLayer = window.dataLayer || []
  if (typeof window.gtag !== 'function') {
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer!.push(args)
    }
  }
}

/** Fire a GA4 event when gtag is available (queues via dataLayer otherwise). */
export function analyticsEvent(name: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  ensureGtagStub()
  window.gtag!('event', name, params)
}

/**
 * Fire sign_up and wait until GA acknowledges (or timeout).
 * Prevents SPA redirect from cancelling the conversion hit.
 */
export function trackSignUpAndWait(timeoutMs = 2000): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (!hasAnalyticsConsent()) return Promise.resolve()

  ensureGtagStub()

  return new Promise(resolve => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      resolve()
    }

    const timer = window.setTimeout(finish, timeoutMs)

    try {
      window.gtag!('event', 'sign_up', {
        method: 'email',
        event_callback: () => {
          window.clearTimeout(timer)
          finish()
        },
        event_timeout: timeoutMs
      })
    } catch {
      window.clearTimeout(timer)
      finish()
    }
  })
}
