import type { AppSettings, AppSettingsInput } from "@/types/app-settings"
import { normalizeAppSettings } from "@/lib/app-settings/normalize-app-settings"

export type OrganizationAppSettingsRow = {
  organization_id: string
  default_trade_markups: Record<string, number> | null
  min_acceptable_margin_percent: number
  offer_validity_days: number
  rfq_default_validity_days: number
  offer_default_notes: string
  offer_default_payment_terms: string
  tig_document_prefix: string
  created_at: string
  updated_at: string
}

export const ORGANIZATION_APP_SETTINGS_SELECT =
  "organization_id, default_trade_markups, min_acceptable_margin_percent, offer_validity_days, rfq_default_validity_days, offer_default_notes, offer_default_payment_terms, tig_document_prefix, created_at, updated_at"

export function mapAppSettingsRow(
  row: OrganizationAppSettingsRow,
  tradeCodes: string[]
): AppSettings {
  return normalizeAppSettings(
    {
      defaultTradeMarkups: row.default_trade_markups ?? undefined,
      minAcceptableMarginPercent: row.min_acceptable_margin_percent,
      offerValidityDays: row.offer_validity_days,
      rfqDefaultValidityDays: row.rfq_default_validity_days,
      offerDefaultNotes: row.offer_default_notes,
      offerDefaultPaymentTerms: row.offer_default_payment_terms,
      tigDocumentPrefix: row.tig_document_prefix,
      updatedAt: row.updated_at,
    },
    tradeCodes
  )
}

export function appSettingsInputToRow(organizationId: string, input: AppSettingsInput) {
  const normalized = normalizeAppSettings(input)
  return {
    organization_id: organizationId,
    default_trade_markups: normalized.defaultTradeMarkups,
    min_acceptable_margin_percent: normalized.minAcceptableMarginPercent,
    offer_validity_days: normalized.offerValidityDays,
    rfq_default_validity_days: normalized.rfqDefaultValidityDays,
    offer_default_notes: normalized.offerDefaultNotes,
    offer_default_payment_terms: normalized.offerDefaultPaymentTerms,
    tig_document_prefix: normalized.tigDocumentPrefix,
  }
}
