import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { EdgeMaterialForm } from '@/components/edge-materials/edge-material-form'
import { getSessionUser } from '@/lib/auth/session'
import {
  listEquipmentOptions,
  listManufacturerOptions,
  listTaxRateOptions
} from '@/lib/edge-materials/queries'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Új élzáró'
}

export default async function NewElzarokPage() {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) notFound()

  const canWrite = Boolean(user.role && user.role !== 'viewer')
  const supabase = await createClient()
  if (!supabase) notFound()

  const [manufacturers, taxRates, equipment] = await Promise.all([
    listManufacturerOptions(supabase, user.tenantId),
    listTaxRateOptions(supabase, user.tenantId),
    listEquipmentOptions(supabase, user.tenantId)
  ])

  return (
    <EdgeMaterialForm
      mode="create"
      manufacturers={manufacturers}
      taxRates={taxRates}
      equipment={equipment}
      canWrite={canWrite}
    />
  )
}
