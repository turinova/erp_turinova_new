import type { Metadata } from 'next'

import { AddonsClient } from '@/components/platform/addons-client'
import { requirePlatformAdmin } from '@/lib/platform/auth'
import {
  listProductAddons,
  listProductFeatures
} from '@/lib/platform/entitlement-queries'

export const metadata: Metadata = {
  title: 'Add-onok'
}

export default async function PlatformAddonsPage() {
  const ctx = await requirePlatformAdmin()
  if (!ctx.ok) {
    return (
      <p className="text-body text-danger-ink" role="alert">
        {ctx.message}
      </p>
    )
  }

  const [addons, features] = await Promise.all([
    listProductAddons(ctx.admin),
    listProductFeatures(ctx.admin)
  ])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-h1 text-ink">Add-onok</h1>
        <p className="mt-1 text-body text-ink-secondary">
          Extrák katalógusa — cégenként manuálisan kapcsolhatók. Az árak nettó
          forintban értendők.
        </p>
      </div>
      <AddonsClient addons={addons} features={features} />
    </div>
  )
}
