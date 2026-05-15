"use client"

import type { ReactNode } from "react"
import { CookieBanner } from "./CookieBanner"
import { CookieConsentProvider } from "./CookieConsentProvider"

export function CookieConsentShell({ children }: { children: ReactNode }) {
  return (
    <CookieConsentProvider>
      {children}
      <CookieBanner />
    </CookieConsentProvider>
  )
}
