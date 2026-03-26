import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { calculateNetGross, type ProductImportRow } from '@/lib/data-operations/products-xlsx'
import { getTenantSupabase } from '@/lib/tenant-supabase'

type ExecutePayload = {
  connection_id?: string
  rows: ProductImportRow[]
}

type FailedRow = {
  rowNumber: number
  sku: string | null
  reason: string
}

type SyncCandidate = {
  productId: string
  sku: string
  isNew: boolean
  changedFields: string[]
  previousGrossPrice: number | null
  nextGrossPrice: number | null
}

function normalizeLookupKey(value: string | null | undefined): string {
  if (!value) return ''
  return value.toString().trim().toLowerCase().replace(/\s+/g, ' ')
}

function extractVatRateCandidates(value: string | null | undefined): string[] {
  const source = normalizeLookupKey(value)
  if (!source) return []
  const set = new Set<string>([source])
  const numberMatch = source.match(/(\d+(?:[.,]\d+)?)/)
  if (numberMatch) {
    const raw = numberMatch[1].replace(',', '.')
    const parsed = Number(raw)
    if (!Number.isNaN(parsed)) {
      const numeric = String(parsed)
      set.add(numeric)
      set.add(`${numeric}%`)
    }
  }
  return [...set]
}

const PRODUCT_SELECT_FIELDS =
  'id, sku, name, erp_manufacturer_id, gtin, internal_barcode, model_number, unit_id, length, width, height, weight, erp_weight_unit_id, cost, multiplier, vat_id, status, price, gross_price'

/**
 * Supabase returns max 1000 rows per request — must page or SKU map misses products and import tries duplicate INSERT.
 */
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

    const body = (await request.json()) as ExecutePayload
    const rows = Array.isArray(body?.rows) ? body.rows : []
    const connectionId = body?.connection_id?.trim()

    if (!connectionId) {
      return NextResponse.json({ error: 'A webshop kapcsolat kiválasztása kötelező.' }, { status: 400 })
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Nincs feldolgozható sor.' }, { status: 400 })
    }

    const [products, manufacturersResp, unitsResp, weightUnitsResp, vatRatesResp] = await Promise.all([
      fetchAllProductsForConnection(supabase, connectionId),
      supabase.from('manufacturers').select('id, name').is('deleted_at', null),
      supabase.from('units').select('id, shortform').is('deleted_at', null),
      supabase.from('weight_units').select('id, shortform').is('deleted_at', null),
      supabase.from('vat').select('id, name, kulcs').is('deleted_at', null)
    ])

    const { data: manufacturers } = manufacturersResp
    const { data: units } = unitsResp
    const { data: weightUnits } = weightUnitsResp
    const { data: vatRates } = vatRatesResp

    const bySku = new Map<string, any>((products || []).map((p: any) => [normalizeLookupKey(p.sku), p]))
    const manufacturerLookup = new Map<string, string>()
    ;(manufacturers || []).forEach((m: any) => manufacturerLookup.set(normalizeLookupKey(m.name), m.id))
    const unitLookup = new Map<string, string>()
    ;(units || []).forEach((u: any) => unitLookup.set(normalizeLookupKey(u.shortform), u.id))
    const weightUnitLookup = new Map<string, string>()
    ;(weightUnits || []).forEach((u: any) => weightUnitLookup.set(normalizeLookupKey(u.shortform), u.id))
    const vatLookup = new Map<string, { id: string; rate: number }>()
    ;(vatRates || []).forEach((v: any) => {
      const rate = Number(v.kulcs || 0)
      const keys = [normalizeLookupKey(v.name), normalizeLookupKey(String(rate)), normalizeLookupKey(`${rate}%`)]
      keys.filter(Boolean).forEach((k) => vatLookup.set(k, { id: v.id, rate }))
    })

    let created = 0
    let updated = 0
    let skipped = 0
    const failed: FailedRow[] = []
    const syncCandidates: SyncCandidate[] = []

    for (const row of rows) {
      if (row.errors?.length > 0) {
        skipped += 1
        failed.push({
          rowNumber: row.rowNumber,
          sku: row.normalized?.sku || null,
          reason: `Validációs hiba: ${row.errors.join('; ')}`
        })
        continue
      }

      const n = row.normalized
      if (!n?.sku) {
        skipped += 1
        failed.push({ rowNumber: row.rowNumber, sku: null, reason: 'Hiányzó kötelező mező: azonosito (SKU).' })
        continue
      }

      let target = bySku.get(normalizeLookupKey(n.sku))

      if (!target && n.sku?.trim()) {
        const { data: found } = await supabase
          .from('shoprenter_products')
          .select(PRODUCT_SELECT_FIELDS)
          .eq('connection_id', connectionId)
          .eq('sku', n.sku.trim())
          .is('deleted_at', null)
          .maybeSingle()

        if (found) {
          target = found
          bySku.set(normalizeLookupKey(found.sku), found)
        }
      }

      const isNew = !target
      const changedFields: string[] = []
      const hasValue = (column: string) => String(row.values?.[column as keyof typeof row.values] || '').trim().length > 0

      const manufacturerId = n.manufacturer ? manufacturerLookup.get(normalizeLookupKey(n.manufacturer)) : undefined
      if (n.manufacturer && !manufacturerId) {
        skipped += 1
        failed.push({ rowNumber: row.rowNumber, sku: n.sku, reason: `Ismeretlen gyártó: ${n.manufacturer}` })
        continue
      }

      const unitId = n.unit ? unitLookup.get(normalizeLookupKey(n.unit)) : undefined
      if (n.unit && !unitId) {
        skipped += 1
        failed.push({ rowNumber: row.rowNumber, sku: n.sku, reason: `Ismeretlen mértékegység: ${n.unit}` })
        continue
      }

      const weightUnitId = n.weight_unit ? weightUnitLookup.get(normalizeLookupKey(n.weight_unit)) : undefined
      if (n.weight_unit && !weightUnitId) {
        skipped += 1
        failed.push({ rowNumber: row.rowNumber, sku: n.sku, reason: `Ismeretlen súlymértékegység: ${n.weight_unit}` })
        continue
      }

      let vat: { id: string; rate: number } | undefined
      if (n.vat) {
        const vatCandidates = extractVatRateCandidates(n.vat)
        vat = vatCandidates.map((candidate) => vatLookup.get(candidate)).find(Boolean)
        if (!vat) {
          skipped += 1
          failed.push({ rowNumber: row.rowNumber, sku: n.sku, reason: `Ismeretlen ÁFA: ${n.vat}` })
          continue
        }
      }

      const hasPricingInput = n.cost !== null || n.multiplier !== null || !!n.vat
      if (hasPricingInput) {
        if (n.cost === null || n.multiplier === null || !vat) {
          skipped += 1
          failed.push({
            rowNumber: row.rowNumber,
            sku: n.sku,
            reason: 'Ár importhoz kötelező mindhárom mező: beszerzesi_ar, arazasi_szorzo, afa.'
          })
          continue
        }
      }

      const payload: Record<string, any> = {
        updated_at: new Date().toISOString(),
        deleted_at: null
      }

      const setIfChanged = (field: string, value: any, currentValue: any) => {
        if (value === undefined) return
        if (isNew || value !== currentValue) {
          payload[field] = value
          changedFields.push(field)
        }
      }

      setIfChanged('name', hasValue('termek_neve') ? n.name : undefined, target?.name ?? null)
      setIfChanged('erp_manufacturer_id', hasValue('gyarto') ? manufacturerId : undefined, target?.erp_manufacturer_id ?? null)
      setIfChanged('gtin', hasValue('vonalkod') ? n.gtin : undefined, target?.gtin ?? null)
      setIfChanged('internal_barcode', hasValue('belso_vonalkod') ? n.internal_barcode : undefined, target?.internal_barcode ?? null)
      setIfChanged('model_number', hasValue('gyartoi_cikkszam') ? n.model_number : undefined, target?.model_number ?? null)
      setIfChanged('unit_id', hasValue('mertekegyseg') ? unitId : undefined, target?.unit_id ?? null)
      setIfChanged('length', hasValue('hosszusag') ? n.length : undefined, target?.length ?? null)
      setIfChanged('width', hasValue('szelesseg') ? n.width : undefined, target?.width ?? null)
      setIfChanged('height', hasValue('magassag') ? n.height : undefined, target?.height ?? null)
      setIfChanged('weight', hasValue('suly') ? n.weight : undefined, target?.weight ?? null)
      setIfChanged('erp_weight_unit_id', hasValue('sulymertekegyseg') ? weightUnitId : undefined, target?.erp_weight_unit_id ?? null)
      setIfChanged('status', hasValue('statusz') ? n.status : undefined, target?.status ?? null)

      if (hasPricingInput && n.cost !== null && n.multiplier !== null && vat) {
        const calc = calculateNetGross(n.cost, n.multiplier, vat.rate)
        setIfChanged('cost', n.cost, target?.cost ?? null)
        setIfChanged('multiplier', n.multiplier, target?.multiplier ?? null)
        setIfChanged('vat_id', vat.id, target?.vat_id ?? null)
        setIfChanged('price', calc.net, target?.price ?? null)
        setIfChanged('gross_price', calc.gross, target?.gross_price ?? null)
      }

      if (!isNew && changedFields.length === 0) {
        skipped += 1
        continue
      }

      try {
        if (isNew) {
          if (!n.name) {
            skipped += 1
            failed.push({
              rowNumber: row.rowNumber,
              sku: n.sku,
              reason: 'Új termék létrehozásához a termek_neve kötelező.'
            })
            continue
          }

          const placeholderShopRenterId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
          const insertPayload = {
            connection_id: connectionId,
            shoprenter_id: placeholderShopRenterId,
            sku: n.sku.trim(),
            status: payload.status ?? 1,
            sync_status: 'pending',
            ...payload,
            created_at: new Date().toISOString()
          }

          const { data: inserted, error: insertError } = await supabase
            .from('shoprenter_products')
            .insert(insertPayload)
            .select('id, sku')
            .single()

          if (insertError || !inserted) {
            skipped += 1
            failed.push({ rowNumber: row.rowNumber, sku: n.sku, reason: insertError?.message || 'Létrehozási hiba' })
            continue
          }

          created += 1
          syncCandidates.push({
            productId: inserted.id,
            sku: inserted.sku,
            isNew: true,
            changedFields,
            previousGrossPrice: null,
            nextGrossPrice: payload.gross_price ?? null
          })
          bySku.set(normalizeLookupKey(n.sku), { ...inserted, ...insertPayload })
        } else {
          const previousGrossPrice = target?.gross_price !== null && target?.gross_price !== undefined
            ? Number(target.gross_price)
            : null
          const nextGrossPrice = payload.gross_price !== undefined
            ? Number(payload.gross_price)
            : previousGrossPrice

          const { error: updateError } = await supabase
            .from('shoprenter_products')
            .update(payload)
            .eq('id', target.id)

          if (updateError) {
            skipped += 1
            failed.push({ rowNumber: row.rowNumber, sku: n.sku, reason: updateError.message || 'Frissítési hiba' })
            continue
          }

          updated += 1
          syncCandidates.push({
            productId: target.id,
            sku: target.sku,
            isNew: false,
            changedFields,
            previousGrossPrice,
            nextGrossPrice
          })
        }
      } catch (error: any) {
        skipped += 1
        failed.push({ rowNumber: row.rowNumber, sku: n.sku, reason: error?.message || 'Ismeretlen feldolgozási hiba' })
      }
    }

    const newCount = syncCandidates.filter((item) => item.isNew).length
    const updateCount = syncCandidates.length - newCount

    return NextResponse.json({
      success: true,
      summary: {
        total: rows.length,
        created,
        updated,
        skipped,
        failed: failed.length
      },
      syncSummary: {
        syncableCount: syncCandidates.length,
        newCount,
        updateCount
      },
      syncCandidates,
      failedRows: failed
    })
  } catch (error: any) {
    console.error('Product import execute error:', error)
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}
