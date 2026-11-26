import type { SupabaseClient } from '@supabase/supabase-js'

import { budapestDayRangeIso, budapestTodayYmd } from '@/lib/home/date'

import type { ReviewCancelReason, ReviewQueueStatus } from '@/lib/reviews/queue-rules'

export const REVIEW_QUEUE_PAGE_SIZE = 25

export type ReviewQueueRow = {
  id: string
  status: ReviewQueueStatus
  customerId: string
  customerName: string
  customerMobile: string | null
  orderNumber: string | null
  orderHref: string | null
  handedOverAt: string
  sendAfter: string
  processedAt: string | null
  skipReason: string | null
  postponedCount: number
  cancelReason: ReviewCancelReason | null
  cancelNote: string | null
  cancelledAt: string | null
  opened: boolean
}

export type ReviewLogPeriod = 7 | 30 | 90
export type ReviewLogStatusFilter = 'all' | 'sent' | 'skipped' | 'cancelled' | 'failed'

export type ReviewQueueList = {
  rows: ReviewQueueRow[]
  total: number
  page: number
  /** false = a 20261026 migráció még nincs lefuttatva (halasztás/törlés nem elérhető). */
  manageAvailable: boolean
  /** false = a 20261004 migráció sincs (nincs sor tábla). */
  available: boolean
}

const BASE_SELECT =
  'id, status, customer_id, quote_id, customer_special_order_id, handed_over_at, send_after, processed_at, skip_reason, customer:customers(name, mobile), quote:quotes(order_number), cso:customer_special_orders(order_number)'
const MANAGE_SELECT = `${BASE_SELECT}, postponed_count, cancel_reason, cancel_note, cancelled_at`

type RawRow = {
  id: string
  status: string
  customer_id: string
  quote_id: string | null
  customer_special_order_id: string | null
  handed_over_at: string
  send_after: string
  processed_at: string | null
  skip_reason: string | null
  postponed_count?: number | null
  cancel_reason?: string | null
  cancel_note?: string | null
  cancelled_at?: string | null
  customer: { name: string | null; mobile: string | null } | null
  quote: { order_number: string | null } | null
  cso: { order_number: string | null } | null
}

export async function listReviewQueue(
  supabase: SupabaseClient,
  tenantId: string,
  opts: { mode: 'pending' } | { mode: 'log'; status: ReviewLogStatusFilter; days: ReviewLogPeriod },
  page: number
): Promise<ReviewQueueList> {
  const safePage = Math.max(1, Math.floor(page) || 1)
  const from = (safePage - 1) * REVIEW_QUEUE_PAGE_SIZE

  const build = (select: string) => {
    let q = supabase
      .from('review_request_queue')
      .select(select, { count: 'exact' })
      .eq('tenant_id', tenantId)
    if (opts.mode === 'pending') {
      q = q.eq('status', 'pending').order('send_after', { ascending: true })
    } else {
      q = q
        .neq('status', 'pending')
        .gte('handed_over_at', new Date(Date.now() - opts.days * 86_400_000).toISOString())
        .order('handed_over_at', { ascending: false })
      if (opts.status !== 'all') q = q.eq('status', opts.status)
    }
    return q.range(from, from + REVIEW_QUEUE_PAGE_SIZE - 1)
  }

  let manageAvailable = true
  let res = await build(MANAGE_SELECT)
  if (res.error?.code === '42703') {
    manageAvailable = false
    res = await build(BASE_SELECT)
  }
  if (res.error) {
    if (res.error.code !== '42P01') console.error('listReviewQueue', res.error.message)
    return { rows: [], total: 0, page: safePage, manageAvailable, available: false }
  }

  const raw = (res.data ?? []) as unknown as RawRow[]
  const opened = await openedCustomers(supabase, tenantId, raw)

  return {
    rows: raw.map((r) => ({
      id: r.id,
      status: r.status as ReviewQueueStatus,
      customerId: r.customer_id,
      customerName: r.customer?.name?.trim() || 'Ismeretlen vevő',
      customerMobile: r.customer?.mobile ?? null,
      orderNumber: r.quote?.order_number ?? r.cso?.order_number ?? null,
      orderHref: r.quote_id
        ? `/ajanlatok/${r.quote_id}`
        : r.customer_special_order_id
          ? `/ugyfelrendelesek/${r.customer_special_order_id}`
          : null,
      handedOverAt: r.handed_over_at,
      sendAfter: r.send_after,
      processedAt: r.processed_at,
      skipReason: r.skip_reason,
      postponedCount: r.postponed_count ?? 0,
      cancelReason: (r.cancel_reason as ReviewCancelReason | null) ?? null,
      cancelNote: r.cancel_note ?? null,
      cancelledAt: r.cancelled_at ?? null,
      opened: opened.has(`${r.customer_id}|${r.id}`)
    })),
    total: res.count ?? 0,
    page: safePage,
    manageAvailable,
    available: true
  }
}

/** Megnyitotta-e a linket az átadás óta (bármely csatornán). */
async function openedCustomers(
  supabase: SupabaseClient,
  tenantId: string,
  rows: RawRow[]
): Promise<Set<string>> {
  const out = new Set<string>()
  if (rows.length === 0) return out
  const ids = [...new Set(rows.map((r) => r.customer_id))]
  const oldest = rows.reduce((min, r) => (r.handed_over_at < min ? r.handed_over_at : min), rows[0]!.handed_over_at)
  const { data, error } = await supabase
    .from('google_review_link_clicks')
    .select('customer_id, clicked_at')
    .eq('tenant_id', tenantId)
    .in('customer_id', ids)
    .gte('clicked_at', oldest)
  if (error) return out
  for (const r of rows) {
    const hit = (data ?? []).some(
      (c) => c.customer_id === r.customer_id && (c.clicked_at as string) >= r.handed_over_at
    )
    if (hit) out.add(`${r.customer_id}|${r.id}`)
  }
  return out
}

export type ReviewFunnel = {
  handedOver: number
  smsSent: number
  opened: number
  newReviews: number | null
  pendingToday: number
  noConsentRecent: number
}

/** Utolsó 30 nap tölcsér + teendők (csak darabszámok). */
export async function getReviewFunnel(
  supabase: SupabaseClient,
  tenantId: string,
  newReviews: number | null
): Promise<ReviewFunnel> {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const { endIso: endOfToday } = budapestDayRangeIso(budapestTodayYmd())

  const [handed, sent, opened, pendingToday, noConsent] = await Promise.all([
    supabase
      .from('quotes')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .eq('status', 'finished')
      .gte('finished_at', since),
    supabase
      .from('review_request_queue')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'sent')
      .gte('processed_at', since),
    supabase
      .from('google_review_link_clicks')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('clicked_at', since),
    supabase
      .from('review_request_queue')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .lt('send_after', endOfToday),
    supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .eq('review_sms_consent', false)
      .gte('created_at', since)
  ])
  const n = (r: { count: number | null; error: unknown }) => (r.error ? 0 : (r.count ?? 0))
  return {
    handedOver: n(handed),
    smsSent: n(sent),
    opened: n(opened),
    newReviews,
    pendingToday: n(pendingToday),
    noConsentRecent: n(noConsent)
  }
}
