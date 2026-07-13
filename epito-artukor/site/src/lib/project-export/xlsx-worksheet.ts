import type { WorkSheet } from "xlsx"
import { cellRef } from "@/lib/project-export/xlsx-address"

export function setText(ws: WorkSheet, col: number, row: number, value: string): void {
  const ref = cellRef(col, row)
  ws[ref] = { t: "s", v: value }
}

export function setNumber(ws: WorkSheet, col: number, row: number, value: number): void {
  const ref = cellRef(col, row)
  ws[ref] = { t: "n", v: value }
}

export function setFormula(ws: WorkSheet, col: number, row: number, formula: string): void {
  const ref = cellRef(col, row)
  ws[ref] = { t: "n", f: formula }
}

export function initSheetRange(ws: WorkSheet, maxCol: number, maxRow: number): void {
  ws["!ref"] = `A1:${cellRef(maxCol, maxRow)}`
}
