import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { SheetMaterialForm } from '@/components/sheet-materials/sheet-material-form'
import { getSessionUser } from '@/lib/auth/session'
import {
  getSheetMaterial,
  listEquipmentOptions,
  listManufacturerOptions,
  listTaxRateOptions
} from '@/lib/sheet-materials/queries'
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
    return { title: 'Táblás anyag' }
  }
  const supabase = await createClient()
  if (!supabase) return { title: 'Táblás anyag' }
  const label = await namedEntityTabTitle(
    supabase,
    'sheet_materials',
    user.tenantId,
    id
  )
  return { title: label ?? 'Táblás anyag' }
}

export default async function EditTablasAnyagPage({
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

  const [sheet, manufacturers, taxRates, equipment] = await Promise.all([
    getSheetMaterial(supabase, user.tenantId, id),
    listManufacturerOptions(supabase, user.tenantId),
    listTaxRateOptions(supabase, user.tenantId),
    listEquipmentOptions(supabase, user.tenantId)
  ])

  if (!sheet) notFound()

  return (
    <SheetMaterialForm
      mode="edit"
      initial={sheet}
      tenantId={user.tenantId}
      manufacturers={manufacturers}
      taxRates={taxRates}
      equipment={equipment}
      canWrite={canWrite}
    />
  )
}
