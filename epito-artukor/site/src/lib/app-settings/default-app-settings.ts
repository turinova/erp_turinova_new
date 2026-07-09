import type { AppSettings } from "@/types/app-settings"

export const STATIC_DEFAULT_TRADE_MARKUPS = {
  epitomester: 18,
  nyilaszaró: 12,
  gepeszet: 12,
  elektromos: 15,
  riaszto: 15,
} as const

export const DEFAULT_APP_SETTINGS: AppSettings = {
  defaultTradeMarkups: { ...STATIC_DEFAULT_TRADE_MARKUPS },
  minAcceptableMarginPercent: 12,
  offerValidityDays: 30,
  rfqDefaultValidityDays: 14,
  offerDefaultNotes:
    "Az ajánlat a feltüntetett érvényességi időtartamig érvényes. Az árak nettó / bruttó bontásban a csomag pillanatképében szerepelnek.",
  offerDefaultPaymentTerms: "Fizetési feltétel: 30% előleg szerződéskötéskor, 70% teljesítésigazolás után 8 napon belül.",
  tigDocumentPrefix: "TIG",
  updatedAt: new Date().toISOString(),
}
