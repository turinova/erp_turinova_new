import ExcelJS from 'exceljs'

import {
  ACCESSORY_EXCEL_EXAMPLE_ROW,
  ACCESSORY_EXCEL_GUIDE_LINES,
  ACCESSORY_EXCEL_GUIDE_NAME,
  ACCESSORY_EXCEL_HEADERS,
  ACCESSORY_EXCEL_SHEET_NAME,
  ACCESSORY_IMPORT_MAX_ROWS,
  type AccessoryExcelHeader,
  type AccessoryExcelRow
} from '@/lib/accessories/excel-columns'
import { parseIntegerInput } from '@/lib/accessories/parse'
import {
  formatBoolHu,
  parseBoolHu
} from '@/lib/sheet-materials/excel-workbook'

export type AccessoryExportRow = AccessoryExcelRow

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

async function buildWorkbook(
  dataRows: Array<Record<AccessoryExcelHeader, string | number>>,
  includeExample: boolean
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Optinova'
  workbook.created = new Date()

  const guide = workbook.addWorksheet(ACCESSORY_EXCEL_GUIDE_NAME)
  for (const line of ACCESSORY_EXCEL_GUIDE_LINES) {
    guide.addRow([line])
  }
  guide.getColumn(1).width = 90

  const sheet = workbook.addWorksheet(ACCESSORY_EXCEL_SHEET_NAME)
  sheet.addRow([...ACCESSORY_EXCEL_HEADERS])
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.commit()

  if (includeExample && dataRows.length === 0) {
    sheet.addRow(
      ACCESSORY_EXCEL_HEADERS.map((h) => ACCESSORY_EXCEL_EXAMPLE_ROW[h])
    )
  }

  for (const row of dataRows) {
    sheet.addRow(ACCESSORY_EXCEL_HEADERS.map((h) => row[h]))
  }

  ACCESSORY_EXCEL_HEADERS.forEach((_, i) => {
    sheet.getColumn(i + 1).width = i === 1 ? 28 : 16
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

export async function buildAccessoriesTemplateBuffer(): Promise<Buffer> {
  return buildWorkbook([], true)
}

export async function buildAccessoriesExportBuffer(
  rows: AccessoryExportRow[]
): Promise<Buffer> {
  const dataRows = rows.map((r) => ({
    Gyarto: r.manufacturerName,
    Nev: r.name,
    SKU: r.sku,
    Vonalkod: r.barcode ?? '',
    Belso_vonalkod: r.barcodeInternal ?? '',
    Brutto_Ft: r.priceGross,
    Adonem: r.taxRateName,
    Egyseg: r.unitLabel,
    Aktiv: formatBoolHu(r.active),
    Kep_fajlnev: r.imageFilename ?? ''
  }))
  return buildWorkbook(dataRows, false)
}

export type ParsedAccessoryExcelRawRow = {
  rowNumber: number
  values: Record<AccessoryExcelHeader, string>
}

export async function parseAccessoriesWorkbook(
  buffer: ArrayBuffer | Buffer
): Promise<
  | { ok: true; rows: ParsedAccessoryExcelRawRow[] }
  | { ok: false; message: string }
> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as ExcelJS.Buffer)

  const sheet =
    workbook.getWorksheet(ACCESSORY_EXCEL_SHEET_NAME) ??
    workbook.worksheets.find(
      (ws) => ws.name !== ACCESSORY_EXCEL_GUIDE_NAME
    ) ??
    workbook.worksheets[0]

  if (!sheet) {
    return { ok: false, message: 'Az Excel fájlban nincs munkalap.' }
  }

  const headerRow = sheet.getRow(1)
  const headerMap = new Map<string, number>()
  headerRow.eachCell({ includeEmpty: false }, (cell, col) => {
    headerMap.set(cellText(cell.value).toLowerCase(), col)
  })

  const missing = ACCESSORY_EXCEL_HEADERS.filter(
    (h) => h !== 'Kep_fajlnev' && !headerMap.has(h.toLowerCase())
  )
  if (missing.length > 0) {
    return {
      ok: false,
      message: `Hiányzó oszlopok: ${missing.join(', ')}. Töltsd le a sablont.`
    }
  }

  const rows: ParsedAccessoryExcelRawRow[] = []
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return
    const values = {} as Record<AccessoryExcelHeader, string>
    let any = false
    for (const header of ACCESSORY_EXCEL_HEADERS) {
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
  if (rows.length > ACCESSORY_IMPORT_MAX_ROWS) {
    return {
      ok: false,
      message: `Legfeljebb ${ACCESSORY_IMPORT_MAX_ROWS} sor importálható egyszerre.`
    }
  }

  return { ok: true, rows }
}

export type CoercedAccessoryRow =
  | { ok: true; rowNumber: number; data: AccessoryExcelRow }
  | { ok: false; rowNumber: number; message: string }

export function coerceAccessoryExcelRow(
  raw: ParsedAccessoryExcelRawRow
): CoercedAccessoryRow {
  const v = raw.values
  const rowNumber = raw.rowNumber

  const manufacturerName = v.Gyarto
  const name = v.Nev
  const sku = v.SKU.trim()
  if (!manufacturerName) {
    return { ok: false, rowNumber, message: 'A gyártó kötelező.' }
  }
  if (!name) {
    return { ok: false, rowNumber, message: 'A név kötelező.' }
  }
  if (!sku) {
    return { ok: false, rowNumber, message: 'A SKU kötelező.' }
  }
  if (sku.length > 100) {
    return { ok: false, rowNumber, message: 'A SKU legfeljebb 100 karakter.' }
  }
  if (name.length > 200) {
    return { ok: false, rowNumber, message: 'A név legfeljebb 200 karakter.' }
  }

  const priceGross = parseIntegerInput(v.Brutto_Ft)
  if (priceGross === null || priceGross < 0) {
    return { ok: false, rowNumber, message: 'Érvénytelen bruttó Ft.' }
  }

  if (!v.Adonem) {
    return { ok: false, rowNumber, message: 'Az adónem kötelező.' }
  }
  if (!v.Egyseg) {
    return { ok: false, rowNumber, message: 'Az egység kötelező.' }
  }

  const active = parseBoolHu(v.Aktiv)
  if (active === null) {
    return { ok: false, rowNumber, message: 'Aktív: igen/nem.' }
  }

  const barcode = v.Vonalkod.trim() || null
  const barcodeInternal = v.Belso_vonalkod.trim() || null
  if (barcode && barcode.length > 64) {
    return {
      ok: false,
      rowNumber,
      message: 'A vonalkód legfeljebb 64 karakter.'
    }
  }
  if (barcodeInternal && barcodeInternal.length > 64) {
    return {
      ok: false,
      rowNumber,
      message: 'A belső vonalkód legfeljebb 64 karakter.'
    }
  }

  return {
    ok: true,
    rowNumber,
    data: {
      manufacturerName,
      name: name.trim(),
      sku,
      barcode,
      barcodeInternal,
      priceGross,
      taxRateName: v.Adonem,
      unitLabel: v.Egyseg.trim(),
      active,
      imageFilename: v.Kep_fajlnev.trim() || null
    }
  }
}
