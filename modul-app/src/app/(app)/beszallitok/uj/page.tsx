import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { SupplierForm } from '@/components/suppliers/supplier-form'
import { getSessionUser } from '@/lib/auth/session'
import { listActivePaymentMethods } from '@/lib/payment-methods/queries'
import { createClient } from '@/lib/supabase/server'
import { listTaxRates } from '@/lib/tax-rates/queries'

export const metadata: Metadata = {
  title: 'Új beszállító'
}

export default async function UjBeszallitoPage() {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) notFound()

  const canWrite = Boolean(user.role && user.role !== 'viewer')
  const supabase = await createClient()
  if (!supabase) notFound()

  const [taxRates, paymentMethods] = await Promise.all([
    listTaxRates(supabase, user.tenantId),
    listActivePaymentMethods(supabase, user.tenantId)
  ])

  return (
    <SupplierForm
      mode="create"
      canWrite={canWrite}
      taxRates={taxRates}
      paymentMethods={paymentMethods}
    />
  )
}
