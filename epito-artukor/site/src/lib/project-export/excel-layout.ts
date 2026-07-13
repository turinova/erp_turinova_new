/** Első lap — mindig a főösszesítő. */
export const SUMMARY_SHEET_NAME = "Főösszesítő"

/** Főösszesítő borító (cég, logó, projekt). */
export const SUMMARY_HEADER_ROWS = 8
export const SUMMARY_SEPARATOR_ROW = 9
export const SUMMARY_TABLE_HEADER_ROW = 10
export const SUMMARY_DATA_START_ROW = 11

/** Szakági lapok — nincs cég-borító, közvetlenül a táblázat. */
export const TRADE_COST_MARGIN_GROUP_ROW = 1
export const TRADE_TABLE_HEADER_ROW = 2
export const TRADE_DATA_START_ROW = 3
export const TRADE_TABLE_HEADER_ROW_SIMPLE = 1
export const TRADE_DATA_START_ROW_SIMPLE = 2

/** @deprecated Szakági lapoknál ne használd — csak összefoglaló kompatibilitás. */
export const SHEET_HEADER_ROWS = 5
/** @deprecated Használd SUMMARY_TABLE_HEADER_ROW vagy TRADE_* változót. */
export const TABLE_HEADER_ROW = 7
/** @deprecated */
export const DATA_START_ROW = 8

export const STANDARD_COLUMNS = [
  { key: "ssz", width: 5 },
  { key: "identifier", width: 14 },
  { key: "text", width: 45 },
  { key: "quantity", width: 8 },
  { key: "unit", width: 7 },
  { key: "materialUnit", width: 12 },
  { key: "laborUnit", width: 12 },
  { key: "materialTotal", width: 14 },
  { key: "laborTotal", width: 14 },
  { key: "extra", width: 10 },
] as const

export const GEPESZET_COLUMNS = [
  { key: "no", width: 5 },
  { key: "identifier", width: 14 },
  { key: "quantity", width: 8 },
  { key: "unit", width: 7 },
  { key: "text", width: 45 },
  { key: "materialUnit", width: 12 },
  { key: "laborUnit", width: 12 },
  { key: "materialTotal", width: 14 },
  { key: "laborTotal", width: 14 },
  { key: "netTotal", width: 12 },
] as const

export const SUMMARY_COLUMNS = [
  { width: 5 },
  { width: 24 },
  { width: 14 },
  { width: 14 },
  { width: 14 },
  { width: 14 },
  { width: 14 },
  { width: 8 },
  { width: 14 },
  { width: 14 },
] as const

export const SUMMARY_LAST_COL = SUMMARY_COLUMNS.length

export function tradeSheetLayout(kind: "cost" | "sell") {
  if (kind === "cost") {
    return {
      groupRow: TRADE_COST_MARGIN_GROUP_ROW,
      headerRow: TRADE_TABLE_HEADER_ROW,
      dataStartRow: TRADE_DATA_START_ROW,
      print: {
        frozenRow: TRADE_TABLE_HEADER_ROW,
        printTitlesRow: `${TRADE_COST_MARGIN_GROUP_ROW}:${TRADE_TABLE_HEADER_ROW}`,
      },
    }
  }
  return {
    headerRow: TRADE_TABLE_HEADER_ROW_SIMPLE,
    dataStartRow: TRADE_DATA_START_ROW_SIMPLE,
    print: {
      frozenRow: TRADE_TABLE_HEADER_ROW_SIMPLE,
      printTitlesRow: `${TRADE_TABLE_HEADER_ROW_SIMPLE}:${TRADE_TABLE_HEADER_ROW_SIMPLE}`,
    },
  }
}

/** Csoportos fejléc a bekerülési + fedezet blokkokhoz (szakági lap 1. sor). */
export const COST_MARGIN_GROUP_ROW = TRADE_COST_MARGIN_GROUP_ROW

/** Bekerülési export — jobb oldali fedezet / eladás oszlopok. */
export const COST_MARGIN_COL = {
  costNet: 10,
  separator: 11,
  markupPct: 12,
  sellNet: 13,
  marginNet: 14,
} as const

export const STANDARD_COLUMNS_COST = [
  { key: "ssz", width: 5 },
  { key: "identifier", width: 14 },
  { key: "text", width: 45 },
  { key: "quantity", width: 8 },
  { key: "unit", width: 7 },
  { key: "materialUnit", width: 12 },
  { key: "laborUnit", width: 12 },
  { key: "materialTotal", width: 14 },
  { key: "laborTotal", width: 14 },
  { key: "costNet", width: 14 },
  { key: "separator", width: 1.2 },
  { key: "markupPct", width: 9 },
  { key: "sellNet", width: 14 },
  { key: "marginNet", width: 14 },
] as const

export const GEPESZET_COLUMNS_COST = [
  { key: "no", width: 5 },
  { key: "identifier", width: 14 },
  { key: "quantity", width: 8 },
  { key: "unit", width: 7 },
  { key: "text", width: 45 },
  { key: "materialUnit", width: 12 },
  { key: "laborUnit", width: 12 },
  { key: "materialTotal", width: 14 },
  { key: "laborTotal", width: 14 },
  { key: "costNet", width: 14 },
  { key: "separator", width: 1.2 },
  { key: "markupPct", width: 9 },
  { key: "sellNet", width: 14 },
  { key: "marginNet", width: 14 },
] as const
