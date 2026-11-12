export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID
export const CLARITY_PROJECT_ID = process.env.NEXT_PUBLIC_CLARITY_ID
export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID

type ConsentValue = "granted" | "denied"

export type UtmParams = {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
}

const UTM_STORAGE_KEY = "hiros_utm_v1"

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (
      command: "consent" | "config" | "event" | "js",
      target: string | Date,
      params?: Record<string, unknown>,
    ) => void
    clarity?: (command: string, ...params: unknown[]) => void
    fbq?: (
      command: "init" | "track" | "trackCustom" | "consent",
      eventOrPixelId: string,
      params?: Record<string, unknown>,
    ) => void
    _fbq?: unknown
  }
}

export function gtagConsentUpdate(statistics: boolean, marketing: boolean) {
  if (typeof window === "undefined" || !window.gtag) return

  const analyticsStorage: ConsentValue = statistics ? "granted" : "denied"
  const marketingStorage: ConsentValue = marketing ? "granted" : "denied"

  window.gtag("consent", "update", {
    analytics_storage: analyticsStorage,
    ad_storage: marketingStorage,
    ad_user_data: marketingStorage,
    ad_personalization: marketingStorage,
  })
}

export function metaPixelConsentUpdate(marketing: boolean) {
  if (typeof window === "undefined" || !window.fbq) return
  window.fbq("consent", marketing ? "grant" : "revoke")
}

export function analyticsEvent(name: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined" || !window.gtag) return
  window.gtag("event", name, params)
}

export function metaTrack(
  event: string,
  params?: Record<string, unknown>,
  standard = true,
) {
  if (typeof window === "undefined" || !window.fbq || !META_PIXEL_ID) return
  if (standard) {
    window.fbq("track", event, params)
  } else {
    window.fbq("trackCustom", event, params)
  }
}

/** Capture UTM from the URL once, keep for the session (FB → apply). */
export function captureAndStoreUtm(): UtmParams {
  if (typeof window === "undefined") return {}
  try {
    const url = new URL(window.location.href)
    const next: UtmParams = {}
    for (const key of [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
    ] as const) {
      const v = url.searchParams.get(key)?.trim()
      if (v) next[key] = v.slice(0, 120)
    }
    if (Object.keys(next).length > 0) {
      sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(next))
      return next
    }
    const raw = sessionStorage.getItem(UTM_STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as UtmParams
  } catch {
    return {}
  }
}

export function readStoredUtm(): UtmParams {
  if (typeof window === "undefined") return {}
  try {
    const raw = sessionStorage.getItem(UTM_STORAGE_KEY)
    if (!raw) return captureAndStoreUtm()
    return JSON.parse(raw) as UtmParams
  } catch {
    return {}
  }
}

export function trackCareerJobView(jobSlug: string) {
  const utm = captureAndStoreUtm()
  const params = { job_slug: jobSlug, ...utm }
  analyticsEvent("job_view", params)
  metaTrack("ViewContent", {
    content_name: jobSlug,
    content_category: "career",
  })
}

export function trackCareerApplyStart(jobSlug: string, step: number) {
  const utm = readStoredUtm()
  const params = { job_slug: jobSlug, step, ...utm }
  analyticsEvent("apply_start", params)
  metaTrack("InitiateCheckout", {
    content_name: jobSlug,
    content_category: "career",
  })
}

export function trackCareerApplyStep(
  jobSlug: string,
  step: number,
  extra?: Record<string, unknown>,
) {
  const utm = readStoredUtm()
  analyticsEvent("apply_step", {
    job_slug: jobSlug,
    step,
    ...extra,
    ...utm,
  })
  metaTrack(
    "CareerApplyStep",
    { job_slug: jobSlug, step, ...extra },
    false,
  )
}

export function trackCareerApplySubmit(
  jobSlug: string,
  fit: "yes" | "no",
) {
  const utm = readStoredUtm()
  const params = { job_slug: jobSlug, fit, ...utm }
  analyticsEvent("apply_submit", params)
  analyticsEvent("generate_lead", {
    currency: "HUF",
    value: 1,
    ...params,
  })
  metaTrack("Lead", {
    content_name: jobSlug,
    content_category: "career",
    status: fit === "yes" ? "fit" : "not_fit",
  })
}

export function trackCareerApplyFail(jobSlug: string, reason: string) {
  analyticsEvent("apply_fail", { job_slug: jobSlug, reason })
  metaTrack("CareerApplyFail", { job_slug: jobSlug, reason }, false)
}
