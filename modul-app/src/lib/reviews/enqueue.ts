import type { SupabaseClient } from '@supabase/supabase-js'

import { getTenantReviewSettings } from '@/lib/reviews/settings'
import { computeThankSmsSendAfter } from '@/lib/reviews/thank-sms'

/**
 * Átadáskor: köszönő SMS ütemezése, ha be van kapcsolva és a vevő hozzájárult.
 * Soha nem dob — az átadás nem bukhat el miatta.
 */
export async function enqueueReviewThankSms(
  supabase: SupabaseClient,
  input: {
    tenantId: string
    customerId: string | null
    quoteId?: string | null
    customerSpecialOrderId?: string | null
    userId?: string | null
  }
): Promise<void> {
  try {
    if (!input.customerId) return
    if (!input.quoteId && !input.customerSpecialOrderId) return

    const { settings, available } = await getTenantReviewSettings(supabase, input.tenantId)
    if (!available || !settings.thankSmsEnabled) return

    const { data: customer } = await supabase
      .from('customers')
      .select('review_sms_consent')
      .eq('id', input.customerId)
      .eq('tenant_id', input.tenantId)
      .maybeSingle()
    if (!customer?.review_sms_consent) return

    const handedOverAt = new Date()
    const { error } = await supabase.from('review_request_queue').insert({
      tenant_id: input.tenantId,
      customer_id: input.customerId,
      quote_id: input.quoteId ?? null,
      customer_special_order_id: input.customerSpecialOrderId ?? null,
      handed_over_at: handedOverAt.toISOString(),
      send_after: computeThankSmsSendAfter(handedOverAt, settings.thankSmsTiming).toISOString(),
      created_by: input.userId ?? null
    })
    // 23505 = már ütemezve (pl. részleges átadás második köre)
    if (error && error.code !== '23505') {
      console.error('enqueueReviewThankSms', error.message)
    }
  } catch (err) {
    console.error('enqueueReviewThankSms', err)
  }
}
