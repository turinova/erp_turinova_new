import type { Metadata } from 'next'
import { Suspense } from 'react'

import { CatalogClient } from '@/components/platform/catalog-client'
import { requirePlatformAdmin } from '@/lib/platform/auth'
import {
  listProductAddons,
  listProductFeatures,
  listProductPlans
} from '@/lib/platform/entitlement-queries'

export const metadata: Metadata = {
  title: 'Katalógus'
}

export default async function PlatformCatalogPage() {
  const ctx = await requirePlatformAdmin()
  if (!ctx.ok) {
    return (
      <p className="text-body text-danger-ink" role="alert">
        {ctx.message}
      </p>
    )
  }

  const [plans, features, addons] = await Promise.all([
    listProductPlans(ctx.admin),
    listProductFeatures(ctx.admin),
    listProductAddons(ctx.admin)
  ])

  return (
    <Suspense fallback={null}>
      <CatalogClient plans={plans} features={features} addons={addons} />
    </Suspense>
  )
}
