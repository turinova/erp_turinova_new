import type { SupabaseClient } from '@supabase/supabase-js'

import type { PaymentStatus } from '@/lib/quotes/payment-labels'
import type { QuoteStatus } from '@/lib/quotes/queries'

export type PartnerQuoteListItem = {
  id: string
  quote_number: string
  order_number: string | null
  status: QuoteStatus
  payment_status: PaymentStatus
  production_date: string | null
  project_name: string | null
  total_gross: number
  currency: string
  updated_at: string
  portal_submitted_at: string | null
  panel_quantity: number
  company_name: string | null
}

export type PartnerQuoteListResult = {
  rows: PartnerQuoteListItem[]
  total: number
  page: number
  limit: number
}

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
  project_name,
  total_gross,
  currency,
  updated_at,
  portal_submitted_at,
  tenant_id,
  quote_panels ( quantity )
`

type QuoteRow = {
  id: string
  quote_number: string
  order_number: string | null
  status: string
  payment_status: string | null
  production_date: string | null
  project_name: string | null
  total_gross: number | string
  currency: string
  updated_at: string
  portal_submitted_at: string | null
  tenant_id: string
  quote_panels: Array<{ quantity: number }> | null
}

function mapRow(
  row: QuoteRow,
  companyByTenant: Map<string, string>
): PartnerQuoteListItem {
  const panels = row.quote_panels ?? []
  const panel_quantity = panels.reduce(
    (sum, p) => sum + (Number(p.quantity) || 0),
    0
  )
  return {
    id: row.id,
    quote_number: row.quote_number,
    order_number: row.order_number,
    status: row.status as QuoteStatus,
    payment_status: (row.payment_status ?? 'not_paid') as PaymentStatus,
    production_date: row.production_date ?? null,
    project_name: row.project_name ?? null,
    total_gross: Number(row.total_gross),
    currency: row.currency,
    updated_at: row.updated_at,
    portal_submitted_at: row.portal_submitted_at,
    panel_quantity,
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

  const q = params.q?.trim()
  if (q) {
    const safe = q.replace(/[%_,]/g, '')
    if (safe) {
      query = query.or(
        `quote_number.ilike.%${safe}%,project_name.ilike.%${safe}%`
      )
    }
  }

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
    rows: rowsRaw.map((row) => mapRow(row, companies)),
    total: count ?? 0,
    page,
    limit
  }
}

/** Beküldött portal ajánlatok / megrendelések (partner nézet). */
export async function listPartnerSubmittedQuotes(
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
    .not('portal_submitted_at', 'is', null)
    .is('deleted_at', null)

  const q = params.q?.trim()
  if (q) {
    const safe = q.replace(/[%_,]/g, '')
    if (safe) {
      query = query.or(
        `quote_number.ilike.%${safe}%,order_number.ilike.%${safe}%,project_name.ilike.%${safe}%`
      )
    }
  }

  const { data, error, count } = await query
    .order('portal_submitted_at', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('listPartnerSubmittedQuotes', error.message)
    throw new Error('Nem sikerült betölteni a megrendeléseket.')
  }

  const rowsRaw = (data ?? []) as QuoteRow[]
  const companies = await resolveCompanyNames(
    supabase,
    rowsRaw.map((r) => r.tenant_id)
  )

  return {
    rows: rowsRaw.map((row) => mapRow(row, companies)),
    total: count ?? 0,
    page,
    limit
  }
}
