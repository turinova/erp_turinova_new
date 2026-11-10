import type { Metadata } from 'next'

import { ReviewSettingsForm } from '@/components/reviews/review-settings-form'
import { getSessionUser } from '@/lib/auth/session'
import { googleReviewShortPath } from '@/lib/company/google-profile'
import { getTenantGoogleProfile } from '@/lib/company/queries'
import { appOrigin } from '@/lib/order-status/format'
import { tenantHasPartnerOrders } from '@/lib/home/partner-portal-inbox'
import {
  getPartnerReviewStats,
  getReviewClickStats,
  getReviewThankSmsStats
} from '@/lib/reviews/queries'
import { getTenantReviewSettings } from '@/lib/reviews/settings'
import { tenantHasAnySms } from '@/lib/sms/entitlement'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Google értékelések'
}

export default async function ReviewSettingsPage() {
  const user = await getSessionUser()
  const canWrite = Boolean(user?.role && user.role !== 'viewer')

  if (!user?.tenantId || user.isDevSession) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Google értékelések</h1>
        <p className="max-w-xl text-body text-ink-secondary">
          {user?.isDevSession
            ? 'Dev bypass módban nincs tenant adatbázis.'
            : 'Nincs aktív céged.'}
        </p>
      </div>
    )
  }

  const supabase = await createClient()
  if (!supabase) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Google értékelések</h1>
        <p className="text-body text-ink-secondary">Az adatbázis kapcsolat nem elérhető.</p>
      </div>
    )
  }

  const tenantId = user.tenantId
  const [review, google, clicks, thankSms, hasSms, hasPartnerPortal, partnerStats] =
    await Promise.all([
      getTenantReviewSettings(supabase, tenantId),
      getTenantGoogleProfile(supabase, tenantId),
      getReviewClickStats(supabase, tenantId),
      getReviewThankSmsStats(supabase, tenantId),
      tenantHasAnySms(supabase, tenantId),
      tenantHasPartnerOrders(supabase, tenantId),
      getPartnerReviewStats(supabase, tenantId)
    ])

  return (
    <ReviewSettingsForm
      initial={review.settings}
      available={review.available}
      canWrite={canWrite}
      google={{
        available: google.available,
        reviewUrl: google.reviewUrl,
        shortUrl: google.code ? `${appOrigin()}${googleReviewShortPath(google.code)}` : null
      }}
      clicks={clicks}
      thankSms={thankSms}
      hasSms={hasSms}
      hasPartnerPortal={hasPartnerPortal}
      partnerStats={partnerStats}
    />
  )
}
