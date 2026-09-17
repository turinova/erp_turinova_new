import type { SupabaseClient } from '@supabase/supabase-js'

import type { StockTransferStatus } from '@/lib/stock-transfers/parse'

export type StockTransferListItem = {
  id: string
  transfer_number: string
  status: StockTransferStatus
  from_warehouse_name: string
  to_warehouse_name: string
  items_count: number
  completed_at: string | null
  created_at: string
}

export type StockTransferItemRow = {
  id: string
  accessory_id: string
  name_snapshot: string
  sku_snapshot: string
  unit_shortform: string
  quantity: number
  sort_order: number
}

export type StockTransferDetail = {
  id: string
  transfer_number: string
  status: StockTransferStatus
  from_warehouse_id: string
  from_warehouse_name: string
  to_warehouse_id: string
  to_warehouse_name: string
  note: string | null
  completed_at: string | null
  created_at: string
  items: StockTransferItemRow[]
}

export type StockTransferListParams = {
  tenantId: string
  q?: string
  page?: number
  limit?: number
}

export type StockTransferListResult = {
  rows: StockTransferListItem[]
  total: number
  page: number
  limit: number
}

export async function listStockTransfers(
  supabase: SupabaseClient,
  params: StockTransferListParams
): Promise<StockTransferListResult> {
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.min(100, Math.max(1, params.limit ?? 25))
  const from = (page - 1) * limit
  const to = from + limit - 1
  const q = params.q?.trim() ?? ''

  let query = supabase
    .from('stock_transfers')
    .select(
      `
      id,
      transfer_number,
      status,
      completed_at,
      created_at,
      from_warehouse:warehouses!from_warehouse_id ( name ),
      to_warehouse:warehouses!to_warehouse_id ( name ),
      stock_transfer_items ( id, deleted_at )
    `,
      { count: 'exact' }
    )
    .eq('tenant_id', params.tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (q) {
    query = query.ilike('transfer_number', `%${q}%`)
  }

  const { data, error, count } = await query

  if (error) {
    console.error('listStockTransfers', error.message)
    throw new Error('Nem sikerült betölteni az áttárolásokat.')
  }

  const rows: StockTransferListItem[] = (data ?? []).map((row) => {
    const fromWh = row.from_warehouse as
      | { name: string }
      | { name: string }[]
      | null
    const toWh = row.to_warehouse as
      | { name: string }
      | { name: string }[]
      | null
    const fromOne = Array.isArray(fromWh) ? fromWh[0] : fromWh
    const toOne = Array.isArray(toWh) ? toWh[0] : toWh
    const items = (row.stock_transfer_items ?? []) as {
      id: string
      deleted_at: string | null
    }[]

    return {
      id: row.id,
      transfer_number: row.transfer_number,
      status: row.status as StockTransferStatus,
      from_warehouse_name: fromOne?.name ?? '—',
      to_warehouse_name: toOne?.name ?? '—',
      items_count: items.filter((it) => !it.deleted_at).length,
      completed_at: row.completed_at,
      created_at: row.created_at
    }
  })

  return {
    rows,
    total: count ?? rows.length,
    page,
    limit
  }
}

export async function getStockTransfer(
  supabase: SupabaseClient,
  tenantId: string,
  id: string
): Promise<StockTransferDetail | null> {
  const { data, error } = await supabase
    .from('stock_transfers')
    .select(
      `
      id,
      transfer_number,
      status,
      from_warehouse_id,
      to_warehouse_id,
      note,
      completed_at,
      created_at,
      from_warehouse:warehouses!from_warehouse_id ( name ),
      to_warehouse:warehouses!to_warehouse_id ( name ),
      stock_transfer_items (
        id,
        accessory_id,
        name_snapshot,
        sku_snapshot,
        unit_shortform,
        quantity,
        sort_order,
        deleted_at
      )
    `
    )
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    console.error('getStockTransfer', error.message)
    throw new Error('Nem sikerült betölteni az áttárolást.')
  }

  if (!data) return null

  const fromWh = data.from_warehouse as
    | { name: string }
    | { name: string }[]
    | null
  const toWh = data.to_warehouse as
    | { name: string }
    | { name: string }[]
    | null
  const fromOne = Array.isArray(fromWh) ? fromWh[0] : fromWh
  const toOne = Array.isArray(toWh) ? toWh[0] : toWh

  const items = (
    (data.stock_transfer_items ?? []) as {
      id: string
      accessory_id: string
      name_snapshot: string
      sku_snapshot: string
      unit_shortform: string
      quantity: number
      sort_order: number
      deleted_at: string | null
    }[]
  )
    .filter((it) => !it.deleted_at)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((it) => ({
      id: it.id,
      accessory_id: it.accessory_id,
      name_snapshot: it.name_snapshot,
      sku_snapshot: it.sku_snapshot,
      unit_shortform: it.unit_shortform,
      quantity: Number(it.quantity),
      sort_order: it.sort_order
    }))

  return {
    id: data.id,
    transfer_number: data.transfer_number,
    status: data.status as StockTransferStatus,
    from_warehouse_id: data.from_warehouse_id,
    from_warehouse_name: fromOne?.name ?? '—',
    to_warehouse_id: data.to_warehouse_id,
    to_warehouse_name: toOne?.name ?? '—',
    note: data.note,
    completed_at: data.completed_at,
    created_at: data.created_at,
    items
  }
}
