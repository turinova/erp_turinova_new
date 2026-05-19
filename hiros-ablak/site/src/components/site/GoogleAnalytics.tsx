"use client"

import Script from "next/script"
import { useEffect } from "react"
import { GA_MEASUREMENT_ID, gtagConsentUpdate } from "@/lib/analytics"
import { useCookieConsent } from "./CookieConsentProvider"

export function GoogleAnalytics() {
  const { consent } = useCookieConsent()

  useEffect(() => {
    if (!consent) return
    gtagConsentUpdate(consent.statistics, consent.marketing)
  }, [consent])

  if (!GA_MEASUREMENT_ID) return null

  return (
    <>
      <Script id="ga-consent-default" strategy="beforeInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('consent', 'default', {
            analytics_storage: 'denied',
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
            wait_for_update: 500
          });
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', {
            anonymize_ip: true,
            send_page_view: true
          });
        `}
      </Script>
      <Script
        id="ga-script"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
    </>
  )
}
