import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'

import * as XLSX from 'xlsx'

import { getTenantSupabase } from '@/lib/tenant-supabase'
import { SUPPLIER_XLSX_COLUMNS } from '@/lib/data-operations/suppliers-xlsx'

type ExportFilters = {
  status?: 'all' | 'active' | 'inactive'
  hasEmail?: 'all' | 'yes' | 'no'
  hasTaxNumber?: 'all' | 'yes' | 'no'
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))

    const filters: ExportFilters = {
      status: body?.status || 'all',
      hasEmail: body?.hasEmail || 'all',
      hasTaxNumber: body?.hasTaxNumber || 'all'
    }

    let query = supabase
      .from('suppliers')
      .select('id, name, short_name, email, phone, website, tax_number, eu_tax_number, status, default_payment_terms_days, default_payment_method_id, default_vat_id, default_currency_id, updated_at')
      .is('deleted_at', null)
      .order('name', { ascending: true })

    if (filters.status === 'active' || filters.status === 'inactive') {
      query = query.eq('status', filters.status)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message || 'Hiba export közben' }, { status: 500 })
    }

    const paymentMethodIds = [...new Set((data || []).map((row: any) => row.default_payment_method_id).filter(Boolean))]
    const vatIds = [...new Set((data || []).map((row: any) => row.default_vat_id).filter(Boolean))]
    const currencyIds = [...new Set((data || []).map((row: any) => row.default_currency_id).filter(Boolean))]

    const paymentMethodMap = new Map<string, string>()
    const vatMap = new Map<string, string>()
    const currencyMap = new Map<string, string>()

    if (paymentMethodIds.length > 0) {
      const { data: methods } = await supabase
        .from('payment_methods')
        .select('id, name, code')
        .in('id', paymentMethodIds)
      ;(methods || []).forEach((m: any) => paymentMethodMap.set(m.id, m.name || m.code || ''))
    }

    if (vatIds.length > 0) {
      const { data: vatRates } = await supabase
        .from('vat')
        .select('id, name, kulcs')
        .in('id', vatIds)
      ;(vatRates || []).forEach((v: any) => vatMap.set(v.id, v.name || v.kulcs || ''))
    }

    if (currencyIds.length > 0) {
      const { data: currencies } = await supabase
        .from('currencies')
        .select('id, code, name')
        .in('id', currencyIds)
      ;(currencies || []).forEach((c: any) => currencyMap.set(c.id, c.code || c.name || ''))
    }

    const filtered = (data || []).filter((row: any) => {
      if (filters.hasEmail === 'yes' && !row.email) return false
      if (filters.hasEmail === 'no' && row.email) return false
      if (filters.hasTaxNumber === 'yes' && !row.tax_number) return false
      if (filters.hasTaxNumber === 'no' && row.tax_number) return false
      
return true
    })

    const exportRows = filtered.map((row: any) => ({
      azonosito: row.short_name || '',
      nev: row.name || '',
      email: row.email || '',
      telefon: row.phone || '',
      weboldal: row.website || '',
      adoszam: row.tax_number || '',
      kozossegi_adoszam: row.eu_tax_number || '',
      statusz: row.status || 'active',
      fizetesi_hatarido_nap: row.default_payment_terms_days ?? '',
      fizetesi_mod: paymentMethodMap.get(row.default_payment_method_id) || '',
      afa: vatMap.get(row.default_vat_id) || '',
      penznem: currencyMap.get(row.default_currency_id) || ''
    }))

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(exportRows, { header: [...SUPPLIER_XLSX_COLUMNS] })

    XLSX.utils.book_append_sheet(wb, ws, 'Beszallitok')
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const timestamp = new Date().toISOString().split('T')[0]

    return new NextResponse(buffer as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="beszallitok_export_${timestamp}.xlsx"`
      }
    })
  } catch (error: any) {
    console.error('Supplier export error:', error)
    
return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}
