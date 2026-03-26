export const PRODUCT_SUPPLIER_XLSX_COLUMNS = [
  'termek_azonosito',
  'gyartoi_cikkszam',
  'beszallito_azonosito',
  'beszallito_termekkod',
  'beszallito_vonalkod',
  'alap_beszerzesi_ar',
  'min_rendelesi_mennyiseg',
  'szallitasi_ido_nap',
  'preferalt',
  'aktiv'
] as const

export type ProductSupplierXlsxColumn = (typeof PRODUCT_SUPPLIER_XLSX_COLUMNS)[number]

export type ProductSupplierImportRow = {
  rowNumber: number
  values: Record<ProductSupplierXlsxColumn, string>
  normalized: {
    product_sku: string | null
    model_number: string | null
    supplier_code: string | null
    supplier_sku: string | null
    supplier_barcode: string | null
    default_cost: number | null
    min_order_quantity: number
    lead_time_days: number | null
    is_preferred: boolean | null
    is_active: boolean | null
  }
  errors: string[]
  warnings: string[]
}

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

function parseNullableInteger(value: string): number | null {
  if (!value || value.trim().length === 0) return null
  const parsed = Number.parseInt(value.trim(), 10)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function parseNullableBoolean(value: string): boolean | null {
  const raw = value.trim().toLowerCase()
  if (!raw) return null
  if (['1', 'true', 'yes', 'igen', 'active', 'aktiv'].includes(raw)) return true
  if (['0', 'false', 'no', 'nem', 'inactive', 'inaktiv'].includes(raw)) return false
  return null
}

export function normalizeProductSupplierImportRows(rows: Array<Record<string, unknown>>): ProductSupplierImportRow[] {
  return rows.map((row, idx) => {
    const values = Object.fromEntries(
      PRODUCT_SUPPLIER_XLSX_COLUMNS.map((column) => [column, toCellString(row[column])])
    ) as Record<ProductSupplierXlsxColumn, string>

    const minOrder = parseNullableInteger(values.min_rendelesi_mennyiseg)
    const leadDays = parseNullableInteger(values.szallitasi_ido_nap)
    const preferred = parseNullableBoolean(values.preferalt)
    const active = parseNullableBoolean(values.aktiv)

    const normalized = {
      product_sku: normalizeNullableText(values.termek_azonosito),
      model_number: normalizeNullableText(values.gyartoi_cikkszam),
      supplier_code: normalizeNullableText(values.beszallito_azonosito),
      supplier_sku: normalizeNullableText(values.beszallito_termekkod),
      supplier_barcode: normalizeNullableText(values.beszallito_vonalkod),
      default_cost: parseNullableNumber(values.alap_beszerzesi_ar),
      min_order_quantity: Number.isFinite(minOrder as number) && (minOrder as number) > 0 ? (minOrder as number) : 1,
      lead_time_days: Number.isFinite(leadDays as number) ? (leadDays as number) : null,
      is_preferred: preferred,
      is_active: active
    }

    const errors: string[] = []
    const warnings: string[] = []

    if (!normalized.product_sku) errors.push('A termek_azonosito (SKU) kötelező.')
    if (!normalized.supplier_code) errors.push('A beszallito_azonosito kötelező.')

    if (normalized.default_cost !== null && !Number.isFinite(normalized.default_cost)) {
      errors.push('Az alap_beszerzesi_ar mezőnek számnak kell lennie.')
    } else if ((normalized.default_cost as number) < 0) {
      errors.push('Az alap_beszerzesi_ar nem lehet negatív.')
    }

    if (minOrder !== null && !Number.isFinite(minOrder)) {
      errors.push('A min_rendelesi_mennyiseg mezőnek egész számnak kell lennie.')
    } else if ((minOrder as number) <= 0) {
      errors.push('A min_rendelesi_mennyiseg nem lehet 0 vagy negatív.')
    }

    if (leadDays !== null && !Number.isFinite(leadDays)) {
      errors.push('A szallitasi_ido_nap mezőnek egész számnak kell lennie.')
    } else if (leadDays !== null && (leadDays as number) < 0) {
      errors.push('A szallitasi_ido_nap nem lehet negatív.')
    }

    if (values.preferalt.trim().length > 0 && preferred === null) {
      errors.push('A preferalt mező csak igen/nem, active/inactive vagy 1/0 lehet.')
    }

    if (values.aktiv.trim().length > 0 && active === null) {
      errors.push('Az aktiv mező csak igen/nem, active/inactive vagy 1/0 lehet.')
    }

    if (!normalized.supplier_sku && !normalized.supplier_barcode) {
      warnings.push('A beszallito_termekkod és beszallito_vonalkod is üres.')
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

export function detectDuplicateProductSupplierRows(rows: ProductSupplierImportRow[]): ProductSupplierImportRow[] {
  const seen = new Map<string, number>()
  rows.forEach((row) => {
    if (!row.normalized.product_sku || !row.normalized.supplier_code) return
    const key = `${row.normalized.product_sku.toLowerCase()}__${row.normalized.supplier_code.toLowerCase()}`
    if (seen.has(key)) {
      row.errors.push(`Duplikált SKU+beszállító kulcs a fájlban (első előfordulás sora: ${seen.get(key)}).`)
      return
    }
    seen.set(key, row.rowNumber)
  })
  return rows
}

export function getProductSupplierTemplateRows(): Array<Record<ProductSupplierXlsxColumn, string>> {
  return [
    {
      termek_azonosito: 'SKU-0001',
      gyartoi_cikkszam: 'MP-001',
      beszallito_azonosito: 'SUP-0001',
      beszallito_termekkod: 'SUP-SKU-1001',
      beszallito_vonalkod: '5991234567890',
      alap_beszerzesi_ar: '1200',
      min_rendelesi_mennyiseg: '1',
      szallitasi_ido_nap: '3',
      preferalt: 'igen',
      aktiv: 'active'
    }
  ]
}
