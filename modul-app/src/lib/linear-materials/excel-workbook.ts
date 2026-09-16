import ExcelJS from 'exceljs'

import {
  LINEAR_EXCEL_EXAMPLE_ROW,
  LINEAR_EXCEL_GUIDE_LINES,
  LINEAR_EXCEL_GUIDE_NAME,
  LINEAR_EXCEL_HEADERS,
  LINEAR_EXCEL_SHEET_NAME,
  LINEAR_IMPORT_MAX_ROWS,
  type LinearExcelHeader,
  type LinearExcelRow
} from '@/lib/linear-materials/excel-columns'
import {
  LINEAR_MATERIAL_TYPE_LABELS,
  parseDecimalInput,
  parseIntegerInput,
  parseLinearMaterialTypeLabel,
  type LinearMaterialType
} from '@/lib/linear-materials/parse'

export type LinearExportRow = LinearExcelRow

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
  dataRows: Array<Record<LinearExcelHeader, string | number>>,
  includeExample: boolean
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Optinova'
  workbook.created = new Date()

  const guide = workbook.addWorksheet(LINEAR_EXCEL_GUIDE_NAME)
  for (const line of LINEAR_EXCEL_GUIDE_LINES) {
    guide.addRow([line])
  }
  guide.getColumn(1).width = 90

  const sheet = workbook.addWorksheet(LINEAR_EXCEL_SHEET_NAME)
  sheet.addRow([...LINEAR_EXCEL_HEADERS])
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.commit()

  if (includeExample && dataRows.length === 0) {
    sheet.addRow(LINEAR_EXCEL_HEADERS.map((h) => LINEAR_EXCEL_EXAMPLE_ROW[h]))
  }

  for (const row of dataRows) {
    sheet.addRow(LINEAR_EXCEL_HEADERS.map((h) => row[h]))
  }

  LINEAR_EXCEL_HEADERS.forEach((_, i) => {
    sheet.getColumn(i + 1).width = i === 2 ? 28 : 16
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

export async function buildLinearMaterialsTemplateBuffer(): Promise<Buffer> {
  return buildWorkbook([], true)
}

export async function buildLinearMaterialsExportBuffer(
  rows: LinearExportRow[]
): Promise<Buffer> {
  const dataRows = rows.map((r) => ({
    Gyarto: r.manufacturerName,
    Tipus: r.materialTypeLabel,
    Nev: r.name,
    Hossz_mm: r.lengthMm,
    Szelesseg_mm: r.widthMm,
    Vastagsag_mm: r.thicknessMm,
    Brutto_Ft_m: r.priceGross,
    Adonem: r.taxRateName,
    Raktari: formatBoolHu(r.onStock),
    Aktiv: formatBoolHu(r.active),
    Kep_fajlnev: r.imageFilename ?? ''
  }))
  return buildWorkbook(dataRows, false)
}

export type ParsedLinearExcelRawRow = {
  rowNumber: number
  values: Record<LinearExcelHeader, string>
}

export async function parseLinearMaterialsWorkbook(
  buffer: ArrayBuffer | Buffer
): Promise<
  | { ok: true; rows: ParsedLinearExcelRawRow[] }
  | { ok: false; message: string }
> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as ExcelJS.Buffer)

  const sheet =
    workbook.getWorksheet(LINEAR_EXCEL_SHEET_NAME) ??
    workbook.worksheets.find((ws) => ws.name !== LINEAR_EXCEL_GUIDE_NAME) ??
    workbook.worksheets[0]

  if (!sheet) {
    return { ok: false, message: 'Az Excel fájlban nincs munkalap.' }
  }

  const headerRow = sheet.getRow(1)
  const headerMap = new Map<string, number>()
  headerRow.eachCell({ includeEmpty: false }, (cell, col) => {
    headerMap.set(cellText(cell.value).toLowerCase(), col)
  })

  const missing = LINEAR_EXCEL_HEADERS.filter(
    (h) => h !== 'Kep_fajlnev' && !headerMap.has(h.toLowerCase())
  )
  if (missing.length > 0) {
    return {
      ok: false,
      message: `Hiányzó oszlopok: ${missing.join(', ')}. Töltsd le a sablont.`
    }
  }

  const rows: ParsedLinearExcelRawRow[] = []
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return
    const values = {} as Record<LinearExcelHeader, string>
    let any = false
    for (const header of LINEAR_EXCEL_HEADERS) {
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
  if (rows.length > LINEAR_IMPORT_MAX_ROWS) {
    return {
      ok: false,
      message: `Legfeljebb ${LINEAR_IMPORT_MAX_ROWS} sor importálható egyszerre.`
    }
  }

  return { ok: true, rows }
}

export type CoercedLinearRow =
  | {
      ok: true
      rowNumber: number
      data: LinearExcelRow & { materialType: LinearMaterialType }
    }
  | { ok: false; rowNumber: number; message: string }

export function coerceLinearExcelRow(
  raw: ParsedLinearExcelRawRow
): CoercedLinearRow {
  const v = raw.values
  const rowNumber = raw.rowNumber

  if (!v.Gyarto) {
    return { ok: false, rowNumber, message: 'A gyártó kötelező.' }
  }
  if (!v.Nev) {
    return { ok: false, rowNumber, message: 'A név kötelező.' }
  }

  const materialType = parseLinearMaterialTypeLabel(v.Tipus)
  if (!materialType) {
    return {
      ok: false,
      rowNumber,
      message: 'Típus: Hátfal, Munkalap vagy Asztalap.'
    }
  }

  const lengthMm = parseIntegerInput(v.Hossz_mm)
  const widthMm = parseIntegerInput(v.Szelesseg_mm)
  const thicknessMm = parseDecimalInput(v.Vastagsag_mm)
  const priceGross = parseIntegerInput(v.Brutto_Ft_m)
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
    return { ok: false, rowNumber, message: 'Érvénytelen bruttó Ft/m.' }
  }

  if (!v.Adonem) {
    return { ok: false, rowNumber, message: 'Az adónem kötelező.' }
  }

  const onStock = parseBoolHu(v.Raktari)
  const active = parseBoolHu(v.Aktiv)
  if (onStock === null) {
    return { ok: false, rowNumber, message: 'Raktári: igen/nem.' }
  }
  if (active === null) {
    return { ok: false, rowNumber, message: 'Aktív: igen/nem.' }
  }

  return {
    ok: true,
    rowNumber,
    data: {
      manufacturerName: v.Gyarto,
      materialTypeLabel: LINEAR_MATERIAL_TYPE_LABELS[materialType],
      materialType,
      name: v.Nev,
      lengthMm,
      widthMm,
      thicknessMm,
      priceGross,
      taxRateName: v.Adonem,
      onStock,
      active,
      imageFilename: v.Kep_fajlnev.trim() || null
    }
  }
}
