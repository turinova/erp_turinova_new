import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ManualOrderFormClient } from '@/components/manual-orders/manual-order-form-client'
import { getSessionUser } from '@/lib/auth/session'
import { listCustomersForSelect } from '@/lib/customers/queries'
import { listActiveSuppliersForSelect } from '@/lib/suppliers/queries'
import { createClient } from '@/lib/supabase/server'
import { listUnits } from '@/lib/units/queries'

export const metadata: Metadata = { title: 'Új kézi rendelés' }

export default async function UjKeziRendelesPage() {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) notFound()

  const supabase = await createClient()
  if (!supabase) notFound()

  const [customers, suppliers, units] = await Promise.all([
    listCustomersForSelect(supabase, user.tenantId),
    listActiveSuppliersForSelect(supabase, user.tenantId),
    listUnits(supabase, user.tenantId)
  ])

  return (
    <ManualOrderFormClient
      customers={customers}
      suppliers={suppliers}
      units={units}
      canWrite={Boolean(user.role && user.role !== 'viewer')}
    />
  )
}
