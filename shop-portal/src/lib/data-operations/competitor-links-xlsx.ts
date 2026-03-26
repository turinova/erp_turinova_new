export const COMPETITOR_LINK_XLSX_COLUMNS = [
  'termek_azonosito',
  'gyartoi_cikkszam',
  'versenytars',
  'versenytars_url',
  'versenytars_termekkod',
  'versenytars_termek_nev',
  'aktiv'
] as const

export type CompetitorLinkXlsxColumn = (typeof COMPETITOR_LINK_XLSX_COLUMNS)[number]

export type CompetitorLinkImportRow = {
  rowNumber: number
  values: Record<CompetitorLinkXlsxColumn, string>
  normalized: {
    product_sku: string | null
    model_number: string | null
    competitor_name: string | null
    competitor_url: string | null
    competitor_sku: string | null
    competitor_product_name: string | null
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

function parseNullableBoolean(value: string): boolean | null {
  const raw = value.trim().toLowerCase()
  if (!raw) return null
  if (['1', 'true', 'yes', 'igen', 'active', 'aktiv'].includes(raw)) return true
  if (['0', 'false', 'no', 'nem', 'inactive', 'inaktiv'].includes(raw)) return false
  return null
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function normalizeCompetitorLinkImportRows(rows: Array<Record<string, unknown>>): CompetitorLinkImportRow[] {
  return rows.map((row, idx) => {
    const values = Object.fromEntries(
      COMPETITOR_LINK_XLSX_COLUMNS.map((column) => [column, toCellString(row[column])])
    ) as Record<CompetitorLinkXlsxColumn, string>

    const active = parseNullableBoolean(values.aktiv)
    const normalized = {
      product_sku: normalizeNullableText(values.termek_azonosito),
      model_number: normalizeNullableText(values.gyartoi_cikkszam),
      competitor_name: normalizeNullableText(values.versenytars),
      competitor_url: normalizeNullableText(values.versenytars_url),
      competitor_sku: normalizeNullableText(values.versenytars_termekkod),
      competitor_product_name: normalizeNullableText(values.versenytars_termek_nev),
      is_active: active
    }

    const errors: string[] = []
    const warnings: string[] = []
    if (!normalized.product_sku) errors.push('A termek_azonosito (SKU) kötelező.')
    if (!normalized.competitor_name) errors.push('A versenytars kötelező.')
    if (!normalized.competitor_url) errors.push('A versenytars_url kötelező.')
    if (normalized.competitor_url && !isValidHttpUrl(normalized.competitor_url)) {
      errors.push('A versenytars_url csak teljes http/https URL lehet.')
    }
    if (values.aktiv.trim().length > 0 && active === null) {
      errors.push('Az aktiv mező csak igen/nem, active/inactive vagy 1/0 lehet.')
    }
    if (!normalized.competitor_sku && !normalized.competitor_product_name) {
      warnings.push('A versenytars_termekkod és versenytars_termek_nev is üres.')
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

export function detectDuplicateCompetitorLinkRows(rows: CompetitorLinkImportRow[]): CompetitorLinkImportRow[] {
  const seen = new Map<string, number>()
  rows.forEach((row) => {
    if (!row.normalized.product_sku || !row.normalized.competitor_name) return
    const key = `${row.normalized.product_sku.toLowerCase()}__${row.normalized.competitor_name.toLowerCase()}`
    if (seen.has(key)) {
      row.errors.push(`Duplikált SKU+versenytárs kulcs a fájlban (első előfordulás sora: ${seen.get(key)}).`)
      return
    }
    seen.set(key, row.rowNumber)
  })
  return rows
}

export function getCompetitorLinkTemplateRows(): Array<Record<CompetitorLinkXlsxColumn, string>> {
  return [
    {
      termek_azonosito: 'SKU-0001',
      gyartoi_cikkszam: 'MP-001',
      versenytars: 'VasalatWebshop',
      versenytars_url: 'https://www.example.com/termek/sku-0001',
      versenytars_termekkod: 'VW-SKU-0001',
      versenytars_termek_nev: 'Minta versenytárs termék',
      aktiv: 'active'
    }
  ]
}
