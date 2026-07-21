'use client'

import { useEffect, useState } from 'react'
import Script from 'next/script'
import {
  COOKIE_CONSENT_EVENT,
  GA_MEASUREMENT_ID,
  hasAnalyticsConsent
} from '@/lib/analytics'

/**
 * Loads GA4 (gtag) only after cookie consent is accepted.
 * Measurement ID: G-TFY51HJF8J (override with NEXT_PUBLIC_GA_ID).
 */
export default function GoogleAnalytics() {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    setEnabled(hasAnalyticsConsent())

    const onConsent = (event: Event) => {
      const detail = (event as CustomEvent<{ accepted?: boolean }>).detail
      setEnabled(Boolean(detail?.accepted) || hasAnalyticsConsent())
    }

    window.addEventListener(COOKIE_CONSENT_EVENT, onConsent)
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, onConsent)
  }, [])

  if (!enabled || !GA_MEASUREMENT_ID) return null

  return (
    <>
      <Script
        id="ga-gtag-js"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga-gtag-config" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', {
            anonymize_ip: true,
            send_page_view: true
          });
        `}
      </Script>
    </>
  )
}
