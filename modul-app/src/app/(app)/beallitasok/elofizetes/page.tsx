import type { Metadata } from 'next'

import { SubscriptionOverview } from '@/components/billing/subscription-overview'
import { PageHeaderWithNav as PageHeader } from '@/components/patterns/page-header-with-nav'
import { requireTenantOwnerPage } from '@/lib/billing/require-owner'
import { getTenantSubscriptionOverview } from '@/lib/billing/subscription-overview'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Előfizetés'
}

export default async function SubscriptionPage() {
  const user = await requireTenantOwnerPage()

  let loadError: string | null = null
  let overview: Awaited<ReturnType<typeof getTenantSubscriptionOverview>> | null =
    null

  if (user.tenantId && !user.isDevSession) {
    const supabase = await createClient()
    if (!supabase) {
      loadError = 'Az adatbázis kapcsolat nem elérhető.'
    } else {
      try {
        overview = await getTenantSubscriptionOverview(supabase, user.tenantId)
      } catch (err) {
        loadError =
          err instanceof Error
            ? err.message
            : 'Nem sikerült betölteni az előfizetést.'
      }
    }
  } else if (user.isDevSession) {
    loadError =
      'Dev bypass módban nincs tenant adatbázis. Kapcsold be a Supabase env-et.'
  } else {
    loadError = 'Nincs aktív céged.'
  }

  if (loadError || !overview) {
    return (
      <div className="space-y-3">
        <h1 className="text-h1 text-ink">Előfizetés</h1>
        <p
          className="max-w-xl rounded-md border border-danger/30 bg-danger-soft p-3 text-body text-danger-ink"
          role="alert"
        >
          {loadError ?? 'Nem sikerült betölteni az előfizetést.'}
        </p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Előfizetés" />
      <div className="mt-4">
        <SubscriptionOverview
          billingStatus={overview.billingStatus}
          trialEndsAt={overview.trialEndsAt}
          paidThrough={overview.paidThrough}
          planName={overview.plan?.name ?? null}
          addons={overview.addons}
          smsUsage={overview.smsUsage}
        />
      </div>
    </div>
  )
}
