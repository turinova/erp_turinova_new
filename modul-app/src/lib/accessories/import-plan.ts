import {
  ACCESSORY_CLEAR_MARK,
  ACCESSORY_EXCEL_HEADERS,
  ACCESSORY_HEADER_LABEL,
  type AccessoryExcelHeader
} from '@/lib/accessories/excel-columns'
import type { ParsedAccessoryRow, ParsedAccessoryWorkbook } from '@/lib/accessories/excel-workbook'
import {
  skuKey,
  type AccessoryImportContext,
  type ImportExisting,
  type ImportManufacturer,
  type ImportTaxRate,
  type ImportUnit
} from '@/lib/accessories/import-context'
import type {
  AccessoryImportDecisions,
  AccessoryImportIssue,
  AccessoryImportItem,
  AccessoryImportPending,
  AccessoryImportPreview,
  AccessoryImportStatus
} from '@/lib/accessories/import-types'
import { formatMoneyFt, grossFromNet, netFromGross } from '@/lib/accessories/parse'
import { closest, parseBool } from '@/lib/webshop/excel/format'

export const NEW_MANUFACTURER_PREFIX = 'new:'

export type AccessoryWriteRow = {
  manufacturer_id: string
  tax_rate_id: string
  unit_id: string
  name: string
  sku: string
  barcode: string | null
  barcode_internal: string | null
  price_net: number
  purchase_price_net: number | null
  margin_factor: number | null
  active: boolean
  image_url: string | null
  web_gallery: string[]
}

export type PlannedWrite = {
  rowNumber: number
  kind: 'create' | 'update'
  id?: string
  row: AccessoryWriteRow
}

export type AccessoryImportPlan = {
  preview: AccessoryImportPreview
  writes: PlannedWrite[]
  /** Sorszám → „Mező: hiba” üzenetek; ezek a sorok (vagy mezőik) nem mentődnek. */
  problems: Map<number, string[]>
  manufacturersToCreate: { key: string; name: string }[]
}

const MAX_NAME = 200
const MAX_SKU = 100
const MAX_BARCODE = 64
const MAX_GALLERY = 20
/** 15 jegy fölött az Excel szám pontatlan: a vonalkód már elromlott a fájlban. */
const MAX_SAFE_EXCEL_INTEGER = 999_999_999_999_999

export function foldName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function manufacturerDecisionKey(raw: string): string {
  return `mfr:${foldName(raw)}`
}

/** „2 490 Ft” / „2490,5” → szám; üres → null; hibás → NaN. */
function parseAmount(raw: string): number | null {
  const t = raw
    .trim()
    .replace(/\s|\u00a0/g, '')
    .replace(/(ft|huf)$/i, '')
  if (!t) return null
  const n = Number(t.replace(',', '.'))
  return Number.isFinite(n) ? n : Number.NaN
}

type Lookups = {
  byId: Map<string, ImportExisting>
  bySku: Map<string, ImportExisting>
  barcodeOwner: Map<string, ImportExisting>
  internalOwner: Map<string, ImportExisting>
  /** Vezető nullák nélküli kód → tulajdonos (számként érkezett cellákhoz). */
  barcodeStripped: Map<string, ImportExisting>
  internalStripped: Map<string, ImportExisting>
  mfrByLower: Map<string, ImportManufacturer>
  mfrByFold: Map<string, ImportManufacturer>
  mfrById: Map<string, ImportManufacturer>
  taxByFold: Map<string, ImportTaxRate>
  taxById: Map<string, ImportTaxRate>
  unitByFold: Map<string, ImportUnit>
  unitById: Map<string, ImportUnit>
}

function buildLookups(ctx: AccessoryImportContext): Lookups {
  const l: Lookups = {
    byId: new Map(),
    bySku: new Map(),
    barcodeOwner: new Map(),
    internalOwner: new Map(),
    barcodeStripped: new Map(),
    internalStripped: new Map(),
    mfrByLower: new Map(),
    mfrByFold: new Map(),
    mfrById: new Map(),
    taxByFold: new Map(),
    taxById: new Map(),
    unitByFold: new Map(),
    unitById: new Map()
  }
  for (const e of ctx.existing) {
    l.byId.set(e.id, e)
    l.bySku.set(skuKey(e.sku), e)
    if (e.barcode?.trim()) {
      l.barcodeOwner.set(e.barcode.trim(), e)
      if (e.barcode.startsWith('0')) l.barcodeStripped.set(e.barcode.trim().replace(/^0+/, ''), e)
    }
    if (e.barcode_internal?.trim()) {
      l.internalOwner.set(e.barcode_internal.trim(), e)
      if (e.barcode_internal.startsWith('0')) {
        l.internalStripped.set(e.barcode_internal.trim().replace(/^0+/, ''), e)
      }
    }
  }
  for (const m of ctx.manufacturers) {
    l.mfrById.set(m.id, m)
    l.mfrByLower.set(m.name.trim().toLowerCase(), m)
    if (!l.mfrByFold.has(foldName(m.name))) l.mfrByFold.set(foldName(m.name), m)
  }
  for (const t of ctx.taxRates) {
    l.taxById.set(t.id, t)
    l.taxByFold.set(foldName(t.name), t)
  }
  for (const u of ctx.units) {
    l.unitById.set(u.id, u)
    l.unitByFold.set(foldName(u.shortform), u)
    if (!l.unitByFold.has(foldName(u.name))) l.unitByFold.set(foldName(u.name), u)
  }
  return l
}

type PendingAcc = { raw: string; rowCount: number; suggestion: ImportManufacturer | null }

type RowState = {
  issues: AccessoryImportIssue[]
  /** Sor szintű hiba: semmi nem mentődik belőle. */
  fatal: boolean
}

const label = (h: AccessoryExcelHeader) => ACCESSORY_HEADER_LABEL[h]

function fieldError(s: RowState, h: AccessoryExcelHeader | 'Sor', message: string) {
  s.issues.push({ level: 'error', where: h === 'Sor' ? 'Sor' : label(h), message })
}
function fieldWarn(s: RowState, h: AccessoryExcelHeader | 'Sor', message: string, level: 'warning' | 'info' = 'warning') {
  s.issues.push({ level, where: h === 'Sor' ? 'Sor' : label(h), message })
}

/** Cella állapota: nincs oszlop / üres → `keep`; `-` → `clear`; különben a szöveg. */
function cell(row: ParsedAccessoryRow, h: AccessoryExcelHeader): { kind: 'keep' } | { kind: 'clear' } | { kind: 'value'; text: string } {
  const raw = row.values[h]
  if (raw == null || raw.trim() === '') return { kind: 'keep' }
  if (raw.trim() === ACCESSORY_CLEAR_MARK) return { kind: 'clear' }
  return { kind: 'value', text: raw.trim() }
}

function suggestionText(name: string | null | undefined): string {
  return name ? ` Erre gondoltál: „${name}”?` : ''
}

export function planAccessoryImport(
  ctx: AccessoryImportContext,
  wb: ParsedAccessoryWorkbook,
  decisions: AccessoryImportDecisions
): AccessoryImportPlan {
  const l = buildLookups(ctx)
  const items: AccessoryImportItem[] = []
  const writes: PlannedWrite[] = []
  const problems = new Map<number, string[]>()
  const pending = new Map<string, PendingAcc>()
  const toCreate = new Map<string, string>()

  const seenTarget = new Map<string, number>()
  const seenSku = new Map<string, number>()
  const seenBarcode = new Map<string, number>()
  const seenInternal = new Map<string, number>()

  let restoredZeros = 0
  let deletedSkuCreates = 0
  let unknownIds = 0
  const stats = { rows: wb.rows.length, create: 0, update: 0, unchanged: 0, error: 0, partial: 0, warning: 0 }

  for (const row of wb.rows) {
    const s: RowState = { issues: [], fatal: false }
    const skuCell = cell(row, 'SKU')
    const skuRaw = skuCell.kind === 'value' ? skuCell.text : ''

    // --- Melyik termék? Azonosító elsőbbséget élvez a SKU előtt. ---
    let target: ImportExisting | undefined
    const idRaw = row.values.Azonosito?.trim()
    if (idRaw) {
      target = l.byId.get(idRaw)
      if (!target) {
        unknownIds += 1
        fieldWarn(
          s,
          'Azonosito',
          'Ismeretlen azonosító (másik cégből vagy törölt termékből jött?). A SKU alapján keresünk.'
        )
      }
    }
    if (skuCell.kind === 'clear') {
      fieldError(s, 'SKU', 'A SKU nem törölhető.')
      s.fatal = true
    } else if (!target && !skuRaw) {
      fieldError(s, 'SKU', 'Hiányzik a SKU.')
      s.fatal = true
    }
    if (row.numbers.SKU != null && (!Number.isInteger(row.numbers.SKU) || Math.abs(row.numbers.SKU) > MAX_SAFE_EXCEL_INTEGER)) {
      fieldError(s, 'SKU', 'A SKU számként érkezett és az Excel elrontotta. Formázd a cellát Szövegként, és írd be újra.')
      s.fatal = true
    }
    if (skuRaw.length > MAX_SKU) {
      fieldError(s, 'SKU', `A SKU legfeljebb ${MAX_SKU} karakter.`)
      s.fatal = true
    }
    if (!target && skuRaw) target = l.bySku.get(skuKey(skuRaw))

    let finalSku = target?.sku ?? skuRaw
    if (!s.fatal && target && skuRaw && skuKey(skuRaw) !== skuKey(target.sku)) {
      const other = l.bySku.get(skuKey(skuRaw))
      if (other && other.id !== target.id) {
        fieldError(s, 'SKU', `Ez a SKU már egy másik termékhez tartozik: „${other.name}”.`)
        s.fatal = true
      } else {
        finalSku = skuRaw
      }
    } else if (!s.fatal && target && skuRaw && skuRaw !== target.sku) {
      finalSku = skuRaw
    }

    if (!s.fatal) {
      const targetKey = target ? `id:${target.id}` : `sku:${skuKey(finalSku)}`
      const firstRow = seenTarget.get(targetKey)
      if (firstRow != null) {
        fieldError(s, 'Sor', `Ez a termék már szerepel a(z) ${firstRow}. sorban. Egy termék csak egyszer lehet a fájlban.`)
        s.fatal = true
      } else {
        seenTarget.set(targetKey, row.rowNumber)
        const skuFirst = seenSku.get(skuKey(finalSku))
        if (skuFirst != null) {
          fieldError(s, 'SKU', `Ez a SKU már szerepel a(z) ${skuFirst}. sorban.`)
          s.fatal = true
        } else {
          seenSku.set(skuKey(finalSku), row.rowNumber)
        }
      }
    }

    const isCreate = !target
    if (isCreate && !s.fatal && ctx.deletedSkus.has(skuKey(finalSku))) {
      deletedSkuCreates += 1
      fieldWarn(s, 'SKU', 'Ezzel a SKU-val korábban volt egy törölt termék. Új termékként jön létre.', 'info')
    }

    // --- Mezők ---
    const required = (h: AccessoryExcelHeader) => {
      if (isCreate) fieldError(s, h, 'Új terméknél kötelező.')
    }

    // Név
    let name = target?.name ?? ''
    const nameCell = cell(row, 'Nev')
    if (nameCell.kind === 'keep') {
      if (isCreate) required('Nev')
    } else if (nameCell.kind === 'clear') {
      fieldError(s, 'Nev', 'A név nem törölhető.')
    } else if (nameCell.text.length > MAX_NAME) {
      fieldError(s, 'Nev', `Legfeljebb ${MAX_NAME} karakter.`)
    } else {
      name = nameCell.text
    }

    // Gyártó
    let manufacturerId = target?.manufacturer_id ?? ''
    let manufacturerName = target ? (l.mfrById.get(target.manufacturer_id)?.name ?? '') : ''
    const mfrCell = cell(row, 'Gyarto')
    if (mfrCell.kind === 'keep') {
      if (isCreate) required('Gyarto')
    } else if (mfrCell.kind === 'clear') {
      fieldError(s, 'Gyarto', 'A gyártó nem törölhető.')
    } else {
      const raw = mfrCell.text
      const hit = l.mfrByLower.get(raw.toLowerCase()) ?? l.mfrByFold.get(foldName(raw))
      if (hit) {
        manufacturerId = hit.id
        manufacturerName = hit.name
      } else {
        const key = manufacturerDecisionKey(raw)
        const acc =
          pending.get(key) ??
          ({ raw, rowCount: 0, suggestion: closest(foldName(raw), ctx.manufacturers, (m) => foldName(m.name)) } as PendingAcc)
        acc.rowCount += 1
        pending.set(key, acc)
        const choice = decisions[key]
        if (choice === 'suggestion' && acc.suggestion) {
          manufacturerId = acc.suggestion.id
          manufacturerName = acc.suggestion.name
        } else if (choice === 'create') {
          manufacturerId = `${NEW_MANUFACTURER_PREFIX}${key}`
          manufacturerName = acc.raw
          toCreate.set(key, acc.raw)
        } else {
          fieldError(
            s,
            'Gyarto',
            isCreate
              ? `Nincs ilyen gyártó: „${raw}”. Fent döntsd el, létrehozzuk-e.`
              : `Nincs ilyen gyártó: „${raw}”. Amíg fent nem döntesz, a gyártó nem változik.`
          )
        }
      }
    }

    // Adónem
    let tax = target ? l.taxById.get(target.tax_rate_id) : undefined
    const taxCell = cell(row, 'Adonem')
    if (taxCell.kind === 'keep') {
      if (isCreate) required('Adonem')
    } else if (taxCell.kind === 'clear') {
      fieldError(s, 'Adonem', 'Az adónem nem törölhető.')
    } else {
      let hit = l.taxByFold.get(foldName(taxCell.text))
      const pct = taxCell.text.match(/^(\d+(?:[.,]\d+)?)\s*%?$/)
      if (!hit && pct) {
        const rate = Number(pct[1].replace(',', '.'))
        const same = ctx.taxRates.filter((t) => t.ratePercent === rate)
        if (same.length === 1) hit = same[0]
      }
      if (hit) tax = hit
      else {
        const guess = closest(foldName(taxCell.text), ctx.taxRates, (t) => foldName(t.name))
        fieldError(s, 'Adonem', `Nincs ilyen adónem: „${taxCell.text}”.${suggestionText(guess?.name)}`)
      }
    }

    // Egység
    let unitId = target?.unit_id ?? ''
    const unitCell = cell(row, 'Egyseg')
    if (unitCell.kind === 'keep') {
      if (isCreate) required('Egyseg')
    } else if (unitCell.kind === 'clear') {
      fieldError(s, 'Egyseg', 'Az egység nem törölhető.')
    } else {
      const hit = l.unitByFold.get(foldName(unitCell.text))
      if (hit) unitId = hit.id
      else {
        const guess = closest(foldName(unitCell.text), ctx.units, (u) => foldName(u.shortform))
        fieldError(s, 'Egyseg', `Nincs ilyen egység: „${unitCell.text}”.${suggestionText(guess?.shortform)}`)
      }
    }

    // Aktív
    let active = target?.active ?? true
    const activeCell = cell(row, 'Aktiv')
    if (activeCell.kind === 'clear') {
      fieldError(s, 'Aktiv', 'igen vagy nem legyen.')
    } else if (activeCell.kind === 'value') {
      const b = parseBool(activeCell.text)
      if (b == null) fieldError(s, 'Aktiv', `„${activeCell.text}” — igen vagy nem legyen.`)
      else active = b
    }

    // Vonalkódok
    const barcodeField = (
      h: 'Vonalkod' | 'Belso_vonalkod',
      current: string | null,
      owners: Map<string, ImportExisting>,
      strippedOwners: Map<string, ImportExisting>,
      seen: Map<string, number>
    ): string | null => {
      const c = cell(row, h)
      if (c.kind === 'keep') return current
      if (c.kind === 'clear') return null
      let text = c.text
      const n = row.numbers[h]
      if (n != null) {
        if (!Number.isInteger(n) || Math.abs(n) > MAX_SAFE_EXCEL_INTEGER) {
          fieldError(s, h, 'Számként érkezett, és az Excel elrontotta a számjegyeket. Formázd a cellát Szövegként, és írd be újra.')
          return current
        }
        text = String(n)
        if (current && current !== text && current.replace(/^0+/, '') === text) {
          restoredZeros += 1
          return current
        }
        const padded = strippedOwners.get(text)
        if (padded && padded.id !== target?.id) {
          fieldError(
            s,
            h,
            `Számként érkezett, és valószínűleg „${padded.name}” (${padded.sku}) kódja, csak az Excel levágta a 0-t az elejéről. Formázd a cellát Szövegként.`
          )
          return current
        }
        if (text.length === 7 || text.length === 12) {
          fieldWarn(s, h, 'Számként érkezett. Ha 0-val kezdődik, az Excel levághatta az elejét — ellenőrizd.')
        }
      } else if (/^\d+(?:[.,]\d+)?e\+\d+$/i.test(text)) {
        fieldError(s, h, `„${text}” — ez tudományos alak, a vonalkód elveszett. Formázd a cellát Szövegként, és írd be újra.`)
        return current
      }
      if (text.length > MAX_BARCODE) {
        fieldError(s, h, `Legfeljebb ${MAX_BARCODE} karakter.`)
        return current
      }
      const owner = owners.get(text)
      if (owner && owner.id !== target?.id) {
        fieldError(s, h, `Már foglalt: „${owner.name}” (${owner.sku}) használja.`)
        return current
      }
      const firstRow = seen.get(text)
      if (firstRow != null) {
        fieldError(s, h, `Ugyanez a kód a(z) ${firstRow}. sorban is szerepel.`)
        return current
      }
      seen.set(text, row.rowNumber)
      return text
    }
    const barcode = barcodeField('Vonalkod', target?.barcode ?? null, l.barcodeOwner, l.barcodeStripped, seenBarcode)
    const barcodeInternal = barcodeField(
      'Belso_vonalkod',
      target?.barcode_internal ?? null,
      l.internalOwner,
      l.internalStripped,
      seenInternal
    )

    // Árak
    let purchase = target?.purchase_price_net ?? null
    let margin = target?.margin_factor ?? null
    const purchaseCell = cell(row, 'Beszerzes_netto_Ft')
    const marginCell = cell(row, 'Arres_szorzo')
    let pricingError = false
    if (purchaseCell.kind === 'clear') purchase = null
    else if (purchaseCell.kind === 'value') {
      const n = parseAmount(purchaseCell.text)
      if (n == null || Number.isNaN(n) || n < 0) {
        fieldError(s, 'Beszerzes_netto_Ft', `„${purchaseCell.text}” — nem ár. Pl. 1400`)
        pricingError = true
      } else {
        if (!Number.isInteger(n)) fieldWarn(s, 'Beszerzes_netto_Ft', `Egész forintra kerekítve: ${Math.round(n)}.`, 'info')
        purchase = Math.round(n)
      }
    }
    if (marginCell.kind === 'clear') margin = null
    else if (marginCell.kind === 'value') {
      const n = parseAmount(marginCell.text)
      if (n == null || Number.isNaN(n) || n <= 0 || n > 100) {
        fieldError(s, 'Arres_szorzo', `„${marginCell.text}” — szorzó legyen 0 és 100 között, pl. 1,35.`)
        pricingError = true
      } else {
        margin = Math.round(n * 10000) / 10000
      }
    }
    if (!pricingError && (purchase == null) !== (margin == null)) {
      fieldError(
        s,
        purchase == null ? 'Beszerzes_netto_Ft' : 'Arres_szorzo',
        'A beszerzési ár és az árrés szorzó csak együtt adható meg (vagy mindkettőt töröld -).'
      )
      pricingError = true
    }
    if (pricingError) {
      purchase = target?.purchase_price_net ?? null
      margin = target?.margin_factor ?? null
    }

    let priceNet = target?.price_net ?? null
    const grossCell = cell(row, 'Brutto_Ft')
    const vat = tax?.ratePercent ?? 0
    if (grossCell.kind === 'clear') {
      fieldError(s, 'Brutto_Ft', 'Az ár nem törölhető.')
    } else if (grossCell.kind === 'value') {
      const n = parseAmount(grossCell.text)
      if (n == null || Number.isNaN(n) || n < 0) {
        fieldError(s, 'Brutto_Ft', `„${grossCell.text}” — nem ár. Pl. 2490`)
      } else if (tax) {
        if (!Number.isInteger(n)) fieldWarn(s, 'Brutto_Ft', `Egész forintra kerekítve: ${Math.round(n)}.`, 'info')
        priceNet = netFromGross(Math.round(n), vat)
      }
    } else if (
      !pricingError &&
      (purchaseCell.kind !== 'keep' || marginCell.kind !== 'keep') &&
      purchase != null &&
      margin != null
    ) {
      priceNet = Math.round(purchase * margin)
    } else if (isCreate && !pricingError) {
      fieldError(s, 'Brutto_Ft', 'Új terméknél adj meg bruttó árat, vagy beszerzési árat + árrés szorzót.')
    }

    // Kép
    let imageUrl = target?.image_url ?? null
    const imageCell = cell(row, 'Kep_fajlnev')
    if (imageCell.kind === 'clear') imageUrl = null
    else if (imageCell.kind === 'value') {
      const url = ctx.mediaByFilename.get(imageCell.text.toLowerCase())
      if (!url) fieldError(s, 'Kep_fajlnev', `Nincs ilyen kép a Médiában: „${imageCell.text}”. Előbb töltsd fel a Média oldalra.`)
      else imageUrl = url
    }

    // Galéria: fájlnevek (vagy teljes URL-ek) | jellel; a meglévőt egészében lecseréli.
    let gallery = target?.web_gallery ?? []
    const galleryCell = cell(row, 'Galeria')
    if (galleryCell.kind === 'clear') gallery = []
    else if (galleryCell.kind === 'value') {
      const names = [...new Set(galleryCell.text.split(/\s*\|\s*|\r?\n/).map((p) => p.trim()).filter(Boolean))]
      const urls: string[] = []
      const unknown: string[] = []
      for (const nameOrUrl of names) {
        if (/^https?:\/\//i.test(nameOrUrl)) urls.push(nameOrUrl)
        else {
          const url = ctx.mediaByFilename.get(nameOrUrl.toLowerCase())
          if (url) urls.push(url)
          else unknown.push(nameOrUrl)
        }
      }
      if (unknown.length > 0) {
        const shown = unknown.slice(0, 3).map((u) => `„${u}”`).join(', ')
        fieldError(
          s,
          'Galeria',
          `Nincs ilyen kép a Médiában: ${shown}${unknown.length > 3 ? ` és még ${unknown.length - 3}` : ''}. Előbb töltsd fel a Média oldalra.`
        )
      } else if (urls.length > MAX_GALLERY) {
        fieldError(s, 'Galeria', `Legfeljebb ${MAX_GALLERY} kép lehet a galériában (most ${urls.length}).`)
      } else {
        gallery = urls
      }
    }

    // --- Eredmény ---
    const hasError = s.issues.some((i) => i.level === 'error')
    let status: AccessoryImportStatus
    const changes: string[] = []
    let write: PlannedWrite | null = null

    if (s.fatal || (isCreate && hasError) || !tax || !manufacturerId || !unitId || priceNet == null) {
      status = 'error'
    } else {
      const next: AccessoryWriteRow = {
        manufacturer_id: manufacturerId,
        tax_rate_id: tax.id,
        unit_id: unitId,
        name,
        sku: finalSku,
        barcode,
        barcode_internal: barcodeInternal,
        price_net: priceNet,
        purchase_price_net: purchase,
        margin_factor: margin,
        active,
        image_url: imageUrl,
        web_gallery: gallery
      }
      if (isCreate) {
        status = 'create'
        changes.push('Új termék')
        write = { rowNumber: row.rowNumber, kind: 'create', row: next }
      } else {
        const t = target!
        const prevTax = l.taxById.get(t.tax_rate_id)
        if (next.name !== t.name) changes.push('Név')
        if (next.sku !== t.sku) changes.push(`SKU: ${t.sku} → ${next.sku}`)
        if (next.manufacturer_id !== t.manufacturer_id) changes.push(`Gyártó: ${manufacturerName}`)
        if (next.tax_rate_id !== t.tax_rate_id) changes.push(`Adónem: ${tax.name}`)
        if (next.unit_id !== t.unit_id) changes.push(`Egység: ${l.unitById.get(next.unit_id)?.shortform ?? ''}`)
        if (next.barcode !== t.barcode) changes.push(next.barcode ? 'Vonalkód' : 'Vonalkód törölve')
        if (next.barcode_internal !== t.barcode_internal) changes.push(next.barcode_internal ? 'Belső vonalkód' : 'Belső vonalkód törölve')
        const oldGross = grossFromNet(t.price_net, prevTax?.ratePercent ?? 0)
        const newGross = grossFromNet(next.price_net, vat)
        if (next.price_net !== t.price_net || oldGross !== newGross) {
          changes.push(`Bruttó ár: ${formatMoneyFt(oldGross)} → ${formatMoneyFt(newGross)}`)
        }
        if (next.purchase_price_net !== t.purchase_price_net || next.margin_factor !== t.margin_factor) {
          changes.push(next.purchase_price_net == null ? 'Beszerzési ár törölve' : 'Beszerzési ár / szorzó')
        }
        if (next.active !== t.active) changes.push(next.active ? 'Aktív lesz' : 'Inaktív lesz')
        if (next.image_url !== t.image_url) changes.push(next.image_url ? 'Kép' : 'Kép törölve')
        if (JSON.stringify(next.web_gallery) !== JSON.stringify(t.web_gallery)) {
          changes.push(next.web_gallery.length > 0 ? `Galéria (${next.web_gallery.length} kép)` : 'Galéria törölve')
        }
        if (next.tax_rate_id !== t.tax_rate_id && grossCell.kind === 'keep' && next.price_net === t.price_net) {
          fieldWarn(s, 'Adonem', 'Az adónem változott, a nettó ár marad — ezért a bruttó ár változik.', 'info')
        }
        status = changes.length > 0 ? 'update' : 'unchanged'
        if (status === 'update') write = { rowNumber: row.rowNumber, kind: 'update', id: t.id, row: next }
      }
    }

    if (write) writes.push(write)
    stats[status] += 1
    if (status !== 'error' && hasError) stats.partial += 1
    if (s.issues.some((i) => i.level === 'warning')) stats.warning += 1

    const errors = s.issues.filter((i) => i.level === 'error').map((i) => `${i.where}: ${i.message}`)
    if (errors.length > 0) problems.set(row.rowNumber, errors)

    if (status !== 'unchanged' || s.issues.length > 0) {
      items.push({
        rowNumber: row.rowNumber,
        status,
        sku: finalSku || skuRaw || '—',
        name: name || row.values.Nev || '',
        manufacturerName: manufacturerName || row.values.Gyarto || '',
        changes,
        issues: s.issues
      })
    }
  }

  const pendingList: AccessoryImportPending[] = [...pending.entries()]
    .map(([key, p]) => ({
      key,
      raw: p.raw,
      rowCount: p.rowCount,
      suggestion: p.suggestion?.name ?? null,
      choice: decisions[key] === 'suggestion' && !p.suggestion ? null : (decisions[key] ?? null)
    }))
    .sort((a, b) => b.rowCount - a.rowCount || a.raw.localeCompare(b.raw, 'hu'))

  const notices: string[] = []
  const missing = ACCESSORY_EXCEL_HEADERS.filter((h) => h !== 'Azonosito' && !wb.columns.includes(h))
  if (missing.length > 0) {
    notices.push(`A fájlban nincs benne: ${missing.map(label).join(', ')}. Ezek a meglévő termékeknél nem változnak.`)
  }
  if (restoredZeros > 0) {
    notices.push(
      `${restoredZeros} vonalkódnál az Excel levágta a 0-t az elejéről. A meglévő, helyes kódot megtartottuk.`
    )
  }
  if (deletedSkuCreates > 0) {
    notices.push(`${deletedSkuCreates} SKU-val korábban volt törölt termék — ezek új termékként jönnek létre.`)
  }
  if (unknownIds > 0) {
    notices.push(`${unknownIds} sorban ismeretlen az Azonosító — ezeknél a SKU alapján kerestünk.`)
  }

  return {
    preview: { stats, items, pending: pendingList, notices },
    writes,
    problems,
    manufacturersToCreate: [...toCreate.entries()].map(([key, name]) => ({ key, name }))
  }
}
