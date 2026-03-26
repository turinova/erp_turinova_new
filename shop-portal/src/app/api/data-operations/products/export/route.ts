import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

import { getTenantSupabase } from '@/lib/tenant-supabase'
import { PRODUCT_EXPORT_INFO_COLUMNS, PRODUCT_XLSX_COLUMNS, calculateNetGross } from '@/lib/data-operations/products-xlsx'

type ExportPayload = {
  connection_id?: string
  status?: 'all' | 'active' | 'inactive'
  includeCalculated?: boolean
}

function formatVat(vatName: string | null, vatRate: number | null | undefined): string {
  if (vatName && vatName.trim().length > 0) return vatName
  if (vatRate === null || vatRate === undefined || Number.isNaN(vatRate)) return ''
  return `${Number(vatRate)}%`
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Fetch all rows for a connection (Supabase default limit is 1000 per request).
 */
async function fetchAllProductsForExport(
  supabase: Awaited<ReturnType<typeof getTenantSupabase>>,
  connectionId: string,
  status: ExportPayload['status']
): Promise<any[]> {
  const pageSize = 1000
  let page = 0
  let all: any[] = []
  let hasMore = true

  while (hasMore) {
    const from = page * pageSize
    const to = from + pageSize - 1

    let query = supabase
      .from('shoprenter_products')
      .select(
        'id, sku, name, erp_manufacturer_id, gtin, internal_barcode, model_number, unit_id, length, width, height, weight, erp_weight_unit_id, cost, multiplier, vat_id, status, price, gross_price'
      )
      .eq('connection_id', connectionId)
      .is('deleted_at', null)
      .order('sku', { ascending: true })
      .range(from, to)

    if (status === 'active') query = query.eq('status', 1)
    if (status === 'inactive') query = query.eq('status', 0)

    const { data: batch, error } = await query
    if (error) throw new Error(error.message || 'Hiba export közben')

    if (batch && batch.length > 0) {
      all = all.concat(batch)
      hasMore = batch.length === pageSize
      page++
    } else {
      hasMore = false
    }
  }

  return all
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = (await request.json().catch(() => ({}))) as ExportPayload
    const connectionId = body.connection_id?.trim()
    if (!connectionId) {
      return NextResponse.json({ error: 'A webshop kapcsolat kiválasztása kötelező.' }, { status: 400 })
    }

    const products = await fetchAllProductsForExport(supabase, connectionId, body.status)

    if (products.length === 0) {
      return NextResponse.json({ error: 'Nincs exportálható termék.' }, { status: 404 })
    }

    const manufacturerIds = [...new Set(products.map((p: any) => p.erp_manufacturer_id).filter(Boolean))]
    const unitIds = [...new Set(products.map((p: any) => p.unit_id).filter(Boolean))]
    const weightUnitIds = [...new Set(products.map((p: any) => p.erp_weight_unit_id).filter(Boolean))]
    const vatIds = [...new Set(products.map((p: any) => p.vat_id).filter(Boolean))]

    const [manufacturersResp, unitsResp, weightUnitsResp, vatResp] = await Promise.all([
      manufacturerIds.length ? supabase.from('manufacturers').select('id, name').in('id', manufacturerIds) : Promise.resolve({ data: [] as any[] }),
      unitIds.length ? supabase.from('units').select('id, shortform').in('id', unitIds) : Promise.resolve({ data: [] as any[] }),
      weightUnitIds.length ? supabase.from('weight_units').select('id, shortform').in('id', weightUnitIds) : Promise.resolve({ data: [] as any[] }),
      vatIds.length ? supabase.from('vat').select('id, name, kulcs').in('id', vatIds) : Promise.resolve({ data: [] as any[] })
    ])

    const manufacturerMap = new Map<string, string>((manufacturersResp.data || []).map((m: any) => [m.id, m.name || '']))
    const unitMap = new Map<string, string>((unitsResp.data || []).map((u: any) => [u.id, u.shortform || '']))
    const weightUnitMap = new Map<string, string>((weightUnitsResp.data || []).map((u: any) => [u.id, u.shortform || '']))
    const vatMap = new Map<string, { name: string; rate: number }>(
      (vatResp.data || []).map((v: any) => [v.id, { name: v.name || '', rate: Number(v.kulcs || 0) }])
    )

    const includeCalculated = body.includeCalculated === true

    const exportRows = products.map((row: any) => {
      const cost = toNum(row.cost)
      const multiplier = toNum(row.multiplier)
      const price = toNum(row.price)
      const grossStored = toNum(row.gross_price)
      const vat = vatMap.get(row.vat_id)
      const vatRate = vat?.rate ?? null

      const hasPurchaseCost = cost !== null && cost > 0
      const hasMultiplier = multiplier !== null && multiplier > 0

      let netCalc: number | null = null
      let grossCalc: number | null = null

      if (hasPurchaseCost && hasMultiplier && vatRate !== null) {
        const calc = calculateNetGross(cost!, multiplier!, vatRate)
        netCalc = calc.net
        grossCalc = calc.gross
      } else if (price !== null && price > 0 && vatRate !== null) {
        netCalc = Math.round(price * 100) / 100
        grossCalc =
          grossStored !== null && grossStored > 0
            ? Math.round(grossStored * 100) / 100
            : Math.round(price * (1 + vatRate / 100) * 100) / 100
      } else if (price !== null && price > 0) {
        netCalc = Math.round(price * 100) / 100
        grossCalc = grossStored !== null && grossStored > 0 ? Math.round(grossStored * 100) / 100 : null
      }

      const beszerzesiExport = hasPurchaseCost ? cost! : ''
      const szorzoExport =
        hasPurchaseCost && hasMultiplier
          ? multiplier!
          : hasPurchaseCost && price !== null && price > 0 && cost! > 0
            ? Math.round((price / cost!) * 1000) / 1000
            : hasMultiplier && multiplier !== null
              ? multiplier
              : ''

      const base: Record<string, string | number> = {
        azonosito: row.sku || '',
        termek_neve: row.name || '',
        gyarto: manufacturerMap.get(row.erp_manufacturer_id) || '',
        vonalkod: row.gtin || '',
        belso_vonalkod: row.internal_barcode || '',
        gyartoi_cikkszam: row.model_number || '',
        mertekegyseg: unitMap.get(row.unit_id) || '',
        hosszusag: row.length ?? '',
        szelesseg: row.width ?? '',
        magassag: row.height ?? '',
        suly: row.weight ?? '',
        sulymertekegyseg: weightUnitMap.get(row.erp_weight_unit_id) || '',
        beszerzesi_ar: beszerzesiExport,
        arazasi_szorzo: szorzoExport,
        afa: formatVat(vat?.name || null, vatRate),
        statusz: Number(row.status) === 1 ? 'active' : 'inactive'
      }

      if (includeCalculated) {
        base.netto_ar_szamolt = netCalc !== null ? netCalc : ''
        base.brutto_ar_szamolt = grossCalc !== null ? grossCalc : ''
      }

      return base
    })

    const headers = includeCalculated ? [...PRODUCT_XLSX_COLUMNS, ...PRODUCT_EXPORT_INFO_COLUMNS] : [...PRODUCT_XLSX_COLUMNS]
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(exportRows, { header: headers })
    XLSX.utils.book_append_sheet(wb, ws, 'Termekek')

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const timestamp = new Date().toISOString().split('T')[0]

    return new NextResponse(buffer as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="termekek_export_${timestamp}.xlsx"`
      }
    })
  } catch (error: any) {
    console.error('Product export error:', error)
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}
