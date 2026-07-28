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
  rfqPublicExportFilename,
  type RfqPublicExportLine,
  type RfqPublicExportModel,
  type RfqPublicExportPackage,
} from "@/lib/rfq-public-export/build-export-model"

const LAST_COL = 10

const SUMMARY_HEADERS = [
  "Ssz.",
  "Szakág",
  "Anyag összesen",
  "Díj összesen",
  "Nettó összesen",
] as const

type PlannedTrade = {
  pkg: RfqPublicExportPackage
  sheetName: string
  anchors: {
    materialTotal: string
    laborTotal: string
    netTotal: string
  }
}

function resolvePackages(model: RfqPublicExportModel): RfqPublicExportPackage[] {
  if (model.packages.length > 0) return model.packages
  return [
    {
      packageId: "primary",
      tradeLabel: model.packageTitle || "Szakág",
      packageTitle: model.packageTitle,
      expiresAt: model.expiresAt,
      hasSubmission: model.mode === "offer",
      totalAmount: model.totalAmount,
      lines: model.lines,
    },
  ]
}

function planTrades(packages: RfqPublicExportPackage[]): PlannedTrade[] {
  const layout = tradeSheetLayout("sell")
  const usedNames = new Set<string>()
  return packages.map((pkg) => {
    const sheetName = sanitizeSheetName(pkg.tradeLabel || pkg.packageTitle, usedNames)
    // sell: header 1, data from 2, footer after last data row
    const totalRow =
      pkg.lines.length === 0
        ? layout.dataStartRow
        : layout.dataStartRow + pkg.lines.length
    return {
      pkg,
      sheetName,
      anchors: {
        materialTotal: cellRef(8, totalRow),
        laborTotal: cellRef(9, totalRow),
        netTotal: cellRef(10, totalRow),
      },
    }
  })
}

function writePublicCoverHeader(
  ws: ExcelJS.Worksheet,
  model: RfqPublicExportModel
): void {
  const dateLabel = new Date(model.exportedAt).toLocaleDateString("hu-HU")

  ws.mergeCells(1, 1, 1, 5)
  ws.mergeCells(2, 1, 2, 5)
  ws.mergeCells(3, 1, 3, 5)
  ws.mergeCells(4, 1, 4, 5)

  ws.mergeCells(1, 8, 1, SUMMARY_LAST_COL)
  ws.mergeCells(2, 8, 2, SUMMARY_LAST_COL)
  ws.mergeCells(3, 8, 3, SUMMARY_LAST_COL)
  ws.mergeCells(4, 8, 4, SUMMARY_LAST_COL)
  ws.mergeCells(5, 8, 5, SUMMARY_LAST_COL)

  ws.getCell(1, 1).value = model.partnerName || "Alvállalkozó"
  ws.getCell(1, 1).font = { ...EXCEL_THEME.fonts.title }

  const contactParts = [model.contactPhone, model.contactEmail].filter(Boolean)
  ws.getCell(2, 1).value = contactParts.join(" · ")
  ws.getCell(2, 1).font = { ...EXCEL_THEME.fonts.subtitle }

  ws.getCell(3, 1).value =
    model.mode === "offer"
      ? "Kitöltött alvállalkozói ajánlat"
      : "Üres árajánlatkérési sablon"
  ws.getCell(3, 1).font = { ...EXCEL_THEME.fonts.subtitle }

  if (model.notes) {
    ws.getCell(4, 1).value = `Megjegyzés: ${model.notes}`
    ws.getCell(4, 1).font = { ...EXCEL_THEME.fonts.subtitle }
  }

  ws.getCell(1, 8).value = model.title
  ws.getCell(1, 8).font = {
    name: "Calibri",
    size: 16,
    bold: true,
    color: { argb: "FF1E293B" },
  }
  ws.getCell(1, 8).alignment = { horizontal: "right", vertical: "middle" }

  ws.getCell(2, 8).value = model.projectName || "—"
  ws.getCell(2, 8).font = { ...EXCEL_THEME.fonts.bodyBold }
  ws.getCell(2, 8).alignment = { horizontal: "right", vertical: "middle" }

  ws.getCell(3, 8).value =
    model.mode === "offer"
      ? "Szakági bontás · partner árak"
      : "Szakági bontás · kitöltendő sablon"
  ws.getCell(3, 8).font = { ...EXCEL_THEME.fonts.subtitle }
  ws.getCell(3, 8).alignment = { horizontal: "right", vertical: "middle" }

  ws.getCell(4, 8).value = `Export dátuma: ${dateLabel}`
  ws.getCell(4, 8).font = { ...EXCEL_THEME.fonts.subtitle }
  ws.getCell(4, 8).alignment = { horizontal: "right", vertical: "middle" }

  if (model.siteAddress || model.projectCode) {
    ws.getCell(5, 8).value = [model.siteAddress, model.projectCode]
      .filter(Boolean)
      .join(" · ")
    ws.getCell(5, 8).font = { ...EXCEL_THEME.fonts.subtitle }
    ws.getCell(5, 8).alignment = { horizontal: "right", vertical: "middle" }
  }

  for (let r = 1; r <= SUMMARY_HEADER_ROWS; r++) {
    ws.getRow(r).height = r === 1 ? 24 : 17
  }

  for (let c = 1; c <= SUMMARY_LAST_COL; c++) {
    const cell = ws.getCell(SUMMARY_SEPARATOR_ROW, c)
    cell.border = {
      bottom: { style: "medium", color: { argb: EXCEL_THEME.colors.separator } },
    }
  }
}

function buildSummarySheet(
  workbook: ExcelJS.Workbook,
  model: RfqPublicExportModel,
  trades: PlannedTrade[]
): void {
  const ws = workbook.addWorksheet(SUMMARY_SHEET_NAME, {
    views: [{ rightToLeft: false }],
  })
  applyColumnWidths(ws, [...SUMMARY_COLUMNS])
  writePublicCoverHeader(ws, model)

  writeTableHeaderRow(ws, SUMMARY_TABLE_HEADER_ROW, [...SUMMARY_HEADERS], 3)

  let row = SUMMARY_DATA_START_ROW
  for (let i = 0; i < trades.length; i++) {
    const { pkg, sheetName, anchors } = trades[i]
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
    ws.getCell(row, 2).value = pkg.tradeLabel
    ws.getCell(row, 2).font = { ...EXCEL_THEME.fonts.bodyBold }
    ws.getCell(row, 3).value = { formula: matRef }
    ws.getCell(row, 3).numFmt = EXCEL_THEME.numFmt.moneyFt
    ws.getCell(row, 4).value = { formula: laborRef }
    ws.getCell(row, 4).numFmt = EXCEL_THEME.numFmt.moneyFt
    ws.getCell(row, 5).value = { formula: netRef }
    ws.getCell(row, 5).numFmt = EXCEL_THEME.numFmt.moneyFt

    ws.getRow(row).height = 20
    row += 1
  }

  const totalRow = row
  styleFooterRow(ws, totalRow, SUMMARY_LAST_COL, 2)
  if (trades.length > 0) {
    const first = SUMMARY_DATA_START_ROW
    const last = row - 1
    ws.getCell(totalRow, 3).value = { formula: `SUM(C${first}:C${last})` }
    ws.getCell(totalRow, 4).value = { formula: `SUM(D${first}:D${last})` }
    ws.getCell(totalRow, 5).value = { formula: `SUM(E${first}:E${last})` }
    for (const c of [3, 4, 5]) {
      ws.getCell(totalRow, c).numFmt = EXCEL_THEME.numFmt.moneyFt
    }
  }

  const panelLines: SummaryTotalsLine[] = [
    { label: "Nettó összesen:", formula: `E${totalRow}`, grand: true },
  ]
  const panelEndRow =
    trades.length > 0
      ? writeSummaryTotalsPanel(ws, totalRow + 2, panelLines)
      : totalRow

  configureWorksheetPrint(ws, panelEndRow, SUMMARY_LAST_COL, {
    frozenRow: SUMMARY_TABLE_HEADER_ROW,
    printTitlesRow: `${SUMMARY_TABLE_HEADER_ROW}:${SUMMARY_TABLE_HEADER_ROW}`,
  })
}

function writeTradeLineRow(
  ws: ExcelJS.Worksheet,
  row: number,
  line: RfqPublicExportLine,
  mode: RfqPublicExportModel["mode"],
  packageHasSubmission: boolean,
  zebra: boolean
): void {
  const fillPrices = mode === "offer" && packageHasSubmission
  const unpriced =
    !fillPrices ||
    line.declined ||
    ((line.materialUnit ?? 0) === 0 && (line.laborUnit ?? 0) === 0)

  styleDataRow(ws, row, LAST_COL, { zebra, unpriced: Boolean(unpriced) })

  ws.getCell(row, 1).value = line.ssz
  ws.getCell(row, 1).alignment = { horizontal: "center", vertical: "top" }

  const idCell = ws.getCell(row, 2)
  idCell.value = "—"
  idCell.font = { ...EXCEL_THEME.fonts.code }
  idCell.alignment = { horizontal: "left", vertical: "top" }

  const textCell = ws.getCell(row, 3)
  textCell.value = line.text
  textCell.alignment = { horizontal: "left", vertical: "top", wrapText: true }

  const qtyCell = ws.getCell(row, 4)
  qtyCell.value = line.quantity
  qtyCell.numFmt = quantityNumFmt(line.quantity)
  qtyCell.alignment = { horizontal: "right", vertical: "top" }

  ws.getCell(row, 5).value = line.unit
  ws.getCell(row, 5).alignment = { horizontal: "center", vertical: "top" }

  if (line.declined) {
    styleMoneyInputCell(ws, row, 6)
    styleMoneyInputCell(ws, row, 7)
    styleComputedMoneyCell(ws, row, 8)
    styleComputedMoneyCell(ws, row, 9)
    styleComputedMoneyCell(ws, row, 10)
    ws.mergeCells(row, 6, row, 7)
    ws.getCell(row, 6).value = "nem vállalom"
    ws.getCell(row, 6).font = {
      ...EXCEL_THEME.fonts.body,
      italic: true,
      color: { argb: "FF64748B" },
    }
    ws.getCell(row, 6).alignment = { horizontal: "left", vertical: "top" }
    ws.getCell(row, 6).numFmt = "@"
    ws.getCell(row, 8).value = 0
    ws.getCell(row, 9).value = 0
    ws.getCell(row, 10).value = 0
  } else {
    styleMoneyInputCell(ws, row, 6)
    styleMoneyInputCell(ws, row, 7)

    if (!fillPrices) {
      ws.getCell(row, 6).value = null
      ws.getCell(row, 7).value = null
      ws.getCell(row, 6).fill = solidFill("FFFFFDE7")
      ws.getCell(row, 7).fill = solidFill("FFFFFDE7")
    } else {
      ws.getCell(row, 6).value = line.materialUnit ?? 0
      ws.getCell(row, 7).value = line.laborUnit ?? 0
    }

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
  }

  ws.getRow(row).height = estimateWrappedRowHeight(
    line.text,
    STANDARD_COLUMNS[2].width
  )
}

function buildTradeSheet(
  workbook: ExcelJS.Workbook,
  planned: PlannedTrade,
  mode: RfqPublicExportModel["mode"]
): void {
  const { pkg, sheetName } = planned
  const ws = workbook.addWorksheet(sheetName)
  const layout = tradeSheetLayout("sell")
  const sellHeaders = SELL_EXPORT_HEADERS.standard

  applyColumnWidths(ws, [...STANDARD_COLUMNS])

  writeTableHeaderRow(ws, layout.headerRow, [
    COL.ssz,
    COL.identifier,
    COL.text,
    COL.quantity,
    COL.unit,
    sellHeaders.materialUnit,
    sellHeaders.laborUnit,
    sellHeaders.materialTotal,
    sellHeaders.laborTotal,
    sellHeaders.lineNet,
  ])

  let row = layout.dataStartRow
  const dataRows: number[] = []
  let lineIndex = 0

  for (const line of pkg.lines) {
    dataRows.push(row)
    writeTradeLineRow(
      ws,
      row,
      line,
      mode,
      pkg.hasSubmission,
      lineIndex % 2 === 1
    )
    lineIndex += 1
    row += 1
  }

  const totalRow = row
  styleFooterRow(ws, totalRow, LAST_COL, 7)
  if (dataRows.length > 0) {
    const first = dataRows[0]
    const last = dataRows[dataRows.length - 1]
    ws.getCell(totalRow, 8).value = { formula: `SUM(H${first}:H${last})` }
    ws.getCell(totalRow, 9).value = { formula: `SUM(I${first}:I${last})` }
    ws.getCell(totalRow, 10).value = { formula: `H${totalRow}+I${totalRow}` }
  } else {
    ws.getCell(totalRow, 8).value = 0
    ws.getCell(totalRow, 9).value = 0
    ws.getCell(totalRow, 10).value = 0
  }
  for (const c of [8, 9, 10]) {
    ws.getCell(totalRow, c).numFmt = EXCEL_THEME.numFmt.moneyFt
  }

  configureWorksheetPrint(ws, totalRow, LAST_COL, layout.print)
}

export async function buildRfqPublicWorkbook(
  model: RfqPublicExportModel
): Promise<{ buffer: ArrayBuffer; filename: string }> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Építőártükör"
  workbook.created = new Date(model.exportedAt)

  const packages = resolvePackages(model)
  const planned = planTrades(packages)

  // Főösszesítő mindig az első lap
  buildSummarySheet(workbook, model, planned)
  for (const trade of planned) {
    buildTradeSheet(workbook, trade, model.mode)
  }

  const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer
  return {
    buffer,
    filename: rfqPublicExportFilename(model),
  }
}

export async function downloadRfqPublicExcel(
  model: RfqPublicExportModel
): Promise<string> {
  const { buffer, filename } = await buildRfqPublicWorkbook(model)
  downloadArrayBuffer(buffer, filename)
  return filename
}
