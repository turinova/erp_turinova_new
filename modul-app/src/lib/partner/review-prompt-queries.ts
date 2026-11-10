import type { SupabaseClient } from '@supabase/supabase-js'

import { googleReviewShortPath } from '@/lib/company/google-profile'
import { appOrigin } from '@/lib/order-status/format'
import {
  partnerReviewVariant,
  shouldShowPartnerReviewCard,
  type PartnerReviewPrompt
} from '@/lib/partner/review-prompt'
import { getTenantReviewSettings } from '@/lib/reviews/settings'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * Partner kezdőlap értékelő kártya. null = nem mutatjuk (vagy hiba / migráció előtt).
 * A bolt beállításait service role olvassa: a partner nem fér a tenant_review_settings-hez.
 */
export async function loadPartnerReviewPrompt(
  supabase: SupabaseClient,
  input: {
    partnerId: string
    tenantId: string
    mustSetPassword: boolean
  }
): Promise<Omit<PartnerReviewPrompt, 'companyName'> | null> {
  if (input.mustSetPassword) return null
  const admin = createServiceClient()
  if (!admin) return null

  try {
    const [{ settings, available }, companyRes, ordersRes, promptRes] = await Promise.all([
      getTenantReviewSettings(admin, input.tenantId),
      admin
        .from('tenant_companies')
        .select('google_review_url, google_review_code')
        .eq('tenant_id', input.tenantId)
        .maybeSingle(),
      supabase
        .from('quotes')
        .select('quote_number, order_number, finished_at', { count: 'exact' })
        .eq('partner_profile_id', input.partnerId)
        .eq('tenant_id', input.tenantId)
        .eq('status', 'finished')
        .is('deleted_at', null)
        .order('finished_at', { ascending: false, nullsFirst: false })
        .limit(1),
      supabase
        .from('partner_review_prompts')
        .select('clicked_at, self_reported_at, dismissed_at, dismiss_count')
        .eq('partner_user_id', input.partnerId)
        .eq('tenant_id', input.tenantId)
        .maybeSingle()
    ])

    // Migráció előtt (nincs prompt tábla) nem mutatunk kártyát: nem lehetne elrejteni.
    if (!available || promptRes.error || companyRes.error || ordersRes.error) {
      if (ordersRes.error) console.error('loadPartnerReviewPrompt orders', ordersRes.error.message)
      return null
    }

    const code = companyRes.data?.google_review_code
    const last = ordersRes.data?.[0] ?? null
    const finishedCount = ordersRes.count ?? 0
    const prompt = promptRes.data

    const show = shouldShowPartnerReviewCard({
      hasTenant: true,
      mustSetPassword: false,
      enabled: settings.partnerPortalEnabled,
      hasReviewUrl: Boolean(code && companyRes.data?.google_review_url),
      finishedCount,
      lastFinishedAt: last?.finished_at ?? null,
      clickedAt: prompt?.clicked_at ?? null,
      selfReportedAt: prompt?.self_reported_at ?? null,
      dismissedAt: prompt?.dismissed_at ?? null,
      dismissCount: prompt?.dismiss_count ?? 0,
      frequencyDays: settings.frequencyDays
    })
    if (!show || !code) return null

    return {
      href: `${appOrigin()}${googleReviewShortPath(code)}?s=partner`,
      tenantId: input.tenantId,
      variant: partnerReviewVariant(finishedCount),
      finishedCount,
      lastOrder: last?.finished_at
        ? {
            number: String(last.order_number || last.quote_number),
            finishedAt: last.finished_at
          }
        : null
    }
  } catch (err) {
    console.error('loadPartnerReviewPrompt', err)
    return null
  }
}
