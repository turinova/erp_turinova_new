"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  createCookieConsent,
  readCookieConsent,
  writeCookieConsent,
  type CookieConsent,
} from "@/lib/cookie-consent"

type CookieConsentContextValue = {
  consent: CookieConsent | null
  hasDecided: boolean
  settingsOpen: boolean
  acceptAll: () => void
  rejectOptional: () => void
  savePreferences: (statistics: boolean, marketing: boolean) => void
  openSettings: () => void
  closeSettings: () => void
}

const CookieConsentContext = createContext<CookieConsentContextValue | null>(
  null
)

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsent] = useState<CookieConsent | null>(null)
  const [hasDecided, setHasDecided] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    const stored = readCookieConsent()
    if (stored) {
      setConsent(stored)
      setHasDecided(true)
    }
  }, [])

  const persist = useCallback((next: CookieConsent) => {
    writeCookieConsent(next)
    setConsent(next)
    setHasDecided(true)
    setSettingsOpen(false)
  }, [])

  const acceptAll = useCallback(() => {
    persist(createCookieConsent(true, true))
  }, [persist])

  const rejectOptional = useCallback(() => {
    persist(createCookieConsent(false, false))
  }, [persist])

  const savePreferences = useCallback(
    (statistics: boolean, marketing: boolean) => {
      persist(createCookieConsent(statistics, marketing))
    },
    [persist]
  )

  const openSettings = useCallback(() => setSettingsOpen(true), [])
  const closeSettings = useCallback(() => setSettingsOpen(false), [])

  const value = useMemo(
    () => ({
      consent,
      hasDecided,
      settingsOpen,
      acceptAll,
      rejectOptional,
      savePreferences,
      openSettings,
      closeSettings,
    }),
    [
      consent,
      hasDecided,
      settingsOpen,
      acceptAll,
      rejectOptional,
      savePreferences,
      openSettings,
      closeSettings,
    ]
  )

  return (
    <CookieConsentContext.Provider value={value}>
      {children}
    </CookieConsentContext.Provider>
  )
}

export function useCookieConsent() {
  const ctx = useContext(CookieConsentContext)
  if (!ctx) {
    throw new Error("useCookieConsent must be used within CookieConsentProvider")
  }
  return ctx
}
