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
import { quoteRemainingGross } from '@/lib/quotes/payment-labels'

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

async function loadCsoView(
  admin: NonNullable<ReturnType<typeof createServiceClient>>,
  tenantId: string,
  orderId: string
): Promise<CustomerOrderStatusView | null> {
  const { data, error } = await admin
    .from('customer_special_orders')
    .select(
      `
      id, order_number, customer_name, deposit_amount, status, updated_at,
      customer_special_order_items (
        id, name, qty, unit_shortform, unit_price_gross, status, deleted_at, sort_order
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

  const toLine = (i: Record<string, unknown>): OrderStatusLineItem => {
    const qty = Number(i.qty)
    const price =
      i.unit_price_gross != null ? Number(i.unit_price_gross) : null
    const amount =
      price != null && Number.isFinite(qty)
        ? Math.round(price * qty)
        : null
    return {
      id: String(i.id),
      name: String(i.name ?? 'Tétel'),
      qtyLabel: qtyLabel(qty, String(i.unit_shortform ?? 'db')),
      amountGross: amount
    }
  }

  const readyItems = items
    .filter((i) => i.status === 'itt_van')
    .map(toLine)
  const waitingItems = items
    .filter((i) => i.status === 'felveve' || i.status === 'rendelve')
    .map(toLine)
  const allDone =
    items.length > 0 &&
    items.every((i) => i.status === 'atadva' || i.status === 'torolve') &&
    items.some((i) => i.status === 'atadva')

  const readyGross = readyItems.reduce(
    (s, i) => s + (i.amountGross ?? 0),
    0
  )
  const deposit =
    data.deposit_amount != null ? Number(data.deposit_amount) : null
  const dueNow =
    readyItems.length > 0
      ? Math.max(0, readyGross - (deposit && deposit > 0 ? deposit : 0))
      : null

  let statusLabel = 'Feldolgozás alatt'
  let statusTone: CustomerOrderStatusView['statusTone'] = 'info'
  let statusBody = ''

  if (allDone) {
    statusLabel = 'Átadva'
    statusTone = 'neutral'
  } else if (readyItems.length > 0 && waitingItems.length > 0) {
    statusLabel = 'Részben átvehető'
    statusTone = 'warning'
    statusBody = `${readyItems.length} tétel kész, ${waitingItems.length} még úton.`
  } else if (readyItems.length > 0) {
    statusLabel = 'Átvehető'
    statusTone = 'success'
  } else if (waitingItems.length > 0) {
    statusLabel = 'Úton'
    statusTone = 'info'
  }

  const company = await loadCompany(admin, tenantId)

  return {
    kind: 'cso',
    orderNumber: String(data.order_number ?? '—'),
    customerFirstName: firstNameFromFull(data.customer_name as string),
    statusLabel,
    statusTone,
    statusBody,
    dueNowGross: dueNow,
    dueHint:
      deposit && deposit > 0 && readyItems.length > 0
        ? `Csak a kész tételek · előleg beszámítva (${formatStatusFt(deposit)})`
        : readyItems.length > 0 && waitingItems.length > 0
          ? 'Csak a kész tételek'
          : null,
    depositGross: deposit && deposit > 0 ? deposit : null,
    company,
    readyItems,
    waitingItems: waitingItems.map((i) => ({ ...i, amountGross: null })),
    steps: [],
    updatedAt: (data.updated_at as string | null) ?? null
  }
}

async function loadQuoteView(
  admin: NonNullable<ReturnType<typeof createServiceClient>>,
  tenantId: string,
  quoteId: string
): Promise<CustomerOrderStatusView | null> {
  const { data, error } = await admin
    .from('quotes')
    .select(
      `
      id, order_number, quote_number, status, payment_status,
      final_total_gross, total_gross, updated_at,
      customers ( name ),
      quote_material_lines ( id, material_name, boards_charged, charged_sqm )
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

  // total_paid: lean query — payment_status + remaining helper needs paid;
  // fetch sum from quote_payments if needed. Use remaining via simple select.
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

  const materials = (
    (data.quote_material_lines ?? []) as Array<Record<string, unknown>>
  ).map((m, idx) => {
    const boards = Number(m.boards_charged ?? 0)
    const sqm = Number(m.charged_sqm ?? 0)
    const parts = [
      boards > 0 ? `${boards} db` : null,
      sqm > 0 ? `${sqm.toFixed(2)} m²` : null
    ].filter(Boolean)
    return {
      id: String(m.id ?? idx),
      name: String(m.material_name ?? 'Anyag'),
      qtyLabel: parts.join(' · ') || '—',
      amountGross: null as number | null
    }
  })

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

  return {
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
    company,
    readyItems: status === 'ready' ? materials : [],
    waitingItems: [],
    steps: [],
    updatedAt: (data.updated_at as string | null) ?? null
  }
}

export async function loadCustomerOrderStatusByToken(
  token: string
): Promise<CustomerOrderStatusView | null> {
  const clean = token.trim()
  if (!clean || clean.length > 64) return null

  const admin = createServiceClient()
  if (!admin) {
    console.error('loadCustomerOrderStatusByToken: no service role')
    return null
  }

  const { data: link, error } = await admin
    .from('order_share_links')
    .select(
      'tenant_id, kind, customer_special_order_id, quote_id, expires_at, revoked_at'
    )
    .eq('token', clean)
    .maybeSingle()

  if (error) {
    console.error('order_share_links', error.message)
    return null
  }
  if (!link || link.revoked_at) return null
  if (new Date(link.expires_at as string).getTime() < Date.now()) return null

  const kind = link.kind as OrderShareKind
  const tenantId = link.tenant_id as string

  if (kind === 'cso' && link.customer_special_order_id) {
    return loadCsoView(admin, tenantId, link.customer_special_order_id as string)
  }
  if (kind === 'quote' && link.quote_id) {
    return loadQuoteView(admin, tenantId, link.quote_id as string)
  }
  return null
}
