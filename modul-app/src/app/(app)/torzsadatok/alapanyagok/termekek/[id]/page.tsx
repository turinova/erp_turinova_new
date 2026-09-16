import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { AccessoryForm } from '@/components/accessories/accessory-form'
import { getSessionUser } from '@/lib/auth/session'
import {
  getAccessory,
  listAccessoryManufacturerOptions,
  listAccessoryTaxOptions,
  listAccessoryUnitOptions
} from '@/lib/accessories/queries'
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
    return { title: 'Termék' }
  }
  const supabase = await createClient()
  if (!supabase) return { title: 'Termék' }
  const label = await namedEntityTabTitle(
    supabase,
    'accessories',
    user.tenantId,
    id
  )
  return { title: label ?? 'Termék' }
}

export default async function EditTermekPage({
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

  const [accessory, manufacturers, taxRates, units] = await Promise.all([
    getAccessory(supabase, user.tenantId, id),
    listAccessoryManufacturerOptions(supabase, user.tenantId),
    listAccessoryTaxOptions(supabase, user.tenantId),
    listAccessoryUnitOptions(supabase, user.tenantId)
  ])

  if (!accessory) notFound()

  return (
    <AccessoryForm
      mode="edit"
      initial={accessory}
      manufacturers={manufacturers}
      taxRates={taxRates}
      units={units}
      canWrite={canWrite}
      tenantId={user.tenantId}
    />
  )
}
