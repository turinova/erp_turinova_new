import type { SupabaseClient } from '@supabase/supabase-js'

import { getReceivedQtyForPoItemIds } from '@/lib/goods-receipts/queries'
import {
  looksLikeBarcode,
  normalizeScannerBarcode
} from '@/lib/pos/barcode'
import type {
  CsoItemStatus,
  CsoListCounts,
  CsoListStatus,
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

/** PostgREST ilike — %, _ és vessző kiszűrése. */
function sanitizeWaitingSearch(raw: string): string {
  return raw.trim().replace(/[%_,]/g, '').slice(0, 80)
}

type PoJoin = {
  po_number: string
  status: string
  created_at?: string | null
  ordered_at?: string | null
}
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

const CSO_ACTIVE_STATUSES = ['felveve', 'rendelve', 'itt_van'] as const
/** `id.in.(…)` URL-hossz korlát a keresési találatokhoz. */
const SEARCH_ID_CAP = 150

/** PostgREST `or()` — a foglalt karakterek (vessző, zárójel, %, _) nem mehetnek bele. */
function sanitizeListSearch(raw: string): string {
  return raw
    .replace(/[%_,()"\\*:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

/**
 * Telefon-szerű keresés → regex, ami a tárolt formázás (`+36 30 123 4567`)
 * szóközeit átugorja. `06…` / `0036…` → `36…`.
 */
function phoneSearchRegex(q: string): string | null {
  let digits = q.replace(/[\s+\-/.]/g, '')
  if (!/^\d{4,}$/.test(digits)) return null
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.startsWith('06')) digits = `36${digits.slice(2)}`
  return digits.split('').join('[^0-9]*')
}

function firstEmbed<T>(raw: T | T[] | null | undefined): T | null {
  return Array.isArray(raw) ? (raw[0] ?? null) : (raw ?? null)
}

function uniq(ids: Array<string | null | undefined>): string[] {
  return [...new Set(ids.filter((v): v is string => Boolean(v)))]
}

/** Keresőszóra illeszkedő rendelés-azonosítók (telefon, tétel neve / SKU, vonalkód). */
async function csoSearchOrderIds(
  supabase: SupabaseClient,
  tenantId: string,
  safe: string
): Promise<string[]> {
  const phoneRegex = phoneSearchRegex(safe)
  const barcode = looksLikeBarcode(safe) ? normalizeScannerBarcode(safe) : null
  const [phoneRes, itemRes, accRes] = await Promise.all([
    phoneRegex
      ? supabase
          .from('customer_special_orders')
          .select('id')
          .eq('tenant_id', tenantId)
          .is('deleted_at', null)
          .filter('customer_mobile', 'match', phoneRegex)
          .limit(SEARCH_ID_CAP)
      : Promise.resolve({ data: [] as { id: string }[], error: null }),
    supabase
      .from('customer_special_order_items')
      .select('order_id')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .or(`name.ilike.%${safe}%,sku_snapshot.ilike.%${safe}%`)
      .limit(SEARCH_ID_CAP),
    // Név + SKU a tétel snapshotjában van; a katalógus csak vonalkódhoz kell,
    // pontos egyezéssel (btree index) — `%…%` a teljes táblán timeoutol.
    barcode
      ? supabase
          .from('accessories')
          .select('id')
          .eq('tenant_id', tenantId)
          .or(`barcode.eq.${barcode},barcode_internal.eq.${barcode}`)
          .limit(20)
      : Promise.resolve({ data: [] as { id: string }[], error: null })
  ])
  if (phoneRes.error) console.error('csoSearch phone', phoneRes.error.message)
  if (itemRes.error) console.error('csoSearch items', itemRes.error.message)
  if (accRes.error) console.error('csoSearch accessories', accRes.error.message)

  const accessoryIds = uniq((accRes.data ?? []).map((a) => a.id as string))
  let accOrderIds: string[] = []
  if (accessoryIds.length > 0) {
    const { data, error } = await supabase
      .from('customer_special_order_items')
      .select('order_id')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .in('accessory_id', accessoryIds)
      .limit(SEARCH_ID_CAP)
    if (error) console.error('csoSearch accessory items', error.message)
    accOrderIds = (data ?? []).map((r) => r.order_id as string)
  }

  return uniq([
    ...(phoneRes.data ?? []).map((r) => r.id as string),
    ...(itemRes.data ?? []).map((r) => r.order_id as string),
    ...accOrderIds
  ]).slice(0, SEARCH_ID_CAP)
}

/**
 * Rendelés-lekérdezés közös alapja. `ready` / `supplierId` szűrés a tételeken
 * külön aliasolt `!inner` beágyazással, hogy a tétellista teljes maradjon.
 */
function csoOrdersQuery(
  supabase: SupabaseClient,
  tenantId: string,
  opts: {
    select: string
    head?: boolean
    ready?: boolean
    supplierId?: string | null
  }
) {
  const parts = [opts.select]
  if (opts.ready) {
    parts.push('ready_items:customer_special_order_items!inner(id)')
  }
  if (opts.supplierId) {
    parts.push('sup_items:customer_special_order_items!inner(id)')
  }
  let query = supabase
    .from('customer_special_orders')
    .select(
      parts.join(', '),
      opts.head ? { count: 'exact', head: true } : { count: 'exact' }
    )
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
  if (opts.ready) {
    query = query
      .eq('ready_items.status', 'itt_van')
      .is('ready_items.deleted_at', null)
  }
  if (opts.supplierId) {
    query = query
      .eq('sup_items.supplier_id', opts.supplierId)
      .is('sup_items.deleted_at', null)
      .neq('sup_items.status', 'torolve')
  }
  return query
}

async function headCount(
  label: string,
  query: PromiseLike<{ count: number | null; error: { message: string } | null }>
): Promise<number> {
  const { count, error } = await query
  if (error) {
    console.error(`csoListCounts ${label}`, error.message)
    return 0
  }
  return count ?? 0
}

export async function listCustomerSpecialOrders(
  supabase: SupabaseClient,
  input: {
    tenantId: string
    q?: string
    /**
     * active = felveve|rendelve|itt_van; itt_van = van átvehető tétel
     * (részben átvehető is); all = minden. Keresésnél kihagyva.
     */
    status?: CsoListStatus
    /** Van átvehető tétel, de nem ment SMS. Keresésnél kihagyva. */
    nosms?: boolean
    /** Van ilyen beszállítójú élő tétel. Keresésnél is él. */
    supplierId?: string | null
    page?: number
    limit?: number
  }
): Promise<{
  rows: CustomerSpecialOrderListItem[]
  total: number
  page: number
  limit: number
  counts: CsoListCounts
}> {
  const limit = Math.min(50, Math.max(1, input.limit ?? LIST_LIMIT))
  const page = Math.max(1, input.page ?? 1)
  const from = (page - 1) * limit
  const to = from + limit - 1
  const safe = sanitizeListSearch(input.q ?? '')
  const searching = safe.length > 0
  const status = input.status ?? 'active'
  const nosms = !searching && Boolean(input.nosms)
  const supplierId = input.supplierId || null
  const tenantId = input.tenantId

  const countBase = (ready = false) =>
    csoOrdersQuery(supabase, tenantId, {
      select: 'id',
      head: true,
      ready,
      supplierId
    })

  const countsPromise = Promise.all([
    headCount(
      'active',
      countBase().in('status', [...CSO_ACTIVE_STATUSES])
    ),
    headCount('felveve', countBase().eq('status', 'felveve')),
    headCount('rendelve', countBase().eq('status', 'rendelve')),
    headCount('itt_van', countBase(true)),
    headCount('nosms', countBase(true).is('sms_sent_at', null))
  ]).then(
    ([active, felveve, rendelve, itt_van, nosmsCount]) => ({
      active,
      felveve,
      rendelve,
      itt_van,
      nosms: nosmsCount
    })
  )

  const searchIds =
    safe.length >= 2 ? await csoSearchOrderIds(supabase, tenantId, safe) : []

  let query = csoOrdersQuery(supabase, tenantId, {
    select: `
      id, order_number, customer_id, customer_name, customer_mobile, status,
      created_at, deposit_amount, sms_sent_at, sales_order_id,
      cso_sale_links ( sales_order_id ),
      customer_special_order_items (
        name, sku_snapshot, qty, unit_price_gross, status, sort_order, deleted_at,
        accessory_id, supplier_id,
        suppliers ( name ),
        purchase_order_items ( purchase_orders ( po_number ) )
      )
    `,
    ready: !searching && (status === 'itt_van' || nosms),
    supplierId
  })

  if (searching) {
    const parts = [
      `order_number.ilike.%${safe}%`,
      `customer_name.ilike.%${safe}%`,
      `customer_mobile.ilike.%${safe}%`
    ]
    if (searchIds.length > 0) parts.push(`id.in.(${searchIds.join(',')})`)
    query = query.or(parts.join(','))
  } else {
    if (status === 'active') {
      query = query.in('status', [...CSO_ACTIVE_STATUSES])
    } else if (status !== 'all' && status !== 'itt_van') {
      query = query.eq('status', status)
    }
    if (nosms) query = query.is('sms_sent_at', null)
  }

  query = query.order('created_at', { ascending: false })

  const [{ data, error, count }, counts] = await Promise.all([
    query.range(from, to),
    countsPromise
  ])
  if (error) {
    console.error('listCustomerSpecialOrders', error.message)
    throw new Error('Nem sikerült betölteni az ügyfélrendeléseket.')
  }

  const needle = safe.toLocaleLowerCase('hu-HU')
  const rows: CustomerSpecialOrderListItem[] = (
    (data ?? []) as unknown as Array<Record<string, unknown>>
  ).map((r) => {
    const rawItems = (r.customer_special_order_items ?? []) as Array<
      Record<string, unknown>
    >
    const live = rawItems
      .filter((i) => !i.deleted_at && i.status !== 'torolve')
      .sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
    const open = live.filter((i) => i.status !== 'atadva')
    const handedCount = live.length - open.length
    const readyCount = live.filter((i) => i.status === 'itt_van').length
    const supplierNames = uniq(
      open.map(
        (i) =>
          firstEmbed(i.suppliers as { name?: string } | { name?: string }[])
            ?.name
      )
    )
    const poNumbers = uniq(
      open
        .filter((i) => i.status === 'rendelve')
        .map((i) => {
          const poi = firstEmbed(
            i.purchase_order_items as
              | { purchase_orders: PoJoin | PoJoin[] | null }
              | { purchase_orders: PoJoin | PoJoin[] | null }[]
          )
          return firstEmbed(poi?.purchase_orders)?.po_number
        })
    )
    const missingSupplier = open.some(
      (i) => i.status === 'felveve' && i.accessory_id && !i.supplier_id
    )

    let remainingGross = 0
    let dueIncomplete = false
    for (const i of open) {
      const price = i.unit_price_gross != null ? Number(i.unit_price_gross) : null
      if (price == null || !Number.isFinite(price) || price <= 0) {
        dueIncomplete = true
        continue
      }
      remainingGross += Math.round(price * Number(i.qty))
    }
    const saleLinks = (r.cso_sale_links ?? []) as unknown[]
    const hasSale = saleLinks.length > 0 || Boolean(r.sales_order_id)
    const deposit = r.deposit_amount != null ? Number(r.deposit_amount) : 0
    const depositLeft = hasSale ? 0 : deposit
    const dueAtPickup = Math.max(0, remainingGross - depositLeft)

    const headerHit =
      needle.length > 0 &&
      [r.order_number, r.customer_name].some((v) =>
        String(v ?? '')
          .toLocaleLowerCase('hu-HU')
          .includes(needle)
      )
    const matchedItem =
      needle.length > 0 && !headerHit
        ? rawItems.find(
            (i) =>
              !i.deleted_at &&
              [i.name, i.sku_snapshot].some((v) =>
                String(v ?? '')
                  .toLocaleLowerCase('hu-HU')
                  .includes(needle)
              )
          )
        : undefined

    return {
      id: r.id as string,
      orderNumber: r.order_number as string,
      customerId: (r.customer_id as string | null) ?? null,
      customerName: r.customer_name as string,
      customerMobile: r.customer_mobile as string,
      status: asStatus(r.status),
      itemCount: live.length,
      createdAt: r.created_at as string,
      depositAmount: r.deposit_amount != null ? Number(r.deposit_amount) : null,
      smsSentAt: (r.sms_sent_at as string | null) ?? null,
      itemNames: live.map((i) => String(i.name)),
      readyCount,
      handedCount,
      supplierNames,
      poNumbers,
      missingSupplier,
      matchedItemName: matchedItem ? String(matchedItem.name) : null,
      dueAtPickup,
      dueIncomplete: open.length > 0 && dueIncomplete
    }
  })

  return { rows, total: count ?? 0, page, limit, counts }
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
      sales_order_id,
      sales_orders!customer_special_orders_sales_order_id_fkey ( id, sale_number ),
      cso_sale_links (
        sales_order_id,
        sales_orders ( id, sale_number )
      ),
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
          purchase_orders ( po_number, status, created_at, ordered_at )
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
        poCreatedAt: (po?.created_at as string | null | undefined) ?? null,
        poOrderedAt: (po?.ordered_at as string | null | undefined) ?? null,
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

  const primarySaleRaw = data.sales_orders as
    | { id?: string; sale_number?: string }
    | { id?: string; sale_number?: string }[]
    | null
  const primarySale = Array.isArray(primarySaleRaw)
    ? (primarySaleRaw[0] ?? null)
    : primarySaleRaw

  const linkRows = (data.cso_sale_links ?? []) as Array<{
    sales_order_id?: string
    sales_orders?:
      | { id?: string; sale_number?: string }
      | { id?: string; sale_number?: string }[]
      | null
  }>
  const saleLinks = linkRows
    .map((row) => {
      const so = Array.isArray(row.sales_orders)
        ? (row.sales_orders[0] ?? null)
        : (row.sales_orders ?? null)
      const salesOrderId = so?.id ?? row.sales_order_id
      const saleNumber = so?.sale_number
      if (!salesOrderId || !saleNumber) return null
      return { salesOrderId, saleNumber }
    })
    .filter((x): x is { salesOrderId: string; saleNumber: string } =>
      Boolean(x)
    )

  // Ha van shortcut de nincs a links-ben (régi / race), told be.
  const salesOrderId =
    (data.sales_order_id as string | null) ??
    primarySale?.id ??
    saleLinks[0]?.salesOrderId ??
    null
  const saleNumber =
    primarySale?.sale_number ??
    saleLinks.find((l) => l.salesOrderId === salesOrderId)?.saleNumber ??
    saleLinks[0]?.saleNumber ??
    null
  if (
    salesOrderId &&
    saleNumber &&
    !saleLinks.some((l) => l.salesOrderId === salesOrderId)
  ) {
    saleLinks.unshift({ salesOrderId, saleNumber })
  }

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
    items,
    salesOrderId,
    saleNumber,
    saleLinks
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
    orderNote: (order?.note as string | null) ?? null,
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
    deposit_amount, sms_sent_at, note, deleted_at
  ),
  suppliers ( name ),
  accessories ( sku ),
  purchase_order_items (
    purchase_order_id,
    quantity,
    purchase_orders ( po_number, status )
  )
`

/**
 * Kereső: ügyfél / UR# / telefon + tétel név / sku_snapshot +
 * katalógus SKU / barcode / barcode_internal → accessory_id.
 */
async function resolveWaitingSearchIds(
  supabase: SupabaseClient,
  tenantId: string,
  rawQ: string
): Promise<{ orderIds: string[]; accessoryIds: string[]; safe: string }> {
  const safe = sanitizeWaitingSearch(rawQ)
  if (!safe) return { orderIds: [], accessoryIds: [], safe: '' }

  const [ordersRes, accessoriesRes] = await Promise.all([
    supabase
      .from('customer_special_orders')
      .select('id')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .or(
        `order_number.ilike.%${safe}%,customer_name.ilike.%${safe}%,customer_mobile.ilike.%${safe}%`
      )
      .limit(200),
    supabase
      .from('accessories')
      .select('id')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .or(
        [
          `sku.ilike.%${safe}%`,
          `barcode.ilike.%${safe}%`,
          `barcode_internal.ilike.%${safe}%`,
          `name.ilike.%${safe}%`
        ].join(',')
      )
      .limit(100)
  ])

  return {
    safe,
    orderIds: (ordersRes.data ?? []).map((o) => o.id as string),
    accessoryIds: (accessoriesRes.data ?? []).map((a) => a.id as string)
  }
}

function waitingSearchOrFilter(
  safe: string,
  orderIds: string[],
  accessoryIds: string[]
): string {
  const parts = [`name.ilike.%${safe}%`, `sku_snapshot.ilike.%${safe}%`]
  if (orderIds.length) parts.push(`order_id.in.(${orderIds.join(',')})`)
  if (accessoryIds.length) {
    parts.push(`accessory_id.in.(${accessoryIds.join(',')})`)
  }
  return parts.join(',')
}

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
  /** true = keresés minden státuszban (view csak URL / chip). */
  searchAllStatuses: boolean
}> {
  const limit = Math.min(50, Math.max(1, input.limit ?? LIST_LIMIT))
  const page = Math.max(1, input.page ?? 1)
  const from = (page - 1) * limit
  const to = from + limit - 1
  const view = input.view ?? 'todo'
  const status = waitingViewToStatus(view)
  const resolved = await resolveWaitingSearchIds(
    supabase,
    input.tenantId,
    input.q ?? ''
  )
  const q = resolved.safe
  const searchAllStatuses = Boolean(q)
  // Kereséskor ne szűkíts SMS-pending-re (kereszt-státusz lookup).
  const notifyPending = Boolean(
    input.notifyPending && view === 'ready' && !searchAllStatuses
  )

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
      return {
        rows: [],
        total: 0,
        page,
        limit,
        searchAllStatuses
      }
    }
  }

  let query = supabase
    .from('customer_special_order_items')
    .select(WAITING_ITEM_SELECT, { count: 'exact' })
    .eq('tenant_id', input.tenantId)
    .is('deleted_at', null)
    .is('customer_special_orders.deleted_at', null)
    .order('created_at', { ascending: true })
    .range(from, to)

  // Üres keresés → nézet státusz; van q → minden státusz (bolti „hol van?”).
  if (!searchAllStatuses) {
    query = query.eq('status', status)
  }

  if (input.supplierId) {
    query = query.eq('supplier_id', input.supplierId)
  }

  if (notifyOrderIds) {
    query = query.in('order_id', notifyOrderIds)
  }

  if (q) {
    query = query.or(
      waitingSearchOrFilter(q, resolved.orderIds, resolved.accessoryIds)
    )
  }

  const { data, error, count } = await query
  if (error) {
    console.error('listCustomerSpecialOrderItemsWaiting', error.message)
    throw new Error('Nem sikerült betölteni a várólistát.')
  }

  let rows = sortWaitingBySupplier(
    (data ?? []).map((r) => mapWaitingRow(r as Record<string, unknown>))
  )

  const needPoReceived =
    searchAllStatuses || view === 'on_way' || view === 'ready'
  if (needPoReceived) {
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

  return { rows, total: count ?? 0, page, limit, searchAllStatuses }
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

/** Lean státusz darabszámok a chip szűrőkhöz (opcionális q = keresés szerinti count). */
export async function countCustomerSpecialOrderItemsWaiting(
  supabase: SupabaseClient,
  tenantId: string,
  supplierId?: string,
  searchQ?: string
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

  const resolved = await resolveWaitingSearchIds(
    supabase,
    tenantId,
    searchQ ?? ''
  )
  const safe = resolved.safe

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
      if (safe) {
        q = q.or(
          waitingSearchOrFilter(safe, resolved.orderIds, resolved.accessoryIds)
        )
      }
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
