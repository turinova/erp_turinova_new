/** Hyundai / BauGenerál Excel ártükör oszlopnevek (Elektromos1 tükör lap) */
export const QUOTE_EXCEL_COLUMNS = {
  ssz: "Ssz.",
  identifier: "Tételszám",
  text: "Tétel szövege",
  quantity: "Menny.",
  unit: "Egység",
  materialUnit: "Anyag egységár",
  laborUnit: "Díj egységre",
  materialTotal: "Anyag összesen",
  laborTotal: "Díj összesen",
} as const

/** Gépészet lap változat (referencia) */
export const QUOTE_GEPESZET_COLUMNS = {
  no: "No.",
  identifier: "Azonosító",
  quantity: "Mennyiség",
  unit: "Egys.",
  text: "Szöveg",
  materialUnit: "Anyagár",
  laborUnit: "Óradij",
  materialTotal: "xAnyagár",
  laborTotal: "xÓradij",
} as const

/** Ügyfélnek szóló export — semleges megnevezések, nincs bekerülés/fedezet utalás. */
export const SELL_EXPORT_HEADERS = {
  standard: {
    materialUnit: "Anyag egységár",
    laborUnit: "Díj egységre",
    materialTotal: "Anyag összesen",
    laborTotal: "Díj összesen",
    lineNet: "Nettó összesen",
  },
  gepeszet: {
    materialUnit: "Anyagár",
    laborUnit: "Óradíj",
    materialTotal: "Anyag összesen",
    laborTotal: "Díj összesen",
    lineNet: "Nettó összesen",
  },
} as const
