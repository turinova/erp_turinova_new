import ExcelJS from 'exceljs'

import {
  ATTRIBUTE_COLUMNS,
  CATEGORY_COLUMNS,
  DOCUMENT_COLUMNS,
  FAQ_COLUMNS,
  GROUP_COLUMNS,
  PROBLEM_COLUMN_LABEL,
  RELATED_COLUMNS,
  SHOP_COLUMNS,
  SHOP_EXCEL_KIND,
  SHOP_IMPORT_MAX_ATTRIBUTE_ROWS,
  SHOP_IMPORT_MAX_CATEGORY_ROWS,
  SHOP_IMPORT_MAX_DOCUMENT_ROWS,
  SHOP_IMPORT_MAX_FAQ_ROWS,
  SHOP_IMPORT_MAX_GROUP_ROWS,
  SHOP_IMPORT_MAX_RELATED_ROWS,
  SHOP_IMPORT_MAX_ROWS,
  SHOP_IMPORT_MAX_SPEC_ROWS,
  SHOP_SHEET,
  SHOP_SNAPSHOT_MODE,
  SPEC_COLUMNS,
  type AttributeColumnId,
  type CategoryColumnId,
  type DocumentColumnId,
  type FaqColumnId,
  type GroupColumnId,
  type RelatedColumnId,
  type ShopColumnId,
  type SpecColumnId
} from '@/lib/webshop/excel/columns'
import { foldKey } from '@/lib/webshop/excel/context'

export type RawRow<C extends string> = {
  rowNumber: number
  cells: Partial<Record<C, string>>
  /** Az Excel dátummá alakította (pl. „1/2” → jan. 2.) — nem bízunk benne. */
  dates?: C[]
}

export type RawSheet<C extends string> = {
  name: string
  /** Felismert oszlopok a fájl sorrendjében. */
  columns: C[]
  rows: RawRow<C>[]
  unknownHeaders: string[]
}

export type ShopXWorkbook = {
  products: RawSheet<ShopColumnId> | null
  specs: RawSheet<SpecColumnId> | null
  faq: RawSheet<FaqColumnId> | null
  related: RawSheet<RelatedColumnId> | null
  documents: RawSheet<DocumentColumnId> | null
  groups: RawSheet<GroupColumnId> | null
  categories: RawSheet<CategoryColumnId> | null
  attributes: RawSheet<AttributeColumnId> | null
  exportedAt: string | null
  /** Régebbi / ismeretlen sablon verzió. */
  version: number | null
  /** Teljes pillanatkép (visszavonás): a benne lévő termékek minden halmaza pontosan a fájl szerinti. */
  snapshot: boolean
}

export function emptyShopWorkbook(): ShopXWorkbook {
  return {
    products: null,
    specs: null,
    faq: null,
    related: null,
    documents: null,
    groups: null,
    categories: null,
    attributes: null,
    exportedAt: null,
    version: null,
    snapshot: false
  }
}

export type ReadResult = { ok: true; workbook: ShopXWorkbook } | { ok: false; message: string }

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'igen' : 'nem'
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'object') {
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((r) => r.text ?? '').join('').trim()
    }
    if ('result' in value) return cellText(value.result as ExcelJS.CellValue)
    if ('text' in value) return String(value.text ?? '').trim()
    if ('error' in value) return ''
  }
  return String(value).trim()
}

function headerKeys(label: string, id: string): string[] {
  return [foldKey(label), foldKey(label.replace(/\(.*?\)/g, '')), foldKey(id)]
}

function matcher<C extends string>(cols: { id: C; label: string }[]): Map<string, C> {
  const m = new Map<string, C>()
  for (const c of cols) for (const k of headerKeys(c.label, c.id)) if (k && !m.has(k)) m.set(k, c.id)
  return m
}

const PRODUCT_MATCH = matcher(SHOP_COLUMNS)
const SPEC_MATCH = matcher(SPEC_COLUMNS)
const FAQ_MATCH = matcher(FAQ_COLUMNS)
const RELATED_MATCH = matcher(RELATED_COLUMNS)
const DOCUMENT_MATCH = matcher(DOCUMENT_COLUMNS)
const GROUP_MATCH = matcher(GROUP_COLUMNS)
const CATEGORY_MATCH = matcher(CATEGORY_COLUMNS)
const ATTRIBUTE_MATCH = matcher(ATTRIBUTE_COLUMNS)
const IGNORED_HEADERS = new Set([foldKey(PROBLEM_COLUMN_LABEL)])

type Grid = { cells: string[][]; dates: Set<string> }

function toSheet<C extends string>(name: string, input: Grid | string[][], match: Map<string, C>): RawSheet<C> {
  const grid = Array.isArray(input) ? input : input.cells
  const dateCells = Array.isArray(input) ? null : input.dates
  const header = grid[0] ?? []
  const colIndex = new Map<C, number>()
  const unknownHeaders: string[] = []
  header.forEach((h, i) => {
    const key = foldKey(h)
    if (!key || IGNORED_HEADERS.has(key)) return
    const id = match.get(key) ?? match.get(foldKey(h.replace(/\(.*?\)/g, '')))
    if (id && !colIndex.has(id)) colIndex.set(id, i)
    else unknownHeaders.push(h)
  })
  const columns = [...colIndex.keys()]
  const rows: RawRow<C>[] = []
  for (let r = 1; r < grid.length; r++) {
    const line = grid[r] ?? []
    const cells: Partial<Record<C, string>> = {}
    const dates: C[] = []
    let any = false
    for (const [id, i] of colIndex) {
      const v = (line[i] ?? '').trim()
      if (v) {
        cells[id] = v
        any = true
        if (dateCells?.has(`${r}:${i}`)) dates.push(id)
      }
    }
    if (any) rows.push({ rowNumber: r + 1, cells, ...(dates.length > 0 ? { dates } : {}) })
  }
  return { name, columns, rows, unknownHeaders }
}

function sheetGrid(ws: ExcelJS.Worksheet): Grid {
  const grid: string[][] = []
  const dates = new Set<string>()
  const width = ws.actualColumnCount || ws.columnCount
  ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const line: string[] = []
    for (let c = 1; c <= Math.max(width, row.cellCount); c++) {
      const value = row.getCell(c).value
      if (value instanceof Date) dates.add(`${rowNumber - 1}:${c - 1}`)
      line.push(cellText(value))
    }
    grid[rowNumber - 1] = line
  })
  for (let i = 0; i < grid.length; i++) grid[i] ??= []
  return { cells: grid, dates }
}

function parseCsv(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, '')
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? ''
  const delimiter = [';', '\t', ','].sort(
    (a, b) => firstLine.split(b).length - firstLine.split(a).length
  )[0]
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') quoted = false
      else field += ch
      continue
    }
    if (ch === '"' && field === '') quoted = true
    else if (ch === delimiter) {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

const SHEET_LIMITS: [keyof ShopXWorkbook, string, number][] = [
  ['products', SHOP_SHEET.products, SHOP_IMPORT_MAX_ROWS],
  ['specs', SHOP_SHEET.specs, SHOP_IMPORT_MAX_SPEC_ROWS],
  ['faq', SHOP_SHEET.faq, SHOP_IMPORT_MAX_FAQ_ROWS],
  ['related', SHOP_SHEET.related, SHOP_IMPORT_MAX_RELATED_ROWS],
  ['documents', SHOP_SHEET.documents, SHOP_IMPORT_MAX_DOCUMENT_ROWS],
  ['groups', SHOP_SHEET.groups, SHOP_IMPORT_MAX_GROUP_ROWS],
  ['categories', SHOP_SHEET.categories, SHOP_IMPORT_MAX_CATEGORY_ROWS],
  ['attributes', SHOP_SHEET.attributes, SHOP_IMPORT_MAX_ATTRIBUTE_ROWS]
]

const REQUIRED_COLUMNS: [keyof ShopXWorkbook, string, string[], string][] = [
  ['specs', SHOP_SHEET.specs, ['sku', 'attribute', 'value'], 'SKU, Jellemző és Érték'],
  ['faq', SHOP_SHEET.faq, ['sku', 'question', 'answer'], 'SKU, Kérdés és Válasz'],
  ['related', SHOP_SHEET.related, ['sku', 'kind', 'relatedSku'], 'SKU, Típus és Kapcsolt SKU'],
  ['documents', SHOP_SHEET.documents, ['sku', 'file'], 'SKU és Fájlnév'],
  ['groups', SHOP_SHEET.groups, ['code'], 'Csoport kód'],
  ['categories', SHOP_SHEET.categories, ['path'], 'Útvonal'],
  ['attributes', SHOP_SHEET.attributes, ['name'], 'Jellemző']
]

function checkLimits(wb: ShopXWorkbook): string | null {
  let total = 0
  for (const [key, label, max] of SHEET_LIMITS) {
    const sheet = wb[key] as RawSheet<string> | null
    const n = sheet?.rows.length ?? 0
    total += n
    if (n > max) {
      return key === 'products'
        ? `Egy fájlban legfeljebb ${max.toLocaleString('hu-HU')} termék lehet (most ${n.toLocaleString('hu-HU')}). Bontsd több fájlra, vagy szűrj a letöltés előtt.`
        : `A „${label}” lapon legfeljebb ${max.toLocaleString('hu-HU')} sor lehet (most ${n.toLocaleString('hu-HU')}).`
    }
  }
  if (total === 0) return 'A fájlban nincs kitöltött sor.'
  if (wb.products && wb.products.rows.length > 0 && !wb.products.columns.includes('sku')) {
    return 'A „Bolt” lapon nincs SKU oszlop. Enélkül nem tudjuk, melyik termékről van szó.'
  }
  for (const [key, label, cols, text] of REQUIRED_COLUMNS) {
    const sheet = wb[key] as RawSheet<string> | null
    if (!sheet || sheet.rows.length === 0) continue
    if (cols.some((c) => !sheet.columns.includes(c))) return `A „${label}” lapon kell ${text} oszlop.`
  }
  return null
}

export async function readShopWorkbook(buffer: Buffer, filename: string): Promise<ReadResult> {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.csv')) {
    const grid = parseCsv(buffer.toString('utf8'))
    const wb: ShopXWorkbook = { ...emptyShopWorkbook(), products: toSheet(SHOP_SHEET.products, grid, PRODUCT_MATCH) }
    const limit = checkLimits(wb)
    return limit ? { ok: false, message: limit } : { ok: true, workbook: wb }
  }
  if (lower.endsWith('.xls')) {
    return { ok: false, message: 'Ez régi .xls fájl. Nyisd meg Excelben, és mentsd el .xlsx formátumban.' }
  }
  if (!lower.endsWith('.xlsx')) {
    return { ok: false, message: 'Csak .xlsx vagy .csv fájl tölthető fel.' }
  }

  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer)
  } catch {
    return { ok: false, message: 'A fájl nem olvasható. Mentsd el Excelben .xlsx formátumban, és próbáld újra.' }
  }
  const byName = new Map(workbook.worksheets.map((ws) => [foldKey(ws.name), ws]))
  const find = (name: string) => byName.get(foldKey(name))

  const meta = find(SHOP_SHEET.meta)
  const kind = meta ? cellText(meta.getCell('B1').value) : ''
  const version = meta ? Number(cellText(meta.getCell('B2').value)) || null : null
  const exportedAt = meta ? cellText(meta.getCell('B3').value) || null : null
  const mode = meta ? cellText(meta.getCell('B4').value) : ''

  let productsWs = find(SHOP_SHEET.products)
  const side = {
    specs: find(SHOP_SHEET.specs),
    faq: find(SHOP_SHEET.faq),
    related: find(SHOP_SHEET.related),
    documents: find(SHOP_SHEET.documents),
    groups: find(SHOP_SHEET.groups),
    categories: find(SHOP_SHEET.categories),
    attributes: find(SHOP_SHEET.attributes)
  }
  if (!productsWs && Object.values(side).every((ws) => !ws)) {
    if (find('Termekek')) {
      return {
        ok: false,
        message:
          'Ez a Termékek oldal fájlja (név, ár, raktár). A bolt adatokhoz a Bolt katalógusban letöltött fájl kell — vagy töltsd fel a Termékek oldalon.'
      }
    }
    const candidate = workbook.worksheets.find((ws) => {
      const grid = sheetGrid(ws)
      return (grid.cells[0] ?? []).some((h) => foldKey(h) === 'sku')
    })
    if (!candidate) {
      return { ok: false, message: 'Nem találjuk a „Bolt” munkalapot. Töltsd le a sablont a Bolt katalógusban.' }
    }
    productsWs = candidate
  }

  const read = <C extends string>(ws: ExcelJS.Worksheet | undefined, match: Map<string, C>) =>
    ws ? toSheet(ws.name, sheetGrid(ws), match) : null
  const ours = kind === SHOP_EXCEL_KIND
  const wb: ShopXWorkbook = {
    products: read(productsWs, PRODUCT_MATCH),
    specs: read(side.specs, SPEC_MATCH),
    faq: read(side.faq, FAQ_MATCH),
    related: read(side.related, RELATED_MATCH),
    documents: read(side.documents, DOCUMENT_MATCH),
    groups: read(side.groups, GROUP_MATCH),
    categories: read(side.categories, CATEGORY_MATCH),
    attributes: read(side.attributes, ATTRIBUTE_MATCH),
    exportedAt: ours && exportedAt ? exportedAt : null,
    version: ours ? version : null,
    snapshot: ours && mode === SHOP_SNAPSHOT_MODE
  }
  const limit = checkLimits(wb)
  return limit ? { ok: false, message: limit } : { ok: true, workbook: wb }
}
