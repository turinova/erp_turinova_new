import ExcelJS from 'exceljs'

import { countryOptions } from '@/lib/geo/countries'
import { resolveCategoryTemplate } from '@/lib/webshop/key-specs'

import { RELATED_KIND_META } from '@/lib/accessories/related-kinds'

import {
  ATTRIBUTE_COLUMNS,
  CATEGORY_COLUMNS,
  DOCUMENT_COLUMNS,
  DOCUMENT_KIND_LABEL,
  FAQ_COLUMNS,
  GROUP_COLUMNS,
  PROBLEM_COLUMN_LABEL,
  RELATED_COLUMNS,
  SHOP_COLUMNS,
  SHOP_EXCEL_KIND,
  SHOP_EXCEL_VERSION,
  SHOP_GUIDE_LINES,
  SHOP_SHEET,
  SHOP_SNAPSHOT_MODE,
  SPEC_COLUMNS,
  type ShopColumn,
  type ShopColumnId,
  type ShopOptionalSheet
} from '@/lib/webshop/excel/columns'
import { foldKey, PACK_AXIS, type ShopXContext, type ShopXProduct } from '@/lib/webshop/excel/context'
import { attributeDisplay, formatBool, formatTiersGross, joinList } from '@/lib/webshop/excel/format'
import { categoryPathOf, countryLabel } from '@/lib/webshop/excel/plan'
import type { RawSheet, ShopXWorkbook } from '@/lib/webshop/excel/read'
import { SHOP_X_SHEET_LABEL, type ShopXItem, type ShopXProblem } from '@/lib/webshop/excel/types'

export type ShopExportMode = 'simple' | 'full' | 'template' | 'snapshot'

/** Alapból letöltött lapok módonként (a felhasználó választhat mást). */
export const DEFAULT_SHEETS: Record<ShopExportMode, ShopOptionalSheet[]> = {
  simple: ['specs'],
  full: ['specs', 'faq', 'related', 'documents', 'groups'],
  template: ['specs', 'faq', 'related', 'documents', 'groups', 'categories', 'attributes'],
  snapshot: ['specs', 'faq', 'related', 'documents', 'groups']
}

const INFO_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F1F3' } }
const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE4E4E7' } }
const PROBLEM_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDECEC' } }
const INFO_FONT: Partial<ExcelJS.Font> = { color: { argb: 'FF71717A' } }
const EXTRA_ROWS = 300

const VALUE_TYPE_HU = { list: 'Lista', number: 'Szám', range: 'Tartomány (10-20)', boolean: 'Igen / nem' } as const
const VALUE_TYPE_SHORT = { list: 'Lista', number: 'Szám', range: 'Tartomány', boolean: 'Igen/nem' } as const

type ListCol = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H'
type Lists = Record<ListCol, number>

function newWorkbook(): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Turinova'
  wb.created = new Date()
  return wb
}

function addGuide(wb: ExcelJS.Workbook) {
  const guide = wb.addWorksheet(SHOP_SHEET.guide)
  SHOP_GUIDE_LINES.forEach((line, i) => {
    const title = line.startsWith('# ')
    const row = guide.addRow([title ? line.slice(2) : line])
    if (title) row.font = { bold: true, ...(i === 0 ? { size: 13 } : {}) }
  })
  guide.getColumn(1).width = 110
}

function addMeta(wb: ExcelJS.Workbook, mode: string, exportedAt: string) {
  const meta = wb.addWorksheet(SHOP_SHEET.meta, { state: 'veryHidden' })
  meta.addRow(['Fajta', SHOP_EXCEL_KIND])
  meta.addRow(['Verzió', SHOP_EXCEL_VERSION])
  meta.addRow(['Letöltve', exportedAt])
  meta.addRow(['Mód', mode])
}

function addLists(wb: ExcelJS.Workbook, ctx: ShopXContext): Lists {
  const ws = wb.addWorksheet(SHOP_SHEET.lists, { state: 'hidden' })
  ws.addRow(['Kategória', 'Igen/nem', 'Egység', 'Ország', 'Jellemző', 'Kapcsolat', 'Dokumentum', 'Jellemző típus'])
  const cols: string[][] = [
    ctx.categories.map((c) => c.path),
    ['igen', 'nem'],
    ['g', 'kg', 'ml', 'l', 'db', 'm', 'm2'],
    countryOptions().map((o) => o.name),
    ctx.attributes.filter((a) => a.active).map((a) => a.name),
    Object.values(RELATED_KIND_META).map((m) => m.label),
    Object.values(DOCUMENT_KIND_LABEL),
    Object.values(VALUE_TYPE_SHORT)
  ]
  const n = Math.max(...cols.map((c) => c.length))
  for (let i = 0; i < n; i++) ws.addRow(cols.map((c) => c[i] ?? null))
  const keys: ListCol[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
  return Object.fromEntries(keys.map((k, i) => [k, cols[i].length])) as Lists
}

function listFormula(col: ListCol, count: number): string | null {
  return count > 0 ? `'${SHOP_SHEET.lists}'!$${col}$2:$${col}$${count + 1}` : null
}

function validate(ws: ExcelJS.Worksheet, colIndex: number, rows: number, formula: string | null, strict: boolean) {
  if (!formula) return
  for (let r = 2; r <= rows + 1; r++) {
    ws.getCell(r, colIndex).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [formula],
      showErrorMessage: strict,
      errorStyle: strict ? 'stop' : 'warning',
      errorTitle: 'Válassz a listából',
      error: 'Válassz a listából, vagy írj - jelet a törléshez.'
    }
  }
}

function styleHeader(
  ws: ExcelJS.Worksheet,
  cols: { label: string; width: number; note: string; info: boolean }[]
) {
  const header = ws.getRow(1)
  cols.forEach((c, i) => {
    const cell = header.getCell(i + 1)
    cell.value = c.label
    cell.font = { bold: true, ...(c.info ? INFO_FONT : {}) }
    cell.fill = c.info ? INFO_FILL : HEADER_FILL
    cell.note = c.note
    ws.getColumn(i + 1).width = c.width
  })
  header.commit()
  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }]
}

function shadeInfo(ws: ExcelJS.Worksheet, infoCols: number[], rows: number) {
  for (const c of infoCols) {
    for (let r = 2; r <= rows + 1; r++) {
      const cell = ws.getCell(r, c)
      cell.fill = INFO_FILL
      cell.font = INFO_FONT
    }
  }
}

function productCell(ctx: ShopXContext, p: ShopXProduct, id: ShopColumnId): string | number | null {
  const w = p.web
  const num = (n: number | null | undefined) => (n == null ? null : n)
  switch (id) {
    case 'sku':
      return p.sku
    case 'name':
      return p.name
    case 'price':
      return p.priceGross
    case 'active':
      return formatBool(p.active)
    case 'available':
      return formatBool(w?.sellable_web === true)
    case 'category':
      return categoryPathOf(ctx, p.categoryId) || null
    case 'description':
      return w?.web_description_long ?? null
    case 'shortDescription':
      return w?.web_description_short ?? null
    case 'useCases':
      return w ? joinList(w.web_use_cases) || null : null
    case 'compatibility':
      return w ? joinList(w.web_compatibility) || null : null
    case 'boxContents':
      return w ? joinList(w.web_box_contents) || null : null
    case 'brand':
      return w?.web_brand ?? null
    case 'mpn':
      return w?.web_mpn ?? null
    case 'gtin':
      return w?.web_gtin ?? null
    case 'group':
      return w?.web_group_id ?? null
    case 'netQuantity':
      return num(w?.web_net_quantity)
    case 'netUnit':
      return w?.web_net_unit ?? null
    case 'multipack':
      return num(w?.web_multipack)
    case 'isBundle':
      return w ? formatBool(w.web_is_bundle) : null
    case 'priceTiers':
      return w && w.web_price_tiers.length > 0 ? formatTiersGross(w.web_price_tiers, p.vatPercent) : null
    case 'compareAt':
      return num(w?.web_compare_at_price)
    case 'productLength':
      return num(w?.product_length_cm)
    case 'productWidth':
      return num(w?.product_width_cm)
    case 'productHeight':
      return num(w?.product_height_cm)
    case 'productWeight':
      return num(w?.product_weight_kg)
    case 'shippingLength':
      return num(w?.shipping_length_cm)
    case 'shippingWidth':
      return num(w?.shipping_width_cm)
    case 'shippingHeight':
      return num(w?.shipping_height_cm)
    case 'shippingWeight':
      return num(w?.shipping_weight_kg)
    case 'country':
      return countryLabel(w?.web_country_of_origin ?? null) || null
    case 'ingredients':
      return w?.web_ingredients ?? null
    case 'usage':
      return w?.web_usage ?? null
    case 'safety':
      return w?.web_safety_info ?? null
    case 'video':
      return w?.web_video_url ?? null
    case 'dimensionImage': {
      const url = w?.web_dimension_image_url
      return url ? (ctx.mediaByUrl.get(url.split('?')[0])?.filename ?? null) : null
    }
    case 'title':
      return w?.web_title ?? null
    case 'slug':
      return w?.web_slug ?? null
    case 'googleCategory':
      return w?.web_google_category ?? null
    case 'searchAliases':
      return w ? joinList(w.web_search_aliases) || null : null
    case 'tags':
      return w ? joinList(w.web_tags) || null : null
  }
}

function applyProductValidations(ws: ExcelJS.Worksheet, cols: ShopColumn[], rows: number, lists: Lists) {
  cols.forEach((c, i) => {
    const idx = i + 1
    if (c.kind === 'availability' || c.kind === 'bool') validate(ws, idx, rows, listFormula('B', lists.B), false)
    if (c.kind === 'category') validate(ws, idx, rows, listFormula('A', lists.A), false)
    if (c.kind === 'netUnit') validate(ws, idx, rows, listFormula('C', lists.C), false)
    if (c.kind === 'country') validate(ws, idx, rows, listFormula('D', lists.D), false)
  })
  const skuIdx = cols.findIndex((c) => c.id === 'sku') + 1
  if (skuIdx > 0) ws.getColumn(skuIdx).numFmt = '@'
}

export async function buildShopWorkbook(
  ctx: ShopXContext,
  products: ShopXProduct[],
  mode: ShopExportMode,
  opts: { sheets?: ShopOptionalSheet[] } = {}
): Promise<Buffer> {
  const wb = newWorkbook()
  addGuide(wb)

  const want = new Set<ShopOptionalSheet>(mode === 'snapshot' ? DEFAULT_SHEETS.snapshot : (opts.sheets ?? DEFAULT_SHEETS[mode]))
  const cols = mode === 'simple' ? SHOP_COLUMNS.filter((c) => c.simple) : SHOP_COLUMNS
  const rows = mode === 'template' ? [] : products

  const bolt = wb.addWorksheet(SHOP_SHEET.products)
  const specs = want.has('specs') ? wb.addWorksheet(SHOP_SHEET.specs) : null
  const faq = want.has('faq') ? wb.addWorksheet(SHOP_SHEET.faq) : null
  const related = want.has('related') ? wb.addWorksheet(SHOP_SHEET.related) : null
  const documents = want.has('documents') ? wb.addWorksheet(SHOP_SHEET.documents) : null
  const groups = want.has('groups') ? wb.addWorksheet(SHOP_SHEET.groups) : null
  const categories = want.has('categories') ? wb.addWorksheet(SHOP_SHEET.categories) : null
  const attributes = want.has('attributes') ? wb.addWorksheet(SHOP_SHEET.attributes) : null
  const help = specs ? wb.addWorksheet('Jellemzők súgó') : null
  const lists = addLists(wb, ctx)
  addMeta(wb, mode === 'snapshot' ? SHOP_SNAPSHOT_MODE : mode, new Date().toISOString())

  styleHeader(
    bolt,
    cols.map((c) => ({ label: c.label, width: c.width, note: c.note, info: c.kind === 'info' }))
  )
  for (const p of rows) bolt.addRow(cols.map((c) => productCell(ctx, p, c.id)))
  const boltRows = rows.length + EXTRA_ROWS
  applyProductValidations(bolt, cols, boltRows, lists)
  shadeInfo(
    bolt,
    cols.flatMap((c, i) => (c.kind === 'info' ? [i + 1] : [])),
    rows.length
  )

  if (specs) {
    styleHeader(specs, SPEC_COLUMNS)
    let specCount = 0
    for (const p of rows) {
      const ids = new Set(p.valueIds)
      const tpl = resolveCategoryTemplate(ctx.categories, p.categoryId)
      const tplIds = new Set(tpl.items.map((i) => i.attributeId))
      for (const attr of ctx.attributes) {
        const value = attributeDisplay(attr, ids, p.inputs)
        if (!value && (mode === 'snapshot' || !(tplIds.has(attr.id) && attr.active))) continue
        specs.addRow([p.sku, p.name, attr.name, value ?? null, attr.unit ?? null])
        specCount++
      }
    }
    validate(specs, 3, specCount + EXTRA_ROWS, listFormula('E', lists.E), false)
    textColumn(specs, 1)
    textColumn(specs, 4)
    shadeInfo(specs, [2, 5], specCount)
  }

  if (faq) {
    styleHeader(faq, FAQ_COLUMNS)
    let faqCount = 0
    for (const p of rows) {
      for (const f of p.web?.web_faq ?? []) {
        faq.addRow([p.sku, p.name, f.q, f.a])
        faqCount++
      }
    }
    textColumn(faq, 1)
    shadeInfo(faq, [2], faqCount)
  }

  if (related) {
    styleHeader(related, RELATED_COLUMNS)
    let n = 0
    for (const p of rows) {
      for (const r of ctx.related.get(p.id) ?? []) {
        const other = ctx.byId.get(r.relatedId)
        if (!other) continue
        related.addRow([p.sku, p.name, RELATED_KIND_META[r.kind]?.label ?? r.kind, other.sku, other.name, r.sortOrder])
        n++
      }
    }
    validate(related, 3, n + EXTRA_ROWS, listFormula('F', lists.F), false)
    textColumn(related, 1)
    textColumn(related, 4)
    shadeInfo(related, [2, 5], n)
  }

  if (documents) {
    styleHeader(documents, DOCUMENT_COLUMNS)
    let n = 0
    for (const p of rows) {
      for (const d of ctx.documents.get(p.id) ?? []) {
        const media = ctx.mediaById.get(d.mediaId)
        if (!media) continue
        documents.addRow([p.sku, p.name, media.filename, DOCUMENT_KIND_LABEL[d.kind] ?? d.kind, d.title, d.language])
        n++
      }
    }
    validate(documents, 4, n + EXTRA_ROWS, listFormula('G', lists.G), false)
    textColumn(documents, 1)
    shadeInfo(documents, [2], n)
  }

  if (groups) {
    styleHeader(groups, GROUP_COLUMNS)
    const codes = new Map<string, string>()
    for (const p of rows) {
      const code = p.web?.web_group_id?.trim()
      if (code && !codes.has(foldKey(code))) codes.set(foldKey(code), code)
    }
    if (mode === 'template') for (const g of ctx.groups.values()) codes.set(foldKey(g.code), g.code)
    const membersBy = new Map<string, string[]>()
    for (const p of ctx.products) {
      const code = p.web?.web_group_id?.trim()
      if (!code || !codes.has(foldKey(code))) continue
      membersBy.set(foldKey(code), [...(membersBy.get(foldKey(code)) ?? []), p.sku])
    }
    let n = 0
    for (const [k, code] of [...codes].sort((a, b) => a[1].localeCompare(b[1], 'hu'))) {
      const g = ctx.groups.get(k)
      const axes = (g?.axes ?? [])
        .map((id) => (id === PACK_AXIS ? 'Kiszerelés' : ctx.attributeById.get(id)?.name))
        .filter(Boolean)
      const members = membersBy.get(k) ?? []
      groups.addRow([
        code,
        g?.name ?? null,
        g?.mainAccessoryId ? (ctx.byId.get(g.mainAccessoryId)?.sku ?? null) : null,
        axes.length > 0 ? joinList(axes as string[]) : null,
        `${members.length} db: ${members.slice(0, 20).join(', ')}${members.length > 20 ? '…' : ''}`
      ])
      n++
    }
    textColumn(groups, 1)
    textColumn(groups, 3)
    shadeInfo(groups, [5], n)
  }

  if (categories) {
    styleHeader(categories, CATEGORY_COLUMNS)
    const counts = new Map<string, number>()
    for (const p of ctx.products) if (p.categoryId) counts.set(p.categoryId, (counts.get(p.categoryId) ?? 0) + 1)
    const names = (ids: string[]) =>
      joinList(ids.map((id) => ctx.attributeById.get(id)?.name).filter((x): x is string => Boolean(x))) || null
    for (const c of ctx.categories) {
      const tpl = [...c.template].sort((a, b) => a.sortOrder - b.sortOrder)
      categories.addRow([
        c.path,
        formatBool(c.active),
        c.googleTaxonomyId,
        c.measureImageUrl ? (ctx.mediaByUrl.get(c.measureImageUrl.split('?')[0])?.filename ?? null) : null,
        names(tpl.filter((t) => t.role === 'key').map((t) => t.attributeId)),
        names(tpl.filter((t) => t.role === 'spec').map((t) => t.attributeId)),
        counts.get(c.id) ?? 0
      ])
    }
    validate(categories, 2, ctx.categories.length + EXTRA_ROWS, listFormula('B', lists.B), false)
    shadeInfo(categories, [7], ctx.categories.length)
  }

  if (attributes) {
    styleHeader(attributes, ATTRIBUTE_COLUMNS)
    for (const a of ctx.attributes) {
      attributes.addRow([
        a.name,
        VALUE_TYPE_SHORT[a.valueType],
        a.unit,
        formatBool(a.allowMultiple),
        formatBool(a.isVariantAxis),
        formatBool(a.active),
        a.valueType === 'list' ? joinList(a.values.map((v) => v.label)) || null : null
      ])
    }
    const n = ctx.attributes.length + EXTRA_ROWS
    validate(attributes, 2, n, listFormula('H', lists.H), false)
    for (const c of [4, 5, 6]) validate(attributes, c, n, listFormula('B', lists.B), false)
  }

  if (help) {
    help.addRow(['Jellemző', 'Típus', 'Mértékegység', 'Lehetséges értékek'])
    help.getRow(1).font = { bold: true }
    help.getRow(1).fill = HEADER_FILL
    for (const a of ctx.attributes.filter((x) => x.active)) {
      help.addRow([
        a.name,
        `${VALUE_TYPE_HU[a.valueType]}${a.valueType === 'list' && a.allowMultiple ? ', több is választható' : ''}`,
        a.unit ?? '',
        a.valueType === 'list' ? joinList(a.values.filter((v) => v.active).map((v) => v.label)) : ''
      ])
    }
    help.getColumn(1).width = 24
    help.getColumn(2).width = 28
    help.getColumn(3).width = 14
    help.getColumn(4).width = 80
    help.views = [{ state: 'frozen', ySplit: 1 }]
  }

  wb.views = [{ x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, activeTab: 1, visibility: 'visible' }]
  return Buffer.from(await wb.xlsx.writeBuffer())
}

/** Szöveg formátum: az Excel ne alakítsa dátummá / számmá (pl. 1/2, 0012). */
function textColumn(ws: ExcelJS.Worksheet, col: number) {
  ws.getColumn(col).numFmt = '@'
}

/** A hibás sorok, az eredeti cellákkal és egy „Mi a baj?” oszloppal — javítás után visszatölthető. */
export async function buildProblemsWorkbook(source: ShopXWorkbook, problems: ShopXProblem[]): Promise<Buffer> {
  const wb = newWorkbook()
  addGuide(wb)
  const bySheet = new Map<string, Map<number, string[]>>()
  for (const p of problems) {
    const m = bySheet.get(p.sheet) ?? new Map<number, string[]>()
    m.set(p.rowNumber, p.messages)
    bySheet.set(p.sheet, m)
  }

  const emit = <C extends string>(
    name: string,
    sheet: RawSheet<C> | null,
    labelOf: (id: C) => string,
    rowsWithProblems: Map<number, string[]> | undefined,
    keepSiblings = false
  ) => {
    if (!sheet || !rowsWithProblems || rowsWithProblems.size === 0) return
    const siblingSkus = new Set(
      keepSiblings
        ? sheet.rows
            .filter((r) => rowsWithProblems.has(r.rowNumber))
            .map((r) => foldKey((r.cells as Record<string, string | undefined>).sku ?? ''))
        : []
    )
    const ws = wb.addWorksheet(name)
    const header = [PROBLEM_COLUMN_LABEL, ...sheet.columns.map(labelOf)]
    ws.addRow(header)
    ws.getRow(1).font = { bold: true }
    ws.getRow(1).fill = HEADER_FILL
    ws.getColumn(1).width = 60
    sheet.columns.forEach((_, i) => {
      ws.getColumn(i + 2).width = 18
    })
    for (const r of sheet.rows) {
      const msgs = rowsWithProblems.get(r.rowNumber)
      const sibling = siblingSkus.has(foldKey((r.cells as Record<string, string | undefined>).sku ?? ''))
      if (!msgs && !sibling) continue
      const row = ws.addRow([msgs ? msgs.join('\n') : null, ...sheet.columns.map((c) => r.cells[c] ?? null)])
      if (msgs) row.getCell(1).fill = PROBLEM_FILL
      row.getCell(1).alignment = { wrapText: true, vertical: 'top' }
    }
    ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }]
  }

  const labeler = (cols: { id: string; label: string }[]) => {
    const m = new Map(cols.map((c) => [c.id, c.label]))
    return (id: string) => m.get(id) ?? id
  }
  emit(SHOP_SHEET.products, source.products, labeler(SHOP_COLUMNS), bySheet.get('products'))
  emit(SHOP_SHEET.specs, source.specs, labeler(SPEC_COLUMNS), bySheet.get('specs'))
  // Halmaz-lapok: egy SKU összes sora kell, különben visszatöltéskor a többi törlődne.
  emit(SHOP_SHEET.faq, source.faq, labeler(FAQ_COLUMNS), bySheet.get('faq'), true)
  emit(SHOP_SHEET.related, source.related, labeler(RELATED_COLUMNS), bySheet.get('related'), true)
  emit(SHOP_SHEET.documents, source.documents, labeler(DOCUMENT_COLUMNS), bySheet.get('documents'), true)
  emit(SHOP_SHEET.groups, source.groups, labeler(GROUP_COLUMNS), bySheet.get('groups'))
  emit(SHOP_SHEET.categories, source.categories, labeler(CATEGORY_COLUMNS), bySheet.get('categories'))
  emit(SHOP_SHEET.attributes, source.attributes, labeler(ATTRIBUTE_COLUMNS), bySheet.get('attributes'))
  addMeta(wb, 'hibas-sorok', source.exportedAt ?? new Date().toISOString())
  return Buffer.from(await wb.xlsx.writeBuffer())
}

const STATUS_HU = { update: 'Frissül', unchanged: 'Nem változik', error: 'Kimarad' } as const
const SHOP_HU = {
  goes_live: 'Kikerül a boltba',
  stays_live: 'Kint marad',
  goes_off: 'Leveszed a boltból',
  forced_off: 'Lekerül — hiányos',
  blocked: 'Nem kerül ki — hiányos',
  off: 'Nincs a boltban'
} as const
const LEVEL_HU = { error: 'Hiba', warning: 'Figyelem', info: 'Infó' } as const

/** Teljes jelentés: minden tétel állapota, változása és megjegyzése (az előnézet csak egy részét mutatja). */
export async function buildReportWorkbook(items: ShopXItem[]): Promise<Buffer> {
  const wb = newWorkbook()
  const ws = wb.addWorksheet('Jelentés')
  styleHeader(ws, [
    { label: 'Sor', width: 16, note: 'Melyik lap hányadik sora.', info: false },
    { label: 'SKU', width: 16, note: '', info: false },
    { label: 'Név', width: 32, note: '', info: false },
    { label: 'Állapot', width: 14, note: '', info: false },
    { label: 'Mi változik', width: 40, note: '', info: false },
    { label: 'Bolt', width: 22, note: '', info: false },
    { label: 'Megjegyzés', width: 90, note: '', info: false }
  ])
  for (const item of items) {
    const first = item.rows[0]
    const notes = [
      ...item.shopReasons.map((r) => `Hiányzik: ${r}`),
      ...item.issues.map((i) => `${LEVEL_HU[i.level]} · ${i.where}: ${i.message}`)
    ]
    const row = ws.addRow([
      first ? `${SHOP_X_SHEET_LABEL[first.sheet]} ${first.rowNumber}.` : '',
      item.sku,
      item.name,
      STATUS_HU[item.status],
      item.changes.join(', '),
      item.accessoryId ? SHOP_HU[item.shop] : '',
      notes.join('\n')
    ])
    row.getCell(7).alignment = { wrapText: true, vertical: 'top' }
    if (item.status === 'error' || item.issues.some((i) => i.level === 'error')) row.getCell(4).fill = PROBLEM_FILL
  }
  ws.autoFilter = { from: 'A1', to: 'G1' }
  return Buffer.from(await wb.xlsx.writeBuffer())
}
