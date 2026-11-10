import type { SupabaseClient } from '@supabase/supabase-js'

import { REVIEW_THANKS_TEMPLATE_KEY } from '@/lib/sms/types'

export type ReviewClickStats = {
  total: number
  status: number
  qr: number
  sms: number
  partner: number
  other: number
}

export type PartnerReviewStats = {
  /** Partnerek, akik a kezdőlapon jelezték: „Már írtam”. */
  selfReported: number
  /** null = a 20261007 migráció még nincs lefuttatva. */
  available: boolean
}

export type ReviewThankSmsStats = {
  sent30d: number
  consentCustomers: number
  pending: number
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Kattintások forrás szerint az utolsó 30 napban (head count-ok, nincs sorletöltés). */
export async function getReviewClickStats(
  supabase: SupabaseClient,
  tenantId: string
): Promise<ReviewClickStats> {
  const since = new Date(Date.now() - 30 * DAY_MS).toISOString()
  const count = (source?: string) => {
    let q = supabase
      .from('google_review_link_clicks')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('clicked_at', since)
    if (source) q = q.eq('source', source)
    return q
  }
  const [total, status, qr, sms, partner] = await Promise.all([
    count(),
    count('status'),
    count('qr'),
    count('sms'),
    count('partner')
  ])
  const n = (r: { count: number | null; error: unknown }) => (r.error ? 0 : (r.count ?? 0))
  const t = n(total)
  const s = n(status)
  const q = n(qr)
  const m = n(sms)
  const p = n(partner)
  return {
    total: t,
    status: s,
    qr: q,
    sms: m,
    partner: p,
    other: Math.max(0, t - s - q - m - p)
  }
}

export async function getPartnerReviewStats(
  supabase: SupabaseClient,
  tenantId: string
): Promise<PartnerReviewStats> {
  const { count, error } = await supabase
    .from('partner_review_prompts')
    .select('partner_user_id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .not('self_reported_at', 'is', null)
  if (error) return { selfReported: 0, available: false }
  return { selfReported: count ?? 0, available: true }
}

export async function getReviewThankSmsStats(
  supabase: SupabaseClient,
  tenantId: string
): Promise<ReviewThankSmsStats> {
  const since = new Date(Date.now() - 30 * DAY_MS).toISOString()
  const [sent, consent, pending] = await Promise.all([
    supabase
      .from('sms_send_events')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('template_key', REVIEW_THANKS_TEMPLATE_KEY)
      .in('status', ['sent', 'delivered'])
      .gte('created_at', since),
    supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('review_sms_consent', true)
      .is('deleted_at', null),
    supabase
      .from('review_request_queue')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
  ])
  return {
    sent30d: sent.error ? 0 : (sent.count ?? 0),
    consentCustomers: consent.error ? 0 : (consent.count ?? 0),
    pending: pending.error ? 0 : (pending.count ?? 0)
  }
}
