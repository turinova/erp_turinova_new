import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { getTenantSupabase } from '@/lib/tenant-supabase'
import type { ProductSupplierImportRow } from '@/lib/data-operations/product-suppliers-xlsx'

type ExecutePayload = {
  connection_id?: string
  rows: ProductSupplierImportRow[]
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

    if (!connectionId) {
      return NextResponse.json({ error: 'A webshop kapcsolat kiválasztása kötelező.' }, { status: 400 })
    }
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Nincs feldolgozható sor.' }, { status: 400 })
    }

    const [products, { data: suppliers }] = await Promise.all([
      fetchAllProductsForConnection(supabase, connectionId),
      supabase.from('suppliers').select('id, short_name').is('deleted_at', null)
    ])

    const productBySku = new Map<string, { id: string; sku: string; model_number: string | null }>(
      (products || []).map((p: any) => [normalizeLookupKey(p.sku), { id: p.id, sku: p.sku, model_number: p.model_number || null }])
    )
    const supplierByCode = new Map<string, { id: string; short_name: string }>(
      (suppliers || []).map((s: any) => [normalizeLookupKey(s.short_name), { id: s.id, short_name: s.short_name }])
    )

    let created = 0
    let updated = 0
    let skipped = 0
    const failed: FailedRow[] = []

    for (const row of rows) {
      if (row.errors?.length > 0) {
        skipped += 1
        failed.push({
          rowNumber: row.rowNumber,
          sku: row.normalized?.product_sku || null,
          reason: `Validációs hiba: ${row.errors.join('; ')}`
        })
        continue
      }

      const n = row.normalized
      if (!n?.product_sku || !n?.supplier_code) {
        skipped += 1
        failed.push({
          rowNumber: row.rowNumber,
          sku: n?.product_sku || null,
          reason: 'Hiányzó kötelező mező: termek_azonosito vagy beszallito_azonosito'
        })
        continue
      }

      const product = productBySku.get(normalizeLookupKey(n.product_sku))
      if (!product) {
        skipped += 1
        failed.push({ rowNumber: row.rowNumber, sku: n.product_sku, reason: `Nem található termék ezzel az SKU-val ebben a kapcsolatban: ${n.product_sku}` })
        continue
      }

      if (n.model_number) {
        const currentModel = normalizeLookupKey(product.model_number)
        const incomingModel = normalizeLookupKey(n.model_number)
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

      const supplier = supplierByCode.get(normalizeLookupKey(n.supplier_code))
      if (!supplier) {
        skipped += 1
        failed.push({ rowNumber: row.rowNumber, sku: n.product_sku, reason: `Nem található beszállító ezzel a kóddal: ${n.supplier_code}` })
        continue
      }

      try {
        const { data: existing } = await supabase
          .from('product_suppliers')
          .select('id, product_id')
          .eq('product_id', product.id)
          .eq('supplier_id', supplier.id)
          .is('deleted_at', null)
          .maybeSingle()

        const payload: Record<string, any> = {
          supplier_sku: n.supplier_sku || null,
          supplier_barcode: n.supplier_barcode || null,
          default_cost: n.default_cost ?? null,
          min_order_quantity: n.min_order_quantity || 1,
          lead_time_days: n.lead_time_days ?? null,
          is_active: n.is_active === null ? true : n.is_active,
          updated_at: new Date().toISOString(),
          deleted_at: null
        }

        if (n.is_preferred !== null) {
          payload.is_preferred = n.is_preferred
        }

        if (existing?.id) {
          const { error: updateError } = await supabase
            .from('product_suppliers')
            .update(payload)
            .eq('id', existing.id)

          if (updateError) {
            skipped += 1
            failed.push({ rowNumber: row.rowNumber, sku: n.product_sku, reason: updateError.message || 'Frissítési hiba' })
            continue
          }

          if (n.is_preferred === true) {
            await supabase
              .from('product_suppliers')
              .update({ is_preferred: false })
              .eq('product_id', product.id)
              .neq('id', existing.id)
              .is('deleted_at', null)
          }

          updated += 1
        } else {
          const insertPayload = {
            product_id: product.id,
            supplier_id: supplier.id,
            is_preferred: n.is_preferred === null ? false : n.is_preferred,
            ...payload,
            created_at: new Date().toISOString()
          }
          const { data: inserted, error: insertError } = await supabase
            .from('product_suppliers')
            .insert(insertPayload)
            .select('id')
            .single()

          if (insertError || !inserted) {
            skipped += 1
            failed.push({ rowNumber: row.rowNumber, sku: n.product_sku, reason: insertError?.message || 'Létrehozási hiba' })
            continue
          }

          if (n.is_preferred === true) {
            await supabase
              .from('product_suppliers')
              .update({ is_preferred: false })
              .eq('product_id', product.id)
              .neq('id', inserted.id)
              .is('deleted_at', null)
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
      summary: {
        total: rows.length,
        created,
        updated,
        skipped,
        failed: failed.length
      },
      failedRows: failed
    })
  } catch (error: any) {
    console.error('Product supplier import execute error:', error)
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}
