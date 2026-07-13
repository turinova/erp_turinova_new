import type { Workbook } from "exceljs"
import type { OrganizationProfile } from "@/types/organization"
import type { Project, Quote, QuoteLine } from "@/types/projects"
import { QUOTE_EXCEL_COLUMNS, QUOTE_GEPESZET_COLUMNS, SELL_EXPORT_HEADERS } from "@/lib/quote-columns"
import {
  buildLineSectionNumbers,
  getLineInternalIdentifier,
} from "@/lib/quote-line-display"
import type { CostItem } from "@/types"
import { groupLinesByTrade } from "@/lib/quote-utils"
import { getTradeLabel } from "@/lib/trades"
import {
  isLineCosted,
  lineCostLaborTotal,
  lineCostMaterialTotal,
  sellLaborUnit,
  sellMaterialUnit,
} from "@/lib/quote-pricing"
import { cellRef } from "@/lib/project-export/xlsx-address"
import {
  COST_MARGIN_HEADERS,
  applyCostMarginColumnHeaderStyles,
  costMarginPrintOptions,
  writeCostMarginFooter,
  writeCostMarginGroupHeader,
  writeLineCostMarginCells,
} from "@/lib/project-export/cost-margin-columns"
import {
  applyColumnWidths,
  configureWorksheetPrint,
  estimateWrappedRowHeight,
  styleComputedMoneyCell,
  styleDataRow,
  styleFooterRow,
  styleMoneyInputCell,
  styleSectionRow,
  writeTableHeaderRow,
} from "@/lib/project-export/excel-helpers"
import { EXCEL_THEME, quantityNumFmt } from "@/lib/project-export/excel-theme"
import {
  COST_MARGIN_COL,
  GEPESZET_COLUMNS,
  GEPESZET_COLUMNS_COST,
  STANDARD_COLUMNS,
  STANDARD_COLUMNS_COST,
  tradeSheetLayout,
} from "@/lib/project-export/excel-layout"
import type { BuiltTradeSheet, ProjectExportKind } from "@/lib/project-export/types"

export type BuildTradeSheetInput = {
  project: Project
  organization: OrganizationProfile
  quote: Quote
  lines: QuoteLine[]
  kind: ProjectExportKind
  exportedAt: string
  costItemById: Map<string, CostItem>
  unitCodeById: Record<string, string>
}

function buildStandardTradeSheet(
  workbook: Workbook,
  sheetName: string,
  input: BuildTradeSheetInput
): BuiltTradeSheet {
  const { quote, lines, kind, costItemById, unitCodeById } = input
  const ws = workbook.addWorksheet(sheetName)
  const isSell = kind === "sell"
  const isCostWithMargin = !isSell
  const lastCol = isSell ? 10 : COST_MARGIN_COL.marginNet
  const layout = tradeSheetLayout(kind)

  applyColumnWidths(ws, [...(isCostWithMargin ? STANDARD_COLUMNS_COST : STANDARD_COLUMNS)])

  if (isCostWithMargin) {
    writeCostMarginGroupHeader(ws)
  }

  const sellHeaders = SELL_EXPORT_HEADERS.standard
  const baseHeaders = [
    QUOTE_EXCEL_COLUMNS.ssz,
    QUOTE_EXCEL_COLUMNS.identifier,
    QUOTE_EXCEL_COLUMNS.text,
    QUOTE_EXCEL_COLUMNS.quantity,
    QUOTE_EXCEL_COLUMNS.unit,
    isSell ? sellHeaders.materialUnit : QUOTE_EXCEL_COLUMNS.materialUnit,
    isSell ? sellHeaders.laborUnit : QUOTE_EXCEL_COLUMNS.laborUnit,
    isSell ? sellHeaders.materialTotal : QUOTE_EXCEL_COLUMNS.materialTotal,
    isSell ? sellHeaders.laborTotal : QUOTE_EXCEL_COLUMNS.laborTotal,
    ...(isSell ? [sellHeaders.lineNet] : [...COST_MARGIN_HEADERS]),
  ]

  writeTableHeaderRow(ws, layout.headerRow, baseHeaders)

  if (isCostWithMargin) {
    applyCostMarginColumnHeaderStyles(ws)
  }

  const sectionNumbers = buildLineSectionNumbers(lines)
  const grouped = groupLinesByTrade(lines)
  let row = layout.dataStartRow
  const dataRows: number[] = []
  let appMaterial = 0
  let appLabor = 0
  let lineIndex = 0

  for (const [trade, group] of grouped) {
    styleSectionRow(ws, row, lastCol, getTradeLabel(trade))
    row += 1

    for (const line of group) {
      dataRows.push(row)
      const costed = isLineCosted(line)
      const matUnit = isSell
        ? sellMaterialUnit(line, quote)
        : line.costMaterialUnitPrice
      const laborUnit = isSell ? sellLaborUnit(line, quote) : line.costLaborUnitPrice
      appMaterial += isSell
        ? Math.round(matUnit * line.quantity)
        : lineCostMaterialTotal(line)
      appLabor += isSell
        ? Math.round(laborUnit * line.quantity)
        : lineCostLaborTotal(line)

      styleDataRow(ws, row, lastCol, { zebra: lineIndex % 2 === 1, unpriced: !costed })
      lineIndex += 1

      const sszCell = ws.getCell(row, 1)
      sszCell.value = sectionNumbers.get(line.id) ?? "—"
      sszCell.alignment = { horizontal: "center", vertical: "top" }
      sszCell.border = { ...sszCell.border }

      const idCell = ws.getCell(row, 2)
      idCell.value = getLineInternalIdentifier(line, costItemById)
      idCell.font = { ...EXCEL_THEME.fonts.code }
      idCell.alignment = { horizontal: "left", vertical: "top", wrapText: false }

      const textCell = ws.getCell(row, 3)
      textCell.value = line.textSnapshot
      textCell.alignment = { horizontal: "left", vertical: "top", wrapText: true }

      const qtyCell = ws.getCell(row, 4)
      qtyCell.value = line.quantity
      qtyCell.numFmt = quantityNumFmt(line.quantity)
      qtyCell.alignment = { horizontal: "right", vertical: "top" }

      ws.getCell(row, 5).value = unitCodeById[line.unitId] ?? ""
      ws.getCell(row, 5).alignment = { horizontal: "center", vertical: "top" }

      styleMoneyInputCell(ws, row, 6)
      ws.getCell(row, 6).value = matUnit
      styleMoneyInputCell(ws, row, 7)
      ws.getCell(row, 7).value = laborUnit

      styleComputedMoneyCell(ws, row, 8)
      ws.getCell(row, 8).value = { formula: `IF(D${row}="","",ROUND(D${row}*F${row},0))` }
      styleComputedMoneyCell(ws, row, 9)
      ws.getCell(row, 9).value = { formula: `IF(D${row}="","",ROUND(D${row}*G${row},0))` }

      if (isSell) {
        styleComputedMoneyCell(ws, row, 10)
        ws.getCell(row, 10).value = { formula: `IF(D${row}="","",H${row}+I${row})` }
      } else {
        writeLineCostMarginCells(ws, {
          row,
          qtyCol: 4,
          matTotalCol: 8,
          laborTotalCol: 9,
          line,
          quote,
          costed,
        })
      }

      ws.getRow(row).height = estimateWrappedRowHeight(
        line.textSnapshot,
        STANDARD_COLUMNS[2].width
      )
      row += 1
    }
  }

  const totalRow = row
  styleFooterRow(ws, totalRow, lastCol, 7)
  if (dataRows.length > 0) {
    const first = dataRows[0]
    const last = dataRows[dataRows.length - 1]
    ws.getCell(totalRow, 8).value = { formula: `SUM(H${first}:H${last})` }
    ws.getCell(totalRow, 9).value = { formula: `SUM(I${first}:I${last})` }
  } else {
    ws.getCell(totalRow, 8).value = 0
    ws.getCell(totalRow, 9).value = 0
  }

  if (isCostWithMargin) {
    writeCostMarginFooter(ws, totalRow, dataRows)
    configureWorksheetPrint(ws, totalRow, lastCol, costMarginPrintOptions())
  } else {
    ws.getCell(totalRow, 10).value = { formula: `H${totalRow}+I${totalRow}` }
    ws.getCell(totalRow, 10).numFmt = EXCEL_THEME.numFmt.moneyFt
    configureWorksheetPrint(ws, totalRow, lastCol, layout.print)
  }

  return {
    sheetName,
    anchors: {
      materialTotal: cellRef(8, totalRow),
      laborTotal: cellRef(9, totalRow),
      netTotal: cellRef(isCostWithMargin ? COST_MARGIN_COL.costNet : 10, totalRow),
      ...(isCostWithMargin
        ? {
            sellTotal: cellRef(COST_MARGIN_COL.sellNet, totalRow),
            marginTotal: cellRef(COST_MARGIN_COL.marginNet, totalRow),
          }
        : {}),
      totalRow,
    },
    appTotals: {
      material: appMaterial,
      labor: appLabor,
      net: appMaterial + appLabor,
    },
  }
}

function buildGepeszetTradeSheet(
  workbook: Workbook,
  sheetName: string,
  input: BuildTradeSheetInput
): BuiltTradeSheet {
  const { quote, lines, kind, costItemById, unitCodeById } = input
  const ws = workbook.addWorksheet(sheetName)
  const isSell = kind === "sell"
  const isCostWithMargin = !isSell
  const lastCol = isCostWithMargin ? COST_MARGIN_COL.marginNet : 10
  const cols = QUOTE_GEPESZET_COLUMNS
  const layout = tradeSheetLayout(kind)

  applyColumnWidths(ws, [...(isCostWithMargin ? GEPESZET_COLUMNS_COST : GEPESZET_COLUMNS)])

  if (isCostWithMargin) {
    writeCostMarginGroupHeader(ws)
  }

  const gepSell = SELL_EXPORT_HEADERS.gepeszet
  writeTableHeaderRow(
    ws,
    layout.headerRow,
    [
      cols.no,
      cols.identifier,
      cols.quantity,
      cols.unit,
      cols.text,
      isSell ? gepSell.materialUnit : cols.materialUnit,
      isSell ? gepSell.laborUnit : cols.laborUnit,
      isSell ? gepSell.materialTotal : cols.materialTotal,
      isSell ? gepSell.laborTotal : cols.laborTotal,
      ...(isSell ? [gepSell.lineNet] : [...COST_MARGIN_HEADERS]),
    ],
    3
  )

  if (isCostWithMargin) {
    applyCostMarginColumnHeaderStyles(ws)
  }

  let row = layout.dataStartRow
  const dataRows: number[] = []
  let appMaterial = 0
  let appLabor = 0
  let n = 0

  for (const line of lines) {
    n += 1
    dataRows.push(row)
    const costed = isLineCosted(line)
    const matUnit = isSell ? sellMaterialUnit(line, quote) : line.costMaterialUnitPrice
    const laborUnit = isSell ? sellLaborUnit(line, quote) : line.costLaborUnitPrice
    appMaterial += isSell
      ? Math.round(matUnit * line.quantity)
      : lineCostMaterialTotal(line)
    appLabor += isSell
      ? Math.round(laborUnit * line.quantity)
      : lineCostLaborTotal(line)

    styleDataRow(ws, row, lastCol, { zebra: n % 2 === 0, unpriced: !costed })

    ws.getCell(row, 1).value = n
    ws.getCell(row, 1).alignment = { horizontal: "center", vertical: "top" }

    const idCell = ws.getCell(row, 2)
    idCell.value = getLineInternalIdentifier(line, costItemById)
    idCell.font = { ...EXCEL_THEME.fonts.code }

    const qtyCell = ws.getCell(row, 3)
    qtyCell.value = line.quantity
    qtyCell.numFmt = quantityNumFmt(line.quantity)
    qtyCell.alignment = { horizontal: "right", vertical: "top" }

    ws.getCell(row, 4).value = unitCodeById[line.unitId] ?? ""
    ws.getCell(row, 4).alignment = { horizontal: "center", vertical: "top" }

    const textCell = ws.getCell(row, 5)
    textCell.value = line.textSnapshot
    textCell.alignment = { horizontal: "left", vertical: "top", wrapText: true }

    styleMoneyInputCell(ws, row, 6)
    ws.getCell(row, 6).value = matUnit
    styleMoneyInputCell(ws, row, 7)
    ws.getCell(row, 7).value = laborUnit

    styleComputedMoneyCell(ws, row, 8)
    ws.getCell(row, 8).value = { formula: `IF(C${row}="","",ROUND(C${row}*F${row},0))` }
    styleComputedMoneyCell(ws, row, 9)
    ws.getCell(row, 9).value = { formula: `IF(C${row}="","",ROUND(C${row}*G${row},0))` }

    if (isCostWithMargin) {
      writeLineCostMarginCells(ws, {
        row,
        qtyCol: 3,
        matTotalCol: 8,
        laborTotalCol: 9,
        line,
        quote,
        costed,
      })
    } else {
      styleComputedMoneyCell(ws, row, 10)
      ws.getCell(row, 10).value = { formula: `IF(C${row}="","",H${row}+I${row})` }
    }

    ws.getRow(row).height = estimateWrappedRowHeight(
      line.textSnapshot,
      GEPESZET_COLUMNS[4].width
    )
    row += 1
  }

  const totalRow = row
  styleFooterRow(ws, totalRow, lastCol, 5)
  if (dataRows.length > 0) {
    const first = dataRows[0]
    const last = dataRows[dataRows.length - 1]
    ws.getCell(totalRow, 8).value = { formula: `SUM(H${first}:H${last})` }
    ws.getCell(totalRow, 9).value = { formula: `SUM(I${first}:I${last})` }
  } else {
    ws.getCell(totalRow, 8).value = 0
    ws.getCell(totalRow, 9).value = 0
  }

  if (isCostWithMargin) {
    writeCostMarginFooter(ws, totalRow, dataRows)
    configureWorksheetPrint(ws, totalRow, lastCol, costMarginPrintOptions())
  } else {
    ws.getCell(totalRow, 10).value = { formula: `H${totalRow}+I${totalRow}` }
    ws.getCell(totalRow, 10).numFmt = EXCEL_THEME.numFmt.moneyFt
    configureWorksheetPrint(ws, totalRow, lastCol, layout.print)
  }

  return {
    sheetName,
    anchors: {
      materialTotal: cellRef(8, totalRow),
      laborTotal: cellRef(9, totalRow),
      netTotal: cellRef(isCostWithMargin ? COST_MARGIN_COL.costNet : 10, totalRow),
      ...(isCostWithMargin
        ? {
            sellTotal: cellRef(COST_MARGIN_COL.sellNet, totalRow),
            marginTotal: cellRef(COST_MARGIN_COL.marginNet, totalRow),
          }
        : {}),
      totalRow,
    },
    appTotals: {
      material: appMaterial,
      labor: appLabor,
      net: appMaterial + appLabor,
    },
  }
}

export function buildTradeSheet(
  workbook: Workbook,
  sheetName: string,
  input: BuildTradeSheetInput
): BuiltTradeSheet {
  const useGepeszet = input.quote.primaryTrade === "gepeszet"
  return useGepeszet
    ? buildGepeszetTradeSheet(workbook, sheetName, input)
    : buildStandardTradeSheet(workbook, sheetName, input)
}
