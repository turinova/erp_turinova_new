import type { SupabaseClient } from '@supabase/supabase-js'

import { getReceivedQtyForPoItemIds } from '@/lib/goods-receipts/queries'
import type {
  CsoItemStatus,
  CsoPoStatus,
  CsoWaitingCounts,
  CsoWaitingListItem,
  CsoWaitingView,
  CustomerSpecialOrderDetail,
  CustomerSpecialOrderItemRow,
  CustomerSpecialOrderListItem
} from '@/lib/customer-orders/types'
import {
  csoItemLeadBlockers,
  waitingViewToStatus
} from '@/lib/customer-orders/types'

const LIST_LIMIT = 25

type PoJoin = { po_number: string; status: string }
type PoItemJoin = {
  purchase_order_id: string
  quantity?: number | null
  purchase_orders: PoJoin | PoJoin[] | null
}

function asStatus(raw: unknown): CsoItemStatus {
  const s = String(raw ?? '')
  if (
    s === 'felveve' ||
    s === 'rendelve' ||
    s === 'itt_van' ||
    s === 'atadva' ||
    s === 'torolve'
  ) {
    return s
  }
  return 'felveve'
}

export async function listCustomerSpecialOrders(
  supabase: SupabaseClient,
  input: {
    tenantId: string
    q?: string
    /** active = felveve|rendelve|itt_van (alap); all = minden nem rejtett; vagy egy státusz */
    status?: CsoItemStatus | 'all' | 'active'
    /** sent = sms_sent_at not null; pending = null; all = nincs szűrés */
    sms?: 'all' | 'sent' | 'pending'
    page?: number
    limit?: number
  }
): Promise<{
  rows: CustomerSpecialOrderListItem[]
  total: number
  page: number
  limit: number
}> {
  const limit = Math.min(50, Math.max(1, input.limit ?? LIST_LIMIT))
  const page = Math.max(1, input.page ?? 1)
  const from = (page - 1) * limit
  const to = from + limit - 1
  const q = input.q?.trim() ?? ''
  const statusFilter = input.status ?? 'active'
  const smsFilter = input.sms ?? 'all'

  let query = supabase
    .from('customer_special_orders')
    .select(
      `
      id, order_number, customer_name, customer_mobile, status,
      created_at, promised_date, deposit_amount, sms_sent_at,
      customer_special_order_items (
        id, name, qty, unit_shortform, status,
        purchase_order_items (
          purchase_orders ( po_number, status )
        )
      )
    `,
      { count: 'exact' }
    )
    .eq('tenant_id', input.tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (statusFilter === 'active') {
    query = query.in('status', ['felveve', 'rendelve', 'itt_van'])
  } else if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  }
  if (smsFilter === 'sent') {
    query = query.not('sms_sent_at', 'is', null)
  } else if (smsFilter === 'pending') {
    query = query.is('sms_sent_at', null)
  }
  if (q) {
    query = query.or(
      `order_number.ilike.%${q}%,customer_name.ilike.%${q}%,customer_mobile.ilike.%${q}%`
    )
  }

  const { data, error, count } = await query
  if (error) {
    console.error('listCustomerSpecialOrders', error.message)
    throw new Error('Nem sikerült betölteni az ügyfélrendeléseket.')
  }

  const rows: CustomerSpecialOrderListItem[] = (data ?? []).map((r) => {
    const rawItems = (r.customer_special_order_items ?? []) as Array<
      Record<string, unknown>
    >
    const live = rawItems.filter((i) => i.status !== 'torolve')
    const cancelLines = live.map((i) => {
      const poiRaw = i.purchase_order_items as
        | { purchase_orders: PoJoin | PoJoin[] | null }
        | { purchase_orders: PoJoin | PoJoin[] | null }[]
        | null
      const poi = Array.isArray(poiRaw) ? (poiRaw[0] ?? null) : poiRaw
      const poRaw = poi?.purchase_orders ?? null
      const po = Array.isArray(poRaw) ? (poRaw[0] ?? null) : poRaw
      return {
        id: String(i.id),
        name: String(i.name),
        qty: Number(i.qty),
        unitShortform: String(i.unit_shortform ?? 'db'),
        status: asStatus(i.status),
        poNumber: po?.po_number ?? null,
        poStatus: (po?.status as CsoPoStatus | undefined) ?? null
      }
    })
    return {
      id: r.id as string,
      orderNumber: r.order_number as string,
      customerName: r.customer_name as string,
      customerMobile: r.customer_mobile as string,
      status: asStatus(r.status),
      itemCount: live.length,
      createdAt: r.created_at as string,
      promisedDate: (r.promised_date as string | null) ?? null,
      depositAmount:
        r.deposit_amount != null ? Number(r.deposit_amount) : null,
      smsSentAt: (r.sms_sent_at as string | null) ?? null,
      cancelLines
    }
  })

  return { rows, total: count ?? 0, page, limit }
}

export async function getCustomerSpecialOrder(
  supabase: SupabaseClient,
  tenantId: string,
  id: string
): Promise<CustomerSpecialOrderDetail | null> {
  const { data, error } = await supabase
    .from('customer_special_orders')
    .select(
      `
      id, order_number, customer_id, customer_name, customer_mobile,
      status, deposit_amount, promised_date, sms_sent_at, note, created_at,
      customer_special_order_items (
        id, name, qty, unit_shortform, unit_price_gross, sku_snapshot,
        accessory_id, supplier_id, status,
        purchase_order_item_id, reserved_qty, reserved_at, note, sort_order,
        deleted_at,
        suppliers ( name ),
        accessories ( sku ),
        purchase_order_items (
          purchase_order_id,
          quantity,
          purchase_orders ( po_number, status )
        )
      )
    `
    )
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    console.error('getCustomerSpecialOrder', error.message)
    throw new Error('Nem sikerült betölteni a rendelést.')
  }
  if (!data) return null

  const rawItems = (data.customer_special_order_items ?? []) as Array<
    Record<string, unknown>
  >
  const mapped = rawItems
    .filter((i) => !i.deleted_at)
    .sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
    .map((i) => {
      const suppliers = i.suppliers as
        | { name?: string }
        | { name?: string }[]
        | null
      const supplierName = Array.isArray(suppliers)
        ? (suppliers[0]?.name ?? null)
        : (suppliers?.name ?? null)
      const accessories = i.accessories as
        | { sku?: string }
        | { sku?: string }[]
        | null
      const catalogSku = Array.isArray(accessories)
        ? (accessories[0]?.sku ?? null)
        : (accessories?.sku ?? null)
      const sku = (i.sku_snapshot as string | null) || catalogSku
      const poiRaw = i.purchase_order_items as
        | PoItemJoin
        | PoItemJoin[]
        | null
      const poi = Array.isArray(poiRaw) ? (poiRaw[0] ?? null) : poiRaw
      const poRaw = poi?.purchase_orders ?? null
      const po = Array.isArray(poRaw) ? (poRaw[0] ?? null) : poRaw
      const poiId = (i.purchase_order_item_id as string | null) ?? null
      return {
        id: String(i.id),
        name: String(i.name),
        qty: Number(i.qty),
        unitShortform: String(i.unit_shortform ?? 'db'),
        unitPriceGross:
          i.unit_price_gross != null ? Number(i.unit_price_gross) : null,
        accessoryId: (i.accessory_id as string | null) ?? null,
        sku,
        supplierId: (i.supplier_id as string | null) ?? null,
        supplierName,
        status: asStatus(i.status),
        purchaseOrderItemId: poiId,
        poId: poi?.purchase_order_id ?? null,
        poNumber: po?.po_number ?? null,
        poStatus: (po?.status as CsoPoStatus | undefined) ?? null,
        poQtyOrdered:
          poi?.quantity != null ? Number(poi.quantity) : null,
        poQtyReceived: null as number | null,
        reservedQty:
          i.reserved_qty != null ? Number(i.reserved_qty) : null,
        reservedAt: (i.reserved_at as string | null) ?? null,
        note: (i.note as string | null) ?? null,
        sortOrder: Number(i.sort_order ?? 0)
      }
    })

  const receivedMap = await getReceivedQtyForPoItemIds(
    supabase,
    tenantId,
    mapped
      .map((i) => i.purchaseOrderItemId)
      .filter((id): id is string => Boolean(id))
  )
  const items: CustomerSpecialOrderItemRow[] = mapped.map((i) => ({
    ...i,
    poQtyReceived: i.purchaseOrderItemId
      ? (receivedMap.get(i.purchaseOrderItemId) ?? 0)
      : null
  }))

  return {
    id: data.id as string,
    orderNumber: data.order_number as string,
    customerId: (data.customer_id as string | null) ?? null,
    customerName: data.customer_name as string,
    customerMobile: data.customer_mobile as string,
    status: asStatus(data.status),
    depositAmount:
      data.deposit_amount != null ? Number(data.deposit_amount) : null,
    promisedDate: (data.promised_date as string | null) ?? null,
    smsSentAt: (data.sms_sent_at as string | null) ?? null,
    note: (data.note as string | null) ?? null,
    createdAt: data.created_at as string,
    items
  }
}

function mapWaitingRow(r: Record<string, unknown>): CsoWaitingListItem {
  const orderRaw = r.customer_special_orders as
    | Record<string, unknown>
    | Record<string, unknown>[]
    | null
  const order = Array.isArray(orderRaw) ? (orderRaw[0] ?? null) : orderRaw
  const suppliers = r.suppliers as
    | { name?: string }
    | { name?: string }[]
    | null
  const supplierName = Array.isArray(suppliers)
    ? (suppliers[0]?.name ?? null)
    : (suppliers?.name ?? null)
  const accessories = r.accessories as
    | { sku?: string }
    | { sku?: string }[]
    | null
  const catalogSku = Array.isArray(accessories)
    ? (accessories[0]?.sku ?? null)
    : (accessories?.sku ?? null)
  const sku = (r.sku_snapshot as string | null) || catalogSku
  const poiRaw = r.purchase_order_items as PoItemJoin | PoItemJoin[] | null
  const poi = Array.isArray(poiRaw) ? (poiRaw[0] ?? null) : poiRaw
  const poRaw = poi?.purchase_orders ?? null
  const po = Array.isArray(poRaw) ? (poRaw[0] ?? null) : poRaw
  const accessoryId = (r.accessory_id as string | null) ?? null
  const supplierId = (r.supplier_id as string | null) ?? null
  const status = asStatus(r.status)

  return {
    id: String(r.id),
    orderId: String(r.order_id),
    orderNumber: String(order?.order_number ?? ''),
    customerName: String(order?.customer_name ?? ''),
    customerMobile: String(order?.customer_mobile ?? ''),
    depositAmount:
      order?.deposit_amount != null ? Number(order.deposit_amount) : null,
    smsSentAt: (order?.sms_sent_at as string | null) ?? null,
    name: String(r.name),
    qty: Number(r.qty),
    unitShortform: String(r.unit_shortform ?? 'db'),
    unitPriceGross:
      r.unit_price_gross != null ? Number(r.unit_price_gross) : null,
    accessoryId,
    sku,
    supplierId,
    supplierName,
    status,
    purchaseOrderItemId: (r.purchase_order_item_id as string | null) ?? null,
    poId: poi?.purchase_order_id ?? null,
    poNumber: po?.po_number ?? null,
    poStatus: (po?.status as CsoPoStatus | undefined) ?? null,
    poQtyOrdered: poi?.quantity != null ? Number(poi.quantity) : null,
    poQtyReceived: null,
    note: (r.note as string | null) ?? null,
    createdAt: String(r.created_at ?? ''),
    leadBlockers:
      status === 'felveve' ? csoItemLeadBlockers({ accessoryId, supplierId }) : []
  }
}

const WAITING_ITEM_SELECT = `
  id, order_id, name, qty, unit_shortform, unit_price_gross, sku_snapshot,
  accessory_id, supplier_id, status, purchase_order_item_id, note, created_at,
  customer_special_orders!inner (
    id, order_number, customer_name, customer_mobile,
    deposit_amount, sms_sent_at, deleted_at
  ),
  suppliers ( name ),
  accessories ( sku ),
  purchase_order_items (
    purchase_order_id,
    quantity,
    purchase_orders ( po_number, status )
  )
`

/** Tételszintű beszállítói várólista — szerveroldali lapozás, beszállító szerint rendezve. */
export async function listCustomerSpecialOrderItemsWaiting(
  supabase: SupabaseClient,
  input: {
    tenantId: string
    view?: CsoWaitingView
    q?: string
    supplierId?: string
    /** ready nézet: csak sms_sent_at IS NULL rendelések */
    notifyPending?: boolean
    page?: number
    limit?: number
  }
): Promise<{
  rows: CsoWaitingListItem[]
  total: number
  page: number
  limit: number
}> {
  const limit = Math.min(50, Math.max(1, input.limit ?? LIST_LIMIT))
  const page = Math.max(1, input.page ?? 1)
  const from = (page - 1) * limit
  const to = from + limit - 1
  const view = input.view ?? 'todo'
  const status = waitingViewToStatus(view)
  const q = input.q?.trim() ?? ''
  const notifyPending = Boolean(input.notifyPending && view === 'ready')

  let orderIdsForQ: string[] = []
  if (q) {
    const { data: orders } = await supabase
      .from('customer_special_orders')
      .select('id')
      .eq('tenant_id', input.tenantId)
      .is('deleted_at', null)
      .or(
        `order_number.ilike.%${q}%,customer_name.ilike.%${q}%,customer_mobile.ilike.%${q}%`
      )
      .limit(200)
    orderIdsForQ = (orders ?? []).map((o) => o.id as string)
  }

  let notifyOrderIds: string[] | null = null
  if (notifyPending) {
    const { data: pendingOrders } = await supabase
      .from('customer_special_orders')
      .select('id')
      .eq('tenant_id', input.tenantId)
      .is('deleted_at', null)
      .is('sms_sent_at', null)
    notifyOrderIds = (pendingOrders ?? []).map((o) => o.id as string)
    if (notifyOrderIds.length === 0) {
      return { rows: [], total: 0, page, limit }
    }
  }

  let query = supabase
    .from('customer_special_order_items')
    .select(WAITING_ITEM_SELECT, { count: 'exact' })
    .eq('tenant_id', input.tenantId)
    .eq('status', status)
    .is('deleted_at', null)
    .is('customer_special_orders.deleted_at', null)
    .order('created_at', { ascending: true })
    .range(from, to)

  if (input.supplierId) {
    query = query.eq('supplier_id', input.supplierId)
  }

  if (notifyOrderIds) {
    query = query.in('order_id', notifyOrderIds)
  }

  if (q) {
    const parts = [
      `name.ilike.%${q}%`,
      `sku_snapshot.ilike.%${q}%`
    ]
    if (orderIdsForQ.length) {
      parts.push(`order_id.in.(${orderIdsForQ.join(',')})`)
    }
    query = query.or(parts.join(','))
  }

  const { data, error, count } = await query
  if (error) {
    console.error('listCustomerSpecialOrderItemsWaiting', error.message)
    throw new Error('Nem sikerült betölteni a várólistát.')
  }

  let rows = sortWaitingBySupplier(
    (data ?? []).map((r) => mapWaitingRow(r as Record<string, unknown>))
  )

  if (view === 'on_way' || view === 'ready') {
    const receivedMap = await getReceivedQtyForPoItemIds(
      supabase,
      input.tenantId,
      rows
        .map((r) => r.purchaseOrderItemId)
        .filter((id): id is string => Boolean(id))
    )
    rows = rows.map((r) => ({
      ...r,
      poQtyReceived: r.purchaseOrderItemId
        ? (receivedMap.get(r.purchaseOrderItemId) ?? 0)
        : null
    }))
  }

  return { rows, total: count ?? 0, page, limit }
}

function sortWaitingBySupplier(rows: CsoWaitingListItem[]): CsoWaitingListItem[] {
  return [...rows].sort((a, b) => {
    const an = a.supplierName?.trim() || ''
    const bn = b.supplierName?.trim() || ''
    if (!an && bn) return 1
    if (an && !bn) return -1
    const byName = an.localeCompare(bn, 'hu')
    if (byName !== 0) return byName
    return a.createdAt.localeCompare(b.createdAt)
  })
}

/** Lean státusz darabszámok a chip szűrőkhöz. */
export async function countCustomerSpecialOrderItemsWaiting(
  supabase: SupabaseClient,
  tenantId: string,
  supplierId?: string
): Promise<CsoWaitingCounts> {
  const views: CsoWaitingView[] = [
    'todo',
    'on_way',
    'ready',
    'done',
    'cancelled'
  ]
  const counts: CsoWaitingCounts = {
    todo: 0,
    on_way: 0,
    ready: 0,
    done: 0,
    cancelled: 0
  }

  await Promise.all(
    views.map(async (view) => {
      let q = supabase
        .from('customer_special_order_items')
        .select('id, customer_special_orders!inner(deleted_at)', {
          count: 'exact',
          head: true
        })
        .eq('tenant_id', tenantId)
        .eq('status', waitingViewToStatus(view))
        .is('deleted_at', null)
        .is('customer_special_orders.deleted_at', null)
      if (supplierId) q = q.eq('supplier_id', supplierId)
      const { count, error } = await q
      if (error) {
        console.error('countWaiting', view, error.message)
        return
      }
      counts[view] = count ?? 0
    })
  )

  return counts
}
