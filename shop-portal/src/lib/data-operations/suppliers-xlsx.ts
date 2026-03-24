export const SUPPLIER_XLSX_COLUMNS = [
  'azonosito',
  'nev',
  'email',
  'telefon',
  'weboldal',
  'adoszam',
  'kozossegi_adoszam',
  'statusz',
  'fizetesi_hatarido_nap',
  'fizetesi_mod',
  'afa',
  'penznem'
] as const

export type SupplierXlsxColumn = (typeof SUPPLIER_XLSX_COLUMNS)[number]

export type SupplierImportRow = {
  rowNumber: number
  values: Record<SupplierXlsxColumn, string>
  normalized: {
    supplier_code: string | null
    name: string | null
    email: string | null
    phone: string | null
    website: string | null
    tax_number: string | null
    eu_tax_number: string | null
    status: 'active' | 'inactive'
    default_payment_terms_days: number | null
    payment_method: string | null
    vat: string | null
    currency: string | null
  }
  errors: string[]
  warnings: string[]
}

export const SUPPLIER_ALLOWED_STATUS = new Set(['active', 'inactive'])
function toCellString(value: unknown): string {
  if (value === null || value === undefined) return ''
  
return String(value).trim()
}

function normalizeNullableText(value: string): string | null {
  const trimmed = value.trim()

  
return trimmed.length > 0 ? trimmed : null
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function normalizeSupplierImportRows(rows: Array<Record<string, unknown>>): SupplierImportRow[] {
  return rows.map((row, idx) => {
    const values = Object.fromEntries(
      SUPPLIER_XLSX_COLUMNS.map((column) => [column, toCellString(row[column])])
    ) as Record<SupplierXlsxColumn, string>

    const normalizedStatusRaw = values.statusz.trim().toLowerCase()

    const normalizedStatus = SUPPLIER_ALLOWED_STATUS.has(normalizedStatusRaw)
      ? (normalizedStatusRaw as 'active' | 'inactive')
      : 'active'

    const paymentTermsRaw = values.fizetesi_hatarido_nap.trim()
    let paymentTerms: number | null = null

    if (paymentTermsRaw.length > 0) {
      const parsed = Number.parseInt(paymentTermsRaw, 10)

      paymentTerms = Number.isFinite(parsed) ? parsed : NaN
    }

    const normalized = {
      supplier_code: normalizeNullableText(values.azonosito),
      name: normalizeNullableText(values.nev),
      email: normalizeNullableText(values.email),
      phone: normalizeNullableText(values.telefon),
      website: normalizeNullableText(values.weboldal),
      tax_number: normalizeNullableText(values.adoszam),
      eu_tax_number: normalizeNullableText(values.kozossegi_adoszam),
      status: normalizedStatus,
      default_payment_terms_days: paymentTerms,
      payment_method: normalizeNullableText(values.fizetesi_mod),
      vat: normalizeNullableText(values.afa),
      currency: normalizeNullableText(values.penznem)
    }

    const errors: string[] = []
    const warnings: string[] = []

    if (!normalized.name) {
      errors.push('A beszállító neve kötelező.')
    }

    if (!normalized.supplier_code) {
      errors.push('A beszállító kód kötelező.')
    }

    if (values.statusz.trim().length > 0 && !SUPPLIER_ALLOWED_STATUS.has(normalizedStatusRaw)) {
      errors.push('Érvénytelen státusz. Csak active vagy inactive lehet.')
    }

    if (paymentTerms !== null) {
      if (!Number.isFinite(paymentTerms)) {
        errors.push('A fizetési határidő csak egész szám lehet.')
      } else if (paymentTerms < 0) {
        errors.push('A fizetési határidő nem lehet negatív.')
      }
    }

    if (normalized.email && !isValidEmail(normalized.email)) {
      errors.push('Érvénytelen e-mail cím az email oszlopban.')
    }

    if (!normalized.tax_number) {
      warnings.push('Nincs adószám megadva. Másodlagos egyeztetésnél ez segít a duplikációk elkerülésében.')
    }

    return {
      rowNumber: idx + 2,
      values,
      normalized: {
        ...normalized,
        default_payment_terms_days: Number.isFinite(normalized.default_payment_terms_days as number)
          ? normalized.default_payment_terms_days
          : null
      },
      errors,
      warnings
    }
  })
}

export function detectDuplicateSupplierRows(rows: SupplierImportRow[]): SupplierImportRow[] {
  const seenByCode = new Map<string, number>()
  const seenByName = new Map<string, number>()

  rows.forEach((row) => {
    if (row.normalized.supplier_code) {
      const key = row.normalized.supplier_code.toLowerCase()

      if (seenByCode.has(key)) {
        const first = seenByCode.get(key)

        row.errors.push(`Duplikált beszállító kód a fájlban (első előfordulás sora: ${first}).`)
      } else {
        seenByCode.set(key, row.rowNumber)
      }
    }

    if (row.normalized.name) {
      const key = row.normalized.name.toLowerCase().replace(/\s+/g, ' ').trim()

      if (seenByName.has(key)) {
        const first = seenByName.get(key)

        row.errors.push(`Duplikált név a fájlban (első előfordulás sora: ${first}).`)
      } else {
        seenByName.set(key, row.rowNumber)
      }
    }
  })

  return rows
}

export function getSupplierTemplateRows(): Array<Record<SupplierXlsxColumn, string>> {
  return [
    {
      azonosito: 'SUP-0001',
      nev: 'Minta Beszállító Kft.',
      email: 'kapcsolat@mintaszallito.hu',
      telefon: '+36 30 123 4567',
      weboldal: 'https://mintaszallito.hu',
      adoszam: '12345678-2-42',
      kozossegi_adoszam: 'HU12345678',
      statusz: 'active',
      fizetesi_hatarido_nap: '30',
      fizetesi_mod: 'Átutalás',
      afa: '27%',
      penznem: 'HUF'
    }
  ]
}
