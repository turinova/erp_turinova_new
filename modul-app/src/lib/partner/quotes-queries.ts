import type { SupabaseClient } from '@supabase/supabase-js'

import { toBudapestYmdFromIso } from '@/lib/home/date'
import {
  quoteRemainingGross,
  type PaymentStatus
} from '@/lib/quotes/payment-labels'
import type { QuoteStatus } from '@/lib/quotes/queries'

export type PartnerQuoteListItem = {
  id: string
  tenant_id: string
  quote_number: string
  order_number: string | null
  status: QuoteStatus
  payment_status: PaymentStatus
  production_date: string | null
  ready_at: string | null
  finished_at: string | null
  project_name: string | null
  total_gross: number
  /** Befizetések összege (csak beküldött listán töltve). */
  total_paid: number
  /** Fizetendő hátralék; null = még nem esedékes (cég nem fogadta el / lemondva). */
  remaining_gross: number | null
  currency: string
  updated_at: string
  portal_submitted_at: string | null
  panel_quantity: number
  material_count: number
  company_name: string | null
}

export type PartnerQuoteListResult = {
  rows: PartnerQuoteListItem[]
  total: number
  page: number
  limit: number
}

/** Beküldött lista szűrő (URL `status`). */
export type PartnerOrderFilter =
  | 'open'
  | 'ready'
  | 'in_production'
  | 'due'
  | 'closed'
  | 'all'

export const PARTNER_ORDER_FILTERS: PartnerOrderFilter[] = [
  'open',
  'ready',
  'in_production',
  'due',
  'closed',
  'all'
]

export function parsePartnerOrderFilter(
  raw: string | undefined
): PartnerOrderFilter {
  return PARTNER_ORDER_FILTERS.includes(raw as PartnerOrderFilter)
    ? (raw as PartnerOrderFilter)
    : 'open'
}

const OPEN_STATUSES: QuoteStatus[] = [
  'draft',
  'ordered',
  'in_production',
  'ready'
]
const CLOSED_STATUSES: QuoteStatus[] = ['finished', 'cancelled']
/** Cég által elfogadott → fizetendő. */
const PAYABLE_STATUSES: QuoteStatus[] = [
  'ordered',
  'in_production',
  'ready',
  'finished'
]

type ListParams = {
  partnerId: string
  page?: number
  limit?: number
  q?: string
}

const SELECT = `
  id,
  quote_number,
  order_number,
  status,
  payment_status,
  production_date,
  ready_at,
  finished_at,
  project_name,
  total_gross,
  final_total_gross,
  currency,
  updated_at,
  portal_submitted_at,
  tenant_id,
  quote_panels ( quantity, sheet_material_id )
`

type QuoteRow = {
  id: string
  quote_number: string
  order_number: string | null
  status: string
  payment_status: string | null
  production_date: string | null
  ready_at: string | null
  finished_at: string | null
  project_name: string | null
  total_gross: number | string
  final_total_gross?: number | string | null
  currency: string
  updated_at: string
  portal_submitted_at: string | null
  tenant_id: string
  quote_panels: Array<{
    quantity: number
    sheet_material_id: string | null
  }> | null
}

function grossOf(row: {
  total_gross: number | string
  final_total_gross?: number | string | null
}): number {
  return Number(row.final_total_gross ?? row.total_gross) || 0
}

function isPayable(status: string): boolean {
  return PAYABLE_STATUSES.includes(status as QuoteStatus)
}

function mapRow(
  row: QuoteRow,
  companyByTenant: Map<string, string>,
  paidByQuote: Map<string, number> | null
): PartnerQuoteListItem {
  const panels = row.quote_panels ?? []
  const panel_quantity = panels.reduce(
    (sum, p) => sum + (Number(p.quantity) || 0),
    0
  )
  const material_count = new Set(
    panels.map((p) => p.sheet_material_id).filter(Boolean)
  ).size
  const total_gross = grossOf(row)
  const total_paid = paidByQuote?.get(row.id) ?? 0
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    quote_number: row.quote_number,
    order_number: row.order_number,
    status: row.status as QuoteStatus,
    payment_status: (row.payment_status ?? 'not_paid') as PaymentStatus,
    production_date: row.production_date ?? null,
    ready_at: row.ready_at ?? null,
    finished_at: row.finished_at ?? null,
    project_name: row.project_name ?? null,
    total_gross,
    total_paid,
    remaining_gross:
      paidByQuote && isPayable(row.status)
        ? quoteRemainingGross(total_gross, total_paid)
        : null,
    currency: row.currency,
    updated_at: row.updated_at,
    portal_submitted_at: row.portal_submitted_at,
    panel_quantity,
    material_count,
    company_name: companyByTenant.get(row.tenant_id) ?? null
  }
}

async function resolveCompanyNames(
  supabase: SupabaseClient,
  tenantIds: string[]
): Promise<Map<string, string>> {
  const unique = [...new Set(tenantIds.filter(Boolean))]
  const map = new Map<string, string>()
  if (unique.length === 0) return map

  const { data, error } = await supabase
    .from('tenants')
    .select('id, name')
    .in('id', unique)

  if (error) {
    console.error('resolveCompanyNames', error.message)
    return map
  }

  for (const row of data ?? []) {
    map.set(row.id, row.name)
  }
  return map
}

/** Σ befizetés quote-onként (RLS: quote_payments_select_own_partner). */
async function sumPaymentsByQuote(
  supabase: SupabaseClient,
  quoteIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (quoteIds.length === 0) return map

  const { data, error } = await supabase
    .from('quote_payments')
    .select('quote_id, amount')
    .in('quote_id', quoteIds)
    .is('deleted_at', null)

  if (error) {
    console.error('partner sumPaymentsByQuote', error.message)
    return map
  }
  for (const p of data ?? []) {
    map.set(p.quote_id, (map.get(p.quote_id) ?? 0) + (Number(p.amount) || 0))
  }
  return map
}

/** PostgREST `or` szűrő ilike kereséshez; null = nincs keresés. */
function searchFilter(q: string | undefined, fields: string[]): string | null {
  const safe = q?.trim().replace(/[%_,()]/g, '')
  if (!safe) return null
  return fields.map((f) => `${f}.ilike.%${safe}%`).join(',')
}

/** Mentett, még nem beküldött portal draftok. */
export async function listPartnerDraftQuotes(
  supabase: SupabaseClient,
  params: ListParams
): Promise<PartnerQuoteListResult> {
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.min(50, Math.max(1, params.limit ?? 25))
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabase
    .from('quotes')
    .select(SELECT, { count: 'exact' })
    .eq('partner_profile_id', params.partnerId)
    .eq('source', 'portal')
    .is('portal_submitted_at', null)
    .is('deleted_at', null)
    .eq('status', 'draft')

  const search = searchFilter(params.q, ['quote_number', 'project_name'])
  if (search) query = query.or(search)

  const { data, error, count } = await query
    .order('updated_at', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('listPartnerDraftQuotes', error.message)
    throw new Error('Nem sikerült betölteni az ajánlatokat.')
  }

  const rowsRaw = (data ?? []) as QuoteRow[]
  const companies = await resolveCompanyNames(
    supabase,
    rowsRaw.map((r) => r.tenant_id)
  )

  return {
    rows: rowsRaw.map((row) => mapRow(row, companies, null)),
    total: count ?? 0,
    page,
    limit
  }
}

/** Beküldött portal ajánlatok / megrendelések (partner nézet). */
export async function listPartnerSubmittedQuotes(
  supabase: SupabaseClient,
  params: ListParams & { filter?: PartnerOrderFilter }
): Promise<PartnerQuoteListResult> {
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.min(50, Math.max(1, params.limit ?? 25))
  const from = (page - 1) * limit
  const to = from + limit - 1
  const searching = Boolean(params.q?.trim())
  const filter: PartnerOrderFilter = searching ? 'all' : (params.filter ?? 'open')

  let query = supabase
    .from('quotes')
    .select(SELECT, { count: 'exact' })
    .eq('partner_profile_id', params.partnerId)
    .eq('source', 'portal')
    .not('portal_submitted_at', 'is', null)
    .is('deleted_at', null)

  switch (filter) {
    case 'open':
      query = query.in('status', OPEN_STATUSES)
      break
    case 'ready':
    case 'in_production':
      query = query.eq('status', filter)
      break
    case 'closed':
      query = query.in('status', CLOSED_STATUSES)
      break
    case 'due':
      query = query
        .in('status', PAYABLE_STATUSES)
        .in('payment_status', ['not_paid', 'partial'])
      break
    default:
      break
  }

  const search = searchFilter(params.q, [
    'quote_number',
    'order_number',
    'project_name'
  ])
  if (search) query = query.or(search)

  const ordered =
    filter === 'ready'
      ? query.order('ready_at', { ascending: false, nullsFirst: false })
      : query.order('portal_submitted_at', { ascending: false })

  const { data, error, count } = await ordered.range(from, to)

  if (error) {
    console.error('listPartnerSubmittedQuotes', error.message)
    throw new Error('Nem sikerült betölteni a megrendeléseket.')
  }

  const rowsRaw = (data ?? []) as QuoteRow[]
  const [companies, paid] = await Promise.all([
    resolveCompanyNames(
      supabase,
      rowsRaw.map((r) => r.tenant_id)
    ),
    sumPaymentsByQuote(
      supabase,
      rowsRaw.filter((r) => isPayable(r.status)).map((r) => r.id)
    )
  ])

  return {
    rows: rowsRaw.map((row) => mapRow(row, companies, paid)),
    total: count ?? 0,
    page,
    limit
  }
}

export type PartnerOrderKpis = {
  counts: Record<PartnerOrderFilter, number>
  /** Σ hátralék a fizetendő (elfogadott) rendeléseken. */
  dueGross: number
  /** Legközelebbi gyártási nap (ma vagy később), ordered / in_production. */
  nextProductionDate: string | null
  yearCount: number
  yearGross: number
  currency: string
}

const KPI_ROW_CAP = 2000

/** Partner beküldött rendelések összesítő — chip számok + KPI sáv. */
export async function getPartnerOrderKpis(
  supabase: SupabaseClient,
  partnerId: string
): Promise<PartnerOrderKpis> {
  const { data, error } = await supabase
    .from('quotes')
    .select(
      'id, status, payment_status, total_gross, final_total_gross, currency, portal_submitted_at, production_date'
    )
    .eq('partner_profile_id', partnerId)
    .eq('source', 'portal')
    .not('portal_submitted_at', 'is', null)
    .is('deleted_at', null)
    .limit(KPI_ROW_CAP)

  if (error) {
    console.error('getPartnerOrderKpis', error.message)
    throw new Error('Nem sikerült betölteni az összesítőt.')
  }

  const rows = (data ?? []) as Array<{
    id: string
    status: string
    payment_status: string | null
    total_gross: number | string
    final_total_gross: number | string | null
    currency: string
    portal_submitted_at: string
    production_date: string | null
  }>

  const today = toBudapestYmdFromIso(new Date().toISOString())
  const year = today.slice(0, 4)
  const counts: Record<PartnerOrderFilter, number> = {
    open: 0,
    ready: 0,
    in_production: 0,
    due: 0,
    closed: 0,
    all: rows.length
  }
  let nextProductionDate: string | null = null
  let yearCount = 0
  let yearGross = 0
  const dueRows: Array<{ id: string; gross: number }> = []

  for (const row of rows) {
    const status = row.status as QuoteStatus
    if (OPEN_STATUSES.includes(status)) counts.open += 1
    if (CLOSED_STATUSES.includes(status)) counts.closed += 1
    if (status === 'ready') counts.ready += 1
    if (status === 'in_production') counts.in_production += 1

    if (
      isPayable(status) &&
      (row.payment_status === 'not_paid' || row.payment_status === 'partial')
    ) {
      counts.due += 1
      dueRows.push({ id: row.id, gross: grossOf(row) })
    }

    if (
      (status === 'ordered' || status === 'in_production') &&
      row.production_date &&
      row.production_date >= today &&
      (!nextProductionDate || row.production_date < nextProductionDate)
    ) {
      nextProductionDate = row.production_date
    }

    if (
      status !== 'cancelled' &&
      toBudapestYmdFromIso(row.portal_submitted_at).startsWith(year)
    ) {
      yearCount += 1
      yearGross += grossOf(row)
    }
  }

  const paid = await sumPaymentsByQuote(
    supabase,
    dueRows.map((r) => r.id)
  )
  const dueGross = dueRows.reduce(
    (sum, r) => sum + quoteRemainingGross(r.gross, paid.get(r.id) ?? 0),
    0
  )

  return {
    counts,
    dueGross,
    nextProductionDate,
    yearCount,
    yearGross: Math.round(yearGross),
    currency: rows[0]?.currency ?? 'HUF'
  }
}

export type PartnerDraftKpis = {
  count: number
  totalGross: number
  oldestUpdatedAt: string | null
  currency: string
}

/** Beküldetlen ajánlatok összesítő. */
export async function getPartnerDraftKpis(
  supabase: SupabaseClient,
  partnerId: string
): Promise<PartnerDraftKpis> {
  const { data, error } = await supabase
    .from('quotes')
    .select('total_gross, final_total_gross, currency, updated_at')
    .eq('partner_profile_id', partnerId)
    .eq('source', 'portal')
    .is('portal_submitted_at', null)
    .is('deleted_at', null)
    .eq('status', 'draft')
    .limit(KPI_ROW_CAP)

  if (error) {
    console.error('getPartnerDraftKpis', error.message)
    throw new Error('Nem sikerült betölteni az összesítőt.')
  }

  const rows = (data ?? []) as Array<{
    total_gross: number | string
    final_total_gross: number | string | null
    currency: string
    updated_at: string
  }>

  let oldest: string | null = null
  let totalGross = 0
  for (const row of rows) {
    totalGross += grossOf(row)
    if (!oldest || row.updated_at < oldest) oldest = row.updated_at
  }

  return {
    count: rows.length,
    totalGross: Math.round(totalGross),
    oldestUpdatedAt: oldest,
    currency: rows[0]?.currency ?? 'HUF'
  }
}
