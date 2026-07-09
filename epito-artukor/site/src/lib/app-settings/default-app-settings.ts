import type { AppSettings } from "@/types/app-settings"

export const STATIC_DEFAULT_TRADE_MARKUPS = {
  elokeszites: 5,
  organizacio: 10,
  bontas: 15,
  foldmunka: 15,
  epitomester: 18,
  acs: 15,
  tetofedes: 15,
  badogozas: 15,
  homlokzat: 15,
  vizszigeteles: 15,
  allvanyozas: 15,
  szarazepites: 15,
  burkolas: 15,
  festes: 15,
  asztalos: 15,
  nyilaszaró: 12,
  arnyekolas: 12,
  lakatos: 15,
  gepeszet: 12,
  "futes-hutes": 12,
  "klima-szellozes": 12,
  gazszereles: 12,
  elektromos: 15,
  riaszto: 15,
  napelem: 12,
  kertepites: 15,
  terburkolas: 15,
  takaritas: 10,
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
