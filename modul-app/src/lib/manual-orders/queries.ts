import type { SupabaseClient } from '@supabase/supabase-js'

import { buildSupplierProductUrl } from '@/lib/suppliers/order-channels'
import {
  MO_ITEM_STATUSES,
  moLineGross,
  type MoBilling,
  type MoDeposit,
  type MoDepositMethod,
  type MoDetail,
  type MoEvent,
  type MoItem,
  type MoItemStatus,
  type MoListRow,
  MO_LATE_DAYS,
  MO_SHELF_DAYS,
  type MoQueueGroup,
  type MoQueueItem,
  type MoQueueSupplierChip,
  type MoQueueView
} from '@/lib/manual-orders/types'

export const MO_PAGE_SIZE = 25

/** PostgREST `.or()` biztonságos keresőszó (vessző / zárójel nélkül). */
function cleanTerm(q: string): string {
  return q.replace(/[,()%*\\]/g, ' ').replace(/\s+/g, ' ').trim()
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

async function orderIdsMatching(
  supabase: SupabaseClient,
  tenantId: string,
  term: string
): Promise<string[]> {
  const { data } = await supabase
    .from('manual_orders')
    .select('id')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .or(
      `order_number.ilike.%${term}%,customer_name.ilike.%${term}%,customer_mobile.ilike.%${term}%`
    )
    .limit(200)
  return (data ?? []).map((r) => r.id as string)
}

// ---------------------------------------------------------------------------
// Rendeléslista
// ---------------------------------------------------------------------------

export type MoListFilter = {
  q?: string
  status?: MoItemStatus | 'mind'
  page?: number
}

export async function listManualOrders(
  supabase: SupabaseClient,
  tenantId: string,
  filter: MoListFilter
): Promise<{
  rows: MoListRow[]
  total: number
  counts: Record<MoItemStatus | 'mind', number>
}> {
  const page = Math.max(1, filter.page ?? 1)
  const from = (page - 1) * MO_PAGE_SIZE
  const term = cleanTerm(filter.q ?? '')
  const status = filter.status ?? 'mind'

  let query = supabase
    .from('manual_orders')
    .select(
      'id, order_number, customer_name, customer_mobile, status, created_at, manual_order_items(status, qty, unit_price_gross, deleted_at)',
      { count: 'exact' }
    )
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)

  if (status !== 'mind') query = query.eq('status', status)
  if (term) {
    query = query.or(
      `order_number.ilike.%${term}%,customer_name.ilike.%${term}%,customer_mobile.ilike.%${term}%`
    )
  }

  const countQuery = (s: MoItemStatus | 'mind') => {
    let q = supabase
      .from('manual_orders')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
    if (s !== 'mind') q = q.eq('status', s)
    return q
  }

  const keys = [...MO_ITEM_STATUSES, 'mind'] as const
  const [res, ...countRes] = await Promise.all([
    query.order('created_at', { ascending: false }).range(from, from + MO_PAGE_SIZE - 1),
    ...keys.map((k) => countQuery(k))
  ])

  if (res.error) {
    console.error('listManualOrders', res.error.message)
    throw new Error('Nem sikerült betölteni a kézi rendeléseket.')
  }

  const counts = Object.fromEntries(
    keys.map((k, i) => [k, countRes[i].count ?? 0])
  ) as Record<MoItemStatus | 'mind', number>

  const rows: MoListRow[] = (res.data ?? []).map((o) => {
    const items = ((o.manual_order_items ?? []) as {
      status: string
      qty: unknown
      unit_price_gross: unknown
      deleted_at: string | null
    }[]).filter((i) => !i.deleted_at && i.status !== 'torolve')
    return {
      id: o.id as string,
      orderNumber: o.order_number as string,
      customerName: o.customer_name as string,
      customerMobile: (o.customer_mobile as string | null) ?? null,
      status: o.status as MoItemStatus,
      itemCount: items.length,
      readyCount: items.filter((i) => i.status === 'megerkezett').length,
      totalGross: items.reduce(
        (s, i) => s + moLineGross(numOrNull(i.unit_price_gross), num(i.qty)),
        0
      ),
      createdAt: o.created_at as string
    }
  })

  return { rows, total: res.count ?? 0, counts }
}

// ---------------------------------------------------------------------------
// Részletező
// ---------------------------------------------------------------------------

/** `kind` a 20261024 migrációval jön — előtte is töltsön be (minden befizetés „előleg”). */
async function loadDeposits(supabase: SupabaseClient, tenantId: string, orderId: string) {
  const q = (cols: string) =>
    supabase
      .from('manual_order_deposits')
      .select(cols)
      .eq('tenant_id', tenantId)
      .eq('order_id', orderId)
      .order('created_at', { ascending: true })
  const base = 'id, amount, method, note, created_by_label, created_at, voided_at, voided_by_label'
  let res = await q(`${base}, kind`)
  if (res.error) res = await q(base)
  return { data: (res.data ?? []) as unknown as Record<string, unknown>[] }
}

export async function getManualOrder(
  supabase: SupabaseClient,
  tenantId: string,
  id: string
): Promise<MoDetail | null> {
  const [orderRes, itemsRes, depRes, evRes] = await Promise.all([
    supabase
      .from('manual_orders')
      .select(
        'id, order_number, customer_id, customer_name, customer_mobile, status, promised_date, note, sms_sent_at, created_by_label, created_at'
      )
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle(),
    supabase
      .from('manual_order_items')
      .select(
        'id, order_id, name, sku, qty, unit_shortform, unit_price_gross, accessory_id, supplier_id, note, status, ordered_at, ordered_by_label, arrived_at, arrived_by_label, handed_over_at, handed_over_by_label, created_at, suppliers(name)'
      )
      .eq('tenant_id', tenantId)
      .eq('order_id', id)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    loadDeposits(supabase, tenantId, id),
    supabase
      .from('manual_order_events')
      .select('id, kind, status, item_count, detail, actor_label, created_at')
      .eq('tenant_id', tenantId)
      .eq('order_id', id)
      .order('created_at', { ascending: false })
      .limit(50)
  ])

  if (orderRes.error) {
    console.error('getManualOrder', orderRes.error.message)
    throw new Error('Nem sikerült betölteni a rendelést.')
  }
  const o = orderRes.data
  if (!o) return null

  const items: MoItem[] = (itemsRes.data ?? []).map((i) => mapItem(i))
  const deposits: MoDeposit[] = (depRes.data as Record<string, unknown>[]).map((d) => ({
    id: d.id as string,
    amount: num(d.amount),
    method: d.method as MoDepositMethod,
    kind: d.kind === 'atadas' ? 'atadas' : 'eloleg',
    note: (d.note as string | null) ?? null,
    createdByLabel: (d.created_by_label as string | null) ?? null,
    createdAt: d.created_at as string,
    voidedAt: (d.voided_at as string | null) ?? null,
    voidedByLabel: (d.voided_by_label as string | null) ?? null
  }))
  const events: MoEvent[] = (evRes.data ?? []).map((e) => ({
    id: e.id as string,
    kind: e.kind as MoEvent['kind'],
    status: (e.status as MoItemStatus | null) ?? null,
    itemCount: (e.item_count as number | null) ?? null,
    detail: (e.detail as string | null) ?? null,
    actorLabel: (e.actor_label as string | null) ?? null,
    createdAt: e.created_at as string
  }))

  let billing: MoBilling | null = null
  if (o.customer_id) {
    const { data: c } = await supabase
      .from('customers')
      .select('billing_name, billing_postal_code, billing_city, billing_street, billing_house_number, billing_tax_number')
      .eq('tenant_id', tenantId)
      .eq('id', o.customer_id)
      .maybeSingle()
    if (c?.billing_name) {
      billing = {
        name: c.billing_name ?? '',
        postalCode: c.billing_postal_code ?? '',
        city: c.billing_city ?? '',
        street: c.billing_street ?? '',
        houseNumber: c.billing_house_number ?? '',
        taxNumber: c.billing_tax_number ?? ''
      }
    }
  }

  return {
    id: o.id as string,
    orderNumber: o.order_number as string,
    billing,
    customerId: (o.customer_id as string | null) ?? null,
    customerName: o.customer_name as string,
    customerMobile: (o.customer_mobile as string | null) ?? null,
    status: o.status as MoItemStatus,
    promisedDate: (o.promised_date as string | null) ?? null,
    note: (o.note as string | null) ?? null,
    smsSentAt: (o.sms_sent_at as string | null) ?? null,
    createdByLabel: (o.created_by_label as string | null) ?? null,
    createdAt: o.created_at as string,
    items,
    deposits,
    events
  }
}

type RawItem = Record<string, unknown> & {
  suppliers?: { name: string } | { name: string }[] | null
}

function supplierNameOf(raw: RawItem): string | null {
  const s = raw.suppliers
  if (!s) return null
  if (Array.isArray(s)) return s[0]?.name ?? null
  return s.name ?? null
}

function mapItem(i: RawItem): MoItem {
  return {
    id: i.id as string,
    orderId: i.order_id as string,
    name: i.name as string,
    sku: (i.sku as string | null) ?? null,
    qty: num(i.qty),
    unitShortform: (i.unit_shortform as string) || 'db',
    unitPriceGross: numOrNull(i.unit_price_gross),
    accessoryId: (i.accessory_id as string | null) ?? null,
    supplierId: (i.supplier_id as string | null) ?? null,
    supplierName: supplierNameOf(i),
    note: (i.note as string | null) ?? null,
    status: i.status as MoItemStatus,
    orderedAt: (i.ordered_at as string | null) ?? null,
    orderedByLabel: (i.ordered_by_label as string | null) ?? null,
    arrivedAt: (i.arrived_at as string | null) ?? null,
    arrivedByLabel: (i.arrived_by_label as string | null) ?? null,
    handedOverAt: (i.handed_over_at as string | null) ?? null,
    handedOverByLabel: (i.handed_over_by_label as string | null) ?? null,
    createdAt: i.created_at as string
  }
}

// ---------------------------------------------------------------------------
// Kézi várólista
// ---------------------------------------------------------------------------

export type MoQueueFilter = {
  view: MoQueueView
  q?: string
  /** supplier uuid, vagy 'none' = beszállító nélküli tételek */
  supplierId?: string
  page?: number
}

export type MoQueueResult = {
  groups: MoQueueGroup[]
  chips: MoQueueSupplierChip[]
  counts: Record<MoQueueView, number>
  totalItems: number
  page: number
  totalPages: number
  lateCount: number
  shelfCount: number
  /** Lemondott (törölt), de már megrendelt tételek az elmúlt 14 napban. */
  cancelledOrderedCount: number
}

const NO_SUPPLIER = '—'
const daysAgoIso = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString()

function statusAtOf(r: Record<string, unknown>): string {
  const st = r.status as MoItemStatus
  return (
    (st === 'megrendelve' && (r.ordered_at as string | null)) ||
    (st === 'megerkezett' && (r.arrived_at as string | null)) ||
    (st === 'atadva' && (r.handed_over_at as string | null)) ||
    (st === 'torolve' && (r.updated_at as string | null)) ||
    (r.created_at as string)
  )
}

export type SupplierInfo = {
  id: string
  name: string
  phone: string | null
  email: string | null
  color: string | null
  intro: string | null
  /** Alapértelmezett (vagy első) webshop csatorna URL sablonja. */
  urlTemplate: string | null
  preferred: 'email' | 'internet' | 'phone' | 'in_person' | null
}

type ChannelRow = { channel_type: string; url_template: string | null; is_default: boolean; deleted_at: string | null }

/** Beszállítói elérhetőség + rendelési csatornák. A `color` a 20261023 migrációval jön — előtte is működik. */
export async function loadSupplierInfo(
  supabase: SupabaseClient,
  tenantId: string,
  ids: string[]
): Promise<Map<string, SupplierInfo>> {
  const m = new Map<string, SupplierInfo>()
  if (ids.length === 0) return m
  const cols = (withColor: boolean) =>
    `id, name, phone, email, email_po_intro_html, ${withColor ? 'color, ' : ''}supplier_order_channels (channel_type, url_template, is_default, deleted_at)`
  let res = await supabase.from('suppliers').select(cols(true)).eq('tenant_id', tenantId).in('id', ids)
  if (res.error) res = await supabase.from('suppliers').select(cols(false)).eq('tenant_id', tenantId).in('id', ids)
  for (const r of (res.data ?? []) as unknown as Record<string, unknown>[]) {
    const channels = ((r.supplier_order_channels as ChannelRow[] | null) ?? [])
      .filter((c) => !c.deleted_at)
      .sort((x, y) => Number(y.is_default) - Number(x.is_default))
    const web = channels.find((c) => c.channel_type === 'internet' && c.url_template)
    const email = (r.email as string | null) ?? null
    const phone = (r.phone as string | null) ?? null
    const def = channels[0]?.channel_type as SupplierInfo['preferred'] | undefined
    m.set(r.id as string, {
      id: r.id as string,
      name: r.name as string,
      phone,
      email,
      color: (r.color as string | null) ?? null,
      intro: (r.email_po_intro_html as string | null) ?? null,
      urlTemplate: web?.url_template ?? null,
      preferred: def ?? (email ? 'email' : web ? 'internet' : phone ? 'phone' : null)
    })
  }
  return m
}

/** `${supplierId}|${accessoryId}` → beszállítói cikkszám. */
export async function loadSupplierSkus(
  supabase: SupabaseClient,
  tenantId: string,
  pairs: { supplierId: string | null; accessoryId: string | null }[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const sup = [...new Set(pairs.map((p) => p.supplierId).filter((x): x is string => Boolean(x)))]
  const acc = [...new Set(pairs.map((p) => p.accessoryId).filter((x): x is string => Boolean(x)))]
  if (sup.length === 0 || acc.length === 0) return out
  const { data, error } = await supabase
    .from('accessory_suppliers')
    .select('supplier_id, accessory_id, supplier_sku')
    .eq('tenant_id', tenantId)
    .in('supplier_id', sup)
    .in('accessory_id', acc)
  if (error) {
    console.error('loadSupplierSkus', error.message)
    return out
  }
  for (const r of data ?? []) {
    const v = (r.supplier_sku as string | null)?.trim()
    if (v) out.set(`${r.supplier_id}|${r.accessory_id}`, v)
  }
  return out
}

const productKey = (supplierId: string | null, sku: unknown, name: unknown, unit: unknown) =>
  `${supplierId ?? ''}|${String((sku as string | null)?.trim() || (name as string).trim()).toLowerCase()}|${String(unit ?? '').toLowerCase()}`

/**
 * Várólista beszállítónként csoportosítva. A lapozás egész csoportokat vesz (~25 tétel / oldal),
 * így egy beszállító sosem esik szét két oldalra.
 */
export async function listManualQueue(
  supabase: SupabaseClient,
  tenantId: string,
  filter: MoQueueFilter
): Promise<MoQueueResult> {
  const term = cleanTerm(filter.q ?? '')
  const matchedOrderIds = term ? await orderIdsMatching(supabase, tenantId, term) : []

  const scoped = <T extends { or: (f: string) => T }>(q: T): T => {
    if (!term) return q
    const parts = [`name.ilike.%${term}%`, `sku.ilike.%${term}%`]
    if (matchedOrderIds.length > 0) parts.push(`order_id.in.(${matchedOrderIds.join(',')})`)
    return q.or(parts.join(','))
  }
  const head = () =>
    supabase
      .from('manual_order_items')
      .select('id, manual_orders!inner(id)', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .is('manual_orders.deleted_at', null)

  const views: MoQueueView[] = [...MO_ITEM_STATUSES, 'mind']

  let leanQ = scoped(
    supabase
      .from('manual_order_items')
      .select('id, supplier_id, qty, unit_price_gross, status, created_at, ordered_at, arrived_at, handed_over_at, updated_at, manual_orders!inner(id)')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .is('manual_orders.deleted_at', null)
  )
  if (filter.view !== 'mind') leanQ = leanQ.eq('status', filter.view)

  const [leanRes, lateRes, shelfRes, cancelledRes, ...countRes] = await Promise.all([
    leanQ.limit(5000),
    head().eq('status', 'megrendelve').lt('ordered_at', daysAgoIso(MO_LATE_DAYS)),
    head().eq('status', 'megerkezett').lt('arrived_at', daysAgoIso(MO_SHELF_DAYS)),
    head().eq('status', 'torolve').not('ordered_at', 'is', null).gt('updated_at', daysAgoIso(14)),
    ...views.map((v) => {
      const q = scoped(head())
      return v === 'mind' ? q : q.eq('status', v)
    })
  ])
  if (leanRes.error) {
    console.error('listManualQueue', leanRes.error.message)
    throw new Error('Nem sikerült betölteni a várólistát.')
  }
  const counts = Object.fromEntries(views.map((v, i) => [v, countRes[i]!.count ?? 0])) as Record<MoQueueView, number>

  // Beszállítónkénti összesítés a teljes nézetre.
  type Agg = { count: number; gross: number; unpriced: number; oldestAt: string | null }
  const agg = new Map<string, Agg>()
  for (const r of (leanRes.data ?? []) as Record<string, unknown>[]) {
    const key = (r.supplier_id as string | null) ?? NO_SUPPLIER
    const a = agg.get(key) ?? { count: 0, gross: 0, unpriced: 0, oldestAt: null }
    a.count++
    const price = numOrNull(r.unit_price_gross)
    if (price == null) a.unpriced++
    else a.gross += moLineGross(price, num(r.qty))
    const at = statusAtOf(r)
    if (!a.oldestAt || at < a.oldestAt) a.oldestAt = at
    agg.set(key, a)
  }

  const info = await loadSupplierInfo(
    supabase,
    tenantId,
    [...agg.keys()].filter((k) => k !== NO_SUPPLIER)
  )
  const chips: MoQueueSupplierChip[] = [...agg.entries()]
    .map(([key, a]) => {
      const s = key === NO_SUPPLIER ? null : info.get(key)
      return {
        key,
        supplierId: key === NO_SUPPLIER ? null : key,
        name: s?.name ?? (key === NO_SUPPLIER ? 'Nincs beszállító' : 'Ismeretlen beszállító'),
        color: s?.color ?? null,
        count: a.count
      }
    })
    .sort((x, y) => (x.supplierId === null ? 1 : y.supplierId === null ? -1 : x.name.localeCompare(y.name, 'hu')))

  const wanted =
    filter.supplierId === 'none' ? NO_SUPPLIER : filter.supplierId ? filter.supplierId : null
  const visible = wanted ? chips.filter((c) => c.key === wanted) : chips

  // Oldalak: egész csoportok, ~MO_PAGE_SIZE tételig.
  const pages: MoQueueSupplierChip[][] = []
  let cur: MoQueueSupplierChip[] = []
  let n = 0
  for (const c of visible) {
    if (cur.length > 0 && n + c.count > MO_PAGE_SIZE) {
      pages.push(cur)
      cur = []
      n = 0
    }
    cur.push(c)
    n += c.count
  }
  if (cur.length > 0) pages.push(cur)
  const totalPages = Math.max(1, pages.length)
  const page = Math.min(Math.max(1, filter.page ?? 1), totalPages)
  const pageChips = pages[page - 1] ?? []

  const base = {
    chips,
    counts,
    totalItems: visible.reduce((s, c) => s + c.count, 0),
    page,
    totalPages,
    lateCount: lateRes.count ?? 0,
    shelfCount: shelfRes.count ?? 0,
    cancelledOrderedCount: cancelledRes.count ?? 0
  }
  if (pageChips.length === 0) return { ...base, groups: [] }

  const ids = pageChips.map((c) => c.supplierId).filter((x): x is string => Boolean(x))
  const withNull = pageChips.some((c) => c.supplierId === null)
  let detailQ = scoped(
    supabase
      .from('manual_order_items')
      .select(
        'id, order_id, name, sku, qty, unit_shortform, unit_price_gross, supplier_id, accessory_id, note, status, created_at, ordered_at, ordered_by_label, arrived_at, arrived_by_label, handed_over_at, handed_over_by_label, updated_at, manual_orders!inner(order_number, customer_name, customer_mobile, sms_sent_at, deleted_at)'
      )
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .is('manual_orders.deleted_at', null)
  )
  if (filter.view !== 'mind') detailQ = detailQ.eq('status', filter.view)
  const supplierOr = [ids.length ? `supplier_id.in.(${ids.join(',')})` : null, withNull ? 'supplier_id.is.null' : null]
    .filter(Boolean)
    .join(',')
  detailQ = detailQ.or(supplierOr)

  const onWayQ =
    filter.view === 'nyitott' && ids.length > 0
      ? supabase
          .from('manual_order_items')
          .select('supplier_id, name, sku, qty, unit_shortform, manual_orders!inner(order_number, deleted_at)')
          .eq('tenant_id', tenantId)
          .eq('status', 'megrendelve')
          .is('deleted_at', null)
          .is('manual_orders.deleted_at', null)
          .in('supplier_id', ids)
          .limit(1000)
      : null

  const [detailRes, onWayRes] = await Promise.all([
    detailQ.order('created_at', { ascending: true }).limit(500),
    onWayQ ?? Promise.resolve(null)
  ])
  if (detailRes.error) {
    console.error('listManualQueue detail', detailRes.error.message)
    throw new Error('Nem sikerült betölteni a várólistát.')
  }

  const skuMap = await loadSupplierSkus(
    supabase,
    tenantId,
    ((detailRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
      supplierId: (r.supplier_id as string | null) ?? null,
      accessoryId: (r.accessory_id as string | null) ?? null
    }))
  )

  const onWay = new Map<string, { qty: number; orderNumber: string }[]>()
  for (const r of (onWayRes?.data ?? []) as Record<string, unknown>[]) {
    const o = r.manual_orders as { order_number: string } | { order_number: string }[]
    const k = productKey(r.supplier_id as string | null, r.sku, r.name, r.unit_shortform)
    onWay.set(k, [
      ...(onWay.get(k) ?? []),
      { qty: num(r.qty), orderNumber: (Array.isArray(o) ? o[0]?.order_number : o?.order_number) ?? '—' }
    ])
  }

  type OrderJoin = {
    order_number: string
    customer_name: string
    customer_mobile: string | null
    sms_sent_at: string | null
  }
  const byKey = new Map<string, MoQueueItem[]>()
  for (const raw of (detailRes.data ?? []) as Record<string, unknown>[]) {
    const oj = raw.manual_orders as OrderJoin | OrderJoin[]
    const o = Array.isArray(oj) ? oj[0] : oj
    const status = raw.status as MoItemStatus
    const supplierId = (raw.supplier_id as string | null) ?? null
    const supplierSku = supplierId && raw.accessory_id ? (skuMap.get(`${supplierId}|${raw.accessory_id}`) ?? null) : null
    const tpl = supplierId ? info.get(supplierId)?.urlTemplate : null
    const item: MoQueueItem = {
      id: raw.id as string,
      orderId: raw.order_id as string,
      orderNumber: o?.order_number ?? '—',
      customerName: o?.customer_name ?? '—',
      customerMobile: o?.customer_mobile ?? null,
      name: raw.name as string,
      sku: (raw.sku as string | null) ?? null,
      qty: num(raw.qty),
      unitShortform: (raw.unit_shortform as string) || 'db',
      unitPriceGross: numOrNull(raw.unit_price_gross),
      supplierId,
      supplierName: supplierId ? (info.get(supplierId)?.name ?? null) : null,
      note: (raw.note as string | null) ?? null,
      status,
      createdAt: raw.created_at as string,
      statusAt: statusAtOf(raw),
      statusByLabel:
        status === 'megrendelve'
          ? ((raw.ordered_by_label as string | null) ?? null)
          : status === 'megerkezett'
            ? ((raw.arrived_by_label as string | null) ?? null)
            : status === 'atadva'
              ? ((raw.handed_over_by_label as string | null) ?? null)
              : null,
      orderSmsSentAt: o?.sms_sent_at ?? null,
      onWay: onWay.get(productKey(supplierId, raw.sku, raw.name, raw.unit_shortform)) ?? [],
      supplierSku,
      shopUrl: tpl
        ? buildSupplierProductUrl({
            urlTemplate: tpl,
            sku: (raw.sku as string | null) ?? null,
            supplierSku,
            name: raw.name as string
          })
        : null
    }
    const k = supplierId ?? NO_SUPPLIER
    byKey.set(k, [...(byKey.get(k) ?? []), item])
  }

  const groups: MoQueueGroup[] = pageChips.map((c) => {
    const a = agg.get(c.key)!
    const s = c.supplierId ? info.get(c.supplierId) : undefined
    return {
      key: c.key,
      supplierId: c.supplierId,
      supplierName: c.name,
      color: c.color,
      phone: s?.phone ?? null,
      email: s?.email ?? null,
      count: a.count,
      gross: a.gross,
      unpriced: a.unpriced,
      oldestAt: a.oldestAt,
      items: (byKey.get(c.key) ?? []).sort((x, y) => x.statusAt.localeCompare(y.statusAt))
    }
  })

  return { ...base, groups }
}

// ---------------------------------------------------------------------------
// Kereső (átadás a keresőből)
// ---------------------------------------------------------------------------

export type MoSearchHit = {
  id: string
  orderNumber: string
  customerName: string
  customerMobile: string | null
  status: MoItemStatus
  readyItems: { id: string; name: string; qty: number; unitShortform: string }[]
  waitingCount: number
}

export async function searchManualOrders(
  supabase: SupabaseClient,
  tenantId: string,
  q: string,
  limit = 5
): Promise<MoSearchHit[]> {
  const term = cleanTerm(q)
  if (term.length < 2) return []

  const { data, error } = await supabase
    .from('manual_orders')
    .select(
      'id, order_number, customer_name, customer_mobile, status, manual_order_items(id, name, qty, unit_shortform, status, deleted_at)'
    )
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .neq('status', 'torolve')
    .or(
      `order_number.ilike.%${term}%,customer_name.ilike.%${term}%,customer_mobile.ilike.%${term}%`
    )
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('searchManualOrders', error.message)
    return []
  }

  return (data ?? []).map((o) => {
    const items = ((o.manual_order_items ?? []) as {
      id: string
      name: string
      qty: unknown
      unit_shortform: string
      status: string
      deleted_at: string | null
    }[]).filter((i) => !i.deleted_at)
    return {
      id: o.id as string,
      orderNumber: o.order_number as string,
      customerName: o.customer_name as string,
      customerMobile: (o.customer_mobile as string | null) ?? null,
      status: o.status as MoItemStatus,
      readyItems: items
        .filter((i) => i.status === 'megerkezett')
        .map((i) => ({
          id: i.id,
          name: i.name,
          qty: num(i.qty),
          unitShortform: i.unit_shortform || 'db'
        })),
      waitingCount: items.filter((i) => i.status === 'nyitott' || i.status === 'megrendelve').length
    }
  })
}
