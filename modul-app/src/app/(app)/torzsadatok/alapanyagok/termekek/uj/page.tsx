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
import {
  listProductAttributes,
  listWebCategories
} from '@/lib/webshop/queries'
import { getTenantWebshopSettings } from '@/lib/webshop/settings'

export const metadata: Metadata = {
  title: 'Új termék'
}

export default async function NewTermekPage() {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) notFound()

  const canWrite = Boolean(user.role && user.role !== 'viewer')
  const supabase = await createClient()
  if (!supabase) notFound()

  const hasWebshop = await tenantHasWebshop(supabase, user.tenantId)

  const [manufacturers, taxRates, units, webCategories, webAttributes, shippingDefaults] =
    await Promise.all([
      listAccessoryManufacturerOptions(supabase, user.tenantId),
      listAccessoryTaxOptions(supabase, user.tenantId),
      listAccessoryUnitOptions(supabase, user.tenantId),
      hasWebshop
        ? listWebCategories(supabase, user.tenantId)
        : Promise.resolve([]),
      hasWebshop
        ? listProductAttributes(supabase, user.tenantId)
        : Promise.resolve([]),
      hasWebshop
        ? getTenantWebshopSettings(supabase, user.tenantId)
        : Promise.resolve(null)
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
      webCategories={webCategories}
      webAttributes={webAttributes}
      webshopShippingDefaults={shippingDefaults}
    />
  )
}
