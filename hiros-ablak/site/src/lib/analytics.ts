export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID
export const CLARITY_PROJECT_ID = process.env.NEXT_PUBLIC_CLARITY_ID

type ConsentValue = "granted" | "denied"

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (
      command: "consent" | "config" | "event" | "js",
      target: string | Date,
      params?: Record<string, unknown>,
    ) => void
    clarity?: (command: string, ...params: unknown[]) => void
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

export function analyticsEvent(name: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined" || !window.gtag) return
  window.gtag("event", name, params)
}
