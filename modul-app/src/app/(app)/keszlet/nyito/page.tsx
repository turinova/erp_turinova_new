import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { OpeningStockClient } from '@/components/opening-stock/opening-stock-client'
import { getSessionUser } from '@/lib/auth/session'
import { tenantHasLapszabaszat } from '@/lib/lapszabaszat/entitlement'
import { createClient } from '@/lib/supabase/server'
import { listActiveWarehouses } from '@/lib/warehouses/queries'

export const metadata: Metadata = {
  title: 'Nyitó készlet'
}

export default async function NyitoKeszletPage() {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) notFound()

  const canWrite = Boolean(user.role && user.role !== 'viewer')
  const supabase = await createClient()
  if (!supabase) notFound()

  const [warehouses, includeMaterials] = await Promise.all([
    listActiveWarehouses(supabase, user.tenantId),
    tenantHasLapszabaszat(supabase, user.tenantId)
  ])

  if (warehouses.length === 0) {
    return (
      <div className="mx-auto max-w-lg rounded-md border border-border bg-subtle px-4 py-6 text-body text-ink-secondary">
        Nincs aktív raktár. Először hozz létre egyet a törzsadatokban.
      </div>
    )
  }

  return (
    <OpeningStockClient
      warehouses={warehouses}
      canWrite={canWrite}
      includeMaterials={includeMaterials}
    />
  )
}
