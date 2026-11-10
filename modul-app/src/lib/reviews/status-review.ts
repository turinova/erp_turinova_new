import type { SupabaseClient } from '@supabase/supabase-js'

import { googleReviewShortPath } from '@/lib/company/google-profile'
import type { OrderShareKind, OrderStatusReview, OrderStatusTone } from '@/lib/order-status/types'
import { getTenantReviewSettings } from '@/lib/reviews/settings'
import { resolveStatusReviewMode } from '@/lib/reviews/status-cta'

const DAY_MS = 24 * 60 * 60 * 1000

/** Volt-e már átvett rendelése a vevőnek (ezen kívül). */
async function isRepeatCustomer(
  admin: SupabaseClient,
  input: { tenantId: string; customerId: string; kind: OrderShareKind; orderId: string }
): Promise<boolean> {
  let quotes = admin
    .from('quotes')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', input.tenantId)
    .eq('customer_id', input.customerId)
    .eq('status', 'finished')
    .is('deleted_at', null)
  if (input.kind === 'quote') quotes = quotes.neq('id', input.orderId)

  let cso = admin
    .from('customer_special_orders')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', input.tenantId)
    .eq('customer_id', input.customerId)
    .not('sales_order_id', 'is', null)
    .is('deleted_at', null)
  if (input.kind === 'cso') cso = cso.neq('id', input.orderId)

  const [q, c] = await Promise.all([quotes, cso])
  return (q.count ?? 0) > 0 || (c.count ?? 0) > 0
}

/**
 * Státusz oldali értékelés-kérés kiszámítása (service role).
 * Bármilyen hiba / hiányzó migráció esetén null — a státusz oldal sosem törik miatta.
 */
export async function loadStatusReview(
  admin: SupabaseClient,
  input: {
    tenantId: string
    linkId: string
    token: string
    kind: OrderShareKind
    orderId: string
    customerId: string | null
    tone: OrderStatusTone
  }
): Promise<OrderStatusReview | null> {
  if (input.tone !== 'success' && input.tone !== 'neutral') return null
  try {
    const [{ settings, available }, companyRes] = await Promise.all([
      getTenantReviewSettings(admin, input.tenantId),
      admin
        .from('tenant_companies')
        .select('google_review_url, google_review_code')
        .eq('tenant_id', input.tenantId)
        .maybeSingle()
    ])
    const code = companyRes.data?.google_review_code ?? null
    const hasReviewUrl = Boolean(!companyRes.error && companyRes.data?.google_review_url && code)
    // Migráció nélkül is működjön az alapértelmezés (státusz oldal be).
    const enabled = available ? settings.statusPageEnabled : true
    if (!enabled || !hasReviewUrl) return null

    const since = new Date(Date.now() - settings.frequencyDays * DAY_MS).toISOString()
    const [thisLinkRes, recentRes, repeat] = await Promise.all([
      admin
        .from('google_review_link_clicks')
        .select('id', { count: 'exact', head: true })
        .eq('share_link_id', input.linkId),
      input.customerId
        ? admin
            .from('google_review_link_clicks')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', input.tenantId)
            .eq('customer_id', input.customerId)
            .gte('clicked_at', since)
        : Promise.resolve({ count: 0, error: null }),
      input.customerId && input.tone === 'success'
        ? isRepeatCustomer(admin, {
            tenantId: input.tenantId,
            customerId: input.customerId,
            kind: input.kind,
            orderId: input.orderId
          })
        : Promise.resolve(false)
    ])

    const clickedFromThisLink = !thisLinkRes.error && (thisLinkRes.count ?? 0) > 0
    const mode = resolveStatusReviewMode({
      enabled,
      hasReviewUrl,
      tone: input.tone,
      clickedFromThisLink,
      clickedRecently: !clickedFromThisLink && !recentRes.error && (recentRes.count ?? 0) > 0,
      isRepeatCustomer: repeat
    })
    if (!mode) return null

    const params = new URLSearchParams({ s: 'status', t: input.token })
    return { mode, href: `${googleReviewShortPath(code!)}?${params.toString()}` }
  } catch (err) {
    console.error('loadStatusReview', err)
    return null
  }
}
