"use client"

import { useEffect, useRef } from "react"
import { useCookieConsent } from "./CookieConsentProvider"
import { CookieSettingsLink } from "./CookieBanner"

/**
 * Trustindex review widget — loads only after marketing cookie consent.
 */
export function TrustindexWidget({
  widgetId,
  className,
  minHeight = 360,
}: {
  widgetId: string
  className?: string
  minHeight?: number
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const { consent, hasDecided } = useCookieConsent()
  const marketingAllowed = Boolean(consent?.marketing)

  useEffect(() => {
    const host = hostRef.current
    if (!host || !marketingAllowed) return

    host.innerHTML = ""
    if (host.querySelector("script[data-trustindex-loader]")) return

    const script = document.createElement("script")
    script.src = `https://cdn.trustindex.io/loader.js?${widgetId}`
    script.async = true
    script.defer = true
    script.dataset.trustindexLoader = "true"
    host.appendChild(script)

    return () => {
      host.innerHTML = ""
    }
  }, [widgetId, marketingAllowed])

  if (!hasDecided) {
    return (
      <div
        className={`flex items-center justify-center rounded-2xl border border-dashed border-black/15 bg-stone-50/80 px-6 text-center text-sm text-black/60 ${className ?? ""}`}
        style={{ minHeight }}
        aria-label="Vélemények"
      >
        A vélemények megjelenítéséhez válasszon a süti beállítások közül.
      </div>
    )
  }

  if (!marketingAllowed) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-black/15 bg-stone-50/80 px-6 py-8 text-center ${className ?? ""}`}
        style={{ minHeight }}
        aria-label="Vélemények"
      >
        <p className="text-sm text-black/65 max-w-md">
          A Google vélemények külső szolgáltatón keresztül jelennek meg. Ehhez
          engedélyezze a marketing sütiket, vagy módosítsa a beállításokat.
        </p>
        <CookieSettingsLink className="text-sm font-semibold text-[var(--color-brand)] underline underline-offset-4 hover:brightness-90">
          Süti beállítások
        </CookieSettingsLink>
      </div>
    )
  }

  return (
    <div
      ref={hostRef}
      className={className}
      style={{ minHeight }}
      aria-label="Vélemények"
    />
  )
}
