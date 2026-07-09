import type { Trade } from "@/types"

export type DefaultTradeMarkups = Record<string, number>

export interface AppSettings {
  defaultTradeMarkups: DefaultTradeMarkups
  minAcceptableMarginPercent: number
  offerValidityDays: number
  rfqDefaultValidityDays: number
  /** Ügyfélnek küldött árajánlat alap megjegyzése */
  offerDefaultNotes: string
  /** Fizetési feltétel szöveg (árajánlat) */
  offerDefaultPaymentTerms: string
  /** TIG sorszám prefix — pl. TIG → TIG-IRO-2026-001 */
  tigDocumentPrefix: string
  updatedAt: string
}

export type AppSettingsInput = Omit<AppSettings, "updatedAt">
