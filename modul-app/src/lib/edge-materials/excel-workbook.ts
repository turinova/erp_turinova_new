import ExcelJS from 'exceljs'

import {
  EDGE_EXCEL_EXAMPLE_ROW,
  EDGE_EXCEL_GUIDE_LINES,
  EDGE_EXCEL_GUIDE_NAME,
  EDGE_EXCEL_HEADERS,
  EDGE_EXCEL_SHEET_NAME,
  EDGE_IMPORT_MAX_ROWS,
  type EdgeExcelHeader,
  type EdgeExcelRow
} from '@/lib/edge-materials/excel-columns'
import {
  parseDecimalInput,
  parseIntegerInput
} from '@/lib/edge-materials/parse'

export type EdgeExportRow = EdgeExcelRow

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
  dataRows: Array<Record<EdgeExcelHeader, string | number>>,
  includeExample: boolean
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Optinova'
  workbook.created = new Date()

  const guide = workbook.addWorksheet(EDGE_EXCEL_GUIDE_NAME)
  for (const line of EDGE_EXCEL_GUIDE_LINES) {
    guide.addRow([line])
  }
  guide.getColumn(1).width = 90

  const sheet = workbook.addWorksheet(EDGE_EXCEL_SHEET_NAME)
  sheet.addRow([...EDGE_EXCEL_HEADERS])
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.commit()

  if (includeExample && dataRows.length === 0) {
    sheet.addRow(EDGE_EXCEL_HEADERS.map((h) => EDGE_EXCEL_EXAMPLE_ROW[h]))
  }

  for (const row of dataRows) {
    sheet.addRow(EDGE_EXCEL_HEADERS.map((h) => row[h]))
  }

  EDGE_EXCEL_HEADERS.forEach((_, i) => {
    sheet.getColumn(i + 1).width = i === 2 ? 28 : 16
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

export async function buildEdgeMaterialsTemplateBuffer(): Promise<Buffer> {
  return buildWorkbook([], true)
}

export async function buildEdgeMaterialsExportBuffer(
  rows: EdgeExportRow[]
): Promise<Buffer> {
  const dataRows = rows.map((r) => ({
    Gyarto: r.manufacturerName,
    Tipus: r.type,
    Dekor: r.decor,
    Szelesseg_mm: r.widthMm,
    Vastagsag_mm: r.thicknessMm,
    Brutto_Ft_m: r.priceGross,
    Adonem: r.taxRateName,
    Berendezes: r.equipmentName,
    Gepkod: r.machineCode,
    Rahagyas_mm: r.allowanceMm,
    Kedvenc_sorrend: r.favouritePriority ?? '',
    Aktiv: formatBoolHu(r.active)
  }))
  return buildWorkbook(dataRows, false)
}

export type ParsedEdgeExcelRawRow = {
  rowNumber: number
  values: Record<EdgeExcelHeader, string>
}

export async function parseEdgeMaterialsWorkbook(
  buffer: ArrayBuffer | Buffer
): Promise<
  | { ok: true; rows: ParsedEdgeExcelRawRow[] }
  | { ok: false; message: string }
> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as ExcelJS.Buffer)

  const sheet =
    workbook.getWorksheet(EDGE_EXCEL_SHEET_NAME) ??
    workbook.worksheets.find((ws) => ws.name !== EDGE_EXCEL_GUIDE_NAME) ??
    workbook.worksheets[0]

  if (!sheet) {
    return { ok: false, message: 'Az Excel fájlban nincs munkalap.' }
  }

  const headerRow = sheet.getRow(1)
  const headerMap = new Map<string, number>()
  headerRow.eachCell({ includeEmpty: false }, (cell, col) => {
    headerMap.set(cellText(cell.value).toLowerCase(), col)
  })

  const missing = EDGE_EXCEL_HEADERS.filter(
    (h) => !headerMap.has(h.toLowerCase())
  )
  if (missing.length > 0) {
    return {
      ok: false,
      message: `Hiányzó oszlopok: ${missing.join(', ')}. Töltsd le a sablont.`
    }
  }

  const rows: ParsedEdgeExcelRawRow[] = []
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return
    const values = {} as Record<EdgeExcelHeader, string>
    let any = false
    for (const header of EDGE_EXCEL_HEADERS) {
      const col = headerMap.get(header.toLowerCase())!
      const text = cellText(row.getCell(col).value)
      values[header] = text
      if (text) any = true
    }
    if (!any) return
    rows.push({ rowNumber, values })
  })

  if (rows.length === 0) {
    return { ok: false, message: 'Nincs importálható adatsor a fájlban.' }
  }
  if (rows.length > EDGE_IMPORT_MAX_ROWS) {
    return {
      ok: false,
      message: `Legfeljebb ${EDGE_IMPORT_MAX_ROWS} sor importálható egyszerre.`
    }
  }

  return { ok: true, rows }
}

export type CoercedEdgeRow =
  | { ok: true; rowNumber: number; data: EdgeExcelRow }
  | { ok: false; rowNumber: number; message: string }

export function coerceEdgeExcelRow(
  raw: ParsedEdgeExcelRawRow
): CoercedEdgeRow {
  const v = raw.values
  const rowNumber = raw.rowNumber

  const manufacturerName = v.Gyarto
  const type = v.Tipus.trim()
  const decor = v.Dekor.trim()
  if (!manufacturerName) {
    return { ok: false, rowNumber, message: 'A gyártó kötelező.' }
  }
  if (!type) {
    return { ok: false, rowNumber, message: 'A típus kötelező.' }
  }
  if (type.length > 80) {
    return { ok: false, rowNumber, message: 'A típus legfeljebb 80 karakter.' }
  }
  if (!decor) {
    return { ok: false, rowNumber, message: 'A dekor kötelező.' }
  }
  if (decor.length > 80) {
    return { ok: false, rowNumber, message: 'A dekor legfeljebb 80 karakter.' }
  }

  const widthMm = parseDecimalInput(v.Szelesseg_mm)
  const thicknessMm = parseDecimalInput(v.Vastagsag_mm)
  const priceGross = parseIntegerInput(v.Brutto_Ft_m)
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
  if (!v.Berendezes) {
    return { ok: false, rowNumber, message: 'A berendezés kötelező.' }
  }
  if (!v.Gepkod.trim()) {
    return { ok: false, rowNumber, message: 'A gépkód kötelező.' }
  }
  if (v.Gepkod.trim().length > 80) {
    return { ok: false, rowNumber, message: 'A gépkód legfeljebb 80 karakter.' }
  }

  const active = parseBoolHu(v.Aktiv)
  if (active === null) {
    return { ok: false, rowNumber, message: 'Aktív: igen/nem.' }
  }

  const allowanceMm = parseIntegerInput(v.Rahagyas_mm)
  if (allowanceMm === null || allowanceMm < 0) {
    return { ok: false, rowNumber, message: 'Érvénytelen ráhagyás (mm).' }
  }

  const favouriteRaw = v.Kedvenc_sorrend.trim()
  let favouritePriority: number | null = null
  if (favouriteRaw) {
    const parsed = parseIntegerInput(favouriteRaw)
    if (parsed === null || parsed < 0) {
      return {
        ok: false,
        rowNumber,
        message: 'Érvénytelen kedvenc sorrend (egész szám vagy üres).'
      }
    }
    favouritePriority = parsed
  }

  return {
    ok: true,
    rowNumber,
    data: {
      manufacturerName,
      type,
      decor,
      widthMm,
      thicknessMm,
      priceGross,
      taxRateName: v.Adonem,
      equipmentName: v.Berendezes,
      machineCode: v.Gepkod.trim(),
      allowanceMm,
      favouritePriority,
      active
    }
  }
}
