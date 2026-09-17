import type { SupabaseClient } from '@supabase/supabase-js'

import { grossFromNet } from '@/lib/accessories/parse'
import {
  type GoodsReceiptStatus
} from '@/lib/goods-receipts/parse'
import type { PurchaseOrderStatus } from '@/lib/purchase-orders/parse'

export type GoodsReceiptListItem = {
  id: string
  receipt_number: string
  status: GoodsReceiptStatus
  purchase_order_id: string
  po_number: string
  supplier_name: string
  items_count: number
  received_at: string | null
  updated_at: string
  created_at: string
}

export type GoodsReceiptItemRow = {
  id: string
  purchase_order_item_id: string | null
  accessory_id: string
  name_snapshot: string
  sku_snapshot: string
  unit_shortform: string
  target_quantity: number
  quantity_received: number
  is_extra: boolean
  sort_order: number
  barcode: string | null
  barcode_internal: string | null
  price_gross: number
  on_hand?: number
}

export type GoodsReceiptDetail = {
  id: string
  receipt_number: string
  status: GoodsReceiptStatus
  purchase_order_id: string
  po_number: string
  po_status: PurchaseOrderStatus
  warehouse_id: string
  warehouse_name: string
  supplier_name: string
  note: string | null
  received_at: string | null
  created_at: string
  updated_at: string
  items: GoodsReceiptItemRow[]
}

export type GoodsReceiptListParams = {
  tenantId: string
  q?: string
  status?: GoodsReceiptStatus | 'all'
  page?: number
  limit?: number
}

export type GoodsReceiptListResult = {
  rows: GoodsReceiptListItem[]
  total: number
  page: number
  limit: number
  statusCounts: Record<GoodsReceiptStatus | 'all', number>
}

/** Már bevételezett qty / PO tétel (csak received receipt-ek). */
export async function getReceivedQtyByPoItem(
  supabase: SupabaseClient,
  tenantId: string,
  purchaseOrderId: string
): Promise<Map<string, number>> {
  const { data: receipts, error: receiptsErr } = await supabase
    .from('goods_receipts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('purchase_order_id', purchaseOrderId)
    .eq('status', 'received')
    .is('deleted_at', null)

  if (receiptsErr) {
    console.error('getReceivedQtyByPoItem receipts', receiptsErr.message)
    throw new Error('Nem sikerült betölteni a beérkezett mennyiségeket.')
  }

  const receiptIds = (receipts ?? []).map((r) => r.id)
  const map = new Map<string, number>()
  if (receiptIds.length === 0) return map

  const { data, error } = await supabase
    .from('goods_receipt_items')
    .select('purchase_order_item_id, quantity_received')
    .eq('tenant_id', tenantId)
    .in('goods_receipt_id', receiptIds)
    .is('deleted_at', null)

  if (error) {
    console.error('getReceivedQtyByPoItem items', error.message)
    throw new Error('Nem sikerült betölteni a beérkezett mennyiségeket.')
  }

  for (const row of data ?? []) {
    const key = row.purchase_order_item_id as string | null
    if (!key) continue // PO-n kívüli (is_extra) sorok nem számítanak a PO teljesítésbe
    const prev = map.get(key) ?? 0
    map.set(key, prev + Number(row.quantity_received))
  }
  return map
}

/** Egy PO összes beérkezése (lookup a rendelés detailen). */
export type GoodsReceiptForPoRow = {
  id: string
  receipt_number: string
  status: GoodsReceiptStatus
  items_count: number
  received_at: string | null
  created_at: string
  updated_at: string
}

export async function listGoodsReceiptsForPo(
  supabase: SupabaseClient,
  tenantId: string,
  purchaseOrderId: string
): Promise<GoodsReceiptForPoRow[]> {
  const { data, error } = await supabase
    .from('goods_receipts')
    .select(
      `
      id,
      receipt_number,
      status,
      received_at,
      created_at,
      updated_at,
      goods_receipt_items ( id, deleted_at )
    `
    )
    .eq('tenant_id', tenantId)
    .eq('purchase_order_id', purchaseOrderId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('listGoodsReceiptsForPo', error.message)
    throw new Error('Nem sikerült betölteni a rendelés beérkezéseit.')
  }

  return (data ?? []).map((row) => {
    const items = (
      (row.goods_receipt_items ?? []) as { id: string; deleted_at: string | null }[]
    ).filter((it) => !it.deleted_at)

    return {
      id: row.id,
      receipt_number: row.receipt_number,
      status: row.status as GoodsReceiptStatus,
      items_count: items.length,
      received_at: row.received_at,
      created_at: row.created_at,
      updated_at: row.updated_at
    }
  })
}

export async function listGoodsReceipts(
  supabase: SupabaseClient,
  params: GoodsReceiptListParams
): Promise<GoodsReceiptListResult> {
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.min(50, Math.max(1, params.limit ?? 25))
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabase
    .from('goods_receipts')
    .select(
      `
      id,
      receipt_number,
      status,
      purchase_order_id,
      received_at,
      updated_at,
      created_at,
      purchase_orders (
        po_number,
        suppliers ( name )
      ),
      goods_receipt_items ( id, deleted_at )
    `,
      { count: 'exact' }
    )
    .eq('tenant_id', params.tenantId)
    .is('deleted_at', null)

  if (params.status && params.status !== 'all') {
    query = query.eq('status', params.status)
  }

  const q = params.q?.trim()
  if (q) {
    const safe = q.replace(/[%_,]/g, '')
    if (safe) {
      query = query.or(
        `receipt_number.ilike.%${safe}%`
      )
    }
  }

  const { data, error, count } = await query
    .order('updated_at', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('listGoodsReceipts', error.message)
    throw new Error('Nem sikerült betölteni a beérkezéseket.')
  }

  const rows: GoodsReceiptListItem[] = (data ?? []).map((row) => {
    const pos = row.purchase_orders as
      | {
          po_number: string
          suppliers:
            | { name: string }
            | { name: string }[]
            | null
        }
      | {
          po_number: string
          suppliers:
            | { name: string }
            | { name: string }[]
            | null
        }[]
      | null
    const po = Array.isArray(pos) ? pos[0] : pos
    const suppliers = po?.suppliers
    const supplier = Array.isArray(suppliers) ? suppliers[0] : suppliers
    const items = (
      (row.goods_receipt_items ?? []) as { id: string; deleted_at: string | null }[]
    ).filter((it) => !it.deleted_at)

    return {
      id: row.id,
      receipt_number: row.receipt_number,
      status: row.status as GoodsReceiptStatus,
      purchase_order_id: row.purchase_order_id,
      po_number: po?.po_number ?? '—',
      supplier_name: supplier?.name ?? '—',
      items_count: items.length,
      received_at: row.received_at,
      updated_at: row.updated_at,
      created_at: row.created_at
    }
  })

  const statusCounts = await countReceiptStatuses(supabase, params.tenantId)

  return {
    rows,
    total: count ?? rows.length,
    page,
    limit,
    statusCounts
  }
}

async function countReceiptStatuses(
  supabase: SupabaseClient,
  tenantId: string
): Promise<Record<GoodsReceiptStatus | 'all', number>> {
  const { data, error } = await supabase
    .from('goods_receipts')
    .select('status')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)

  const counts: Record<GoodsReceiptStatus | 'all', number> = {
    all: 0,
    checking: 0,
    received: 0,
    cancelled: 0
  }

  if (error) {
    console.error('countReceiptStatuses', error.message)
    return counts
  }

  for (const row of data ?? []) {
    const s = row.status as GoodsReceiptStatus
    counts.all += 1
    if (s in counts) counts[s] += 1
  }
  return counts
}

export async function getGoodsReceipt(
  supabase: SupabaseClient,
  tenantId: string,
  id: string
): Promise<GoodsReceiptDetail | null> {
  const { data, error } = await supabase
    .from('goods_receipts')
    .select(
      `
      id,
      receipt_number,
      status,
      purchase_order_id,
      warehouse_id,
      note,
      received_at,
      created_at,
      updated_at,
      warehouses ( name ),
      purchase_orders (
        po_number,
        status,
        suppliers ( name )
      ),
      goods_receipt_items (
        id,
        purchase_order_item_id,
        accessory_id,
        name_snapshot,
        sku_snapshot,
        unit_shortform,
        target_quantity,
        quantity_received,
        is_extra,
        sort_order,
        deleted_at,
        accessories (
          barcode,
          barcode_internal,
          price_net,
          tax_rates ( rate_percent )
        )
      )
    `
    )
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    console.error('getGoodsReceipt', error.message)
    throw new Error('Nem sikerült betölteni a beérkezést.')
  }

  if (!data) return null

  const warehouses = data.warehouses as
    | { name: string }
    | { name: string }[]
    | null
  const warehouse = Array.isArray(warehouses) ? warehouses[0] : warehouses

  const pos = data.purchase_orders as
    | {
        po_number: string
        status: string
        suppliers: { name: string } | { name: string }[] | null
      }
    | {
        po_number: string
        status: string
        suppliers: { name: string } | { name: string }[] | null
      }[]
    | null
  const po = Array.isArray(pos) ? pos[0] : pos
  const suppliers = po?.suppliers
  const supplier = Array.isArray(suppliers) ? suppliers[0] : suppliers

  const rawItems = (
    (data.goods_receipt_items ?? []) as {
      id: string
      purchase_order_item_id: string | null
      accessory_id: string
      name_snapshot: string
      sku_snapshot: string
      unit_shortform: string
      target_quantity: number
      quantity_received: number
      is_extra: boolean | null
      sort_order: number
      deleted_at: string | null
      accessories:
        | {
            barcode: string | null
            barcode_internal: string | null
            price_net: number | null
            tax_rates:
              | { rate_percent: number | string }
              | { rate_percent: number | string }[]
              | null
          }
        | {
            barcode: string | null
            barcode_internal: string | null
            price_net: number | null
            tax_rates:
              | { rate_percent: number | string }
              | { rate_percent: number | string }[]
              | null
          }[]
        | null
    }[]
  )
    .filter((it) => !it.deleted_at)
    .sort((a, b) => a.sort_order - b.sort_order)

  const items: GoodsReceiptItemRow[] = rawItems.map((it) => {
    const acc = Array.isArray(it.accessories)
      ? it.accessories[0]
      : it.accessories
    const taxJoin = acc?.tax_rates
    const tax = Array.isArray(taxJoin) ? taxJoin[0] : taxJoin
    const priceNet = Number(acc?.price_net ?? 0)
    const taxPct = Number(tax?.rate_percent ?? 0)
    return {
      id: it.id,
      purchase_order_item_id: it.purchase_order_item_id,
      accessory_id: it.accessory_id,
      name_snapshot: it.name_snapshot,
      sku_snapshot: it.sku_snapshot,
      unit_shortform: it.unit_shortform,
      target_quantity: Number(it.target_quantity),
      quantity_received: Number(it.quantity_received),
      is_extra: Boolean(it.is_extra),
      sort_order: it.sort_order,
      barcode: acc?.barcode ?? null,
      barcode_internal: acc?.barcode_internal ?? null,
      price_gross: grossFromNet(priceNet, taxPct)
    }
  })

  return {
    id: data.id,
    receipt_number: data.receipt_number,
    status: data.status as GoodsReceiptStatus,
    purchase_order_id: data.purchase_order_id,
    po_number: po?.po_number ?? '—',
    po_status: (po?.status as PurchaseOrderStatus) ?? 'ordered',
    warehouse_id: data.warehouse_id,
    warehouse_name: warehouse?.name ?? '—',
    supplier_name: supplier?.name ?? '—',
    note: data.note,
    received_at: data.received_at,
    created_at: data.created_at,
    updated_at: data.updated_at,
    items
  }
}

export async function findCheckingReceiptForPo(
  supabase: SupabaseClient,
  tenantId: string,
  purchaseOrderId: string
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from('goods_receipts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('purchase_order_id', purchaseOrderId)
    .eq('status', 'checking')
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    console.error('findCheckingReceiptForPo', error.message)
    throw new Error('Nem sikerült ellenőrizni a beérkezéseket.')
  }

  return data
}
