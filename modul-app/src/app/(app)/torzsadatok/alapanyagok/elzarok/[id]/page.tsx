import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { EdgeMaterialForm } from '@/components/edge-materials/edge-material-form'
import { getSessionUser } from '@/lib/auth/session'
import {
  getEdgeMaterial,
  listEquipmentOptions,
  listManufacturerOptions,
  listTaxRateOptions
} from '@/lib/edge-materials/queries'
import { createClient } from '@/lib/supabase/server'

type Params = Promise<{ id: string }>

export async function generateMetadata({
  params
}: {
  params: Params
}): Promise<Metadata> {
  const { id } = await params
  return { title: `Élzáró · ${id.slice(0, 8)}` }
}

export default async function EditElzarokPage({
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

  const [edge, manufacturers, taxRates, equipment] = await Promise.all([
    getEdgeMaterial(supabase, user.tenantId, id),
    listManufacturerOptions(supabase, user.tenantId),
    listTaxRateOptions(supabase, user.tenantId),
    listEquipmentOptions(supabase, user.tenantId)
  ])

  if (!edge) notFound()

  return (
    <EdgeMaterialForm
      mode="edit"
      initial={edge}
      manufacturers={manufacturers}
      taxRates={taxRates}
      equipment={equipment}
      canWrite={canWrite}
    />
  )
}
