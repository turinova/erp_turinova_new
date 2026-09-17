import type { SupabaseClient } from '@supabase/supabase-js'

import { getReceivedQtyByPoItem } from '@/lib/goods-receipts/queries'
import {
  lineAmounts,
  sumOrderAmounts,
  type PurchaseOrderStatus
} from '@/lib/purchase-orders/parse'

export type PurchaseOrderListItem = {
  id: string
  po_number: string
  status: PurchaseOrderStatus
  supplier_id: string
  supplier_name: string
  expected_date: string | null
  items_count: number
  net_total: number
  updated_at: string
  created_at: string
}

export type PurchaseOrderItemRow = {
  id: string
  accessory_id: string
  name_snapshot: string
  sku_snapshot: string
  quantity: number
  quantity_received: number
  net_price: number
  tax_rate_id: string
  tax_rate_percent: number
  unit_id: string
  unit_shortform: string
  sort_order: number
  line_net: number
  line_vat: number
  line_gross: number
}

export type PurchaseOrderReceiveSummary = {
  ordered_qty: number
  received_qty: number
  remaining_qty: number
  percent: number
}

export type PurchaseOrderDetail = {
  id: string
  po_number: string
  status: PurchaseOrderStatus
  supplier_id: string
  supplier_name: string
  warehouse_id: string
  warehouse_name: string
  warehouse_code: string
  expected_date: string | null
  note: string | null
  currency: string
  email_sent: boolean
  email_sent_at: string | null
  ordered_at: string | null
  cancelled_at: string | null
  closed_incomplete_at: string | null
  created_at: string
  updated_at: string
  items: PurchaseOrderItemRow[]
  totals: { net: number; vat: number; gross: number }
  receive_summary: PurchaseOrderReceiveSummary
}

export type PurchaseOrderListParams = {
  tenantId: string
  q?: string
  status?: PurchaseOrderStatus | 'all'
  page?: number
  limit?: number
}

export type PurchaseOrderListResult = {
  rows: PurchaseOrderListItem[]
  total: number
  page: number
  limit: number
  statusCounts: Record<PurchaseOrderStatus | 'all', number>
}

export type PurchaseProductSearchItem = {
  id: string
  name: string
  sku: string
  purchase_price_net: number | null
  price_net: number
  tax_rate_id: string
  tax_rate_percent: number
  unit_id: string
  unit_shortform: string
}

export async function listPurchaseOrders(
  supabase: SupabaseClient,
  params: PurchaseOrderListParams
): Promise<PurchaseOrderListResult> {
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.min(50, Math.max(1, params.limit ?? 25))
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabase
    .from('purchase_orders')
    .select(
      `
      id,
      po_number,
      status,
      supplier_id,
      expected_date,
      updated_at,
      created_at,
      suppliers ( name ),
      purchase_order_items (
        quantity,
        net_price,
        tax_rate_percent,
        deleted_at
      )
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
      const { data: supplierHits } = await supabase
        .from('suppliers')
        .select('id')
        .eq('tenant_id', params.tenantId)
        .is('deleted_at', null)
        .ilike('name', `%${safe}%`)
        .limit(50)
      const supplierIds = (supplierHits ?? []).map((s) => s.id)
      if (supplierIds.length > 0) {
        query = query.or(
          `po_number.ilike.%${safe}%,supplier_id.in.(${supplierIds.join(',')})`
        )
      } else {
        query = query.ilike('po_number', `%${safe}%`)
      }
    }
  }

  const { data, error, count } = await query
    .order('updated_at', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('listPurchaseOrders', error.message)
    throw new Error('Nem sikerült betölteni a beszállítói rendeléseket.')
  }

  const rows: PurchaseOrderListItem[] = (data ?? []).map((row) => {
    const suppliers = row.suppliers as
      | { name: string }
      | { name: string }[]
      | null
    const supplier = Array.isArray(suppliers) ? suppliers[0] : suppliers
    const items = (
      (row.purchase_order_items ?? []) as {
        quantity: number
        net_price: number
        tax_rate_percent: number
        deleted_at: string | null
      }[]
    ).filter((it) => !it.deleted_at)

    const totals = sumOrderAmounts(
      items.map((it) => ({
        quantity: Number(it.quantity),
        netPrice: Number(it.net_price),
        taxRatePercent: Number(it.tax_rate_percent)
      }))
    )

    return {
      id: row.id,
      po_number: row.po_number,
      status: row.status as PurchaseOrderStatus,
      supplier_id: row.supplier_id,
      supplier_name: supplier?.name ?? '—',
      expected_date: row.expected_date,
      items_count: items.length,
      net_total: totals.net,
      updated_at: row.updated_at,
      created_at: row.created_at
    }
  })

  const statusCounts = await countPurchaseOrderStatuses(
    supabase,
    params.tenantId
  )

  return {
    rows,
    total: count ?? rows.length,
    page,
    limit,
    statusCounts
  }
}

async function countPurchaseOrderStatuses(
  supabase: SupabaseClient,
  tenantId: string
): Promise<Record<PurchaseOrderStatus | 'all', number>> {
  const { data, error } = await supabase
    .from('purchase_orders')
    .select('status')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)

  const counts: Record<PurchaseOrderStatus | 'all', number> = {
    all: 0,
    draft: 0,
    ordered: 0,
    partial: 0,
    received: 0,
    cancelled: 0
  }

  if (error) {
    console.error('countPurchaseOrderStatuses', error.message)
    return counts
  }

  for (const row of data ?? []) {
    const s = row.status as PurchaseOrderStatus
    counts.all += 1
    if (s in counts) counts[s] += 1
  }
  return counts
}

export async function getPurchaseOrder(
  supabase: SupabaseClient,
  tenantId: string,
  id: string
): Promise<PurchaseOrderDetail | null> {
  const { data, error } = await supabase
    .from('purchase_orders')
    .select(
      `
      id,
      po_number,
      status,
      supplier_id,
      warehouse_id,
      expected_date,
      note,
      currency,
      email_sent,
      email_sent_at,
      ordered_at,
      cancelled_at,
      closed_incomplete_at,
      created_at,
      updated_at,
      suppliers ( name ),
      warehouses ( name, code ),
      purchase_order_items (
        id,
        accessory_id,
        name_snapshot,
        sku_snapshot,
        quantity,
        net_price,
        tax_rate_id,
        tax_rate_percent,
        unit_id,
        unit_shortform,
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
    console.error('getPurchaseOrder', error.message)
    throw new Error('Nem sikerült betölteni a rendelést.')
  }

  if (!data) return null

  const suppliers = data.suppliers as
    | { name: string }
    | { name: string }[]
    | null
  const supplier = Array.isArray(suppliers) ? suppliers[0] : suppliers

  const warehouses = data.warehouses as
    | { name: string; code: string }
    | { name: string; code: string }[]
    | null
  const warehouse = Array.isArray(warehouses) ? warehouses[0] : warehouses

  const rawItems = (
    (data.purchase_order_items ?? []) as {
      id: string
      accessory_id: string
      name_snapshot: string
      sku_snapshot: string
      quantity: number
      net_price: number
      tax_rate_id: string
      tax_rate_percent: number
      unit_id: string
      unit_shortform: string
      sort_order: number
      deleted_at: string | null
    }[]
  )
    .filter((it) => !it.deleted_at)
    .sort((a, b) => a.sort_order - b.sort_order)

  const receivedMap = await getReceivedQtyByPoItem(supabase, tenantId, id)

  const items: PurchaseOrderItemRow[] = rawItems.map((it) => {
    const qty = Number(it.quantity)
    const netPrice = Number(it.net_price)
    const taxPct = Number(it.tax_rate_percent)
    const line = lineAmounts(qty, netPrice, taxPct)
    return {
      id: it.id,
      accessory_id: it.accessory_id,
      name_snapshot: it.name_snapshot,
      sku_snapshot: it.sku_snapshot,
      quantity: qty,
      quantity_received: receivedMap.get(it.id) ?? 0,
      net_price: netPrice,
      tax_rate_id: it.tax_rate_id,
      tax_rate_percent: taxPct,
      unit_id: it.unit_id,
      unit_shortform: it.unit_shortform,
      sort_order: it.sort_order,
      line_net: line.net,
      line_vat: line.vat,
      line_gross: line.gross
    }
  })

  const totals = sumOrderAmounts(
    items.map((it) => ({
      quantity: it.quantity,
      netPrice: it.net_price,
      taxRatePercent: it.tax_rate_percent
    }))
  )

  const orderedQty = items.reduce((s, it) => s + it.quantity, 0)
  const receivedQty = items.reduce((s, it) => s + it.quantity_received, 0)
  const remainingQty = Math.max(0, orderedQty - receivedQty)
  const percent =
    orderedQty > 0 ? Math.round((receivedQty / orderedQty) * 100) : 0

  return {
    id: data.id,
    po_number: data.po_number,
    status: data.status as PurchaseOrderStatus,
    supplier_id: data.supplier_id,
    supplier_name: supplier?.name ?? '—',
    warehouse_id: data.warehouse_id as string,
    warehouse_name: warehouse?.name ?? '—',
    warehouse_code: warehouse?.code ?? '',
    expected_date: data.expected_date,
    note: data.note,
    currency: data.currency,
    email_sent: Boolean(data.email_sent),
    email_sent_at: data.email_sent_at,
    ordered_at: data.ordered_at,
    cancelled_at: data.cancelled_at,
    closed_incomplete_at: data.closed_incomplete_at ?? null,
    created_at: data.created_at,
    updated_at: data.updated_at,
    items,
    totals,
    receive_summary: {
      ordered_qty: orderedQty,
      received_qty: receivedQty,
      remaining_qty: remainingQty,
      percent
    }
  }
}

/** Aktív termékek keresése PO tételhez. */
export async function searchProductsForPurchaseOrder(
  supabase: SupabaseClient,
  tenantId: string,
  q: string,
  limit = 15
): Promise<PurchaseProductSearchItem[]> {
  const safe = q.trim().replace(/[%_,]/g, '')
  if (!safe) return []

  const { data, error } = await supabase
    .from('accessories')
    .select(
      `
      id,
      name,
      sku,
      price_net,
      purchase_price_net,
      tax_rate_id,
      unit_id,
      tax_rates ( rate_percent ),
      units ( shortform )
    `
    )
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .is('deleted_at', null)
    .or(
      `name.ilike.%${safe}%,sku.ilike.%${safe}%,barcode.ilike.%${safe}%,barcode_internal.ilike.%${safe}%`
    )
    .order('name', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('searchProductsForPurchaseOrder', error.message)
    throw new Error('Nem sikerült keresni a termékek között.')
  }

  return (data ?? []).map((row) => {
    const taxRates = row.tax_rates as
      | { rate_percent: number | string }
      | { rate_percent: number | string }[]
      | null
    const tax = Array.isArray(taxRates) ? taxRates[0] : taxRates
    const units = row.units as
      | { shortform: string }
      | { shortform: string }[]
      | null
    const unit = Array.isArray(units) ? units[0] : units

    return {
      id: row.id,
      name: row.name,
      sku: row.sku,
      purchase_price_net:
        row.purchase_price_net == null
          ? null
          : Number(row.purchase_price_net),
      price_net: Number(row.price_net) || 0,
      tax_rate_id: row.tax_rate_id,
      tax_rate_percent: Number(tax?.rate_percent ?? 0),
      unit_id: row.unit_id,
      unit_shortform: unit?.shortform ?? 'db'
    }
  })
}
