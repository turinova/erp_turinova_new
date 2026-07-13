import type { Workbook, Worksheet } from "exceljs"
import type { OrganizationProfile } from "@/types/organization"
import type { Project } from "@/types/projects"
import { formatHungarianAddress } from "@/lib/organizations/address"
import { organizationBankLine, organizationContactLine } from "@/lib/organization-profile"
import { EXCEL_THEME, solidFill, thinBorder } from "@/lib/project-export/excel-theme"
import {
  COST_MARGIN_COL,
  SHEET_HEADER_ROWS,
  SUMMARY_HEADER_ROWS,
  SUMMARY_LAST_COL,
  SUMMARY_SEPARATOR_ROW,
  SUMMARY_TABLE_HEADER_ROW,
  TABLE_HEADER_ROW,
  TRADE_TABLE_HEADER_ROW,
} from "@/lib/project-export/excel-layout"
import type { ProjectExportKind } from "@/lib/project-export/types"

type ColumnWidth = { width: number }

/** Becsült sor magasság (pt) tördelt szöveghez — oszlopszélesség alapján. */
export function estimateWrappedRowHeight(
  text: string,
  columnWidth: number,
  fontSize = 10
): number {
  const charsPerLine = Math.max(12, Math.floor(columnWidth * 0.82))
  const paragraphs = text.split(/\r?\n/)
  let lineCount = 0
  for (const paragraph of paragraphs) {
    const len = paragraph.length
    lineCount += Math.max(1, Math.ceil(len / charsPerLine))
  }
  const lineHeightPt = fontSize * 1.45
  return Math.max(15, Math.ceil(lineCount * lineHeightPt + 6))
}

export function applyColumnWidths(ws: Worksheet, columns: ColumnWidth[]): void {
  columns.forEach((c, i) => {
    const col = ws.getColumn(i + 1)
    col.width = c.width
  })
}

export function styleCell(
  ws: Worksheet,
  row: number,
  col: number,
  style: Parameters<Worksheet["getCell"]>[0] extends string ? never : object
): void {
  const cell = ws.getCell(row, col)
  Object.assign(cell, style)
}

export function setGridCell(
  ws: Worksheet,
  row: number,
  col: number,
  value: string | number | { formula: string } | null,
  style?: object
): void {
  const cell = ws.getCell(row, col)
  if (value === null) cell.value = ""
  else cell.value = value
  cell.border = thinBorder()
  if (style) Object.assign(cell, style)
}

export function writeTableHeaderRow(
  ws: Worksheet,
  row: number,
  labels: string[],
  rightAlignedFromCol = 4
): void {
  for (let col = 1; col <= labels.length; col++) {
    const cell = ws.getCell(row, col)
    cell.value = labels[col - 1] ?? ""
    cell.font = { ...EXCEL_THEME.fonts.header }
    cell.fill = solidFill(EXCEL_THEME.colors.headerBg)
    cell.border = thinBorder()
    cell.alignment = {
      vertical: "middle",
      horizontal: col >= rightAlignedFromCol ? "right" : "left",
      wrapText: false,
    }
  }
  ws.getRow(row).height = 22
}

export function styleSectionRow(ws: Worksheet, row: number, lastCol: number, label: string): void {
  ws.mergeCells(row, 1, row, Math.min(5, lastCol))
  const cell = ws.getCell(row, 1)
  cell.value = label
  cell.font = { ...EXCEL_THEME.fonts.bodyBold }
  cell.fill = solidFill(EXCEL_THEME.colors.sectionBg)
  cell.alignment = { vertical: "middle", horizontal: "left" }
  for (let c = 1; c <= lastCol; c++) {
    ws.getCell(row, c).border = thinBorder()
    if (c > 1 && c <= 5) {
      ws.getCell(row, c).fill = solidFill(EXCEL_THEME.colors.sectionBg)
    }
  }
  ws.getRow(row).height = 18
}

export function styleDataRow(
  ws: Worksheet,
  row: number,
  lastCol: number,
  opts: { zebra: boolean; unpriced: boolean }
): void {
  const bg = opts.unpriced
    ? EXCEL_THEME.colors.unpricedBg
    : opts.zebra
      ? EXCEL_THEME.colors.zebraBg
      : "FFFFFFFF"

  for (let c = 1; c <= lastCol; c++) {
    const cell = ws.getCell(row, c)
    if (!cell.fill) cell.fill = solidFill(bg)
    if (!cell.border) cell.border = thinBorder()
    cell.alignment = { ...cell.alignment, vertical: "top" }
  }
}

export function styleComputedMoneyCell(ws: Worksheet, row: number, col: number): void {
  const cell = ws.getCell(row, col)
  cell.fill = solidFill(EXCEL_THEME.colors.computedBg)
  cell.numFmt = EXCEL_THEME.numFmt.moneyFt
  cell.font = { ...EXCEL_THEME.fonts.body }
  cell.alignment = { horizontal: "right", vertical: "top" }
  cell.border = thinBorder()
}

export function styleMoneyInputCell(ws: Worksheet, row: number, col: number): void {
  const cell = ws.getCell(row, col)
  cell.numFmt = EXCEL_THEME.numFmt.money
  cell.font = { ...EXCEL_THEME.fonts.body }
  cell.alignment = { horizontal: "right", vertical: "top" }
  cell.border = thinBorder()
}

export function styleMarginSeparatorCell(ws: Worksheet, row: number): void {
  const cell = ws.getCell(row, COST_MARGIN_COL.separator)
  cell.fill = solidFill(EXCEL_THEME.colors.marginSeparatorBg)
  cell.border = {
    top: thinBorder().top,
    bottom: thinBorder().bottom,
    left: { style: "medium", color: { argb: EXCEL_THEME.colors.separator } },
    right: { style: "medium", color: { argb: EXCEL_THEME.colors.separator } },
  }
}

export function styleMarginInputCell(ws: Worksheet, row: number, col: number): void {
  const cell = ws.getCell(row, col)
  cell.fill = solidFill(EXCEL_THEME.colors.marginBlockBg)
  cell.font = { ...EXCEL_THEME.fonts.body }
  cell.alignment = { horizontal: "right", vertical: "top" }
  cell.border = thinBorder()
}

export function styleMarginComputedCell(ws: Worksheet, row: number, col: number): void {
  const cell = ws.getCell(row, col)
  cell.fill = solidFill(EXCEL_THEME.colors.marginBlockBg)
  cell.numFmt = EXCEL_THEME.numFmt.moneyFt
  cell.font = { ...EXCEL_THEME.fonts.body }
  cell.alignment = { horizontal: "right", vertical: "top" }
  cell.border = thinBorder()
}

export function styleFooterRow(ws: Worksheet, row: number, lastCol: number, labelCol: number): void {
  const labelCell = ws.getCell(row, labelCol)
  labelCell.value = "Összesen:"
  labelCell.font = { ...EXCEL_THEME.fonts.bodyBold }
  labelCell.alignment = { horizontal: "right", vertical: "middle" }
  labelCell.fill = solidFill(EXCEL_THEME.colors.footerBg)
  labelCell.border = {
    top: { style: "double", color: { argb: EXCEL_THEME.colors.separator } },
    left: thinBorder().left,
    bottom: thinBorder().bottom,
    right: thinBorder().right,
  }

  for (let c = 1; c <= lastCol; c++) {
    const cell = ws.getCell(row, c)
    cell.fill = solidFill(EXCEL_THEME.colors.footerBg)
    cell.font = { ...cell.font, ...EXCEL_THEME.fonts.bodyBold }
    if (c >= labelCol) {
      cell.border = {
        top: { style: "double", color: { argb: EXCEL_THEME.colors.separator } },
        left: thinBorder().left,
        bottom: thinBorder().bottom,
        right: thinBorder().right,
      }
    }
    if (c >= 8) cell.numFmt = EXCEL_THEME.numFmt.moneyFt
  }
  ws.getRow(row).height = 22
}

export function configureWorksheetPrint(
  ws: Worksheet,
  lastRow: number,
  lastCol: number,
  opts?: { frozenRow?: number; printTitlesRow?: string }
): void {
  const frozenRow = opts?.frozenRow ?? TABLE_HEADER_ROW
  const printTitlesRow = opts?.printTitlesRow ?? `${TABLE_HEADER_ROW}:${TABLE_HEADER_ROW}`
  ws.pageSetup = {
    paperSize: 9,
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.4,
      right: 0.4,
      top: 0.5,
      bottom: 0.5,
      header: 0.3,
      footer: 0.3,
    },
    printTitlesRow,
  }
  ws.pageSetup.printArea = `A1:${colLetter(lastCol)}${lastRow}`
  ws.views = [{ state: "frozen", ySplit: frozenRow, xSplit: 0, activeCell: "A8" }]
}

function colLetter(col: number): string {
  let n = col
  let s = ""
  while (n > 0) {
    const m = (n - 1) % 26
    s = String.fromCharCode(65 + m) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

function parseLogoDataUrl(dataUrl: string): { base64: string; extension: "png" | "jpeg" } | null {
  const match = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(dataUrl)
  if (!match) return null
  return {
    extension: match[1].toLowerCase() === "png" ? "png" : "jpeg",
    base64: match[2],
  }
}

export function writeSheetHeaderBlock(
  workbook: Workbook,
  ws: Worksheet,
  input: {
    organization: OrganizationProfile
    project: Project
    docTitle: string
    subtitle: string
    kind: ProjectExportKind
    exportedAt: string
  }
): void {
  const { organization, project, docTitle, subtitle, exportedAt } = input
  const addr = formatHungarianAddress(organization.headquarters)
  const contact = organizationContactLine(organization)
  const dateLabel = new Date(exportedAt).toLocaleDateString("hu-HU")

  ws.mergeCells(1, 1, 1, 4)
  ws.mergeCells(2, 1, 2, 4)
  ws.mergeCells(3, 1, 3, 4)
  ws.mergeCells(1, 6, 1, 9)
  ws.mergeCells(2, 6, 2, 9)
  ws.mergeCells(3, 6, 3, 9)

  const orgCell = ws.getCell(1, 1)
  orgCell.value = organization.legalName || "—"
  orgCell.font = { ...EXCEL_THEME.fonts.org }

  const addrCell = ws.getCell(2, 1)
  addrCell.value = addr || ""
  addrCell.font = { ...EXCEL_THEME.fonts.subtitle }

  const contactCell = ws.getCell(3, 1)
  contactCell.value = contact ?? organization.email ?? ""
  contactCell.font = { ...EXCEL_THEME.fonts.subtitle }

  const titleCell = ws.getCell(1, 6)
  titleCell.value = docTitle
  titleCell.font = { ...EXCEL_THEME.fonts.title }
  titleCell.alignment = { horizontal: "right", vertical: "middle" }

  const projectCell = ws.getCell(2, 6)
  projectCell.value = project.name
  projectCell.font = { ...EXCEL_THEME.fonts.bodyBold }
  projectCell.alignment = { horizontal: "right", vertical: "middle" }

  const metaCell = ws.getCell(3, 6)
  metaCell.value = `${subtitle} · ${dateLabel}`
  metaCell.font = { ...EXCEL_THEME.fonts.subtitle }
  metaCell.alignment = { horizontal: "right", vertical: "middle" }

  for (let r = 1; r <= SHEET_HEADER_ROWS; r++) {
    ws.getRow(r).height = r === 1 ? 22 : 16
  }

  const separatorRow = SHEET_HEADER_ROWS
  for (let c = 1; c <= 10; c++) {
    const cell = ws.getCell(separatorRow, c)
    cell.border = {
      bottom: { style: "medium", color: { argb: EXCEL_THEME.colors.separator } },
    }
  }

  const logo = organization.logoDataUrl ? parseLogoDataUrl(organization.logoDataUrl) : null
  if (logo) {
    try {
      const imageId = workbook.addImage({
        base64: logo.base64,
        extension: logo.extension,
      })
      ws.addImage(imageId, {
        tl: { col: 4.2, row: 0.1 },
        ext: { width: 110, height: 36 },
      })
    } catch {
      // logo hiba nem blokkolja az exportot
    }
  }
}

export function writeGrandTotalBlock(
  ws: Worksheet,
  startRow: number,
  labels: { net: string; vat?: string; gross: string },
  formulaRefs: { net: string; vat?: string; gross: string }
): number {
  let row = startRow + 1
  ws.mergeCells(row, 1, row, 4)
  const netLabel = ws.getCell(row, 1)
  netLabel.value = labels.net
  netLabel.font = { ...EXCEL_THEME.fonts.bodyBold }
  netLabel.alignment = { horizontal: "right" }
  const netVal = ws.getCell(row, 5)
  netVal.value = { formula: formulaRefs.net }
  netVal.numFmt = EXCEL_THEME.numFmt.moneyFt
  netVal.font = { ...EXCEL_THEME.fonts.bodyBold }
  netVal.alignment = { horizontal: "right" }
  row += 1

  if (labels.vat && formulaRefs.vat) {
    ws.mergeCells(row, 1, row, 4)
    ws.getCell(row, 1).value = labels.vat
    ws.getCell(row, 1).font = { ...EXCEL_THEME.fonts.body }
    ws.getCell(row, 1).alignment = { horizontal: "right" }
    ws.getCell(row, 5).value = { formula: formulaRefs.vat }
    ws.getCell(row, 5).numFmt = EXCEL_THEME.numFmt.moneyFt
    ws.getCell(row, 5).alignment = { horizontal: "right" }
    row += 1
  }

  ws.mergeCells(row, 1, row, 4)
  const grossLabel = ws.getCell(row, 1)
  grossLabel.value = labels.gross
  grossLabel.font = { ...EXCEL_THEME.fonts.grandTotal }
  grossLabel.alignment = { horizontal: "right" }
  grossLabel.fill = solidFill(EXCEL_THEME.colors.grandTotalBg)
  const grossVal = ws.getCell(row, 5)
  grossVal.value = { formula: formulaRefs.gross }
  grossVal.numFmt = EXCEL_THEME.numFmt.moneyFt
  grossVal.font = { ...EXCEL_THEME.fonts.grandTotal }
  grossVal.alignment = { horizontal: "right" }
  grossVal.fill = solidFill(EXCEL_THEME.colors.grandTotalBg)
  ws.getRow(row).height = 24

  return row
}

export type SummaryTotalsLine = {
  label: string
  formula: string
  grand?: boolean
}

/** Főösszesítő borító — logó, cégadatok, projekt (csak az első lapon). */
export function writeSummaryCoverHeader(
  workbook: Workbook,
  ws: Worksheet,
  input: {
    organization: OrganizationProfile
    project: Project
    docTitle: string
    subtitle: string
    exportedAt: string
  }
): void {
  const { organization, project, docTitle, subtitle, exportedAt } = input
  const addr = formatHungarianAddress(organization.headquarters)
  const contact = organizationContactLine(organization)
  const bank = organizationBankLine(organization)
  const dateLabel = new Date(exportedAt).toLocaleDateString("hu-HU")
  const hasLogo = Boolean(organization.logoDataUrl)
  const textStartCol = hasLogo ? 3 : 1

  ws.mergeCells(1, textStartCol, 1, 6)
  ws.mergeCells(2, textStartCol, 2, 6)
  ws.mergeCells(3, textStartCol, 3, 6)
  ws.mergeCells(4, textStartCol, 4, 6)
  if (bank) ws.mergeCells(5, textStartCol, 5, 6)

  ws.mergeCells(1, 8, 1, SUMMARY_LAST_COL)
  ws.mergeCells(2, 8, 2, SUMMARY_LAST_COL)
  ws.mergeCells(3, 8, 3, SUMMARY_LAST_COL)
  ws.mergeCells(4, 8, 4, SUMMARY_LAST_COL)
  ws.mergeCells(5, 8, 5, SUMMARY_LAST_COL)

  const orgCell = ws.getCell(1, textStartCol)
  orgCell.value = organization.legalName || "—"
  orgCell.font = { ...EXCEL_THEME.fonts.title }

  ws.getCell(2, textStartCol).value = addr || ""
  ws.getCell(2, textStartCol).font = { ...EXCEL_THEME.fonts.subtitle }

  const taxParts = [
    organization.taxNumber ? `Adószám: ${organization.taxNumber}` : null,
    organization.registrationNumber ? `Cégj.: ${organization.registrationNumber}` : null,
  ].filter(Boolean)
  ws.getCell(3, textStartCol).value = taxParts.join(" · ") || ""
  ws.getCell(3, textStartCol).font = { ...EXCEL_THEME.fonts.subtitle }

  ws.getCell(4, textStartCol).value = contact ?? organization.email ?? ""
  ws.getCell(4, textStartCol).font = { ...EXCEL_THEME.fonts.subtitle }

  if (bank) {
    ws.getCell(5, textStartCol).value = bank
    ws.getCell(5, textStartCol).font = { ...EXCEL_THEME.fonts.subtitle }
  }

  const titleCell = ws.getCell(1, 8)
  titleCell.value = docTitle
  titleCell.font = { name: "Calibri", size: 16, bold: true, color: { argb: "FF1E293B" } }
  titleCell.alignment = { horizontal: "right", vertical: "middle" }

  ws.getCell(2, 8).value = project.name
  ws.getCell(2, 8).font = { ...EXCEL_THEME.fonts.bodyBold }
  ws.getCell(2, 8).alignment = { horizontal: "right", vertical: "middle" }

  ws.getCell(3, 8).value = subtitle
  ws.getCell(3, 8).font = { ...EXCEL_THEME.fonts.subtitle }
  ws.getCell(3, 8).alignment = { horizontal: "right", vertical: "middle" }

  ws.getCell(4, 8).value = `Export dátuma: ${dateLabel}`
  ws.getCell(4, 8).font = { ...EXCEL_THEME.fonts.subtitle }
  ws.getCell(4, 8).alignment = { horizontal: "right", vertical: "middle" }

  if (project.clientName) {
    ws.getCell(5, 8).value = `Megrendelő: ${project.clientName}`
    ws.getCell(5, 8).font = { ...EXCEL_THEME.fonts.subtitle }
    ws.getCell(5, 8).alignment = { horizontal: "right", vertical: "middle" }
  }

  if (project.siteAddress) {
    ws.getCell(6, 8).value = `Telephely: ${project.siteAddress}`
    ws.getCell(6, 8).font = { ...EXCEL_THEME.fonts.subtitle }
    ws.getCell(6, 8).alignment = { horizontal: "right", vertical: "middle" }
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

  const logo = organization.logoDataUrl ? parseLogoDataUrl(organization.logoDataUrl) : null
  if (logo) {
    try {
      const imageId = workbook.addImage({
        base64: logo.base64,
        extension: logo.extension,
      })
      ws.addImage(imageId, {
        tl: { col: 0.15, row: 0.2 },
        ext: { width: 150, height: 52 },
      })
    } catch {
      // logo hiba nem blokkolja az exportot
    }
  }
}

/** Jobb oldali összesítő panel — nettó / ÁFA / bruttó bontás. */
export function writeSummaryTotalsPanel(
  ws: Worksheet,
  startRow: number,
  lines: SummaryTotalsLine[]
): number {
  const labelStartCol = 6
  const labelEndCol = 8
  const valueCol = 9
  let row = startRow

  ws.mergeCells(row, labelStartCol, row, valueCol)
  const titleCell = ws.getCell(row, labelStartCol)
  titleCell.value = "Összesítés"
  titleCell.font = { ...EXCEL_THEME.fonts.bodyBold }
  titleCell.fill = solidFill(EXCEL_THEME.colors.headerBg)
  titleCell.alignment = { horizontal: "center", vertical: "middle" }
  titleCell.border = thinBorder()
  row += 1

  for (const line of lines) {
    ws.mergeCells(row, labelStartCol, row, labelEndCol)
    const labelCell = ws.getCell(row, labelStartCol)
    labelCell.value = line.label
    labelCell.font = line.grand ? { ...EXCEL_THEME.fonts.grandTotal } : { ...EXCEL_THEME.fonts.body }
    labelCell.alignment = { horizontal: "right", vertical: "middle" }
    labelCell.border = thinBorder()
    if (line.grand) labelCell.fill = solidFill(EXCEL_THEME.colors.grandTotalBg)

    const valueCell = ws.getCell(row, valueCol)
    valueCell.value = { formula: line.formula }
    valueCell.numFmt = EXCEL_THEME.numFmt.moneyFt
    valueCell.font = line.grand ? { ...EXCEL_THEME.fonts.grandTotal } : { ...EXCEL_THEME.fonts.bodyBold }
    valueCell.alignment = { horizontal: "right", vertical: "middle" }
    valueCell.border = thinBorder()
    if (line.grand) valueCell.fill = solidFill(EXCEL_THEME.colors.grandTotalBg)
    ws.getRow(row).height = line.grand ? 24 : 20
    row += 1
  }

  return row - 1
}
