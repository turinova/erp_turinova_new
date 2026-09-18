import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { SalesQuoteCreateClient } from '@/components/sales-quotes/sales-quote-create-client'
import { getSessionUser } from '@/lib/auth/session'
import { listCustomersForSelect } from '@/lib/customers/queries'
import { listActiveFeeTypeOptions } from '@/lib/fee-types/queries'
import { createClient } from '@/lib/supabase/server'
import { listActiveWarehouses } from '@/lib/warehouses/queries'

export const metadata: Metadata = { title: 'Új árajánlat' }

export default async function UjArajnlatPage() {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) notFound()

  const canWrite = Boolean(user.role && user.role !== 'viewer')
  const supabase = await createClient()
  if (!supabase) notFound()

  const [warehouses, customers, feeTypes] = await Promise.all([
    listActiveWarehouses(supabase, user.tenantId),
    listCustomersForSelect(supabase, user.tenantId),
    listActiveFeeTypeOptions(supabase, user.tenantId)
  ])

  return (
    <SalesQuoteCreateClient
      warehouses={warehouses}
      customers={customers}
      feeTypes={feeTypes}
      canWrite={canWrite}
    />
  )
}
