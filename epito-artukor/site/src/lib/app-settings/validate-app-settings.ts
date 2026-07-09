import type { AppSettingsInput } from "@/types/app-settings"
import { normalizeAppSettings } from "@/lib/app-settings/normalize-app-settings"

export function validateAppSettingsInput(
  input: AppSettingsInput,
  tradeCodes: string[]
): { ok: true; normalized: AppSettingsInput } | { ok: false; error: string } {
  const normalized = normalizeAppSettings(input, tradeCodes)

  if (!normalized.tigDocumentPrefix.trim()) {
    return { ok: false, error: "A TIG prefix nem lehet üres." }
  }

  return {
    ok: true,
    normalized: {
      defaultTradeMarkups: normalized.defaultTradeMarkups,
      minAcceptableMarginPercent: normalized.minAcceptableMarginPercent,
      offerValidityDays: normalized.offerValidityDays,
      rfqDefaultValidityDays: normalized.rfqDefaultValidityDays,
      offerDefaultNotes: normalized.offerDefaultNotes,
      offerDefaultPaymentTerms: normalized.offerDefaultPaymentTerms,
      tigDocumentPrefix: normalized.tigDocumentPrefix,
    },
  }
}
