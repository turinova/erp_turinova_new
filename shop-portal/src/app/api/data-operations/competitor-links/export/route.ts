import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

import { getTenantSupabase } from '@/lib/tenant-supabase'
import { COMPETITOR_LINK_XLSX_COLUMNS } from '@/lib/data-operations/competitor-links-xlsx'

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

    let query = supabase
      .from('competitor_product_links')
      .select(`
        id,
        competitor_id,
        competitor_url,
        competitor_sku,
        competitor_product_name,
        is_active,
        competitor:competitors!inner(name),
        product:shoprenter_products!inner(sku, model_number, connection_id, deleted_at)
      `)
      .eq('product.connection_id', connectionId)
      .is('product.deleted_at', null)

    if (status === 'active') query = query.eq('is_active', true)
    if (status === 'inactive') query = query.eq('is_active', false)

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message || 'Versenytárs linkek lekérdezése sikertelen' }, { status: 500 })
    }
    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Nincs exportálható versenytárs link.' }, { status: 404 })
    }

    const exportRows = (data || []).map((row: any) => ({
      termek_azonosito: row.product?.sku || '',
      gyartoi_cikkszam: row.product?.model_number || '',
      versenytars: row.competitor?.name || '',
      versenytars_url: row.competitor_url || '',
      versenytars_termekkod: row.competitor_sku || '',
      versenytars_termek_nev: row.competitor_product_name || '',
      aktiv: row.is_active ? 'active' : 'inactive'
    }))

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(exportRows, { header: [...COMPETITOR_LINK_XLSX_COLUMNS] })
    XLSX.utils.book_append_sheet(wb, ws, 'VersenytarsLinkek')

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const timestamp = new Date().toISOString().split('T')[0]
    return new NextResponse(buffer as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="versenytars_linkek_export_${timestamp}.xlsx"`
      }
    })
  } catch (error: any) {
    console.error('Competitor link export error:', error)
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}
