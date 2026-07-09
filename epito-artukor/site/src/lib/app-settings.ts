import type { Trade } from "@/types"
import {
  DEFAULT_APP_SETTINGS,
  STATIC_DEFAULT_TRADE_MARKUPS,
} from "@/lib/app-settings/default-app-settings"
import { loadAppSettings } from "@/lib/data/app-settings-store"

export function getAppSettings() {
  if (typeof window === "undefined") return DEFAULT_APP_SETTINGS
  return loadAppSettings()
}

export function getDefaultTradeMarkups(): Record<Trade, number> {
  return getAppSettings().defaultTradeMarkups
}

export function getDefaultTradeMarkupsStatic(): Record<Trade, number> {
  return { ...STATIC_DEFAULT_TRADE_MARKUPS }
}

export function getMinAcceptableMarginPercent(): number {
  return getAppSettings().minAcceptableMarginPercent
}

export function getMinAcceptableMarginPercentStatic(): number {
  return DEFAULT_APP_SETTINGS.minAcceptableMarginPercent
}

export function getOfferValidityDays(): number {
  return getAppSettings().offerValidityDays
}

export function getOfferValidityDaysStatic(): number {
  return DEFAULT_APP_SETTINGS.offerValidityDays
}

export function getRfqDefaultValidityDays(): number {
  return getAppSettings().rfqDefaultValidityDays
}

export function getRfqDefaultValidityDaysStatic(): number {
  return DEFAULT_APP_SETTINGS.rfqDefaultValidityDays
}

export function getOfferDefaultNotes(): string {
  return getAppSettings().offerDefaultNotes
}

export function getOfferDefaultPaymentTerms(): string {
  return getAppSettings().offerDefaultPaymentTerms
}

export function buildOfferDefaultNotesText(): string {
  const settings = getAppSettings()
  const parts = [settings.offerDefaultNotes.trim(), settings.offerDefaultPaymentTerms.trim()].filter(
    Boolean
  )
  return parts.join("\n\n")
}

export function getTigDocumentPrefix(): string {
  return getAppSettings().tigDocumentPrefix.trim() || "TIG"
}

export function getTigDocumentPrefixStatic(): string {
  return DEFAULT_APP_SETTINGS.tigDocumentPrefix
}
