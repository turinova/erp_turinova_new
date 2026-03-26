import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { getTenantSupabase } from '@/lib/tenant-supabase'
import type { CompetitorLinkImportRow } from '@/lib/data-operations/competitor-links-xlsx'

type ExecutePayload = {
  connection_id?: string
  rows: CompetitorLinkImportRow[]
}

type FailedRow = {
  rowNumber: number
  sku: string | null
  reason: string
}

function normalizeLookupKey(value: string | null | undefined): string {
  if (!value) return ''
  return value.toString().trim().toLowerCase().replace(/\s+/g, ' ')
}

const PRODUCT_SELECT_FIELDS = 'id, sku, model_number'

async function fetchAllProductsForConnection(
  supabase: Awaited<ReturnType<typeof getTenantSupabase>>,
  connectionId: string
): Promise<any[]> {
  const pageSize = 1000
  let page = 0
  let all: any[] = []
  let hasMore = true

  while (hasMore) {
    const from = page * pageSize
    const to = from + pageSize - 1
    const { data: batch, error } = await supabase
      .from('shoprenter_products')
      .select(PRODUCT_SELECT_FIELDS)
      .eq('connection_id', connectionId)
      .is('deleted_at', null)
      .order('sku', { ascending: true })
      .range(from, to)

    if (error) throw new Error(error.message || 'Termékek betöltése sikertelen')
    if (batch && batch.length > 0) {
      all = all.concat(batch)
      hasMore = batch.length === pageSize
      page += 1
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

    const body = (await request.json()) as ExecutePayload
    const rows = Array.isArray(body?.rows) ? body.rows : []
    const connectionId = body?.connection_id?.trim()

    if (!connectionId) return NextResponse.json({ error: 'A webshop kapcsolat kiválasztása kötelező.' }, { status: 400 })
    if (rows.length === 0) return NextResponse.json({ error: 'Nincs feldolgozható sor.' }, { status: 400 })

    const [products, { data: competitors }] = await Promise.all([
      fetchAllProductsForConnection(supabase, connectionId),
      supabase.from('competitors').select('id, name').order('name', { ascending: true })
    ])

    const productBySku = new Map<string, { id: string; sku: string; model_number: string | null }>(
      (products || []).map((p: any) => [normalizeLookupKey(p.sku), { id: p.id, sku: p.sku, model_number: p.model_number || null }])
    )
    const competitorByName = new Map<string, { id: string; name: string }>(
      (competitors || []).map((c: any) => [normalizeLookupKey(c.name), { id: c.id, name: c.name }])
    )

    let created = 0
    let updated = 0
    let skipped = 0
    const failed: FailedRow[] = []

    for (const row of rows) {
      if (row.errors?.length > 0) {
        skipped += 1
        failed.push({ rowNumber: row.rowNumber, sku: row.normalized?.product_sku || null, reason: `Validációs hiba: ${row.errors.join('; ')}` })
        continue
      }

      const n = row.normalized
      if (!n?.product_sku || !n?.competitor_name || !n?.competitor_url) {
        skipped += 1
        failed.push({ rowNumber: row.rowNumber, sku: n?.product_sku || null, reason: 'Hiányzó kötelező mező: termek_azonosito, versenytars vagy versenytars_url' })
        continue
      }

      const product = productBySku.get(normalizeLookupKey(n.product_sku))
      if (!product) {
        skipped += 1
        failed.push({ rowNumber: row.rowNumber, sku: n.product_sku, reason: `Nem található termék ezzel az SKU-val ebben a kapcsolatban: ${n.product_sku}` })
        continue
      }

      if (n.model_number) {
        const incomingModel = normalizeLookupKey(n.model_number)
        const currentModel = normalizeLookupKey(product.model_number)
        if (currentModel && currentModel !== incomingModel) {
          skipped += 1
          failed.push({
            rowNumber: row.rowNumber,
            sku: n.product_sku,
            reason: `A gyartoi_cikkszam nem egyezik a termékhez tartozó értékkel (várt: ${product.model_number}, kapott: ${n.model_number}).`
          })
          continue
        }
      }

      const competitor = competitorByName.get(normalizeLookupKey(n.competitor_name))
      if (!competitor) {
        skipped += 1
        failed.push({ rowNumber: row.rowNumber, sku: n.product_sku, reason: `Nem található versenytárs ezzel a névvel: ${n.competitor_name}` })
        continue
      }

      try {
        const { data: existing } = await supabase
          .from('competitor_product_links')
          .select('id')
          .eq('product_id', product.id)
          .eq('competitor_id', competitor.id)
          .maybeSingle()

        const payload: Record<string, any> = {
          competitor_url: n.competitor_url,
          competitor_sku: n.competitor_sku || null,
          competitor_product_name: n.competitor_product_name || null,
          is_active: n.is_active === null ? true : n.is_active,
          updated_at: new Date().toISOString()
        }

        if (existing?.id) {
          const { error: updateError } = await supabase
            .from('competitor_product_links')
            .update(payload)
            .eq('id', existing.id)

          if (updateError) {
            skipped += 1
            failed.push({ rowNumber: row.rowNumber, sku: n.product_sku, reason: updateError.message || 'Frissítési hiba' })
            continue
          }
          updated += 1
        } else {
          const { error: insertError } = await supabase
            .from('competitor_product_links')
            .insert({
              product_id: product.id,
              competitor_id: competitor.id,
              matching_method: 'manual',
              ...payload
            })

          if (insertError) {
            skipped += 1
            failed.push({ rowNumber: row.rowNumber, sku: n.product_sku, reason: insertError.message || 'Létrehozási hiba' })
            continue
          }
          created += 1
        }
      } catch (error: any) {
        skipped += 1
        failed.push({ rowNumber: row.rowNumber, sku: n.product_sku, reason: error?.message || 'Ismeretlen feldolgozási hiba' })
      }
    }

    return NextResponse.json({
      success: true,
      summary: { total: rows.length, created, updated, skipped, failed: failed.length },
      failedRows: failed
    })
  } catch (error: any) {
    console.error('Competitor link import execute error:', error)
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}
