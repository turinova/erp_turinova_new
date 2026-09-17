import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { SaleCreateClient } from '@/components/sales/sale-create-client'
import { getSessionUser } from '@/lib/auth/session'
import { listCustomersForSelect } from '@/lib/customers/queries'
import { listActiveFeeTypeOptions } from '@/lib/fee-types/queries'
import { listActivePaymentMethods } from '@/lib/payment-methods/queries'
import { createClient } from '@/lib/supabase/server'
import { listActiveWarehouses } from '@/lib/warehouses/queries'

export const metadata: Metadata = { title: 'Új értékesítés' }

export default async function UjErtekesitesPage() {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) notFound()

  const canWrite = Boolean(user.role && user.role !== 'viewer')
  const supabase = await createClient()
  if (!supabase) notFound()

  const [warehouses, customers, paymentMethods, feeTypes] = await Promise.all([
    listActiveWarehouses(supabase, user.tenantId),
    listCustomersForSelect(supabase, user.tenantId),
    listActivePaymentMethods(supabase, user.tenantId),
    listActiveFeeTypeOptions(supabase, user.tenantId)
  ])

  return (
    <SaleCreateClient
      warehouses={warehouses}
      customers={customers}
      paymentMethods={paymentMethods}
      feeTypes={feeTypes}
      canWrite={canWrite}
    />
  )
}
