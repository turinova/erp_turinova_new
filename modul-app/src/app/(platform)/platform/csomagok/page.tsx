import type { Metadata } from 'next'

import { PlansClient } from '@/components/platform/plans-client'
import { requirePlatformAdmin } from '@/lib/platform/auth'
import {
  listProductFeatures,
  listProductPlans
} from '@/lib/platform/entitlement-queries'

export const metadata: Metadata = {
  title: 'Csomagok'
}

export default async function PlatformPlansPage() {
  const ctx = await requirePlatformAdmin()
  if (!ctx.ok) {
    return (
      <p className="text-body text-danger-ink" role="alert">
        {ctx.message}
      </p>
    )
  }

  const [plans, features] = await Promise.all([
    listProductPlans(ctx.admin),
    listProductFeatures(ctx.admin)
  ])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-h1 text-ink">Csomagok</h1>
        <p className="mt-1 text-body text-ink-secondary">
          Plan feature-ök szerkesztése. Mentés után az „Alkalmaz” gomb írja át a
          meglévő cégeket.
        </p>
      </div>
      <PlansClient plans={plans} features={features} />
    </div>
  )
}
