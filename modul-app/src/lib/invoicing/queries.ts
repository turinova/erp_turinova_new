import type { SupabaseClient } from '@supabase/supabase-js'

import type {
  InvoiceListItem,
  InvoiceRow,
  InvoiceType
} from '@/lib/invoicing/types'

export type ListInvoicesParams = {
  page?: number
  limit?: number
  search?: string
  type?: InvoiceType | 'all'
  status?: string
  from?: string
  to?: string
  /** Szűrés forrásra: sale | opti_order | opti_quote */
  sourceType?: InvoiceListItem['related_source_type']
}

export async function listInvoices(
  supabase: SupabaseClient,
  tenantId: string,
  params: ListInvoicesParams = {}
): Promise<{ rows: InvoiceListItem[]; total: number; page: number; limit: number }> {
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.min(100, Math.max(1, params.limit ?? 25))
  const from = (page - 1) * limit
  const to = from + limit - 1

  let q = supabase
    .from('invoices')
    .select(
      `id, internal_number, provider_invoice_number, invoice_type,
       related_source_type, related_source_id, related_source_number,
       customer_name, gross_total, payment_status, payment_due_date, created_at,
       is_storno_of_invoice_id`,
      { count: 'exact' }
    )
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (params.type && params.type !== 'all') {
    q = q.eq('invoice_type', params.type)
  }
  if (params.sourceType) {
    q = q.eq('related_source_type', params.sourceType)
  }
  if (params.status && params.status !== 'all') {
    q = q.eq('payment_status', params.status)
  }
  if (params.from) q = q.gte('created_at', `${params.from}T00:00:00`)
  if (params.to) q = q.lte('created_at', `${params.to}T23:59:59`)
  const search = params.search?.trim()
  if (search) {
    q = q.or(
      `provider_invoice_number.ilike.%${search}%,internal_number.ilike.%${search}%,customer_name.ilike.%${search}%,related_source_number.ilike.%${search}%`
    )
  }

  const { data, error, count } = await q.range(from, to)
  if (error) {
    console.error('listInvoices', error.message)
    throw new Error('Nem sikerült betölteni a számlákat.')
  }

  const rows = (data ?? []).map((r) => ({
    ...r,
    gross_total: r.gross_total != null ? Number(r.gross_total) : null
  })) as InvoiceListItem[]

  return { rows, total: count ?? rows.length, page, limit }
}

/** Az oldalon lévő források összes bizonylata — kapcsolat / életút enrich. */
export async function listInvoicePeersForSources(
  supabase: SupabaseClient,
  tenantId: string,
  sourceKeys: { type: string; id: string }[]
): Promise<InvoiceListItem[]> {
  if (sourceKeys.length === 0) return []

  const ids = [...new Set(sourceKeys.map((s) => s.id).filter(Boolean))]
  if (ids.length === 0) return []

  const { data, error } = await supabase
    .from('invoices')
    .select(
      `id, internal_number, provider_invoice_number, invoice_type,
       related_source_type, related_source_id, related_source_number,
       customer_name, gross_total, payment_status, payment_due_date, created_at,
       is_storno_of_invoice_id`
    )
    .eq('tenant_id', tenantId)
    .in('related_source_id', ids)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    console.error('listInvoicePeersForSources', error.message)
    return []
  }

  return (data ?? []).map((r) => ({
    ...r,
    gross_total: r.gross_total != null ? Number(r.gross_total) : null
  })) as InvoiceListItem[]
}

/** Sztornó célok (is_storno_of) — ha az eredeti nincs a peers között. */
export async function listInvoicesByIds(
  supabase: SupabaseClient,
  tenantId: string,
  ids: string[]
): Promise<InvoiceListItem[]> {
  const unique = [...new Set(ids.filter(Boolean))]
  if (unique.length === 0) return []

  const { data, error } = await supabase
    .from('invoices')
    .select(
      `id, internal_number, provider_invoice_number, invoice_type,
       related_source_type, related_source_id, related_source_number,
       customer_name, gross_total, payment_status, payment_due_date, created_at,
       is_storno_of_invoice_id`
    )
    .eq('tenant_id', tenantId)
    .in('id', unique)
    .is('deleted_at', null)

  if (error) {
    console.error('listInvoicesByIds', error.message)
    return []
  }

  return (data ?? []).map((r) => ({
    ...r,
    gross_total: r.gross_total != null ? Number(r.gross_total) : null
  })) as InvoiceListItem[]
}

export async function getInvoice(
  supabase: SupabaseClient,
  tenantId: string,
  id: string
): Promise<InvoiceRow | null> {
  const { data, error } = await supabase
    .from('invoices')
    .select(
      `id, internal_number, provider_invoice_number, invoice_type,
       related_source_type, related_source_id, related_source_number,
       customer_name, customer_email, gross_total, payment_status,
       payment_due_date, fulfillment_date, is_storno_of_invoice_id,
       note, pdf_url, created_at`
    )
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    console.error('getInvoice', error.message)
    throw new Error('Nem sikerült betölteni a számlát.')
  }
  if (!data) return null
  return {
    ...data,
    gross_total: data.gross_total != null ? Number(data.gross_total) : null
  } as InvoiceRow
}

const INVOICE_LIST_SELECT = `id, internal_number, provider_invoice_number, invoice_type,
       related_source_type, related_source_id, related_source_number,
       customer_name, gross_total, payment_status, payment_due_date, created_at,
       is_storno_of_invoice_id`

function mapInvoiceListRows(
  data: Record<string, unknown>[] | null
): InvoiceListItem[] {
  return (data ?? []).map((r) => ({
    ...r,
    gross_total: r.gross_total != null ? Number(r.gross_total) : null
  })) as InvoiceListItem[]
}

/** Direkt + összevont (invoice_source_links) bizonylatok egy forráshoz. */
async function listInvoicesForSource(
  supabase: SupabaseClient,
  tenantId: string,
  sourceType: 'sale' | 'opti_order',
  sourceId: string
): Promise<InvoiceListItem[]> {
  const { data: direct, error } = await supabase
    .from('invoices')
    .select(INVOICE_LIST_SELECT)
    .eq('tenant_id', tenantId)
    .eq('related_source_type', sourceType)
    .eq('related_source_id', sourceId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('listInvoicesForSource', error.message)
  }

  const byId = new Map<string, InvoiceListItem>()
  for (const row of mapInvoiceListRows(direct as Record<string, unknown>[])) {
    byId.set(row.id, row)
  }

  const { data: links } = await supabase
    .from('invoice_source_links')
    .select('invoice_id')
    .eq('tenant_id', tenantId)
    .eq('source_type', sourceType)
    .eq('source_id', sourceId)

  const linkedIds = (links ?? [])
    .map((l) => l.invoice_id as string)
    .filter((id) => !byId.has(id))

  if (linkedIds.length > 0) {
    const { data: linked, error: linkedErr } = await supabase
      .from('invoices')
      .select(INVOICE_LIST_SELECT)
      .eq('tenant_id', tenantId)
      .in('id', linkedIds)
      .is('deleted_at', null)
    if (linkedErr) {
      console.error('listInvoicesForSource links', linkedErr.message)
    } else {
      for (const row of mapInvoiceListRows(
        linked as Record<string, unknown>[]
      )) {
        byId.set(row.id, row)
      }
    }
  }

  return [...byId.values()].sort((a, b) =>
    a.created_at < b.created_at ? 1 : -1
  )
}

export async function listInvoicesForSale(
  supabase: SupabaseClient,
  tenantId: string,
  saleId: string
): Promise<InvoiceListItem[]> {
  return listInvoicesForSource(supabase, tenantId, 'sale', saleId)
}

export async function listInvoicesForQuote(
  supabase: SupabaseClient,
  tenantId: string,
  quoteId: string
): Promise<InvoiceListItem[]> {
  return listInvoicesForSource(supabase, tenantId, 'opti_order', quoteId)
}
