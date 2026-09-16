import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { TenantDetailClient } from '@/components/platform/tenant-detail-client'
import { TenantEntitlementsPanel } from '@/components/platform/tenant-entitlements-panel'
import { estimateTenantMonthlyBill } from '@/lib/billing/estimate'
import { listTenantPlatformAudit } from '@/lib/platform/audit'
import { requirePlatformAdmin } from '@/lib/platform/auth'
import {
  listProductPlans,
  getTenantEntitlementState
} from '@/lib/platform/entitlement-queries'
import { ph } from '@/lib/platform/platform-href-server'
import { getPlatformTenantDetail } from '@/lib/platform/queries'
import { platformTenantTabTitle } from '@/lib/seo/tab-titles'

type Params = Promise<{ id: string }>

export async function generateMetadata({
  params
}: {
  params: Params
}): Promise<Metadata> {
  const { id } = await params
  const ctx = await requirePlatformAdmin()
  if (!ctx.ok) return { title: 'Cég' }
  const label = await platformTenantTabTitle(ctx.admin, id)
  return { title: label ?? 'Cég' }
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

  const [entitlements, plans, auditRows, tenantsHref, monthlyBill] =
    await Promise.all([
      getTenantEntitlementState(ctx.admin, id),
      listProductPlans(ctx.admin),
      listTenantPlatformAudit(ctx.admin, id),
      ph('/tenants'),
      estimateTenantMonthlyBill(ctx.admin, id)
    ])

  return (
    <div className="space-y-3">
      <Link
        href={tenantsHref}
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
        auditRows={auditRows}
        monthlyBill={monthlyBill}
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
