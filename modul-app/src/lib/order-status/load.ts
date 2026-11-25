import { cache } from 'react'

import { createServiceClient } from '@/lib/supabase/service'
import {
  firstNameFromFull,
  formatStatusFt
} from '@/lib/order-status/format'
import type {
  CustomerOrderStatusView,
  OrderShareKind,
  OrderStatusLineItem
} from '@/lib/order-status/types'
import { buildManualOrderView } from '@/lib/order-status/manual-view'
import { DAY_KEYS, normalizeOpeningHours, openStatus, rangesText, budapestNow } from '@/lib/opening-hours'
import { quoteRemainingGross } from '@/lib/quotes/payment-labels'
import { loadStatusReview } from '@/lib/reviews/status-review'

function companyAddress(row: {
  postal_code: string | null
  city: string | null
  address: string | null
}): string | null {
  const parts = [
    [row.postal_code, row.city].filter(Boolean).join(' '),
    row.address
  ].filter((p) => p && String(p).trim())
  return parts.length ? parts.join(', ') : null
}

function qtyLabel(qty: number, unit: string): string {
  const q = Number.isFinite(qty) ? qty : 0
  const u = (unit || 'db').trim() || 'db'
  return `${q} ${u}`
}

function accessorySku(raw: unknown): string | null {
  const a = (Array.isArray(raw) ? raw[0] : raw) as { sku?: string | null } | null | undefined
  return a?.sku?.trim() || null
}

function panelHasEdging(row: Record<string, unknown>): boolean {
  return Boolean(
    row.edge_a_id || row.edge_b_id || row.edge_c_id || row.edge_d_id
  )
}

async function loadCompany(
  admin: NonNullable<ReturnType<typeof createServiceClient>>,
  tenantId: string
): Promise<CustomerOrderStatusView['company']> {
  const { data } = await admin
    .from('tenant_companies')
    .select('name, logo_url, phone_number, email, postal_code, city, address')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!data) {
    return {
      name: 'Cégünk',
      logoUrl: null,
      phone: null,
      email: null,
      addressLine: null
    }
  }

  return {
    name: (data.name as string) || 'Cégünk',
    logoUrl: (data.logo_url as string | null) ?? null,
    phone: (data.phone_number as string | null) ?? null,
    email: (data.email as string | null) ?? null,
    addressLine: companyAddress(data as {
      postal_code: string | null
      city: string | null
      address: string | null
    })
  }
}

type LoadedView = { view: CustomerOrderStatusView; customerId: string | null }

async function loadCsoView(
  admin: NonNullable<ReturnType<typeof createServiceClient>>,
  tenantId: string,
  orderId: string
): Promise<LoadedView | null> {
  const { data, error } = await admin
    .from('customer_special_orders')
    .select(
      `
      id, order_number, customer_id, customer_name, deposit_amount, status, updated_at,
      customer_special_order_items (
        id, name, qty, unit_shortform, unit_price_gross, status, deleted_at, sort_order,
        accessories ( sku )
      )
    `
    )
    .eq('tenant_id', tenantId)
    .eq('id', orderId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error || !data) {
    if (error) console.error('loadCsoView', error.message)
    return null
  }

  const items = (
    (data.customer_special_order_items ?? []) as Array<Record<string, unknown>>
  )
    .filter((i) => !i.deleted_at)
    .sort((a, b) => Number(a.sort_order) - Number(b.sort_order))

  const lineAmount = (i: Record<string, unknown>): number => {
    const qty = Number(i.qty)
    const price =
      i.unit_price_gross != null ? Number(i.unit_price_gross) : null
    if (price == null || !Number.isFinite(qty)) return 0
    return Math.round(price * qty)
  }

  const toLine = (
    i: Record<string, unknown>,
    withPrice: boolean
  ): OrderStatusLineItem => {
    const qty = Number(i.qty)
    const unitShort = String(i.unit_shortform ?? 'db').trim() || 'db'
    const unit =
      i.unit_price_gross != null ? Number(i.unit_price_gross) : null
    const amount =
      withPrice && unit != null && Number.isFinite(qty)
        ? Math.round(unit * qty)
        : null
    return {
      id: String(i.id),
      name: String(i.name ?? 'Tétel'),
      qtyLabel: qtyLabel(qty, unitShort),
      sku: accessorySku(i.accessories),
      unitPriceGross: withPrice && unit != null ? unit : null,
      unitShort: withPrice ? unitShort : null,
      amountGross: amount
    }
  }

  const readyRaw = items.filter((i) => i.status === 'itt_van')
  const waitingRaw = items.filter(
    (i) => i.status === 'felveve' || i.status === 'rendelve'
  )
  const readyItems = readyRaw.map((i) => toLine(i, true))
  const waitingItems = waitingRaw.map((i) => toLine(i, false))
  const allDone =
    items.length > 0 &&
    items.every((i) => i.status === 'atadva' || i.status === 'torolve') &&
    items.some((i) => i.status === 'atadva')

  const readyGross = readyRaw.reduce((s, i) => s + lineAmount(i), 0)
  const deposit =
    data.deposit_amount != null ? Number(data.deposit_amount) : null
  const credit = deposit && deposit > 0 ? deposit : 0
  const dueNow = readyItems.length > 0 ? Math.max(0, readyGross - credit) : null
  const creditLeft = readyItems.length > 0 ? Math.max(0, credit - readyGross) : 0
  const waitingGross = waitingRaw.reduce((s, i) => s + lineAmount(i), 0)
  const waitingPriced = waitingRaw.every((i) => i.unit_price_gross != null)

  let statusLabel = 'Feldolgozás alatt'
  let statusTone: CustomerOrderStatusView['statusTone'] = 'info'

  if (allDone) {
    statusLabel = 'Átadva'
    statusTone = 'neutral'
  } else if (readyItems.length > 0 && waitingItems.length > 0) {
    statusLabel = 'Részben átvehető'
    statusTone = 'warning'
  } else if (readyItems.length > 0) {
    statusLabel = 'Átvehető'
    statusTone = 'success'
  } else if (waitingItems.length > 0) {
    statusLabel = 'Úton'
    statusTone = 'info'
  }

  const company = await loadCompany(admin, tenantId)

  let dueHint: string | null = null
  if (readyItems.length > 0) {
    if (deposit && deposit > 0) dueHint = 'Előleg beszámítva'
    else if (waitingItems.length > 0) dueHint = 'Csak a kész tételek'
  }

  const view: CustomerOrderStatusView = {
    kind: 'cso',
    orderNumber: String(data.order_number ?? '—'),
    customerFirstName: firstNameFromFull(data.customer_name as string),
    statusLabel,
    statusTone,
    statusBody: '',
    dueNowGross: dueNow,
    dueHint,
    depositGross: deposit && deposit > 0 ? deposit : null,
    summaryLine:
      readyItems.length >= 2
        ? `Összesen ${readyItems.length} tétel`
        : null,
    company,
    readyItems,
    waitingItems,
    steps: [],
    updatedAt: (data.updated_at as string | null) ?? null,
    creditAppliedGross: readyItems.length > 0 && credit > 0 ? Math.min(credit, readyGross) : null,
    creditLeftGross: creditLeft > 0 && !allDone ? creditLeft : null,
    laterGross:
      waitingRaw.length > 0 && waitingPriced && waitingGross - creditLeft > 0 ? waitingGross - creditLeft : null
  }
  return { view, customerId: (data.customer_id as string | null) ?? null }
}

async function loadManualView(
  admin: NonNullable<ReturnType<typeof createServiceClient>>,
  tenantId: string,
  orderId: string
): Promise<LoadedView | null> {
  const { data, error } = await admin
    .from('manual_orders')
    .select(
      `id, order_number, customer_id, customer_name, updated_at,
      manual_order_items ( id, name, sku, qty, unit_shortform, unit_price_gross, status, arrived_at, deleted_at, sort_order, created_at )`
    )
    .eq('tenant_id', tenantId)
    .eq('id', orderId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error || !data) {
    if (error) console.error('loadManualView', error.message)
    return null
  }
  const { data: deps } = await admin
    .from('manual_order_deposits')
    .select('amount, voided_at')
    .eq('tenant_id', tenantId)
    .eq('order_id', orderId)

  const items = ((data.manual_order_items ?? []) as Array<Record<string, unknown>>)
    .filter((i) => !i.deleted_at)
    .sort(
      (a, b) =>
        Number(a.sort_order) - Number(b.sort_order) || String(a.created_at).localeCompare(String(b.created_at))
    )
    .map((i) => ({
      id: String(i.id),
      name: String(i.name ?? 'Tétel'),
      sku: (i.sku as string | null) ?? null,
      qty: Number(i.qty) || 0,
      unitShortform: String(i.unit_shortform ?? 'db').trim() || 'db',
      unitPriceGross: i.unit_price_gross != null ? Number(i.unit_price_gross) : null,
      status: String(i.status),
      arrivedAt: (i.arrived_at as string | null) ?? null
    }))
  const core = buildManualOrderView(
    items,
    (deps ?? []).map((d) => ({ amount: Number(d.amount) || 0, voided: Boolean(d.voided_at) }))
  )
  const company = await loadCompany(admin, tenantId)
  const view: CustomerOrderStatusView = {
    ...core,
    orderNumber: String(data.order_number ?? '—'),
    customerFirstName: firstNameFromFull(data.customer_name as string),
    company,
    updatedAt: (data.updated_at as string | null) ?? null
  }
  return { view, customerId: (data.customer_id as string | null) ?? null }
}

/** Nyitvatartás külön select-tel, hogy migráció nélkül se törjön. */
async function loadOpening(
  admin: NonNullable<ReturnType<typeof createServiceClient>>,
  tenantId: string
): Promise<{ openLabel: string | null; todayHours: string | null }> {
  const { data, error } = await admin
    .from('tenant_companies')
    .select('opening_hours')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (error) return { openLabel: null, todayHours: null }
  const hours = normalizeOpeningHours(data?.opening_hours ?? null)
  if (!hours || DAY_KEYS.every((d) => hours[d].length === 0)) return { openLabel: null, todayHours: null }
  const now = new Date()
  const { day } = budapestNow(now)
  return { openLabel: openStatus(hours, now).label, todayHours: `Ma: ${rangesText(hours[day])}` }
}

/**
 * Ügyfélnyelv: anyagonként panel db (nem tábla / m²).
 * Élzárás: bármely él oldal ki van töltve, vagy material edge_length > 0.
 */
function buildQuotePanelLines(
  panels: Array<Record<string, unknown>>,
  materialEdgeByName: Map<string, boolean>
): { lines: OrderStatusLineItem[]; totalQty: number } {
  type Acc = {
    id: string
    name: string
    qty: number
    hasEdging: boolean
  }
  const byKey = new Map<string, Acc>()

  for (const p of panels) {
    const sheet = p.sheet_materials as
      | { name?: string }
      | { name?: string }[]
      | null
    const materialName = Array.isArray(sheet)
      ? sheet[0]?.name
      : sheet?.name
    const name = String(materialName || 'Bútorlap').trim() || 'Bútorlap'
    const materialId = p.sheet_material_id ? String(p.sheet_material_id) : name
    const key = materialId
    const qty = Number(p.quantity ?? 0)
    const edged =
      panelHasEdging(p) || Boolean(materialEdgeByName.get(name.toLowerCase()))

    const prev = byKey.get(key)
    if (prev) {
      prev.qty += Number.isFinite(qty) ? qty : 0
      prev.hasEdging = prev.hasEdging || edged
    } else {
      byKey.set(key, {
        id: key,
        name,
        qty: Number.isFinite(qty) ? qty : 0,
        hasEdging: edged
      })
    }
  }

  const lines: OrderStatusLineItem[] = [...byKey.values()]
    .filter((g) => g.qty > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'hu'))
    .map((g) => {
      const base = qtyLabel(g.qty, 'db')
      return {
        id: g.id,
        name: g.name,
        qtyLabel: g.hasEdging ? `${base} · élzárás` : base,
        unitPriceGross: null,
        unitShort: null,
        amountGross: null
      }
    })

  const totalQty = [...byKey.values()]
    .filter((g) => g.qty > 0)
    .reduce((s, g) => s + g.qty, 0)

  return { lines, totalQty }
}

async function loadQuoteView(
  admin: NonNullable<ReturnType<typeof createServiceClient>>,
  tenantId: string,
  quoteId: string
): Promise<LoadedView | null> {
  const { data, error } = await admin
    .from('quotes')
    .select(
      `
      id, order_number, quote_number, status, payment_status, customer_id,
      final_total_gross, total_gross, updated_at,
      customers ( name ),
      quote_material_lines ( id, material_name, edge_length_m ),
      quote_panels (
        id, quantity, sheet_material_id,
        edge_a_id, edge_b_id, edge_c_id, edge_d_id,
        sheet_materials ( name )
      )
    `
    )
    .eq('tenant_id', tenantId)
    .eq('id', quoteId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error || !data) {
    if (error) console.error('loadQuoteView', error.message)
    return null
  }

  const customers = data.customers as
    | { name?: string }
    | { name?: string }[]
    | null
  const customerName = Array.isArray(customers)
    ? customers[0]?.name
    : customers?.name

  const status = String(data.status ?? 'ordered')
  const gross = Number(data.final_total_gross ?? data.total_gross ?? 0)

  const { data: payRows } = await admin
    .from('quote_payments')
    .select('amount, void_reason, deleted_at')
    .eq('quote_id', quoteId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)

  const totalPaid = (payRows ?? [])
    .filter((p) => !p.void_reason)
    .reduce((s, p) => s + Number(p.amount ?? 0), 0)

  const remaining = quoteRemainingGross(gross, totalPaid)

  const materialEdgeByName = new Map<string, boolean>()
  for (const m of (data.quote_material_lines ?? []) as Array<
    Record<string, unknown>
  >) {
    const name = String(m.material_name ?? '')
      .trim()
      .toLowerCase()
    if (!name) continue
    const edged = Number(m.edge_length_m ?? 0) > 0
    if (edged) materialEdgeByName.set(name, true)
  }

  const panels = (data.quote_panels ?? []) as Array<Record<string, unknown>>
  const { lines, totalQty } = buildQuotePanelLines(panels, materialEdgeByName)

  let statusLabel = 'Feldolgozás alatt'
  let statusTone: CustomerOrderStatusView['statusTone'] = 'info'

  if (status === 'finished') {
    statusLabel = 'Átadva'
    statusTone = 'neutral'
  } else if (status === 'ready') {
    statusLabel = 'Kész, átvehető'
    statusTone = 'success'
  } else if (status === 'in_production') {
    statusLabel = 'Gyártásban'
    statusTone = 'info'
  } else if (status === 'ordered') {
    statusLabel = 'Megrendelve'
    statusTone = 'info'
  }

  const company = await loadCompany(admin, tenantId)
  const orderNumber =
    (data.order_number as string | null) ||
    (data.quote_number as string | null) ||
    '—'

  const showMoney = status === 'ready' || status === 'finished'
  const showItems = status === 'ready'

  const view: CustomerOrderStatusView = {
    kind: 'quote',
    orderNumber: String(orderNumber),
    customerFirstName: firstNameFromFull(customerName),
    statusLabel,
    statusTone,
    statusBody: '',
    dueNowGross: showMoney ? remaining : null,
    dueHint:
      showMoney && remaining > 0 && gross > 0
        ? `Rendelés összesen: ${formatStatusFt(gross)}`
        : null,
    depositGross: null,
    summaryLine:
      showItems && totalQty > 0 && lines.length >= 2
        ? `Összesen ${totalQty} db`
        : null,
    company,
    readyItems: showItems ? lines : [],
    waitingItems: [],
    steps: [],
    updatedAt: (data.updated_at as string | null) ?? null
  }
  return { view, customerId: (data.customer_id as string | null) ?? null }
}

/** Egy kérésen belül (metadata + oldal) egyszer fut. */
export const loadCustomerOrderStatusByToken = cache(loadByToken)

async function loadByToken(
  token: string
): Promise<CustomerOrderStatusView | null> {
  const clean = token.trim()
  if (!clean || clean.length > 64) return null

  const admin = createServiceClient()
  if (!admin) {
    console.error('loadCustomerOrderStatusByToken: no service role')
    return null
  }

  const LINK_BASE = 'id, tenant_id, kind, customer_special_order_id, quote_id, expires_at, revoked_at'
  let res = await admin
    .from('order_share_links')
    .select(`${LINK_BASE}, manual_order_id`)
    .eq('token', clean)
    .maybeSingle()
  // Migráció előtt nincs manual_order_id oszlop — a régi linkek ettől még működjenek.
  if (res.error?.message.includes('manual_order_id')) {
    res = (await admin.from('order_share_links').select(LINK_BASE).eq('token', clean).maybeSingle()) as typeof res
  }
  const { data: link, error } = res

  if (error) {
    console.error('order_share_links', error.message)
    return null
  }
  if (!link || link.revoked_at) return null
  if (new Date(link.expires_at as string).getTime() < Date.now()) return null

  const kind = link.kind as OrderShareKind
  const tenantId = link.tenant_id as string

  const orderId =
    kind === 'cso'
      ? (link.customer_special_order_id as string | null)
      : kind === 'manual'
        ? (link.manual_order_id as string | null)
        : (link.quote_id as string | null)
  if (!orderId) return null

  const [loaded, opening] = await Promise.all([
    kind === 'cso'
      ? loadCsoView(admin, tenantId, orderId)
      : kind === 'manual'
        ? loadManualView(admin, tenantId, orderId)
        : loadQuoteView(admin, tenantId, orderId),
    loadOpening(admin, tenantId)
  ])
  if (!loaded) return null

  // Amíg a rendelés nincs lezárva, a megnyitás frissen tartja a linket (lassú beszállító).
  const expiresMs = new Date(link.expires_at as string).getTime()
  if (loaded.view.statusTone !== 'neutral' && expiresMs - Date.now() < LINK_REFRESH_BEFORE_MS) {
    void admin
      .from('order_share_links')
      .update({ expires_at: new Date(Date.now() + LINK_TTL_MS).toISOString() })
      .eq('id', link.id as string)
      .then(({ error: e }) => e && console.error('order_share_links extend', e.message))
  }

  const review = await loadStatusReview(admin, {
    tenantId,
    linkId: link.id as string,
    token: clean,
    kind,
    orderId,
    customerId: loaded.customerId,
    tone: loaded.view.statusTone
  })
  return { ...loaded.view, ...opening, review }
}

const DAY_MS = 24 * 60 * 60 * 1000
const LINK_TTL_MS = 30 * DAY_MS
const LINK_REFRESH_BEFORE_MS = 7 * DAY_MS

export type InvalidOrderLink = {
  reason: 'expired' | 'closed'
  company: CustomerOrderStatusView['company']
}

/** Ismert, de lejárt / visszavont token → a bolt elérhetősége a hibaoldalon. */
export async function loadInvalidOrderLink(token: string): Promise<InvalidOrderLink | null> {
  const clean = token.trim()
  if (!clean || clean.length > 64) return null
  const admin = createServiceClient()
  if (!admin) return null
  const { data: link } = await admin
    .from('order_share_links')
    .select('tenant_id, revoked_at')
    .eq('token', clean)
    .maybeSingle()
  if (!link) return null
  return {
    reason: link.revoked_at ? 'closed' : 'expired',
    company: await loadCompany(admin, link.tenant_id as string)
  }
}
