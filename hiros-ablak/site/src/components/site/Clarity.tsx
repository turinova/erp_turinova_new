"use client"

import Script from "next/script"
import { useEffect } from "react"
import { CLARITY_PROJECT_ID } from "@/lib/analytics"
import { useCookieConsent } from "./CookieConsentProvider"

export function Clarity() {
  const { consent } = useCookieConsent()
  const statisticsAllowed = Boolean(consent?.statistics)

  useEffect(() => {
    if (typeof window === "undefined" || !window.clarity) return
    window.clarity("consent", statisticsAllowed)
  }, [statisticsAllowed])

  if (!CLARITY_PROJECT_ID || !statisticsAllowed) return null

  return (
    <Script id="ms-clarity" strategy="afterInteractive">
      {`
        (function(c,l,a,r,i,t,y){
          c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
          t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
          y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
        })(window, document, "clarity", "script", "${CLARITY_PROJECT_ID}");
      `}
    </Script>
  )
}
