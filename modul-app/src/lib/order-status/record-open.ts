import type { SupabaseClient } from '@supabase/supabase-js'

import { isLinkPreviewAgent } from '@/lib/company/google-profile'
import { createServiceClient } from '@/lib/supabase/service'

/** Prefetch / bot / üres UA → ne számítson megnyitásnak. */
export function shouldRecordOrderShareOpen(headerBag: {
  get(name: string): string | null
}): boolean {
  const purpose = headerBag.get('purpose')
  const secPurpose = headerBag.get('sec-purpose')
  if (purpose === 'prefetch') return false
  if (secPurpose?.includes('prefetch')) return false
  return !isLinkPreviewAgent(headerBag.get('user-agent'))
}

/**
 * Státusz oldal megnyitás napló — csak ha már ment kész-értesítő SMS.
 * Soha nem dob; after()-ből hívható.
 */
export async function recordOrderShareOpenByToken(
  token: string,
  headerBag: { get(name: string): string | null }
): Promise<void> {
  try {
    if (!shouldRecordOrderShareOpen(headerBag)) return
    const clean = token.trim()
    if (!clean || clean.length > 64) return

    const admin = createServiceClient()
    if (!admin) return

    const { data: link, error } = await admin
      .from('order_share_links')
      .select(
        'id, tenant_id, kind, quote_id, customer_special_order_id, revoked_at, expires_at'
      )
      .eq('token', clean)
      .maybeSingle()

    if (error || !link || link.revoked_at) return
    if (new Date(link.expires_at as string).getTime() < Date.now()) return

    const smsSent = await orderHasReadySmsSent(admin, {
      tenantId: link.tenant_id as string,
      kind: link.kind as 'quote' | 'cso',
      quoteId: (link.quote_id as string | null) ?? null,
      csoId: (link.customer_special_order_id as string | null) ?? null
    })
    if (!smsSent) return

    const { error: updateError } = await admin.rpc('touch_order_share_open', {
      p_link_id: link.id
    })

    if (updateError) {
      // Migráció előtt: függvény / oszlopok hiányozhatnak — csendben kihagyjuk.
      if (
        !/touch_order_share_open|first_opened_at|open_count|last_opened_at|schema cache/i.test(
          updateError.message
        )
      ) {
        console.error('recordOrderShareOpenByToken', updateError.message)
      }
    }
  } catch (err) {
    console.error('recordOrderShareOpenByToken', err)
  }
}

async function orderHasReadySmsSent(
  admin: SupabaseClient,
  input: {
    tenantId: string
    kind: 'quote' | 'cso'
    quoteId: string | null
    csoId: string | null
  }
): Promise<boolean> {
  if (input.kind === 'quote' && input.quoteId) {
    const { data } = await admin
      .from('quotes')
      .select('ready_notification_sent_at')
      .eq('id', input.quoteId)
      .eq('tenant_id', input.tenantId)
      .maybeSingle()
    return Boolean(data?.ready_notification_sent_at)
  }
  if (input.kind === 'cso' && input.csoId) {
    const { data } = await admin
      .from('customer_special_orders')
      .select('sms_sent_at')
      .eq('id', input.csoId)
      .eq('tenant_id', input.tenantId)
      .maybeSingle()
    return Boolean(data?.sms_sent_at)
  }
  return false
}

/** Élő share link első megnyitása (detail UI). Migráció előtt null. */
export async function getOrderShareFirstOpenedAt(
  supabase: SupabaseClient,
  input: {
    tenantId: string
    kind: 'quote' | 'cso'
    refId: string
  }
): Promise<string | null> {
  let query = supabase
    .from('order_share_links')
    .select('first_opened_at')
    .eq('tenant_id', input.tenantId)
    .eq('kind', input.kind)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .limit(1)

  query =
    input.kind === 'cso'
      ? query.eq('customer_special_order_id', input.refId)
      : query.eq('quote_id', input.refId)

  const { data, error } = await query.maybeSingle()
  if (error) {
    if (!/first_opened_at/i.test(error.message)) {
      console.error('getOrderShareFirstOpenedAt', error.message)
    }
    return null
  }
  return (data?.first_opened_at as string | null) ?? null
}

/** Megrendelés info SMS sor szövege. */
export function formatReadySmsInfoLine(input: {
  sentAt: string | null
  firstOpenedAt: string | null
  formatDateTime: (iso: string) => string
}): string {
  if (!input.sentAt) return 'még nem ment ki'
  const sent = `elküldve ${input.formatDateTime(input.sentAt)}`
  if (!input.firstOpenedAt) return `${sent} · még nem nyitotta meg`
  return `${sent} · megnyitva ${input.formatDateTime(input.firstOpenedAt)}`
}
