import type { Workbook } from "exceljs"
import type { OrganizationProfile } from "@/types/organization"
import type { Project } from "@/types/projects"
import { resolveQuoteVatMode } from "@/lib/quote-client-summary"
import { quoteSheetRef } from "@/lib/project-export/sheet-name"
import {
  applyColumnWidths,
  configureWorksheetPrint,
  styleFooterRow,
  writeSummaryCoverHeader,
  writeSummaryTotalsPanel,
  writeTableHeaderRow,
  type SummaryTotalsLine,
} from "@/lib/project-export/excel-helpers"
import { EXCEL_THEME, solidFill, thinBorder } from "@/lib/project-export/excel-theme"
import {
  SUMMARY_COLUMNS,
  SUMMARY_DATA_START_ROW,
  SUMMARY_LAST_COL,
  SUMMARY_SHEET_NAME,
  SUMMARY_TABLE_HEADER_ROW,
} from "@/lib/project-export/excel-layout"
import type { BuiltTradeSheet, ProjectExportKind, ProjectExportQuoteSlice } from "@/lib/project-export/types"

export type SummaryTradeRef = {
  slice: ProjectExportQuoteSlice
  built: BuiltTradeSheet
}

const SELL_HEADERS = [
  "Ssz.",
  "Szakág",
  "Anyag összesen",
  "Díj összesen",
  "Nettó összesen",
  "ÁFA %",
  "ÁFA összeg",
  "Bruttó összesen",
] as const

const COST_HEADERS = [
  "Ssz.",
  "Szakág",
  "Anyag (bek.)",
  "Díj (bek.)",
  "Bekerülés nettó",
  "Fedezet össz.",
  "Eladás nettó",
  "ÁFA %",
  "ÁFA összeg",
  "Bruttó összesen",
] as const

export function buildSummarySheet(
  workbook: Workbook,
  input: {
    project: Project
    organization: OrganizationProfile
    kind: ProjectExportKind
    exportedAt: string
    trades: SummaryTradeRef[]
  }
): void {
  const { project, organization, kind, exportedAt, trades } = input
  const ws = workbook.addWorksheet(SUMMARY_SHEET_NAME, { views: [{ rightToLeft: false }] })
  const lastCol = SUMMARY_LAST_COL
  const isCost = kind === "cost"

  applyColumnWidths(ws, [...SUMMARY_COLUMNS])
  writeSummaryCoverHeader(workbook, ws, {
    organization,
    project,
    docTitle: isCost ? "Főösszesítő" : "Árajánlat",
    subtitle: isCost
      ? "Bekerülési tükör · bekerülés + fedezet + eladás"
      : "Költségvetés összesítő · szakági bontás",
    exportedAt,
  })

  writeTableHeaderRow(
    ws,
    SUMMARY_TABLE_HEADER_ROW,
    [...(isCost ? COST_HEADERS : SELL_HEADERS)],
    3
  )

  let row = SUMMARY_DATA_START_ROW
  for (let i = 0; i < trades.length; i++) {
    const { slice, built } = trades[i]
    const sheet = slice.sheetName
    const matRef = quoteSheetRef(sheet, built.anchors.materialTotal)
    const laborRef = quoteSheetRef(sheet, built.anchors.laborTotal)
    const netRef = quoteSheetRef(sheet, built.anchors.netTotal)
    const sellRef = built.anchors.sellTotal
      ? quoteSheetRef(sheet, built.anchors.sellTotal)
      : null
    const marginRef = built.anchors.marginTotal
      ? quoteSheetRef(sheet, built.anchors.marginTotal)
      : null

    const zebra = i % 2 === 1
    for (let c = 1; c <= lastCol; c++) {
      const cell = ws.getCell(row, c)
      cell.fill = solidFill(zebra ? EXCEL_THEME.colors.zebraBg : "FFFFFFFF")
      cell.border = thinBorder()
      cell.alignment = { vertical: "middle", horizontal: c >= 3 ? "right" : "left" }
    }

    ws.getCell(row, 1).value = i + 1
    ws.getCell(row, 1).alignment = { horizontal: "center", vertical: "middle" }
    ws.getCell(row, 2).value = slice.tradeLabel
    ws.getCell(row, 2).font = { ...EXCEL_THEME.fonts.bodyBold }
    ws.getCell(row, 3).value = { formula: matRef }
    ws.getCell(row, 3).numFmt = EXCEL_THEME.numFmt.moneyFt
    ws.getCell(row, 4).value = { formula: laborRef }
    ws.getCell(row, 4).numFmt = EXCEL_THEME.numFmt.moneyFt
    ws.getCell(row, 5).value = { formula: netRef }
    ws.getCell(row, 5).numFmt = EXCEL_THEME.numFmt.moneyFt

    const vatMode = resolveQuoteVatMode(slice.quote)
    const vatRate = vatMode === "standard" ? 27 : vatMode === "reduced" ? 5 : 0

    if (isCost && sellRef && marginRef) {
      ws.getCell(row, 6).value = { formula: marginRef }
      ws.getCell(row, 6).numFmt = EXCEL_THEME.numFmt.moneyFt
      ws.getCell(row, 7).value = { formula: sellRef }
      ws.getCell(row, 7).numFmt = EXCEL_THEME.numFmt.moneyFt
      ws.getCell(row, 8).value = vatRate
      ws.getCell(row, 8).numFmt = EXCEL_THEME.numFmt.percent
      ws.getCell(row, 9).value = {
        formula: vatRate === 0 ? "0" : `IF(G${row}=0,0,ROUND(G${row}*H${row}/100,0))`,
      }
      ws.getCell(row, 9).numFmt = EXCEL_THEME.numFmt.moneyFt
      ws.getCell(row, 10).value = { formula: `G${row}+I${row}` }
      ws.getCell(row, 10).numFmt = EXCEL_THEME.numFmt.moneyFt
    } else {
      ws.getCell(row, 6).value = vatRate
      ws.getCell(row, 6).numFmt = EXCEL_THEME.numFmt.percent
      ws.getCell(row, 7).value = {
        formula: vatRate === 0 ? "0" : `IF(E${row}=0,0,ROUND(E${row}*F${row}/100,0))`,
      }
      ws.getCell(row, 7).numFmt = EXCEL_THEME.numFmt.moneyFt
      ws.getCell(row, 8).value = { formula: `E${row}+G${row}` }
      ws.getCell(row, 8).numFmt = EXCEL_THEME.numFmt.moneyFt
    }

    ws.getRow(row).height = 20
    row += 1
  }

  const totalRow = row
  styleFooterRow(ws, totalRow, lastCol, 2)
  if (trades.length > 0) {
    const first = SUMMARY_DATA_START_ROW
    const last = row - 1
    ws.getCell(totalRow, 3).value = { formula: `SUM(C${first}:C${last})` }
    ws.getCell(totalRow, 4).value = { formula: `SUM(D${first}:D${last})` }
    ws.getCell(totalRow, 5).value = { formula: `SUM(E${first}:E${last})` }

    if (isCost) {
      ws.getCell(totalRow, 6).value = { formula: `SUM(F${first}:F${last})` }
      ws.getCell(totalRow, 7).value = { formula: `SUM(G${first}:G${last})` }
      ws.getCell(totalRow, 9).value = { formula: `SUM(I${first}:I${last})` }
      ws.getCell(totalRow, 10).value = { formula: `SUM(J${first}:J${last})` }
      for (const c of [3, 4, 5, 6, 7, 9, 10]) {
        ws.getCell(totalRow, c).numFmt = EXCEL_THEME.numFmt.moneyFt
      }
    } else {
      ws.getCell(totalRow, 7).value = { formula: `SUM(G${first}:G${last})` }
      ws.getCell(totalRow, 8).value = { formula: `SUM(H${first}:H${last})` }
      for (const c of [3, 4, 5, 7, 8]) {
        ws.getCell(totalRow, c).numFmt = EXCEL_THEME.numFmt.moneyFt
      }
    }
  }

  const panelLines: SummaryTotalsLine[] = isCost
    ? [
        { label: "Bekerülés nettó összesen:", formula: `E${totalRow}` },
        { label: "Fedezet összesen:", formula: `F${totalRow}` },
        { label: "Eladás nettó összesen:", formula: `G${totalRow}` },
        { label: "ÁFA összesen:", formula: `I${totalRow}` },
        { label: "Bruttó összesen:", formula: `J${totalRow}`, grand: true },
      ]
    : [
        { label: "Nettó összesen:", formula: `E${totalRow}` },
        { label: "ÁFA összesen:", formula: `G${totalRow}` },
        { label: "Bruttó összesen:", formula: `H${totalRow}`, grand: true },
      ]

  const panelEndRow =
    trades.length > 0
      ? writeSummaryTotalsPanel(ws, totalRow + 2, panelLines)
      : totalRow

  configureWorksheetPrint(ws, panelEndRow, lastCol, {
    frozenRow: SUMMARY_TABLE_HEADER_ROW,
    printTitlesRow: `${SUMMARY_TABLE_HEADER_ROW}:${SUMMARY_TABLE_HEADER_ROW}`,
  })
}
