"use client"

import type { ReactNode } from "react"
import { Clarity } from "./Clarity"
import { CookieBanner } from "./CookieBanner"
import { CookieConsentProvider } from "./CookieConsentProvider"
import { GoogleAnalytics } from "./GoogleAnalytics"

export function CookieConsentShell({ children }: { children: ReactNode }) {
  return (
    <CookieConsentProvider>
      <GoogleAnalytics />
      {children}
      <CookieBanner />
      <Clarity />
    </CookieConsentProvider>
  )
}
