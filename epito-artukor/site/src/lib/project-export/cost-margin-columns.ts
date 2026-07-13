import type { Worksheet } from "exceljs"
import type { Quote, QuoteLine } from "@/types/projects"
import { getLineMarkupPercent } from "@/lib/quote-pricing"
import { colToLetter } from "@/lib/project-export/xlsx-address"
import {
  styleComputedMoneyCell,
  styleMarginComputedCell,
  styleMarginInputCell,
  styleMarginSeparatorCell,
} from "@/lib/project-export/excel-helpers"
import {
  COST_MARGIN_COL,
  COST_MARGIN_GROUP_ROW,
  TRADE_TABLE_HEADER_ROW,
} from "@/lib/project-export/excel-layout"
import { EXCEL_THEME, solidFill, thinBorder } from "@/lib/project-export/excel-theme"

export const COST_MARGIN_HEADERS = [
  "Bekerülés össz.",
  "",
  "Fedezet %",
  "Eladás össz.",
  "Fedezet össz.",
] as const

type LineMarginInput = {
  row: number
  qtyCol: number
  matTotalCol: number
  laborTotalCol: number
  line: QuoteLine
  quote: Quote
  costed: boolean
}

/** 6. sor: vizuális csoportos fejléc — bekerülés | fedezet és eladás. */
export function writeCostMarginGroupHeader(ws: Worksheet): void {
  const row = COST_MARGIN_GROUP_ROW
  ws.mergeCells(row, 1, row, COST_MARGIN_COL.costNet)
  const costGroup = ws.getCell(row, 1)
  costGroup.value = "Bekerülés (nettó)"
  costGroup.font = { ...EXCEL_THEME.fonts.bodyBold }
  costGroup.fill = solidFill(EXCEL_THEME.colors.headerBg)
  costGroup.alignment = { horizontal: "center", vertical: "middle" }
  costGroup.border = thinBorder()

  styleMarginSeparatorCell(ws, row)

  ws.mergeCells(row, COST_MARGIN_COL.markupPct, row, COST_MARGIN_COL.marginNet)
  const marginGroup = ws.getCell(row, COST_MARGIN_COL.markupPct)
  marginGroup.value = "Fedezet és ügyfélár"
  marginGroup.font = { ...EXCEL_THEME.fonts.bodyBold }
  marginGroup.fill = solidFill(EXCEL_THEME.colors.marginBlockBg)
  marginGroup.alignment = { horizontal: "center", vertical: "middle" }
  marginGroup.border = thinBorder()

  for (let c = 1; c <= COST_MARGIN_COL.costNet; c++) {
    if (c === 1) continue
    ws.getCell(row, c).fill = solidFill(EXCEL_THEME.colors.headerBg)
    ws.getCell(row, c).border = thinBorder()
  }

  ws.getRow(row).height = 18
}

export function writeLineCostMarginCells(ws: Worksheet, input: LineMarginInput): void {
  const { row, qtyCol, matTotalCol, laborTotalCol, line, quote, costed } = input
  const qty = colToLetter(qtyCol)
  const mat = colToLetter(matTotalCol)
  const labor = colToLetter(laborTotalCol)
  const costNetL = colToLetter(COST_MARGIN_COL.costNet)
  const markupL = colToLetter(COST_MARGIN_COL.markupPct)
  const sellL = colToLetter(COST_MARGIN_COL.sellNet)

  styleMarginSeparatorCell(ws, row)

  styleComputedMoneyCell(ws, row, COST_MARGIN_COL.costNet)
  ws.getCell(row, COST_MARGIN_COL.costNet).value = {
    formula: `IF(${qty}${row}="","",${mat}${row}+${labor}${row})`,
  }

  const markupCell = ws.getCell(row, COST_MARGIN_COL.markupPct)
  styleMarginInputCell(ws, row, COST_MARGIN_COL.markupPct)
  if (costed) {
    markupCell.value = getLineMarkupPercent(line, quote)
    markupCell.numFmt = EXCEL_THEME.numFmt.percent
  }

  styleMarginComputedCell(ws, row, COST_MARGIN_COL.sellNet)
  ws.getCell(row, COST_MARGIN_COL.sellNet).value = {
    formula: `IF(${qty}${row}="","",ROUND(${mat}${row}*(1+${markupL}${row}/100),0)+ROUND(${labor}${row}*(1+${markupL}${row}/100),0))`,
  }

  styleMarginComputedCell(ws, row, COST_MARGIN_COL.marginNet)
  ws.getCell(row, COST_MARGIN_COL.marginNet).value = {
    formula: `IF(${costNetL}${row}="","",${sellL}${row}-${costNetL}${row})`,
  }
}

export function writeCostMarginFooter(
  ws: Worksheet,
  totalRow: number,
  dataRows: number[]
): void {
  const { costNet, markupPct, sellNet, marginNet } = COST_MARGIN_COL

  styleMarginSeparatorCell(ws, totalRow)

  if (dataRows.length > 0) {
    const first = dataRows[0]
    const last = dataRows[dataRows.length - 1]
    const costNetL = colToLetter(costNet)
    const sellL = colToLetter(sellNet)
    const marginL = colToLetter(marginNet)

    ws.getCell(totalRow, costNet).value = { formula: `SUM(${costNetL}${first}:${costNetL}${last})` }
    ws.getCell(totalRow, sellNet).value = { formula: `SUM(${sellL}${first}:${sellL}${last})` }
    ws.getCell(totalRow, marginNet).value = { formula: `SUM(${marginL}${first}:${marginL}${last})` }
    ws.getCell(totalRow, markupPct).value = {
      formula: `IF(${costNetL}${totalRow}=0,"",ROUND(${marginL}${totalRow}/${costNetL}${totalRow}*100,0))`,
    }
    ws.getCell(totalRow, markupPct).numFmt = EXCEL_THEME.numFmt.percent
  } else {
    ws.getCell(totalRow, costNet).value = 0
    ws.getCell(totalRow, sellNet).value = 0
    ws.getCell(totalRow, marginNet).value = 0
    ws.getCell(totalRow, markupPct).value = 0
    ws.getCell(totalRow, markupPct).numFmt = EXCEL_THEME.numFmt.percent
  }

  for (const c of [costNet, sellNet, marginNet]) {
    ws.getCell(totalRow, c).numFmt = EXCEL_THEME.numFmt.moneyFt
  }
}

export function applyCostMarginColumnHeaderStyles(ws: Worksheet): void {
  const row = TRADE_TABLE_HEADER_ROW
  styleMarginSeparatorCell(ws, row)
  ws.getCell(row, COST_MARGIN_COL.separator).value = ""

  for (const c of [COST_MARGIN_COL.markupPct, COST_MARGIN_COL.sellNet, COST_MARGIN_COL.marginNet]) {
    const cell = ws.getCell(row, c)
    cell.fill = solidFill(EXCEL_THEME.colors.marginBlockBg)
    cell.font = { ...EXCEL_THEME.fonts.header }
    cell.border = thinBorder()
  }

  const costNetHeader = ws.getCell(row, COST_MARGIN_COL.costNet)
  costNetHeader.fill = solidFill(EXCEL_THEME.colors.headerBg)
  costNetHeader.font = { ...EXCEL_THEME.fonts.header }
  costNetHeader.border = thinBorder()
}

import { tradeSheetLayout } from "@/lib/project-export/excel-layout"

export function costMarginPrintOptions() {
  return tradeSheetLayout("cost").print
}
