import type { SupabaseClient } from '@supabase/supabase-js'

import type { StockMovementSource, StockMovementType } from '@/lib/supabase/database.types'

export type StockMovementListItem = {
  id: string
  created_at: string
  stock_movement_number: string
  movement_type: StockMovementType
  quantity: number
  source_type: StockMovementSource
  warehouse_id: string
  warehouse_name: string
  accessory_id: string
  accessory_name: string
  accessory_sku: string
  unit_shortform: string
  source_id: string | null
  source_label: string | null
  source_href: string | null
}

export type StockMovementListParams = {
  tenantId: string
  q?: string
  warehouseId?: string | 'all'
  movementType?: StockMovementType | 'all'
  sourceType?: StockMovementSource | 'all'
  page?: number
  limit?: number
}

export type StockMovementListResult = {
  rows: StockMovementListItem[]
  total: number
  page: number
  limit: number
}

export async function listStockMovements(
  supabase: SupabaseClient,
  params: StockMovementListParams
): Promise<StockMovementListResult> {
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.min(100, Math.max(1, params.limit ?? 25))
  const from = (page - 1) * limit
  const to = from + limit - 1
  const q = params.q?.trim() ?? ''

  let query = supabase
    .from('stock_movements')
    .select(
      `
      id,
      created_at,
      stock_movement_number,
      movement_type,
      quantity,
      source_type,
      source_id,
      warehouse_id,
      accessory_id,
      warehouses ( name ),
      accessories ( name, sku, units ( shortform ) )
    `,
      { count: 'exact' }
    )
    .eq('tenant_id', params.tenantId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (params.warehouseId && params.warehouseId !== 'all') {
    query = query.eq('warehouse_id', params.warehouseId)
  }
  if (params.movementType && params.movementType !== 'all') {
    query = query.eq('movement_type', params.movementType)
  }
  if (params.sourceType && params.sourceType !== 'all') {
    query = query.eq('source_type', params.sourceType)
  }
  if (q) {
    query = query.or(
      `stock_movement_number.ilike.%${q}%,note.ilike.%${q}%`
    )
  }

  const { data, error, count } = await query

  if (error) {
    console.error('listStockMovements', error.message)
    throw new Error('Nem sikerült betölteni a készletmozgásokat.')
  }

  const rowsRaw = data ?? []
  const receiptIds = [
    ...new Set(
      rowsRaw
        .filter((r) => r.source_type === 'purchase_receipt' && r.source_id)
        .map((r) => r.source_id as string)
    )
  ]
  const transferIds = [
    ...new Set(
      rowsRaw
        .filter((r) => r.source_type === 'transfer' && r.source_id)
        .map((r) => r.source_id as string)
    )
  ]
  const saleIds = [
    ...new Set(
      rowsRaw
        .filter((r) => r.source_type === 'sale' && r.source_id)
        .map((r) => r.source_id as string)
    )
  ]
  const returnIds = [
    ...new Set(
      rowsRaw
        .filter((r) => r.source_type === 'sale_return' && r.source_id)
        .map((r) => r.source_id as string)
    )
  ]

  const receiptMeta = new Map<string, string>()
  const transferMeta = new Map<string, string>()
  const saleMeta = new Map<string, string>()
  const returnMeta = new Map<string, { number: string; saleId: string }>()

  if (receiptIds.length > 0) {
    const { data: receipts } = await supabase
      .from('goods_receipts')
      .select('id, receipt_number')
      .eq('tenant_id', params.tenantId)
      .in('id', receiptIds)
    for (const r of receipts ?? []) {
      receiptMeta.set(r.id, r.receipt_number)
    }
  }

  if (transferIds.length > 0) {
    const { data: transfers } = await supabase
      .from('stock_transfers')
      .select('id, transfer_number')
      .eq('tenant_id', params.tenantId)
      .in('id', transferIds)
    for (const t of transfers ?? []) {
      transferMeta.set(t.id, t.transfer_number)
    }
  }

  if (saleIds.length > 0) {
    const { data: sales } = await supabase
      .from('sales_orders')
      .select('id, sale_number')
      .eq('tenant_id', params.tenantId)
      .in('id', saleIds)
    for (const s of sales ?? []) {
      saleMeta.set(s.id, s.sale_number)
    }
  }

  if (returnIds.length > 0) {
    const { data: returns } = await supabase
      .from('sales_returns')
      .select('id, return_number, sales_order_id')
      .eq('tenant_id', params.tenantId)
      .in('id', returnIds)
    for (const r of returns ?? []) {
      returnMeta.set(r.id, {
        number: r.return_number,
        saleId: r.sales_order_id
      })
    }
  }

  const rows: StockMovementListItem[] = rowsRaw.map((row) => {
    const whJoin = row.warehouses as
      | { name: string }
      | { name: string }[]
      | null
    const wh = Array.isArray(whJoin) ? whJoin[0] : whJoin
    const accJoin = row.accessories as
      | {
          name: string
          sku: string
          units: { shortform: string } | { shortform: string }[] | null
        }
      | {
          name: string
          sku: string
          units: { shortform: string } | { shortform: string }[] | null
        }[]
      | null
    const acc = Array.isArray(accJoin) ? accJoin[0] : accJoin
    const unitJoin = acc?.units
    const unit = Array.isArray(unitJoin) ? unitJoin[0] : unitJoin

    let source_label: string | null = null
    let source_href: string | null = null
    if (row.source_type === 'purchase_receipt' && row.source_id) {
      const num = receiptMeta.get(row.source_id)
      source_label = num ? `Beérkezés ${num}` : 'Beérkezés'
      source_href = `/beerkezesek/${row.source_id}`
    } else if (row.source_type === 'transfer' && row.source_id) {
      const num = transferMeta.get(row.source_id)
      source_label = num ? `Áttárolás ${num}` : 'Áttárolás'
      source_href = `/keszlet/atadasok/${row.source_id}`
    } else if (row.source_type === 'sale' && row.source_id) {
      const num = saleMeta.get(row.source_id)
      source_label = num ? `Értékesítés ${num}` : 'Eladás'
      source_href = `/ertekesitesek/${row.source_id}`
    } else if (row.source_type === 'sale_return' && row.source_id) {
      const meta = returnMeta.get(row.source_id)
      source_label = meta ? `Visszáru ${meta.number}` : 'Visszáru'
      source_href = meta?.saleId
        ? `/ertekesitesek/${meta.saleId}`
        : null
    } else if (row.source_type === 'adjustment') {
      source_label = 'Korrekció'
    }

    return {
      id: row.id,
      created_at: row.created_at,
      stock_movement_number: row.stock_movement_number,
      movement_type: row.movement_type as StockMovementType,
      quantity: Number(row.quantity),
      source_type: row.source_type as StockMovementSource,
      warehouse_id: row.warehouse_id,
      warehouse_name: wh?.name ?? '—',
      accessory_id: row.accessory_id,
      accessory_name: acc?.name ?? '—',
      accessory_sku: acc?.sku ?? '',
      unit_shortform: unit?.shortform ?? 'db',
      source_id: row.source_id,
      source_label,
      source_href
    }
  })

  return {
    rows,
    total: count ?? rows.length,
    page,
    limit
  }
}
