import type { SupabaseClient } from '@supabase/supabase-js'

import { googleReviewShortPath } from '@/lib/company/google-profile'
import type { HandoverSlipReviewQr } from '@/lib/handover-slip/types'
import { appOrigin } from '@/lib/order-status/format'
import { getTenantReviewSettings } from '@/lib/reviews/settings'

export function handoverReviewQrUrl(code: string): string {
  return `${appOrigin()}${googleReviewShortPath(code)}?s=qr`
}

/** Átvételi blokk QR adat — null, ha ki van kapcsolva vagy nincs értékelő link. */
export async function loadHandoverReviewQr(
  supabase: SupabaseClient,
  tenantId: string
): Promise<HandoverSlipReviewQr | null> {
  try {
    const [{ settings, available }, companyRes] = await Promise.all([
      getTenantReviewSettings(supabase, tenantId),
      supabase
        .from('tenant_companies')
        .select('google_review_url, google_review_code')
        .eq('tenant_id', tenantId)
        .maybeSingle()
    ])
    if (!available || !settings.handoverQrEnabled) return null
    const code = companyRes.data?.google_review_code
    if (companyRes.error || !code || !companyRes.data?.google_review_url) return null
    return { url: handoverReviewQrUrl(code), text: settings.handoverQrText }
  } catch (err) {
    console.error('loadHandoverReviewQr', err)
    return null
  }
}
