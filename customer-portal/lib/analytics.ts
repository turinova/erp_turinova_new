export const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_ID || 'G-TFY51HJF8J'

export const COOKIE_CONSENT_KEY = 'turinova_cookie_consent'
export const COOKIE_CONSENT_EVENT = 'turinova-cookie-consent'

type ConsentValue = 'granted' | 'denied'

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

/** Update GA4 Consent Mode after cookie banner choice. */
export function gtagConsentUpdate(accepted: boolean) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  const value: ConsentValue = accepted ? 'granted' : 'denied'
  window.gtag('consent', 'update', {
    analytics_storage: value,
    ad_storage: value,
    ad_user_data: value,
    ad_personalization: value
  })
}

export function analyticsEvent(name: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  window.gtag('event', name, {
    send_to: GA_MEASUREMENT_ID,
    ...params
  })
}

function waitForGtag(timeoutMs: number): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false)
  if (typeof window.gtag === 'function') return Promise.resolve(true)

  return new Promise(resolve => {
    const started = Date.now()
    const tick = () => {
      if (typeof window.gtag === 'function') {
        resolve(true)
        return
      }
      if (Date.now() - started >= timeoutMs) {
        resolve(false)
        return
      }
      window.setTimeout(tick, 50)
    }
    tick()
  })
}

/**
 * Fire sign_up and wait until GA acknowledges (or timeout).
 * Requires cookie consent; uses Consent Mode + send_to.
 */
export async function trackSignUpAndWait(timeoutMs = 2500): Promise<void> {
  if (typeof window === 'undefined') return
  if (!hasAnalyticsConsent()) {
    console.warn('[GA4] sign_up skipped: cookie consent not granted')
    return
  }

  const ready = await waitForGtag(timeoutMs)
  if (!ready || typeof window.gtag !== 'function') {
    console.warn('[GA4] sign_up skipped: gtag not ready')
    return
  }

  // Ensure storage is granted right before conversion (Consent Mode)
  gtagConsentUpdate(true)

  await new Promise<void>(resolve => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      resolve()
    }

    const timer = window.setTimeout(finish, timeoutMs)

    try {
      window.gtag('event', 'sign_up', {
        method: 'email',
        send_to: GA_MEASUREMENT_ID,
        event_callback: () => {
          window.clearTimeout(timer)
          finish()
        },
        event_timeout: timeoutMs
      })
    } catch (err) {
      console.warn('[GA4] sign_up error', err)
      window.clearTimeout(timer)
      finish()
    }
  })
}
