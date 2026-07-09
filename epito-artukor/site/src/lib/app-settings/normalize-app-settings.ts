import type { AppSettings, AppSettingsInput } from "@/types/app-settings"
import { DEFAULT_APP_SETTINGS, STATIC_DEFAULT_TRADE_MARKUPS } from "@/lib/app-settings/default-app-settings"
import { TRADE_CODES } from "@/lib/trades/constants"

function clampMarkup(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.round(value))
}

export function normalizeTradeMarkups(
  raw: Partial<Record<string, number>> | undefined,
  tradeCodes: string[] = [...TRADE_CODES]
): AppSettings["defaultTradeMarkups"] {
  const result: Record<string, number> = { ...STATIC_DEFAULT_TRADE_MARKUPS }
  for (const code of tradeCodes) {
    if (result[code] == null) result[code] = 0
  }
  if (raw) {
    for (const [key, value] of Object.entries(raw)) {
      if (value != null) result[key] = clampMarkup(value)
    }
  }
  return result
}

export function normalizeAppSettings(
  raw: Partial<AppSettings> | null | undefined,
  tradeCodes: string[] = [...TRADE_CODES]
): AppSettings {
  const base = DEFAULT_APP_SETTINGS
  if (!raw) {
    return {
      ...base,
      defaultTradeMarkups: normalizeTradeMarkups(base.defaultTradeMarkups, tradeCodes),
    }
  }

  return {
    defaultTradeMarkups: normalizeTradeMarkups(raw.defaultTradeMarkups, tradeCodes),
    minAcceptableMarginPercent: clampMarkup(
      raw.minAcceptableMarginPercent ?? base.minAcceptableMarginPercent
    ),
    offerValidityDays: Math.max(1, Math.round(raw.offerValidityDays ?? base.offerValidityDays)),
    rfqDefaultValidityDays: Math.max(
      1,
      Math.round(raw.rfqDefaultValidityDays ?? base.rfqDefaultValidityDays)
    ),
    offerDefaultNotes: raw.offerDefaultNotes ?? base.offerDefaultNotes,
    offerDefaultPaymentTerms: raw.offerDefaultPaymentTerms ?? base.offerDefaultPaymentTerms,
    tigDocumentPrefix: (raw.tigDocumentPrefix ?? base.tigDocumentPrefix).trim() || "TIG",
    updatedAt: raw.updatedAt ?? base.updatedAt,
  }
}

export function appSettingsInputFromSettings(settings: AppSettings): AppSettingsInput {
  return {
    defaultTradeMarkups: { ...settings.defaultTradeMarkups },
    minAcceptableMarginPercent: settings.minAcceptableMarginPercent,
    offerValidityDays: settings.offerValidityDays,
    rfqDefaultValidityDays: settings.rfqDefaultValidityDays,
    offerDefaultNotes: settings.offerDefaultNotes,
    offerDefaultPaymentTerms: settings.offerDefaultPaymentTerms,
    tigDocumentPrefix: settings.tigDocumentPrefix,
  }
}
