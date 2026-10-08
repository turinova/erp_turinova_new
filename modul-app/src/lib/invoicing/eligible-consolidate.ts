import type { SupabaseClient } from '@supabase/supabase-js'

import { activeDocs } from '@/lib/invoicing/invoice-rules'
import type { InvoiceListItem } from '@/lib/invoicing/types'

export type ConsolidateSourceType = 'sale' | 'opti_order'

export type EligibleConsolidateSource = {
  sourceType: ConsolidateSourceType
  sourceId: string
  sourceNumber: string
  totalGross: number
  createdAt: string
  kindLabel: string
}

function hasActiveFinal(invoices: InvoiceListItem[]): boolean {
  return activeDocs(invoices).hasFinal
}

/** Források, amelyekhez már van élő végszámla (direct vagy összevont link). */
async function blockedSourceKeys(
  supabase: SupabaseClient,
  tenantId: string,
  sourceIds: string[]
): Promise<Set<string>> {
  const blocked = new Set<string>()
  if (sourceIds.length === 0) return blocked

  const { data: directs } = await supabase
    .from('invoices')
    .select(
      `id, invoice_type, related_source_type, related_source_id, is_storno_of_invoice_id`
    )
    .eq('tenant_id', tenantId)
    .in('related_source_id', sourceIds)
    .is('deleted_at', null)
    .limit(500)

  const bySource = new Map<string, InvoiceListItem[]>()
  for (const r of directs ?? []) {
    if (!r.related_source_id || !r.related_source_type) continue
    const key = `${r.related_source_type}:${r.related_source_id}`
    const arr = bySource.get(key) ?? []
    arr.push(r as InvoiceListItem)
    bySource.set(key, arr)
  }
  for (const [key, peers] of bySource) {
    if (hasActiveFinal(peers)) blocked.add(key)
  }

  const { data: links } = await supabase
    .from('invoice_source_links')
    .select('source_type, source_id, invoice_id')
    .eq('tenant_id', tenantId)
    .in('source_id', sourceIds)
    .limit(500)

  if (!links?.length) return blocked

  const invoiceIds = [...new Set(links.map((l) => l.invoice_id))]
  const { data: linkedInvs } = await supabase
    .from('invoices')
    .select('id, invoice_type, is_storno_of_invoice_id')
    .eq('tenant_id', tenantId)
    .in('id', invoiceIds)
    .is('deleted_at', null)

  const stornoOf = new Set(
    (linkedInvs ?? [])
      .filter((i) => i.invoice_type === 'sztorno' && i.is_storno_of_invoice_id)
      .map((i) => i.is_storno_of_invoice_id as string)
  )
  const activeFinalIds = new Set(
    (linkedInvs ?? [])
      .filter((i) => i.invoice_type === 'szamla' && !stornoOf.has(i.id))
      .map((i) => i.id)
  )

  for (const link of links) {
    if (activeFinalIds.has(link.invoice_id)) {
      blocked.add(`${link.source_type}:${link.source_id}`)
    }
  }

  return blocked
}

/**
 * Ügyfélhez tartozó, végszámlázható sale + opti_order sorok.
 * Sale: paid + nem confirmed/cancelled/returned.
 * Quote: paid + ordered|in_production|ready|finished.
 */
export async function listEligibleConsolidateSources(
  supabase: SupabaseClient,
  tenantId: string,
  customerId: string
): Promise<EligibleConsolidateSource[]> {
  if (!customerId) return []

  const [salesRes, quotesRes] = await Promise.all([
    supabase
      .from('sales_orders')
      .select('id, sale_number, total_gross, created_at, status, payment_status')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .eq('payment_status', 'paid')
      .is('deleted_at', null)
      .not('status', 'in', '(cancelled,returned,confirmed)')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('quotes')
      .select(
        'id, quote_number, order_number, final_total_gross, total_gross, updated_at, status, payment_status'
      )
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .eq('payment_status', 'paid')
      .is('deleted_at', null)
      .in('status', ['ordered', 'in_production', 'ready', 'finished'])
      .order('updated_at', { ascending: false })
      .limit(50)
  ])

  if (salesRes.error) {
    console.error('listEligibleConsolidateSources sales', salesRes.error.message)
  }
  if (quotesRes.error) {
    console.error('listEligibleConsolidateSources quotes', quotesRes.error.message)
  }

  const sales = salesRes.data ?? []
  const quotes = quotesRes.data ?? []
  const allIds = [
    ...sales.map((s) => s.id as string),
    ...quotes.map((q) => q.id as string)
  ]
  const blocked = await blockedSourceKeys(supabase, tenantId, allIds)

  const out: EligibleConsolidateSource[] = []

  for (const s of sales) {
    const key = `sale:${s.id}`
    if (blocked.has(key)) continue
    out.push({
      sourceType: 'sale',
      sourceId: s.id as string,
      sourceNumber: (s.sale_number as string) || '—',
      totalGross: Number(s.total_gross) || 0,
      createdAt: s.created_at as string,
      kindLabel: 'Értékesítés'
    })
  }

  for (const q of quotes) {
    const key = `opti_order:${q.id}`
    if (blocked.has(key)) continue
    const num =
      (q.order_number as string | null)?.trim() ||
      (q.quote_number as string) ||
      '—'
    out.push({
      sourceType: 'opti_order',
      sourceId: q.id as string,
      sourceNumber: num,
      totalGross: Number(q.final_total_gross ?? q.total_gross) || 0,
      createdAt: q.updated_at as string,
      kindLabel: 'Lapszabászat'
    })
  }

  out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  return out
}

/** Van-e aktív végszámla (direkt vagy összevont link) a forráson. */
export async function sourceHasActiveFinalInvoice(
  supabase: SupabaseClient,
  tenantId: string,
  sourceType: ConsolidateSourceType,
  sourceId: string
): Promise<boolean> {
  const blocked = await blockedSourceKeys(supabase, tenantId, [sourceId])
  return blocked.has(`${sourceType}:${sourceId}`)
}

export async function listInvoiceSourceLinks(
  supabase: SupabaseClient,
  tenantId: string,
  invoiceId: string
): Promise<
  {
    sourceType: ConsolidateSourceType
    sourceId: string
    sourceNumber: string | null
  }[]
> {
  const { data, error } = await supabase
    .from('invoice_source_links')
    .select('source_type, source_id, source_number')
    .eq('tenant_id', tenantId)
    .eq('invoice_id', invoiceId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('listInvoiceSourceLinks', error.message)
    return []
  }

  return (data ?? []).map((r) => ({
    sourceType: r.source_type as ConsolidateSourceType,
    sourceId: r.source_id as string,
    sourceNumber: (r.source_number as string | null) ?? null
  }))
}
