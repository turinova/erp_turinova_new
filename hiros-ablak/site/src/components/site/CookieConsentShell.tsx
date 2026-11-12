"use client"

import type { ReactNode } from "react"
import { Clarity } from "./Clarity"
import { CookieBanner } from "./CookieBanner"
import { CookieConsentProvider } from "./CookieConsentProvider"
import { GoogleAnalytics } from "./GoogleAnalytics"
import { MetaPixel } from "./MetaPixel"

export function CookieConsentShell({ children }: { children: ReactNode }) {
  return (
    <CookieConsentProvider>
      <GoogleAnalytics />
      <MetaPixel />
      {children}
      <CookieBanner />
      <Clarity />
    </CookieConsentProvider>
  )
}
