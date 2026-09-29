import type { SupabaseClient } from '@supabase/supabase-js'

export type AgingBucket = 'current' | 'd1_30' | 'd31_60' | 'd61_90' | 'd90p'

export type ArRow = {
  id: string
  provider_invoice_number: string | null
  internal_number: string
  invoice_type: string
  customer_name: string | null
  customer_id: string | null
  related_source_type: string
  related_source_number: string | null
  gross_total: number
  paid_amount: number
  open_amount: number
  payment_due_date: string | null
  fulfillment_date: string | null
  bucket: AgingBucket
  days_overdue: number
}

export type AfaRow = {
  vat_percent: number
  line_net: number
  line_vat: number
  line_gross: number
  invoice_count: number
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function bucketFor(due: string | null, today: string): {
  bucket: AgingBucket
  days_overdue: number
} {
  if (!due || due >= today) return { bucket: 'current', days_overdue: 0 }
  const days = Math.floor(
    (new Date(today + 'T12:00:00').getTime() -
      new Date(due + 'T12:00:00').getTime()) /
      86400000
  )
  if (days <= 30) return { bucket: 'd1_30', days_overdue: days }
  if (days <= 60) return { bucket: 'd31_60', days_overdue: days }
  if (days <= 90) return { bucket: 'd61_90', days_overdue: days }
  return { bucket: 'd90p', days_overdue: days }
}

/** Nyitott kintlévőség (számla / előleg, nem díjbekérő, nem sztornó). */
export async function listAccountsReceivable(
  supabase: SupabaseClient,
  tenantId: string
): Promise<ArRow[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select(
      'id, provider_invoice_number, internal_number, invoice_type, customer_name, customer_id, related_source_type, related_source_number, gross_total, paid_amount, payment_due_date, fulfillment_date, payment_status'
    )
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .in('invoice_type', ['szamla', 'elolegszamla'])
    .neq('payment_status', 'fizetve')
    .order('payment_due_date', { ascending: true, nullsFirst: false })
    .limit(500)

  if (error) {
    console.error('listAccountsReceivable', error.message)
    return []
  }

  const today = todayIso()
  const rows: ArRow[] = []
  for (const r of data ?? []) {
    const gross = Number(r.gross_total) || 0
    const paid = Number(r.paid_amount) || 0
    const open = Math.max(0, Math.round(gross - paid))
    if (open <= 0) continue
    const { bucket, days_overdue } = bucketFor(r.payment_due_date, today)
    rows.push({
      id: r.id,
      provider_invoice_number: r.provider_invoice_number,
      internal_number: r.internal_number,
      invoice_type: r.invoice_type,
      customer_name: r.customer_name,
      customer_id: r.customer_id,
      related_source_type: r.related_source_type,
      related_source_number: r.related_source_number,
      gross_total: gross,
      paid_amount: paid,
      open_amount: open,
      payment_due_date: r.payment_due_date,
      fulfillment_date: r.fulfillment_date,
      bucket,
      days_overdue
    })
  }
  return rows
}

export function summarizeAging(rows: ArRow[]) {
  const sums: Record<AgingBucket, number> = {
    current: 0,
    d1_30: 0,
    d31_60: 0,
    d61_90: 0,
    d90p: 0
  }
  let total = 0
  let overdue = 0
  for (const r of rows) {
    sums[r.bucket] += r.open_amount
    total += r.open_amount
    if (r.bucket !== 'current') overdue += r.open_amount
  }
  return { sums, total, overdue, count: rows.length }
}

/** ÁFA összesítő teljesítés dátum szerint — díjbekérő kizárva. */
export async function listAfaSummary(
  supabase: SupabaseClient,
  tenantId: string,
  periodYm: string
): Promise<{ rows: AfaRow[]; invoiceCount: number }> {
  if (!/^\d{4}-\d{2}$/.test(periodYm)) {
    return { rows: [], invoiceCount: 0 }
  }
  const from = `${periodYm}-01`
  const [y, m] = periodYm.split('-').map(Number)
  const lastDay = new Date(y!, m!, 0).getDate()
  const to = `${periodYm}-${String(lastDay).padStart(2, '0')}`

  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('id, invoice_type')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .gte('fulfillment_date', from)
    .lte('fulfillment_date', to)
    .neq('invoice_type', 'dijbekero')

  if (error) {
    console.error('listAfaSummary invoices', error.message)
    return { rows: [], invoiceCount: 0 }
  }

  const ids = (invoices ?? []).map((i) => i.id)
  if (ids.length === 0) return { rows: [], invoiceCount: 0 }

  const stornoIds = new Set(
    (invoices ?? []).filter((i) => i.invoice_type === 'sztorno').map((i) => i.id)
  )

  const { data: lines, error: lineErr } = await supabase
    .from('invoice_lines')
    .select('invoice_id, vat_percent, line_net, line_vat, line_gross')
    .eq('tenant_id', tenantId)
    .in('invoice_id', ids)

  if (lineErr) {
    console.error('listAfaSummary lines', lineErr.message)
    return { rows: [], invoiceCount: ids.length }
  }

  const byVat = new Map<number, AfaRow>()
  const invoicesWithLines = new Set<string>()
  for (const l of lines ?? []) {
    invoicesWithLines.add(l.invoice_id)
    const sign = stornoIds.has(l.invoice_id) ? -1 : 1
    const pct = Number(l.vat_percent) || 0
    const cur = byVat.get(pct) ?? {
      vat_percent: pct,
      line_net: 0,
      line_vat: 0,
      line_gross: 0,
      invoice_count: 0
    }
    cur.line_net += sign * (Number(l.line_net) || 0)
    cur.line_vat += sign * (Number(l.line_vat) || 0)
    cur.line_gross += sign * (Number(l.line_gross) || 0)
    byVat.set(pct, cur)
  }

  // számlánként egyszer számoljuk a vat kulcs invoice_count-ját
  for (const row of byVat.values()) {
    row.invoice_count = invoicesWithLines.size
  }

  const rows = [...byVat.values()].sort((a, b) => a.vat_percent - b.vat_percent)
  return { rows, invoiceCount: ids.length }
}

export async function getFinanceDashboard(
  supabase: SupabaseClient,
  tenantId: string
) {
  const ar = await listAccountsReceivable(supabase, tenantId)
  const aging = summarizeAging(ar)
  const today = todayIso()
  const in7 = new Date()
  in7.setDate(in7.getDate() + 7)
  const in7Iso = in7.toISOString().slice(0, 10)

  const dueSoon = ar.filter(
    (r) =>
      r.payment_due_date &&
      r.payment_due_date >= today &&
      r.payment_due_date <= in7Iso
  )
  const dueSoonSum = dueSoon.reduce((s, r) => s + r.open_amount, 0)

  const periodYm = today.slice(0, 7)
  const afa = await listAfaSummary(supabase, tenantId, periodYm)

  const { count: agentErrorCount } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .not('agent_last_error', 'is', null)

  return {
    aging,
    dueSoonCount: dueSoon.length,
    dueSoonSum,
    periodYm,
    afaNet: afa.rows.reduce((s, r) => s + r.line_net, 0),
    afaVat: afa.rows.reduce((s, r) => s + r.line_vat, 0),
    afaGross: afa.rows.reduce((s, r) => s + r.line_gross, 0),
    afaInvoiceCount: afa.invoiceCount,
    agentErrorCount: agentErrorCount ?? 0
  }
}
