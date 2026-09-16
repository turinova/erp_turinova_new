import ExcelJS from 'exceljs'

import {
  SHEET_EXCEL_EXAMPLE_ROW,
  SHEET_EXCEL_GUIDE_LINES,
  SHEET_EXCEL_GUIDE_NAME,
  SHEET_EXCEL_HEADERS,
  SHEET_EXCEL_SHEET_NAME,
  SHEET_IMPORT_MAX_ROWS,
  type SheetExcelHeader,
  type SheetExcelRow
} from '@/lib/sheet-materials/excel-columns'
import {
  parseDecimalInput,
  parseIntegerInput
} from '@/lib/sheet-materials/parse'

export type SheetExportRow = SheetExcelRow

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'igen' : 'nem'
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object' && 'text' in value) {
    return String(value.text ?? '').trim()
  }
  if (typeof value === 'object' && 'result' in value) {
    return cellText(value.result as ExcelJS.CellValue)
  }
  return String(value).trim()
}

export function formatBoolHu(value: boolean): string {
  return value ? 'igen' : 'nem'
}

export function parseBoolHu(raw: string): boolean | null {
  const v = raw.trim().toLowerCase()
  if (!v) return null
  if (['igen', 'i', 'yes', 'y', 'true', '1'].includes(v)) return true
  if (['nem', 'n', 'no', 'false', '0'].includes(v)) return false
  return null
}

async function buildWorkbook(
  dataRows: Array<Record<SheetExcelHeader, string | number>>,
  includeExample: boolean
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Optinova'
  workbook.created = new Date()

  const guide = workbook.addWorksheet(SHEET_EXCEL_GUIDE_NAME)
  for (const line of SHEET_EXCEL_GUIDE_LINES) {
    guide.addRow([line])
  }
  guide.getColumn(1).width = 90

  const sheet = workbook.addWorksheet(SHEET_EXCEL_SHEET_NAME)
  sheet.addRow([...SHEET_EXCEL_HEADERS])
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.commit()

  if (includeExample && dataRows.length === 0) {
    sheet.addRow(SHEET_EXCEL_HEADERS.map((h) => SHEET_EXCEL_EXAMPLE_ROW[h]))
  }

  for (const row of dataRows) {
    sheet.addRow(SHEET_EXCEL_HEADERS.map((h) => row[h]))
  }

  SHEET_EXCEL_HEADERS.forEach((_, i) => {
    sheet.getColumn(i + 1).width = i === 1 ? 28 : 16
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

export async function buildSheetMaterialsTemplateBuffer(): Promise<Buffer> {
  return buildWorkbook([], true)
}

export async function buildSheetMaterialsExportBuffer(
  rows: SheetExportRow[]
): Promise<Buffer> {
  const dataRows = rows.map((r) => ({
    Gyarto: r.manufacturerName,
    Nev: r.name,
    Hossz_mm: r.lengthMm,
    Szelesseg_mm: r.widthMm,
    Vastagsag_mm: r.thicknessMm,
    Brutto_Ft_m2: r.priceGross,
    Adonem: r.taxRateName,
    Berendezes: r.equipmentName,
    Gepkod: r.machineCode,
    Raktari: formatBoolHu(r.onStock),
    Aktiv: formatBoolHu(r.active),
    Trim_fel_mm: r.trimTopMm,
    Trim_jobb_mm: r.trimRightMm,
    Trim_le_mm: r.trimBottomMm,
    Trim_bal_mm: r.trimLeftMm,
    Kerf_mm: r.kerfMm,
    Hulladek_szorzo: r.wasteMulti,
    Kihasznaltsag_szazalek: r.usageLimitPercent,
    Szalirany: formatBoolHu(r.grainDirection),
    Forgathato: formatBoolHu(r.rotatable),
    Kep_fajlnev: r.imageFilename ?? ''
  }))
  return buildWorkbook(dataRows, false)
}

export type ParsedSheetExcelRawRow = {
  rowNumber: number
  values: Record<SheetExcelHeader, string>
}

export async function parseSheetMaterialsWorkbook(
  buffer: ArrayBuffer | Buffer
): Promise<
  | { ok: true; rows: ParsedSheetExcelRawRow[] }
  | { ok: false; message: string }
> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as ExcelJS.Buffer)

  const sheet =
    workbook.getWorksheet(SHEET_EXCEL_SHEET_NAME) ??
    workbook.worksheets.find((ws) => ws.name !== SHEET_EXCEL_GUIDE_NAME) ??
    workbook.worksheets[0]

  if (!sheet) {
    return { ok: false, message: 'Az Excel fájlban nincs munkalap.' }
  }

  const headerRow = sheet.getRow(1)
  const headerMap = new Map<string, number>()
  headerRow.eachCell({ includeEmpty: false }, (cell, col) => {
    headerMap.set(cellText(cell.value).toLowerCase(), col)
  })

  const missing = SHEET_EXCEL_HEADERS.filter(
    (h) => h !== 'Kep_fajlnev' && !headerMap.has(h.toLowerCase())
  )
  if (missing.length > 0) {
    return {
      ok: false,
      message: `Hiányzó oszlopok: ${missing.join(', ')}. Töltsd le a sablont.`
    }
  }

  const rows: ParsedSheetExcelRawRow[] = []
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return
    const values = {} as Record<SheetExcelHeader, string>
    let any = false
    for (const header of SHEET_EXCEL_HEADERS) {
      const col = headerMap.get(header.toLowerCase())
      const text = col != null ? cellText(row.getCell(col).value) : ''
      values[header] = text
      if (text) any = true
    }
    if (!any) return
    rows.push({ rowNumber, values })
  })

  if (rows.length === 0) {
    return { ok: false, message: 'Nincs importálható adatsor a fájlban.' }
  }
  if (rows.length > SHEET_IMPORT_MAX_ROWS) {
    return {
      ok: false,
      message: `Legfeljebb ${SHEET_IMPORT_MAX_ROWS} sor importálható egyszerre.`
    }
  }

  return { ok: true, rows }
}

export type CoercedSheetRow =
  | { ok: true; rowNumber: number; data: SheetExcelRow }
  | { ok: false; rowNumber: number; message: string }

export function coerceSheetExcelRow(
  raw: ParsedSheetExcelRawRow
): CoercedSheetRow {
  const v = raw.values
  const rowNumber = raw.rowNumber

  const manufacturerName = v.Gyarto
  const name = v.Nev
  if (!manufacturerName) {
    return { ok: false, rowNumber, message: 'A gyártó kötelező.' }
  }
  if (!name) {
    return { ok: false, rowNumber, message: 'A név kötelező.' }
  }

  const lengthMm = parseIntegerInput(v.Hossz_mm)
  const widthMm = parseIntegerInput(v.Szelesseg_mm)
  const thicknessMm = parseDecimalInput(v.Vastagsag_mm)
  const priceGross = parseIntegerInput(v.Brutto_Ft_m2)
  if (lengthMm === null || lengthMm <= 0) {
    return { ok: false, rowNumber, message: 'Érvénytelen hossz (mm).' }
  }
  if (widthMm === null || widthMm <= 0) {
    return { ok: false, rowNumber, message: 'Érvénytelen szélesség (mm).' }
  }
  if (thicknessMm === null || thicknessMm <= 0) {
    return { ok: false, rowNumber, message: 'Érvénytelen vastagság (mm).' }
  }
  if (priceGross === null || priceGross < 0) {
    return { ok: false, rowNumber, message: 'Érvénytelen bruttó Ft/m².' }
  }

  if (!v.Adonem) {
    return { ok: false, rowNumber, message: 'Az adónem kötelező.' }
  }
  if (!v.Berendezes) {
    return { ok: false, rowNumber, message: 'A berendezés kötelező.' }
  }
  if (!v.Gepkod) {
    return { ok: false, rowNumber, message: 'A gépkód kötelező.' }
  }

  const onStock = parseBoolHu(v.Raktari)
  const active = parseBoolHu(v.Aktiv)
  const grainDirection = parseBoolHu(v.Szalirany)
  const rotatable = parseBoolHu(v.Forgathato)
  if (onStock === null) {
    return { ok: false, rowNumber, message: 'Raktári: igen/nem.' }
  }
  if (active === null) {
    return { ok: false, rowNumber, message: 'Aktív: igen/nem.' }
  }
  if (grainDirection === null) {
    return { ok: false, rowNumber, message: 'Szálirány: igen/nem.' }
  }
  if (rotatable === null) {
    return { ok: false, rowNumber, message: 'Forgatható: igen/nem.' }
  }

  const trimTopMm = parseIntegerInput(v.Trim_fel_mm)
  const trimRightMm = parseIntegerInput(v.Trim_jobb_mm)
  const trimBottomMm = parseIntegerInput(v.Trim_le_mm)
  const trimLeftMm = parseIntegerInput(v.Trim_bal_mm)
  const kerfMm = parseIntegerInput(v.Kerf_mm)
  const wasteMulti = parseDecimalInput(v.Hulladek_szorzo)
  const usageLimitPercent = parseDecimalInput(v.Kihasznaltsag_szazalek)

  if (
    trimTopMm === null ||
    trimRightMm === null ||
    trimBottomMm === null ||
    trimLeftMm === null ||
    trimTopMm < 0 ||
    trimRightMm < 0 ||
    trimBottomMm < 0 ||
    trimLeftMm < 0
  ) {
    return { ok: false, rowNumber, message: 'Érvénytelen trim érték.' }
  }
  if (kerfMm === null || kerfMm < 0) {
    return { ok: false, rowNumber, message: 'Érvénytelen kerf (mm).' }
  }
  if (wasteMulti === null || wasteMulti <= 0 || wasteMulti > 10) {
    return { ok: false, rowNumber, message: 'Érvénytelen hulladékszorzó.' }
  }
  if (
    usageLimitPercent === null ||
    usageLimitPercent < 0 ||
    usageLimitPercent > 100
  ) {
    return {
      ok: false,
      rowNumber,
      message: 'Kihasználtság 0–100% között legyen.'
    }
  }

  return {
    ok: true,
    rowNumber,
    data: {
      manufacturerName,
      name,
      lengthMm,
      widthMm,
      thicknessMm,
      priceGross,
      taxRateName: v.Adonem,
      equipmentName: v.Berendezes,
      machineCode: v.Gepkod.trim(),
      onStock,
      active,
      trimTopMm,
      trimRightMm,
      trimBottomMm,
      trimLeftMm,
      kerfMm,
      wasteMulti,
      usageLimitPercent,
      grainDirection,
      rotatable,
      imageFilename: v.Kep_fajlnev.trim() || null
    }
  }
}
