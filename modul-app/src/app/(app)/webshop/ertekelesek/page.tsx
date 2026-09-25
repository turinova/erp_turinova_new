import type { Metadata } from 'next'

import { WebshopReviewsClient } from '@/components/webshop/webshop-reviews-client'
import { getSessionUser } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { tenantHasWebshop } from '@/lib/webshop/entitlement'
import { listAdminReviews, type ReviewStatus } from '@/lib/webshop/reviews'

export const metadata: Metadata = { title: 'Értékelések' }

type PageProps = {
  searchParams: Promise<{ status?: string; page?: string }>
}

const STATUSES = new Set(['pending', 'approved', 'rejected', 'all'])

export default async function WebshopErtekelesekPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const status = (
    sp.status && STATUSES.has(sp.status) ? sp.status : 'pending'
  ) as ReviewStatus | 'all'
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1)

  const user = await getSessionUser()
  const canWrite = Boolean(user?.role && user.role !== 'viewer')

  if (!user?.tenantId || user.isDevSession) {
    return (
      <p className="text-body text-ink-secondary">
        Dev módban nincs tenant adatbázis.
      </p>
    )
  }

  const supabase = await createClient()
  if (!supabase) {
    return (
      <p className="text-body text-danger-ink">Adatbázis nem elérhető.</p>
    )
  }

  const entitled = await tenantHasWebshop(supabase, user.tenantId)
  if (!entitled) {
    return (
      <p className="text-body text-ink-secondary">
        Az Online bolt add-on nincs bekapcsolva.
      </p>
    )
  }

  const { rows, total, pendingCount } = await listAdminReviews(
    supabase,
    user.tenantId,
    { status, page }
  )

  return (
    <WebshopReviewsClient
      rows={rows}
      total={total}
      pendingCount={pendingCount}
      status={status}
      page={page}
      canWrite={canWrite}
    />
  )
}
