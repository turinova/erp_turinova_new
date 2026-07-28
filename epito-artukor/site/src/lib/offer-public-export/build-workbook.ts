import ExcelJS from "exceljs"
import { QUOTE_EXCEL_COLUMNS as COL, SELL_EXPORT_HEADERS } from "@/lib/quote-columns"
import { downloadArrayBuffer } from "@/lib/project-export/download"
import {
  applyColumnWidths,
  configureWorksheetPrint,
  estimateWrappedRowHeight,
  styleComputedMoneyCell,
  styleDataRow,
  styleFooterRow,
  styleMoneyInputCell,
  writeSummaryTotalsPanel,
  writeTableHeaderRow,
  type SummaryTotalsLine,
} from "@/lib/project-export/excel-helpers"
import {
  STANDARD_COLUMNS,
  SUMMARY_COLUMNS,
  SUMMARY_DATA_START_ROW,
  SUMMARY_HEADER_ROWS,
  SUMMARY_LAST_COL,
  SUMMARY_SEPARATOR_ROW,
  SUMMARY_SHEET_NAME,
  SUMMARY_TABLE_HEADER_ROW,
  tradeSheetLayout,
} from "@/lib/project-export/excel-layout"
import { EXCEL_THEME, quantityNumFmt, solidFill, thinBorder } from "@/lib/project-export/excel-theme"
import { quoteSheetRef, sanitizeSheetName } from "@/lib/project-export/sheet-name"
import { cellRef } from "@/lib/project-export/xlsx-address"
import {
  offerPublicExportFilename,
  type OfferPublicExportModel,
  type OfferPublicExportTrade,
} from "@/lib/offer-public-export/build-export-model"

const TRADE_LAST_COL = 10

const SUMMARY_HEADERS = [
  "Ssz.",
  "Szakág",
  "Anyag összesen",
  "Díj összesen",
  "Nettó összesen",
  "ÁFA",
  "Bruttó összesen",
] as const

type PlannedTrade = {
  trade: OfferPublicExportTrade
  sheetName: string
  anchors: {
    materialTotal: string
    laborTotal: string
    netTotal: string
  }
}

function planTrades(trades: OfferPublicExportTrade[]): PlannedTrade[] {
  const layout = tradeSheetLayout("sell")
  const usedNames = new Set<string>()
  return trades.map((trade) => {
    const sheetName = sanitizeSheetName(trade.tradeLabel || trade.packageTitle, usedNames)
    const lineCount = trade.hasLineDetail ? Math.max(trade.lines.length, 1) : 1
    const totalRow = layout.dataStartRow + lineCount
    return {
      trade,
      sheetName,
      anchors: {
        materialTotal: cellRef(8, totalRow),
        laborTotal: cellRef(9, totalRow),
        netTotal: cellRef(10, totalRow),
      },
    }
  })
}

function writeCoverHeader(
  ws: ExcelJS.Worksheet,
  model: OfferPublicExportModel
): void {
  const dateLabel = new Date(model.exportedAt).toLocaleDateString("hu-HU")
  const org = model.organization

  ws.mergeCells(1, 1, 1, 5)
  ws.mergeCells(2, 1, 2, 5)
  ws.mergeCells(3, 1, 3, 5)
  ws.mergeCells(4, 1, 4, 5)

  ws.mergeCells(1, 8, 1, SUMMARY_LAST_COL)
  ws.mergeCells(2, 8, 2, SUMMARY_LAST_COL)
  ws.mergeCells(3, 8, 3, SUMMARY_LAST_COL)
  ws.mergeCells(4, 8, 4, SUMMARY_LAST_COL)
  ws.mergeCells(5, 8, 5, SUMMARY_LAST_COL)

  ws.getCell(1, 1).value = org?.legalName || "Vállalkozó"
  ws.getCell(1, 1).font = { ...EXCEL_THEME.fonts.title }

  ws.getCell(2, 1).value = org?.address || ""
  ws.getCell(2, 1).font = { ...EXCEL_THEME.fonts.subtitle }

  const taxParts = [
    org?.taxNumber ? `Adószám: ${org.taxNumber}` : null,
    org?.registrationNumber ? `Cégj.: ${org.registrationNumber}` : null,
  ].filter(Boolean)
  ws.getCell(3, 1).value = taxParts.join(" · ")
  ws.getCell(3, 1).font = { ...EXCEL_THEME.fonts.subtitle }

  ws.getCell(4, 1).value =
    org?.contactLine || [org?.phone, org?.email].filter(Boolean).join(" · ")
  ws.getCell(4, 1).font = { ...EXCEL_THEME.fonts.subtitle }

  ws.getCell(1, 8).value = "Árajánlat"
  ws.getCell(1, 8).font = {
    name: "Calibri",
    size: 16,
    bold: true,
    color: { argb: "FF1E293B" },
  }
  ws.getCell(1, 8).alignment = { horizontal: "right", vertical: "middle" }

  ws.getCell(2, 8).value = model.projectName || model.title
  ws.getCell(2, 8).font = { ...EXCEL_THEME.fonts.bodyBold }
  ws.getCell(2, 8).alignment = { horizontal: "right", vertical: "middle" }

  ws.getCell(3, 8).value = "Költségvetés összesítő · szakági bontás"
  ws.getCell(3, 8).font = { ...EXCEL_THEME.fonts.subtitle }
  ws.getCell(3, 8).alignment = { horizontal: "right", vertical: "middle" }

  ws.getCell(4, 8).value = `Export dátuma: ${dateLabel}`
  ws.getCell(4, 8).font = { ...EXCEL_THEME.fonts.subtitle }
  ws.getCell(4, 8).alignment = { horizontal: "right", vertical: "middle" }

  if (model.clientName) {
    ws.getCell(5, 8).value = `Megrendelő: ${model.clientName}`
    ws.getCell(5, 8).font = { ...EXCEL_THEME.fonts.subtitle }
    ws.getCell(5, 8).alignment = { horizontal: "right", vertical: "middle" }
  }

  for (let r = 1; r <= SUMMARY_HEADER_ROWS; r++) {
    ws.getRow(r).height = r === 1 ? 24 : 17
  }

  for (let c = 1; c <= SUMMARY_LAST_COL; c++) {
    ws.getCell(SUMMARY_SEPARATOR_ROW, c).border = {
      bottom: { style: "medium", color: { argb: EXCEL_THEME.colors.separator } },
    }
  }
}

function buildSummarySheet(
  workbook: ExcelJS.Workbook,
  model: OfferPublicExportModel,
  planned: PlannedTrade[]
): void {
  const ws = workbook.addWorksheet(SUMMARY_SHEET_NAME, {
    views: [{ rightToLeft: false }],
  })
  applyColumnWidths(ws, [...SUMMARY_COLUMNS])
  writeCoverHeader(ws, model)
  writeTableHeaderRow(ws, SUMMARY_TABLE_HEADER_ROW, [...SUMMARY_HEADERS], 3)

  let row = SUMMARY_DATA_START_ROW
  for (let i = 0; i < planned.length; i++) {
    const { trade, sheetName, anchors } = planned[i]
    const matRef = quoteSheetRef(sheetName, anchors.materialTotal)
    const laborRef = quoteSheetRef(sheetName, anchors.laborTotal)
    const netRef = quoteSheetRef(sheetName, anchors.netTotal)
    const zebra = i % 2 === 1

    for (let c = 1; c <= SUMMARY_LAST_COL; c++) {
      const cell = ws.getCell(row, c)
      cell.fill = solidFill(zebra ? EXCEL_THEME.colors.zebraBg : "FFFFFFFF")
      cell.border = thinBorder()
      cell.alignment = {
        vertical: "middle",
        horizontal: c >= 3 ? "right" : "left",
      }
    }

    ws.getCell(row, 1).value = i + 1
    ws.getCell(row, 1).alignment = { horizontal: "center", vertical: "middle" }
    ws.getCell(row, 2).value = trade.tradeLabel
    ws.getCell(row, 2).font = { ...EXCEL_THEME.fonts.bodyBold }
    ws.getCell(row, 3).value = { formula: matRef }
    ws.getCell(row, 3).numFmt = EXCEL_THEME.numFmt.moneyFt
    ws.getCell(row, 4).value = { formula: laborRef }
    ws.getCell(row, 4).numFmt = EXCEL_THEME.numFmt.moneyFt
    ws.getCell(row, 5).value = { formula: netRef }
    ws.getCell(row, 5).numFmt = EXCEL_THEME.numFmt.moneyFt
    ws.getCell(row, 6).value = trade.vatAmount
    ws.getCell(row, 6).numFmt = EXCEL_THEME.numFmt.moneyFt
    ws.getCell(row, 7).value = { formula: `E${row}+F${row}` }
    ws.getCell(row, 7).numFmt = EXCEL_THEME.numFmt.moneyFt
    ws.getRow(row).height = 20
    row += 1
  }

  const totalRow = row
  styleFooterRow(ws, totalRow, SUMMARY_LAST_COL, 2)
  if (planned.length > 0) {
    const first = SUMMARY_DATA_START_ROW
    const last = row - 1
    for (const c of [3, 4, 5, 6, 7]) {
      const col = String.fromCharCode(64 + c)
      ws.getCell(totalRow, c).value = {
        formula: `SUM(${col}${first}:${col}${last})`,
      }
      ws.getCell(totalRow, c).numFmt = EXCEL_THEME.numFmt.moneyFt
    }
  }

  const panelLines: SummaryTotalsLine[] = [
    { label: "Nettó összesen:", formula: `E${totalRow}` },
    { label: "ÁFA összesen:", formula: `F${totalRow}` },
    { label: "Bruttó összesen:", formula: `G${totalRow}`, grand: true },
  ]
  const panelEnd =
    planned.length > 0
      ? writeSummaryTotalsPanel(ws, totalRow + 2, panelLines)
      : totalRow

  configureWorksheetPrint(ws, panelEnd, SUMMARY_LAST_COL, {
    frozenRow: SUMMARY_TABLE_HEADER_ROW,
    printTitlesRow: `${SUMMARY_TABLE_HEADER_ROW}:${SUMMARY_TABLE_HEADER_ROW}`,
  })
}

function buildTradeSheet(
  workbook: ExcelJS.Workbook,
  planned: PlannedTrade
): void {
  const { trade, sheetName } = planned
  const ws = workbook.addWorksheet(sheetName)
  const layout = tradeSheetLayout("sell")
  const sell = SELL_EXPORT_HEADERS.standard

  applyColumnWidths(ws, [...STANDARD_COLUMNS])
  writeTableHeaderRow(ws, layout.headerRow, [
    COL.ssz,
    COL.identifier,
    COL.text,
    COL.quantity,
    COL.unit,
    sell.materialUnit,
    sell.laborUnit,
    sell.materialTotal,
    sell.laborTotal,
    sell.lineNet,
  ])

  let row = layout.dataStartRow
  const dataRows: number[] = []

  if (trade.hasLineDetail && trade.lines.length > 0) {
    trade.lines.forEach((line, index) => {
      dataRows.push(row)
      styleDataRow(ws, row, TRADE_LAST_COL, {
        zebra: index % 2 === 1,
        unpriced: false,
      })

      ws.getCell(row, 1).value = line.ssz
      ws.getCell(row, 1).alignment = { horizontal: "center", vertical: "top" }

      const idCell = ws.getCell(row, 2)
      idCell.value = line.identifier
      idCell.font = { ...EXCEL_THEME.fonts.code }

      const textCell = ws.getCell(row, 3)
      textCell.value = line.text
      textCell.alignment = { horizontal: "left", vertical: "top", wrapText: true }

      const qty = ws.getCell(row, 4)
      qty.value = line.quantity
      qty.numFmt = quantityNumFmt(line.quantity)
      qty.alignment = { horizontal: "right", vertical: "top" }

      ws.getCell(row, 5).value = line.unit
      ws.getCell(row, 5).alignment = { horizontal: "center", vertical: "top" }

      styleMoneyInputCell(ws, row, 6)
      ws.getCell(row, 6).value = line.materialUnit
      styleMoneyInputCell(ws, row, 7)
      ws.getCell(row, 7).value = line.laborUnit

      styleComputedMoneyCell(ws, row, 8)
      ws.getCell(row, 8).value = {
        formula: `IF(D${row}="","",ROUND(D${row}*F${row},0))`,
      }
      styleComputedMoneyCell(ws, row, 9)
      ws.getCell(row, 9).value = {
        formula: `IF(D${row}="","",ROUND(D${row}*G${row},0))`,
      }
      styleComputedMoneyCell(ws, row, 10)
      ws.getCell(row, 10).value = {
        formula: `IF(D${row}="","",H${row}+I${row})`,
      }

      ws.getRow(row).height = estimateWrappedRowHeight(line.text, 45)
      row += 1
    })
  } else {
    dataRows.push(row)
    styleDataRow(ws, row, TRADE_LAST_COL, { zebra: false, unpriced: false })
    ws.getCell(row, 1).value = 1
    ws.getCell(row, 2).value = "—"
    ws.getCell(row, 3).value = trade.hasLineDetail
      ? trade.packageTitle
      : `${trade.packageTitle} (összesített szakág — tételes lista nem érhető el)`
    ws.getCell(row, 3).alignment = { wrapText: true, vertical: "top" }
    ws.getCell(row, 4).value = 1
    ws.getCell(row, 5).value = "össz"
    styleMoneyInputCell(ws, row, 6)
    ws.getCell(row, 6).value = trade.sellNetTotal
    styleMoneyInputCell(ws, row, 7)
    ws.getCell(row, 7).value = 0
    styleComputedMoneyCell(ws, row, 8)
    ws.getCell(row, 8).value = trade.sellNetTotal
    styleComputedMoneyCell(ws, row, 9)
    ws.getCell(row, 9).value = 0
    styleComputedMoneyCell(ws, row, 10)
    ws.getCell(row, 10).value = trade.sellNetTotal
    row += 1
  }

  const totalRow = row
  styleFooterRow(ws, totalRow, TRADE_LAST_COL, 7)
  if (dataRows.length > 0) {
    const first = dataRows[0]
    const last = dataRows[dataRows.length - 1]
    ws.getCell(totalRow, 8).value = { formula: `SUM(H${first}:H${last})` }
    ws.getCell(totalRow, 9).value = { formula: `SUM(I${first}:I${last})` }
    ws.getCell(totalRow, 10).value = { formula: `H${totalRow}+I${totalRow}` }
  } else {
    ws.getCell(totalRow, 8).value = 0
    ws.getCell(totalRow, 9).value = 0
    ws.getCell(totalRow, 10).value = trade.sellNetTotal
  }
  for (const c of [8, 9, 10]) {
    ws.getCell(totalRow, c).numFmt = EXCEL_THEME.numFmt.moneyFt
  }

  configureWorksheetPrint(ws, totalRow, TRADE_LAST_COL, layout.print)
}

export async function buildOfferPublicWorkbook(
  model: OfferPublicExportModel
): Promise<{ buffer: ArrayBuffer; filename: string }> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Építőártükör"
  workbook.created = new Date(model.exportedAt)

  const planned = planTrades(model.trades)
  buildSummarySheet(workbook, model, planned)
  for (const trade of planned) {
    buildTradeSheet(workbook, trade)
  }

  const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer
  return {
    buffer,
    filename: offerPublicExportFilename(model),
  }
}

export async function downloadOfferPublicExcel(
  model: OfferPublicExportModel
): Promise<string> {
  const { buffer, filename } = await buildOfferPublicWorkbook(model)
  downloadArrayBuffer(buffer, filename)
  return filename
}
