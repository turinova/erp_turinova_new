import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

import { getTenantSupabase } from '@/lib/tenant-supabase'
import {
  COMPETITOR_LINK_XLSX_COLUMNS,
  detectDuplicateCompetitorLinkRows,
  normalizeCompetitorLinkImportRows
} from '@/lib/data-operations/competitor-links-xlsx'

function validateHeaderColumns(columns: string[]): string[] {
  const missing = COMPETITOR_LINK_XLSX_COLUMNS.filter((col) => !columns.includes(col))
  return missing.map((col) => `Hiányzó oszlop: ${col}`)
}

export async function POST(request: Request) {
  try {
    const supabase = await getTenantSupabase()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) return NextResponse.json({ error: 'Fájl feltöltése kötelező.' }, { status: 400 })
    if (!file.name.toLowerCase().endsWith('.xlsx')) return NextResponse.json({ error: 'Csak .xlsx fájl tölthető fel.' }, { status: 400 })

    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const firstSheetName = workbook.SheetNames[0]
    if (!firstSheetName) return NextResponse.json({ error: 'A fájl nem tartalmaz munkalapot.' }, { status: 400 })

    const worksheet = workbook.Sheets[firstSheetName]
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' })
    if (rawRows.length === 0) return NextResponse.json({ error: 'A fájl üres, nincs importálható sor.' }, { status: 400 })

    const headers = Object.keys(rawRows[0] || {})
    const headerErrors = validateHeaderColumns(headers)
    if (headerErrors.length > 0) return NextResponse.json({ error: headerErrors.join(' | ') }, { status: 400 })

    const normalized = detectDuplicateCompetitorLinkRows(normalizeCompetitorLinkImportRows(rawRows))
    const errorCount = normalized.reduce((sum, row) => sum + row.errors.length, 0)
    const warningCount = normalized.reduce((sum, row) => sum + row.warnings.length, 0)

    return NextResponse.json({
      filename: file.name,
      row_count: normalized.length,
      error_count: errorCount,
      warning_count: warningCount,
      rows: normalized
    })
  } catch (error: any) {
    console.error('Competitor link import preview error:', error)
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}
