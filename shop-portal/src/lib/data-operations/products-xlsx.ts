export const PRODUCT_XLSX_COLUMNS = [
  'azonosito',
  'termek_neve',
  'gyarto',
  'vonalkod',
  'belso_vonalkod',
  'gyartoi_cikkszam',
  'mertekegyseg',
  'hosszusag',
  'szelesseg',
  'magassag',
  'suly',
  'sulymertekegyseg',
  'beszerzesi_ar',
  'arazasi_szorzo',
  'afa',
  'statusz'
] as const

export const PRODUCT_EXPORT_INFO_COLUMNS = ['netto_ar_szamolt', 'brutto_ar_szamolt'] as const

export type ProductXlsxColumn = (typeof PRODUCT_XLSX_COLUMNS)[number]
export type ProductExportInfoColumn = (typeof PRODUCT_EXPORT_INFO_COLUMNS)[number]

export type ProductImportRow = {
  rowNumber: number
  values: Record<ProductXlsxColumn, string>
  normalized: {
    sku: string | null
    name: string | null
    manufacturer: string | null
    gtin: string | null
    internal_barcode: string | null
    model_number: string | null
    unit: string | null
    length: number | null
    width: number | null
    height: number | null
    weight: number | null
    weight_unit: string | null
    cost: number | null
    multiplier: number | null
    vat: string | null
    status: number | null
  }
  errors: string[]
  warnings: string[]
}

const ALLOWED_STATUS = new Set(['active', 'inactive', '1', '0'])

function toCellString(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function normalizeNullableText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function parseNullableNumber(value: string): number | null {
  if (!value || value.trim().length === 0) return null
  const normalized = value.replace(',', '.').trim()
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

export function normalizeProductImportRows(rows: Array<Record<string, unknown>>): ProductImportRow[] {
  return rows.map((row, idx) => {
    const values = Object.fromEntries(
      PRODUCT_XLSX_COLUMNS.map((column) => [column, toCellString(row[column])])
    ) as Record<ProductXlsxColumn, string>

    const rawStatus = values.statusz.toLowerCase().trim()
    let normalizedStatus: number | null = null
    if (rawStatus.length > 0) {
      if (rawStatus === 'active' || rawStatus === '1') normalizedStatus = 1
      else if (rawStatus === 'inactive' || rawStatus === '0') normalizedStatus = 0
      else normalizedStatus = Number.NaN
    }

    const normalized = {
      sku: normalizeNullableText(values.azonosito),
      name: normalizeNullableText(values.termek_neve),
      manufacturer: normalizeNullableText(values.gyarto),
      gtin: normalizeNullableText(values.vonalkod),
      internal_barcode: normalizeNullableText(values.belso_vonalkod),
      model_number: normalizeNullableText(values.gyartoi_cikkszam),
      unit: normalizeNullableText(values.mertekegyseg),
      length: parseNullableNumber(values.hosszusag),
      width: parseNullableNumber(values.szelesseg),
      height: parseNullableNumber(values.magassag),
      weight: parseNullableNumber(values.suly),
      weight_unit: normalizeNullableText(values.sulymertekegyseg),
      cost: parseNullableNumber(values.beszerzesi_ar),
      multiplier: parseNullableNumber(values.arazasi_szorzo),
      vat: normalizeNullableText(values.afa),
      status: normalizedStatus
    }

    const errors: string[] = []
    const warnings: string[] = []

    if (!normalized.sku) {
      errors.push('Az azonosito (SKU) kötelező.')
    }

    if (values.statusz.trim().length > 0 && !ALLOWED_STATUS.has(rawStatus)) {
      errors.push('Érvénytelen statusz. Csak active/inactive vagy 1/0 lehet.')
    }

    const numericFields: Array<{ key: keyof typeof normalized; label: string; min?: number }> = [
      { key: 'length', label: 'hosszusag', min: 0 },
      { key: 'width', label: 'szelesseg', min: 0 },
      { key: 'height', label: 'magassag', min: 0 },
      { key: 'weight', label: 'suly', min: 0 },
      { key: 'cost', label: 'beszerzesi_ar', min: 0.000001 },
      { key: 'multiplier', label: 'arazasi_szorzo', min: 0.000001 }
    ]

    numericFields.forEach(({ key, label, min }) => {
      const val = normalized[key]
      if (val !== null && !Number.isFinite(val)) {
        errors.push(`A(z) ${label} mezőnek számnak kell lennie.`)
        return
      }
      if (val !== null && min !== undefined && val < min) {
        errors.push(`A(z) ${label} mező értéke túl alacsony.`)
      }
    })

    const hasAnyPricingInput = values.beszerzesi_ar.trim() || values.arazasi_szorzo.trim() || values.afa.trim()
    if (hasAnyPricingInput) {
      if (normalized.cost === null) errors.push('A beszerzesi_ar kötelező, ha ár mezőt importálsz.')
      if (normalized.multiplier === null) errors.push('Az arazasi_szorzo kötelező, ha ár mezőt importálsz.')
      if (!normalized.vat) errors.push('Az afa kötelező, ha ár mezőt importálsz.')
    }

    if (!normalized.name) {
      warnings.push('A termek_neve üres. A termék neve nem frissül.')
    }

    return {
      rowNumber: idx + 2,
      values,
      normalized,
      errors,
      warnings
    }
  })
}

export function detectDuplicateProductRows(rows: ProductImportRow[]): ProductImportRow[] {
  const seenBySku = new Map<string, number>()
  rows.forEach((row) => {
    if (!row.normalized.sku) return
    const key = row.normalized.sku.toLowerCase()
    if (seenBySku.has(key)) {
      row.errors.push(`Duplikált azonosito a fájlban (első előfordulás sora: ${seenBySku.get(key)}).`)
    } else {
      seenBySku.set(key, row.rowNumber)
    }
  })
  return rows
}

export function calculateNetGross(cost: number, multiplier: number, vatRate: number) {
  const net = Math.round(cost * multiplier * 100) / 100
  const gross = Math.round(net * (1 + vatRate / 100) * 100) / 100
  return { net, gross }
}

export function getProductTemplateRows(): Array<Record<ProductXlsxColumn, string>> {
  return [
    {
      azonosito: 'SKU-0001',
      termek_neve: 'Minta termék',
      gyarto: 'Minta Gyártó',
      vonalkod: '5991234567890',
      belso_vonalkod: 'INT-0001',
      gyartoi_cikkszam: 'MP-001',
      mertekegyseg: 'db',
      hosszusag: '10',
      szelesseg: '5',
      magassag: '3',
      suly: '0.25',
      sulymertekegyseg: 'kg',
      beszerzesi_ar: '1000',
      arazasi_szorzo: '1.35',
      afa: '27%',
      statusz: 'active'
    }
  ]
}
