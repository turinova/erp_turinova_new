import type { SupabaseClient } from '@supabase/supabase-js'

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
  customer_name: string
  customer_email: string | null
  customer_mobile: string | null
  production_machine_id: string | null
  production_machine_name: string | null
  production_date: string | null
  barcode: string | null
}

export type ListOrdersParams = {
  tenantId: string
  status?: OrderListStatusFilter
  q?: string
  machineId?: string
  productionDate?: string
  page?: number
  limit?: number
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
    .select(
      `
      id,
      quote_number,
      order_number,
      status,
      payment_status,
      project_name,
      total_gross,
      currency,
      updated_at,
      production_machine_id,
      production_date,
      barcode,
      customers ( name, email, mobile ),
      production_machines ( name )
    `,
      { count: 'exact' }
    )
    .eq('tenant_id', params.tenantId)
    .is('deleted_at', null)
    .not('order_number', 'is', null)

  if (status === 'all') {
    query = query.in('status', ORDER_STATUSES)
  } else {
    query = query.eq('status', status)
  }

  if (params.machineId) {
    query = query.eq('production_machine_id', params.machineId)
  }

  if (params.productionDate && /^\d{4}-\d{2}-\d{2}$/.test(params.productionDate)) {
    query = query.eq('production_date', params.productionDate)
  }

  const q = params.q?.trim()
  if (q) {
    const safe = q.replace(/[%_,]/g, '')
    if (safe) {
      const { data: customerMatches } = await supabase
        .from('customers')
        .select('id')
        .eq('tenant_id', params.tenantId)
        .is('deleted_at', null)
        .ilike('name', `%${safe}%`)
        .limit(100)

      const customerIds = (customerMatches ?? []).map((c) => c.id)
      const parts = [
        `order_number.ilike.%${safe}%`,
        `quote_number.ilike.%${safe}%`,
        `project_name.ilike.%${safe}%`,
        `barcode.ilike.%${safe}%`
      ]
      if (customerIds.length > 0) {
        parts.push(`customer_id.in.(${customerIds.join(',')})`)
      }
      query = query.or(parts.join(','))
    }
  }

  const { data, error, count } = await query
    .order('updated_at', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('listOrders', error.message)
    throw new Error('Nem sikerült betölteni a megrendeléseket.')
  }

  const rawRows = (data ?? []).filter((row) => Boolean(row.order_number))
  const quoteIds = rawRows.map((row) => row.id)
  const paidByQuote: Record<string, number> = {}

  if (quoteIds.length > 0) {
    const { data: paymentRows, error: paymentError } = await supabase
      .from('quote_payments')
      .select('quote_id, amount')
      .eq('tenant_id', params.tenantId)
      .in('quote_id', quoteIds)
      .is('deleted_at', null)

    if (paymentError) {
      console.error('listOrders payments', paymentError.message)
    } else {
      for (const p of paymentRows ?? []) {
        paidByQuote[p.quote_id] =
          (paidByQuote[p.quote_id] ?? 0) + (Number(p.amount) || 0)
      }
    }
  }

  const rows: OrderListItem[] = rawRows.map((row) => {
      const customers = row.customers as
        | { name: string; email: string | null; mobile: string | null }
        | { name: string; email: string | null; mobile: string | null }[]
        | null
      const customer = Array.isArray(customers) ? customers[0] : customers
      const machines = row.production_machines as
        | { name: string }
        | { name: string }[]
        | null
      const machine = Array.isArray(machines) ? machines[0] : machines

      return {
        id: row.id,
        quote_number: row.quote_number,
        order_number: row.order_number as string,
        status: row.status as QuoteStatus,
        payment_status: (row.payment_status ?? 'not_paid') as PaymentStatus,
        project_name: (row.project_name as string | null) ?? null,
        total_gross: Number(row.total_gross),
        total_paid: Math.round((paidByQuote[row.id] ?? 0) * 100) / 100,
        currency: row.currency,
        updated_at: row.updated_at,
        customer_name: customer?.name ?? '—',
        customer_email: customer?.email ?? null,
        customer_mobile: customer?.mobile ?? null,
        production_machine_id: row.production_machine_id ?? null,
        production_machine_name: machine?.name ?? null,
        production_date: row.production_date ?? null,
        barcode: row.barcode ?? null
      }
    })

  return { rows, total: count ?? 0, page, limit }
}
