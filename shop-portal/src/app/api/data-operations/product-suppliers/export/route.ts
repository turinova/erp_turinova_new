import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

import { getTenantSupabase } from '@/lib/tenant-supabase'
import { PRODUCT_SUPPLIER_XLSX_COLUMNS } from '@/lib/data-operations/product-suppliers-xlsx'

type ExportPayload = {
  connection_id?: string
  status?: 'all' | 'active' | 'inactive'
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = (await request.json().catch(() => ({}))) as ExportPayload
    const connectionId = body.connection_id?.trim()
    const status = body.status || 'all'
    if (!connectionId) {
      return NextResponse.json({ error: 'A webshop kapcsolat kiválasztása kötelező.' }, { status: 400 })
    }

    let relationQuery = supabase
      .from('product_suppliers')
      .select(`
        id,
        product_id,
        supplier_id,
        supplier_sku,
        supplier_barcode,
        default_cost,
        min_order_quantity,
        lead_time_days,
        is_preferred,
        is_active,
        products:shoprenter_products!inner(id, sku, model_number, connection_id, deleted_at)
      `)
      .is('deleted_at', null)
      .eq('products.connection_id', connectionId)
      .is('products.deleted_at', null)

    if (status === 'active') relationQuery = relationQuery.eq('is_active', true)
    if (status === 'inactive') relationQuery = relationQuery.eq('is_active', false)

    const { data: relations, error: relationsError } = await relationQuery
    if (relationsError) {
      return NextResponse.json({ error: relationsError.message || 'Kapcsolatok lekérdezése sikertelen' }, { status: 500 })
    }
    if (!relations || relations.length === 0) {
      return NextResponse.json({ error: 'Nincs exportálható termék-beszállító kapcsolat.' }, { status: 404 })
    }

    const supplierIds = [...new Set(relations.map((r: any) => r.supplier_id).filter(Boolean))]
    const { data: suppliers } = await supabase
      .from('suppliers')
      .select('id, short_name')
      .in('id', supplierIds)
      .is('deleted_at', null)

    const supplierMap = new Map((suppliers || []).map((s: any) => [s.id, s.short_name || '']))

    const exportRows = relations.map((row: any) => ({
      termek_azonosito: row.products?.sku || '',
      gyartoi_cikkszam: row.products?.model_number || '',
      beszallito_azonosito: supplierMap.get(row.supplier_id) || '',
      beszallito_termekkod: row.supplier_sku || '',
      beszallito_vonalkod: row.supplier_barcode || '',
      alap_beszerzesi_ar: row.default_cost ?? '',
      min_rendelesi_mennyiseg: row.min_order_quantity ?? 1,
      szallitasi_ido_nap: row.lead_time_days ?? '',
      preferalt: row.is_preferred ? 'igen' : 'nem',
      aktiv: row.is_active ? 'active' : 'inactive'
    }))

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(exportRows, { header: [...PRODUCT_SUPPLIER_XLSX_COLUMNS] })
    XLSX.utils.book_append_sheet(wb, ws, 'TermekBeszallitok')

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const timestamp = new Date().toISOString().split('T')[0]
    return new NextResponse(buffer as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="termek_beszallitok_export_${timestamp}.xlsx"`
      }
    })
  } catch (error: any) {
    console.error('Product supplier export error:', error)
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}
