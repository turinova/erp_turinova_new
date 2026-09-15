import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { LinearMaterialForm } from '@/components/linear-materials/linear-material-form'
import { getSessionUser } from '@/lib/auth/session'
import {
  listManufacturerOptions,
  listTaxRateOptions
} from '@/lib/linear-materials/queries'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Új szálas anyag'
}

export default async function NewSzalasAnyagPage() {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) notFound()

  const canWrite = Boolean(user.role && user.role !== 'viewer')
  const supabase = await createClient()
  if (!supabase) notFound()

  const [manufacturers, taxRates] = await Promise.all([
    listManufacturerOptions(supabase, user.tenantId),
    listTaxRateOptions(supabase, user.tenantId)
  ])

  return (
    <LinearMaterialForm
      mode="create"
      tenantId={user.tenantId}
      manufacturers={manufacturers}
      taxRates={taxRates}
      canWrite={canWrite}
    />
  )
}
