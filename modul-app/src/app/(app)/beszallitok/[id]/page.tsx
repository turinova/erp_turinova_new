import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { SupplierForm } from '@/components/suppliers/supplier-form'
import { getSessionUser } from '@/lib/auth/session'
import { listActivePaymentMethods } from '@/lib/payment-methods/queries'
import { supplierTabTitle } from '@/lib/seo/tab-titles'
import { getSupplier } from '@/lib/suppliers/queries'
import { createClient } from '@/lib/supabase/server'
import { listTaxRates } from '@/lib/tax-rates/queries'

type Params = Promise<{ id: string }>

export async function generateMetadata({
  params
}: {
  params: Params
}): Promise<Metadata> {
  const { id } = await params
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return { title: 'Beszállító' }
  }
  const supabase = await createClient()
  if (!supabase) return { title: 'Beszállító' }
  const label = await supplierTabTitle(supabase, user.tenantId, id)
  return { title: label ?? 'Beszállító' }
}

export default async function EditBeszallitoPage({
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

  const [supplier, taxRates, paymentMethods] = await Promise.all([
    getSupplier(supabase, user.tenantId, id),
    listTaxRates(supabase, user.tenantId),
    listActivePaymentMethods(supabase, user.tenantId)
  ])

  if (!supplier) notFound()

  return (
    <SupplierForm
      mode="edit"
      initial={supplier}
      canWrite={canWrite}
      taxRates={taxRates}
      paymentMethods={paymentMethods}
    />
  )
}
