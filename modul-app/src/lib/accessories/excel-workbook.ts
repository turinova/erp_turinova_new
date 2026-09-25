import ExcelJS from 'exceljs'

import {
  ACCESSORY_EXCEL_EXAMPLE_ROW,
  ACCESSORY_EXCEL_GUIDE_LINES,
  ACCESSORY_EXCEL_GUIDE_NAME,
  ACCESSORY_EXCEL_HEADERS,
  ACCESSORY_EXCEL_LISTS_NAME,
  ACCESSORY_EXCEL_SHEET_NAME,
  ACCESSORY_HEADER_LABEL,
  ACCESSORY_HEADER_NOTE,
  ACCESSORY_IMPORT_MAX_ROWS,
  ACCESSORY_PROBLEM_COLUMN,
  ACCESSORY_TEXT_HEADERS,
  type AccessoryExcelHeader,
  type AccessoryExcelRow
} from '@/lib/accessories/excel-columns'

export type AccessoryExportRow = AccessoryExcelRow

export type AccessoryExcelLists = {
  manufacturers: string[]
  taxRates: string[]
  units: string[]
}

const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE4E4E7' } }
const INFO_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F1F3' } }
const PROBLEM_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDECEC' } }
const INFO_FONT: Partial<ExcelJS.Font> = { color: { argb: 'FF71717A' } }
/** Ennyi üres sor kap legördülőt a kitöltéshez az adatsorok után. */
const EXTRA_ROWS = 300

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'igen' : 'nem'
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object' && 'richText' in value && Array.isArray(value.richText)) {
    return value.richText.map((r) => r.text).join('').trim()
  }
  if (typeof value === 'object' && 'text' in value) {
    return cellText(value.text as ExcelJS.CellValue)
  }
  if (typeof value === 'object' && 'result' in value) {
    return cellText(value.result as ExcelJS.CellValue)
  }
  return String(value).trim()
}

function cellNumber(value: ExcelJS.CellValue): number | null {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'result' in value && typeof value.result === 'number') {
    return value.result
  }
  return null
}

function foldHeader(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[_\s]+/g, ' ')
    .trim()
}

const HEADER_ALIASES: Map<string, AccessoryExcelHeader> = (() => {
  const m = new Map<string, AccessoryExcelHeader>()
  for (const h of ACCESSORY_EXCEL_HEADERS) {
    m.set(foldHeader(h), h)
    m.set(foldHeader(ACCESSORY_HEADER_LABEL[h]), h)
  }
  m.set('id', 'Azonosito')
  m.set('brutto', 'Brutto_Ft')
  m.set('kep', 'Kep_fajlnev')
  return m
})()

function exportCells(r: AccessoryExportRow): Record<AccessoryExcelHeader, string | number | null> {
  return {
    Gyarto: r.manufacturerName,
    Nev: r.name,
    SKU: r.sku,
    Vonalkod: r.barcode,
    Belso_vonalkod: r.barcodeInternal,
    Brutto_Ft: r.priceGross,
    Beszerzes_netto_Ft: r.purchasePriceNet,
    Arres_szorzo: r.marginFactor,
    Adonem: r.taxRateName,
    Egyseg: r.unitLabel,
    Aktiv: r.active ? 'igen' : 'nem',
    Kep_fajlnev: r.imageFilename,
    Galeria: r.gallery.length > 0 ? r.gallery.join(' | ') : null,
    Azonosito: r.id
  }
}

function addGuide(wb: ExcelJS.Workbook) {
  const guide = wb.addWorksheet(ACCESSORY_EXCEL_GUIDE_NAME)
  for (const line of ACCESSORY_EXCEL_GUIDE_LINES) guide.addRow([line])
  guide.getRow(1).font = { bold: true, size: 13 }
  guide.getRow(3).font = { bold: true }
  guide.getRow(9).font = { bold: true }
  guide.getColumn(1).width = 120
}

type ListRanges = Partial<Record<'Gyarto' | 'Adonem' | 'Egyseg' | 'Aktiv', string>>

function addLists(wb: ExcelJS.Workbook, lists: AccessoryExcelLists): ListRanges {
  const ws = wb.addWorksheet(ACCESSORY_EXCEL_LISTS_NAME)
  ws.addRow(['Gyártók', 'Adónemek', 'Egységek', 'Igen/nem'])
  ws.getRow(1).font = { bold: true }
  const bools = ['igen', 'nem']
  const n = Math.max(lists.manufacturers.length, lists.taxRates.length, lists.units.length, bools.length)
  for (let i = 0; i < n; i++) {
    ws.addRow([lists.manufacturers[i] ?? null, lists.taxRates[i] ?? null, lists.units[i] ?? null, bools[i] ?? null])
  }
  ;[28, 18, 12, 10].forEach((w, i) => {
    ws.getColumn(i + 1).width = w
  })
  const range = (col: string, count: number) =>
    count > 0 ? `'${ACCESSORY_EXCEL_LISTS_NAME}'!$${col}$2:$${col}$${count + 1}` : undefined
  return {
    Gyarto: range('A', lists.manufacturers.length),
    Adonem: range('B', lists.taxRates.length),
    Egyseg: range('C', lists.units.length),
    Aktiv: range('D', bools.length)
  }
}

function addValidations(ws: ExcelJS.Worksheet, ranges: ListRanges, lastRow: number) {
  for (const [header, formula] of Object.entries(ranges) as [keyof ListRanges, string | undefined][]) {
    if (!formula) continue
    const col = ACCESSORY_EXCEL_HEADERS.indexOf(header) + 1
    // A gyártónál új név is írható: csak figyelmeztet, nem tilt.
    const strict = header !== 'Gyarto'
    for (let r = 2; r <= lastRow; r++) {
      ws.getCell(r, col).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [formula],
        showErrorMessage: true,
        errorStyle: strict ? 'stop' : 'information',
        errorTitle: 'Válassz a listából',
        error: strict
          ? 'Válassz a listából (Listak lap).'
          : 'Ez a gyártó még nincs a listában. Feltöltéskor megkérdezzük, létrehozzuk-e.'
      }
    }
  }
}

export async function buildAccessoriesWorkbook(
  rows: AccessoryExportRow[],
  lists: AccessoryExcelLists,
  opts: { template: boolean }
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Turinova'
  wb.created = new Date()
  addGuide(wb)

  const ws = wb.addWorksheet(ACCESSORY_EXCEL_SHEET_NAME)
  const header = ws.getRow(1)
  ACCESSORY_EXCEL_HEADERS.forEach((h, i) => {
    const cell = header.getCell(i + 1)
    cell.value = h
    cell.note = ACCESSORY_HEADER_NOTE[h]
    cell.font = { bold: true, ...(h === 'Azonosito' ? INFO_FONT : {}) }
    cell.fill = h === 'Azonosito' ? INFO_FILL : HEADER_FILL
    const column = ws.getColumn(i + 1)
    column.width = h === 'Nev' ? 36 : h === 'Azonosito' ? 38 : h === 'Galeria' ? 40 : h === 'Gyarto' ? 20 : 15
    if (ACCESSORY_TEXT_HEADERS.has(h)) column.numFmt = '@'
  })
  header.commit()
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }]

  if (opts.template && rows.length === 0) {
    ws.addRow(ACCESSORY_EXCEL_HEADERS.map((h) => ACCESSORY_EXCEL_EXAMPLE_ROW[h]))
  }
  const idCol = ACCESSORY_EXCEL_HEADERS.indexOf('Azonosito') + 1
  for (const r of rows) {
    const cells = exportCells(r)
    const row = ws.addRow(ACCESSORY_EXCEL_HEADERS.map((h) => cells[h] ?? null))
    const idCell = row.getCell(idCol)
    idCell.font = INFO_FONT
  }

  const ranges = addLists(wb, lists)
  addValidations(ws, ranges, Math.max(ws.rowCount, 1) + EXTRA_ROWS)
  wb.views = [{ x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, activeTab: 1, visibility: 'visible' }]
  return Buffer.from(await wb.xlsx.writeBuffer())
}

export type ParsedAccessoryRow = {
  rowNumber: number
  /** Hiányzó oszlop: nincs kulcs. Üres cella: ''. */
  values: Partial<Record<AccessoryExcelHeader, string>>
  /** Számként tárolt cellák eredeti értéke (vonalkód-ellenőrzéshez). */
  numbers: Partial<Record<AccessoryExcelHeader, number>>
}

export type ParsedAccessoryWorkbook = {
  columns: AccessoryExcelHeader[]
  rows: ParsedAccessoryRow[]
}

function pickSheet(wb: ExcelJS.Workbook): ExcelJS.Worksheet | { error: string } {
  const named = wb.getWorksheet(ACCESSORY_EXCEL_SHEET_NAME)
  if (named) return named
  if (wb.getWorksheet('Bolt')) {
    return {
      error:
        'Ez a bolt adatok fájlja (Bolt lap). Ezt a Webshop → Bolt katalógus oldalon töltsd fel. Ide a „Termekek” lapos fájl kell.'
    }
  }
  const skip = new Set([ACCESSORY_EXCEL_GUIDE_NAME, ACCESSORY_EXCEL_LISTS_NAME])
  const first = wb.worksheets.find((s) => !skip.has(s.name) && s.state === 'visible') ?? wb.worksheets[0]
  return first ?? { error: 'Az Excel fájlban nincs munkalap.' }
}

export async function parseAccessoriesWorkbook(
  buffer: ArrayBuffer | Buffer
): Promise<{ ok: true; workbook: ParsedAccessoryWorkbook } | { ok: false; message: string }> {
  const wb = new ExcelJS.Workbook()
  try {
    await wb.xlsx.load(buffer as ExcelJS.Buffer)
  } catch {
    return {
      ok: false,
      message: 'A fájlt nem tudtuk megnyitni. Mentsd el Excel munkafüzetként (.xlsx), és próbáld újra.'
    }
  }

  const sheet = pickSheet(wb)
  if ('error' in sheet) return { ok: false, message: sheet.error }

  const colOf = new Map<AccessoryExcelHeader, number>()
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => {
    const h = HEADER_ALIASES.get(foldHeader(cellText(cell.value)))
    if (h && !colOf.has(h)) colOf.set(h, col)
  })

  if (!colOf.has('SKU') && !colOf.has('Azonosito')) {
    return {
      ok: false,
      message: 'Hiányzik a SKU oszlop. Az első sorban legyenek az oszlopnevek — töltsd le a sablont mintának.'
    }
  }

  const columns = ACCESSORY_EXCEL_HEADERS.filter((h) => colOf.has(h))
  const rows: ParsedAccessoryRow[] = []
  let tooMany = false
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1 || tooMany) return
    const values: ParsedAccessoryRow['values'] = {}
    const numbers: ParsedAccessoryRow['numbers'] = {}
    let any = false
    for (const h of columns) {
      const raw = row.getCell(colOf.get(h)!).value
      const text = cellText(raw)
      values[h] = text
      const n = cellNumber(raw)
      if (n != null) numbers[h] = n
      if (text) any = true
    }
    if (!any) return
    if (rows.length >= ACCESSORY_IMPORT_MAX_ROWS) {
      tooMany = true
      return
    }
    rows.push({ rowNumber, values, numbers })
  })

  if (tooMany) {
    return {
      ok: false,
      message: `Egy fájlban legfeljebb ${ACCESSORY_IMPORT_MAX_ROWS.toLocaleString('hu-HU')} termék lehet. Oszd több fájlra.`
    }
  }
  if (rows.length === 0) {
    return { ok: false, message: 'Nincs kitöltött sor a fájlban.' }
  }
  return { ok: true, workbook: { columns, rows } }
}

/** A hibás sorok, az eredeti cellákkal és egy „Mi a baj?” oszloppal — javítás után visszatölthető. */
export async function buildAccessoriesProblemsWorkbook(
  source: ParsedAccessoryWorkbook,
  problems: Map<number, string[]>
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Turinova'
  wb.created = new Date()
  addGuide(wb)
  const ws = wb.addWorksheet(ACCESSORY_EXCEL_SHEET_NAME)
  ws.addRow([...source.columns, ACCESSORY_PROBLEM_COLUMN])
  ws.getRow(1).font = { bold: true }
  ws.getRow(1).fill = HEADER_FILL
  source.columns.forEach((h, i) => {
    const column = ws.getColumn(i + 1)
    column.width = h === 'Nev' ? 36 : 15
    if (ACCESSORY_TEXT_HEADERS.has(h)) column.numFmt = '@'
  })
  const problemCol = source.columns.length + 1
  ws.getColumn(problemCol).width = 70
  for (const r of source.rows) {
    const msgs = problems.get(r.rowNumber)
    if (!msgs) continue
    const row = ws.addRow([...source.columns.map((h) => r.values[h] || null), msgs.join('\n')])
    const cell = row.getCell(problemCol)
    cell.fill = PROBLEM_FILL
    cell.alignment = { wrapText: true, vertical: 'top' }
  }
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
  wb.views = [{ x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, activeTab: 1, visibility: 'visible' }]
  return Buffer.from(await wb.xlsx.writeBuffer())
}
