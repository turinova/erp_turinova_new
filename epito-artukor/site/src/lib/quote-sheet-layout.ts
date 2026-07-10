import { QUOTE_EXCEL_COLUMNS } from "@/lib/quote-columns"

/** 8 jegyű Ft formázott összeg: „99 999 999 Ft” (~13 karakter). */
export const SHEET_MONEY_COL_WIDTH = "14ch"

/** Tételszám oszlop — fejléc + tipikus azonosítók (pl. BURK-1000). */
export const SHEET_IDENTIFIER_COL_WIDTH = "13ch"

export type SheetDensity = "compact" | "normal"

/** Bekerülés rács — fix oszlopszélességek (ch = max. karakterszám). */
export const COST_SHEET_LAYOUT = {
  ssz: "2.75rem",
  identifier: SHEET_IDENTIFIER_COL_WIDTH,
  quantity: "5.5ch",
  unit: "8ch",
  materialUnit: "11ch",
  laborUnit: "9ch",
  materialTotal: SHEET_MONEY_COL_WIDTH,
  laborTotal: SHEET_MONEY_COL_WIDTH,
  lineTotal: SHEET_MONEY_COL_WIDTH,
  source: "4.5ch",
  actions: "3rem",
} as const

/** Árrés rács oszlopszélességek. */
export const MARKUP_SHEET_LAYOUT = {
  checkbox: "2rem",
  ssz: "2.75rem",
  identifier: SHEET_IDENTIFIER_COL_WIDTH,
  quantity: "8ch",
  cost: SHEET_MONEY_COL_WIDTH,
  markup: "5.5ch",
  sell: SHEET_MONEY_COL_WIDTH,
  margin: SHEET_MONEY_COL_WIDTH,
} as const

export const COST_SHEET_HEADERS = {
  ssz: QUOTE_EXCEL_COLUMNS.ssz,
  identifier: QUOTE_EXCEL_COLUMNS.identifier,
  text: QUOTE_EXCEL_COLUMNS.text,
  quantity: QUOTE_EXCEL_COLUMNS.quantity,
  unit: QUOTE_EXCEL_COLUMNS.unit,
  materialUnit: {
    short: "Anyag/egys.",
    full: QUOTE_EXCEL_COLUMNS.materialUnit,
    sub: "nettó",
  },
  laborUnit: {
    short: "Díj/egys.",
    full: QUOTE_EXCEL_COLUMNS.laborUnit,
    sub: "nettó",
  },
  materialTotal: {
    short: "Σ anyag",
    full: QUOTE_EXCEL_COLUMNS.materialTotal,
    sub: "nettó",
  },
  laborTotal: {
    short: "Σ díj",
    full: QUOTE_EXCEL_COLUMNS.laborTotal,
    sub: "nettó",
  },
  lineTotal: {
    short: "Σ össz.",
    full: "Összesen (bekerülés)",
    sub: "nettó",
  },
  source: { short: "Forr.", full: "Forrás" },
} as const

export const MARKUP_SHEET_HEADERS = {
  quantity: { short: "Menny.", full: "Mennyiség" },
  cost: { short: "Beker.", full: "Bekerülési összeg", sub: "nettó" },
  markup: { short: "Fedez.%", full: "Fedezet százalék" },
  sell: { short: "Ügyf.ár", full: "Ügyfél eladási ár", sub: "nettó" },
  margin: { short: "Σ fedez.", full: "Fedezet összeg", sub: "nettó" },
} as const

export const COST_SHEET_FOOTER = {
  label: "Összesen",
  sub: "nettó · bekerülés · ÁFA nélkül",
} as const

export const MARKUP_SHEET_FOOTER = {
  label: "Összesen",
  sub: "nettó · eladási árak",
} as const

/** Minimális táblázat szélesség. */
export const COST_SHEET_MIN_WIDTH = "50rem"
export const MARKUP_SHEET_MIN_WIDTH = "46rem"
