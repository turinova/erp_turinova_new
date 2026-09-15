import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { LinearMaterialForm } from '@/components/linear-materials/linear-material-form'
import { getSessionUser } from '@/lib/auth/session'
import {
  getLinearMaterial,
  listManufacturerOptions,
  listTaxRateOptions
} from '@/lib/linear-materials/queries'
import { namedEntityTabTitle } from '@/lib/seo/tab-titles'
import { createClient } from '@/lib/supabase/server'

type Params = Promise<{ id: string }>

export async function generateMetadata({
  params
}: {
  params: Params
}): Promise<Metadata> {
  const { id } = await params
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return { title: 'Szálas anyag' }
  }
  const supabase = await createClient()
  if (!supabase) return { title: 'Szálas anyag' }
  const label = await namedEntityTabTitle(
    supabase,
    'linear_materials',
    user.tenantId,
    id
  )
  return { title: label ?? 'Szálas anyag' }
}

export default async function EditSzalasAnyagPage({
  params
}: {
  params: Params
}) {
  const { id } = await params
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) notFound()

  const canWrite = Boolean(user.role && user.role !== 'viewer')
  const supabase = await createClient()
  if (!supabase) notFound()

  const [row, manufacturers, taxRates] = await Promise.all([
    getLinearMaterial(supabase, user.tenantId, id),
    listManufacturerOptions(supabase, user.tenantId),
    listTaxRateOptions(supabase, user.tenantId)
  ])

  if (!row) notFound()

  return (
    <LinearMaterialForm
      mode="edit"
      initial={row}
      tenantId={user.tenantId}
      manufacturers={manufacturers}
      taxRates={taxRates}
      canWrite={canWrite}
    />
  )
}
