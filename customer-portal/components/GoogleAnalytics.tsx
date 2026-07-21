'use client'

import { useEffect } from 'react'
import Script from 'next/script'
import {
  COOKIE_CONSENT_EVENT,
  GA_MEASUREMENT_ID,
  gtagConsentUpdate,
  hasAnalyticsConsent
} from '@/lib/analytics'

/**
 * Always loads GA4 with Consent Mode default denied.
 * Cookie accept → consent update granted (same pattern as hiros-ablak).
 */
export default function GoogleAnalytics() {
  useEffect(() => {
    if (hasAnalyticsConsent()) {
      gtagConsentUpdate(true)
    }

    const onConsent = (event: Event) => {
      const detail = (event as CustomEvent<{ accepted?: boolean }>).detail
      gtagConsentUpdate(Boolean(detail?.accepted))
    }

    window.addEventListener(COOKIE_CONSENT_EVENT, onConsent)
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, onConsent)
  }, [])

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
        id="ga-gtag-js"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
    </>
  )
}
