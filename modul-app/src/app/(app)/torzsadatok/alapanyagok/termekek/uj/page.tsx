import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { AccessoryForm } from '@/components/accessories/accessory-form'
import { getSessionUser } from '@/lib/auth/session'
import {
  listAccessoryManufacturerOptions,
  listAccessoryTaxOptions,
  listAccessoryUnitOptions
} from '@/lib/accessories/queries'
import { createClient } from '@/lib/supabase/server'
import { tenantHasWebshop } from '@/lib/webshop/entitlement'

export const metadata: Metadata = {
  title: 'Új termék'
}

export default async function NewTermekPage() {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) notFound()

  const canWrite = Boolean(user.role && user.role !== 'viewer')
  const supabase = await createClient()
  if (!supabase) notFound()

  const [manufacturers, taxRates, units, hasWebshop] = await Promise.all([
    listAccessoryManufacturerOptions(supabase, user.tenantId),
    listAccessoryTaxOptions(supabase, user.tenantId),
    listAccessoryUnitOptions(supabase, user.tenantId),
    tenantHasWebshop(supabase, user.tenantId)
  ])

  return (
    <AccessoryForm
      mode="create"
      manufacturers={manufacturers}
      taxRates={taxRates}
      units={units}
      canWrite={canWrite}
      tenantId={user.tenantId}
      hasWebshop={hasWebshop}
    />
  )
}
