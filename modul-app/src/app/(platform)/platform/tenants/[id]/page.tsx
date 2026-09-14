import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { TenantDetailClient } from '@/components/platform/tenant-detail-client'
import { TenantEntitlementsPanel } from '@/components/platform/tenant-entitlements-panel'
import { requirePlatformAdmin } from '@/lib/platform/auth'
import {
  listProductPlans,
  getTenantEntitlementState
} from '@/lib/platform/entitlement-queries'
import { getPlatformTenantDetail } from '@/lib/platform/queries'

type Params = Promise<{ id: string }>

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Cég · Platform' }
}

export default async function PlatformTenantDetailPage({
  params
}: {
  params: Params
}) {
  const { id } = await params
  const ctx = await requirePlatformAdmin()
  if (!ctx.ok) {
    return (
      <p className="text-body text-danger-ink" role="alert">
        {ctx.message}
      </p>
    )
  }

  const detail = await getPlatformTenantDetail(ctx.admin, id)
  if (!detail) notFound()

  const [entitlements, plans] = await Promise.all([
    getTenantEntitlementState(ctx.admin, id),
    listProductPlans(ctx.admin)
  ])

  return (
    <div className="space-y-3">
      <Link
        href="/platform/tenants"
        className="text-hint text-ink-secondary no-underline hover:underline"
      >
        ← Cégek
      </Link>
      <TenantDetailClient
        tenant={detail.tenant}
        onboarding={detail.onboarding}
        kpis={detail.kpis}
        members={detail.members}
        company={detail.company}
        entitlementsSlot={
          <TenantEntitlementsPanel
            tenantId={id}
            plans={plans}
            currentPlanId={entitlements.plan?.id ?? null}
            entitledCount={entitlements.entitledKeys.length}
            addons={entitlements.addons}
            features={entitlements.features}
          />
        }
      />
    </div>
  )
}
