import type { SupabaseClient } from '@supabase/supabase-js'

import {
  BACKLOG_MAX_AGE_DAYS,
  addDaysYmd,
  budapestTodayYmd,
  budapestYesterdayYmd
} from '@/lib/home/date'
import type { PaymentStatus } from '@/lib/quotes/payment-labels'
import type { QuoteStatus } from '@/lib/quotes/queries'

export type OrderListStatusFilter =
  | 'all'
  | 'ordered'
  | 'in_production'
  | 'ready'
  | 'finished'
  | 'cancelled'

export type OrderListItem = {
  id: string
  quote_number: string
  order_number: string
  status: QuoteStatus
  payment_status: PaymentStatus
  project_name: string | null
  total_gross: number
  total_paid: number
  currency: string
  updated_at: string
  customer_id: string | null
  customer_name: string
  customer_email: string | null
  customer_mobile: string | null
  production_machine_id: string | null
  production_machine_name: string | null
  production_date: string | null
  barcode: string | null
  archived_at: string | null
  /** Σ quote_material_lines.cutting_length_m */
  cutting_length_m: number
  /** Σ quote_material_lines.edge_length_m */
  edge_length_m: number
}

export type ListOrdersParams = {
  tenantId: string
  status?: OrderListStatusFilter
  q?: string
  machineId?: string
  productionDate?: string
  /**
   * Home Elmaradás KPI-val egyező ablak:
   * ordered|in_production, production_date ≤ tegnap, max BACKLOG_MAX_AGE_DAYS.
   * Felülírja a status / date szűrőt.
   */
  overdueOnly?: boolean
  /**
   * Nincs gyártási nap: ordered|in_production + production_date IS NULL.
   * Felülírja a status / date szűrőt.
   */
  unscheduledOnly?: boolean
  /**
   * Mai gyártási nap (BP): ordered|in_production + production_date = ma.
   * Felülírja a status / date szűrőt.
   */
  todayOnly?: boolean
  /** false (default): aktív lista; true: csak archív. */
  archivedOnly?: boolean
  page?: number
  limit?: number
}

const SHOP_FLOOR_STATUSES: QuoteStatus[] = ['ordered', 'in_production']

async function sumMetersForQuotes(
  supabase: SupabaseClient,
  quoteIds: string[]
): Promise<Map<string, { cutting: number; edge: number }>> {
  const map = new Map<string, { cutting: number; edge: number }>()
  if (quoteIds.length === 0) return map

  const { data, error } = await supabase
    .from('quote_material_lines')
    .select('quote_id, cutting_length_m, edge_length_m')
    .in('quote_id', quoteIds)

  if (error) {
    console.error('listOrders meters', error.message)
    return map
  }

  for (const row of data ?? []) {
    const id = row.quote_id as string
    const prev = map.get(id) ?? { cutting: 0, edge: 0 }
    prev.cutting += Number(row.cutting_length_m) || 0
    prev.edge += Number(row.edge_length_m) || 0
    map.set(id, prev)
  }
  return map
}

export type ListOrdersResult = {
  rows: OrderListItem[]
  total: number
  page: number
  limit: number
}

const ORDER_STATUSES: QuoteStatus[] = [
  'ordered',
  'in_production',
  'ready',
  'finished',
  'cancelled'
]

const ORDER_LIST_SELECT = `
  id,
  quote_number,
  order_number,
  status,
  payment_status,
  project_name,
  total_gross,
  final_total_gross,
  currency,
  updated_at,
  customer_id,
  production_machine_id,
  production_date,
  barcode,
  archived_at,
  customers ( name, email, mobile ),
  production_machines ( name )
`

/**
 * TS2589: nested embed + feltételes FilterBuilder-újraassign unió → depth overflow.
 * A select után erre a vékony felületre castolunk (nem `any`); a sorok lent
 * `OrderListItem`-re mapelődnek.
 */
type OrdersListQuery = {
  eq: (column: string, value: unknown) => OrdersListQuery
  is: (column: string, value: null) => OrdersListQuery
  not: (column: string, operator: string, value: unknown) => OrdersListQuery
  in: (column: string, values: readonly string[]) => OrdersListQuery
  lte: (column: string, value: string) => OrdersListQuery
  gte: (column: string, value: string) => OrdersListQuery
  or: (filters: string) => OrdersListQuery
  order: (
    column: string,
    options: { ascending: boolean; nullsFirst?: boolean }
  ) => OrdersListQuery
  range: (
    from: number,
    to: number
  ) => PromiseLike<{
    data: unknown[] | null
    error: { message: string } | null
    count: number | null
  }>
}

export async function listOrders(
  supabase: SupabaseClient,
  params: ListOrdersParams
): Promise<ListOrdersResult> {
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.min(50, Math.max(1, params.limit ?? 25))
  const from = (page - 1) * limit
  const to = from + limit - 1
  const status = params.status ?? 'ordered'

  let query = supabase
    .from('quotes')
    .select(ORDER_LIST_SELECT, { count: 'estimated' }) as unknown as OrdersListQuery

  query = query
    .eq('tenant_id', params.tenantId)
    .is('deleted_at', null)
    .not('order_number', 'is', null)

  if (params.archivedOnly) {
    query = query.not('archived_at', 'is', null)
  } else {
    query = query.is('archived_at', null)
  }

  if (params.overdueOnly) {
    const yesterday = budapestYesterdayYmd()
    const windowStart = addDaysYmd(budapestTodayYmd(), -BACKLOG_MAX_AGE_DAYS)
    query = query
      .in('status', SHOP_FLOOR_STATUSES)
      .not('production_date', 'is', null)
      .lte('production_date', yesterday)
      .gte('production_date', windowStart)
  } else if (params.unscheduledOnly) {
    query = query
      .in('status', SHOP_FLOOR_STATUSES)
      .is('production_date', null)
  } else if (params.todayOnly) {
    query = query
      .in('status', SHOP_FLOOR_STATUSES)
      .eq('production_date', budapestTodayYmd())
  } else if (status === 'all') {
    query = query.in('status', ORDER_STATUSES)
  } else {
    query = query.eq('status', status)
  }

  if (params.machineId) {
    query = query.eq('production_machine_id', params.machineId)
  }

  if (
    !params.overdueOnly &&
    !params.unscheduledOnly &&
    !params.todayOnly &&
    params.productionDate &&
    /^\d{4}-\d{2}-\d{2}$/.test(params.productionDate)
  ) {
    query = query.eq('production_date', params.productionDate)
  }

  const q = params.q?.trim()
  if (q) {
    const safe = q.replace(/[%_,]/g, '')
    if (safe) {
      const [{ data: customerMatches }, { data: materialMatches }] =
        await Promise.all([
          supabase
            .from('customers')
            .select('id')
            .eq('tenant_id', params.tenantId)
            .is('deleted_at', null)
            .ilike('name', `%${safe}%`)
            .limit(100),
          // Bútorlap / anyagnév az ajánlat snapshotján (RLS → tenant).
          supabase
            .from('quote_material_lines')
            .select('quote_id')
            .ilike('material_name', `%${safe}%`)
            .limit(200)
        ])

      const customerIds = (customerMatches ?? []).map((c) => c.id as string)
      const materialQuoteIds = [
        ...new Set(
          (materialMatches ?? []).map((r) => r.quote_id as string).filter(Boolean)
        )
      ]
      const parts = [
        `order_number.ilike.%${safe}%`,
        `quote_number.ilike.%${safe}%`,
        `project_name.ilike.%${safe}%`,
        `barcode.ilike.%${safe}%`
      ]
      if (customerIds.length > 0) {
        parts.push(`customer_id.in.(${customerIds.join(',')})`)
      }
      if (materialQuoteIds.length > 0) {
        parts.push(`id.in.(${materialQuoteIds.join(',')})`)
      }
      query = query.or(parts.join(','))
    }
  }

  const shopFloorSort =
    params.overdueOnly ||
    params.unscheduledOnly ||
    params.todayOnly ||
    status === 'ordered' ||
    status === 'in_production'

  // Gyártás nézet: nap ASC (üres végén), majd frissítés. Iroda: updated_at DESC.
  const ordered = shopFloorSort
    ? query
        .order('production_date', { ascending: true, nullsFirst: false })
        .order('updated_at', { ascending: false })
    : query.order('updated_at', { ascending: false })

  const { data, error, count } = await ordered.range(from, to)

  if (error) {
    console.error('listOrders', error.message)
    throw new Error('Nem sikerült betölteni a megrendeléseket.')
  }

  type OrderListDbRow = {
    id: string
    quote_number: string
    order_number: string | null
    status: string
    payment_status: string | null
    project_name: string | null
    total_gross: number
    final_total_gross: number | null
    currency: string
    updated_at: string
    customer_id: string | null
    production_machine_id: string | null
    production_date: string | null
    barcode: string | null
    archived_at: string | null
    customers:
      | { name: string; email: string | null; mobile: string | null }
      | { name: string; email: string | null; mobile: string | null }[]
      | null
    production_machines: { name: string } | { name: string }[] | null
  }

  const rawRows = ((data ?? []) as OrderListDbRow[]).filter((row) =>
    Boolean(row.order_number)
  )
  const quoteIds = rawRows.map((row) => row.id)
  const paidByQuote: Record<string, number> = {}
  let metersByQuote = new Map<string, { cutting: number; edge: number }>()

  if (quoteIds.length > 0) {
    const [paymentsRes, meters] = await Promise.all([
      supabase
        .from('quote_payments')
        .select('quote_id, amount')
        .eq('tenant_id', params.tenantId)
        .in('quote_id', quoteIds)
        .is('deleted_at', null),
      sumMetersForQuotes(supabase, quoteIds)
    ])
    metersByQuote = meters

    if (paymentsRes.error) {
      console.error('listOrders payments', paymentsRes.error.message)
    } else {
      for (const p of paymentsRes.data ?? []) {
        paidByQuote[p.quote_id] =
          (paidByQuote[p.quote_id] ?? 0) + (Number(p.amount) || 0)
      }
    }
  }

  const rows: OrderListItem[] = rawRows.map((row) => {
    const customers = row.customers
    const customer = Array.isArray(customers) ? customers[0] : customers
    const machines = row.production_machines
    const machine = Array.isArray(machines) ? machines[0] : machines
    const meters = metersByQuote.get(row.id) ?? { cutting: 0, edge: 0 }

    return {
      id: row.id,
      quote_number: row.quote_number,
      order_number: row.order_number as string,
      status: row.status as QuoteStatus,
      payment_status: (row.payment_status ?? 'not_paid') as PaymentStatus,
      project_name: row.project_name ?? null,
      total_gross: Number(row.final_total_gross ?? row.total_gross),
      total_paid: Math.round(paidByQuote[row.id] ?? 0),
      currency: row.currency,
      updated_at: row.updated_at,
      customer_id: row.customer_id ?? null,
      customer_name: customer?.name ?? '—',
      customer_email: customer?.email ?? null,
      customer_mobile: customer?.mobile ?? null,
      production_machine_id: row.production_machine_id ?? null,
      production_machine_name: machine?.name ?? null,
      production_date: row.production_date ?? null,
      barcode: row.barcode ?? null,
      archived_at: row.archived_at ?? null,
      cutting_length_m: Math.round(meters.cutting * 10) / 10,
      edge_length_m: Math.round(meters.edge * 10) / 10
    }
  })

  return { rows, total: count ?? 0, page, limit }
}
