import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { PurchaseOrderForm } from '@/components/purchase-orders/purchase-order-form'
import { getSessionUser } from '@/lib/auth/session'
import { listActiveSuppliersForSelect } from '@/lib/suppliers/queries'
import {
  ensureDefaultWarehouse,
  listActiveWarehouses
} from '@/lib/warehouses/queries'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Új beszállítói rendelés'
}

export default async function UjBeszallitoiRendelesPage() {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) notFound()

  const canWrite = Boolean(user.role && user.role !== 'viewer')
  const supabase = await createClient()
  if (!supabase) notFound()

  let warehouses = await listActiveWarehouses(supabase, user.tenantId)
  if (warehouses.length === 0) {
    await ensureDefaultWarehouse(supabase, user.tenantId)
    warehouses = await listActiveWarehouses(supabase, user.tenantId)
  }

  const suppliers = await listActiveSuppliersForSelect(
    supabase,
    user.tenantId
  )

  return (
    <PurchaseOrderForm
      mode="create"
      canWrite={canWrite}
      suppliers={suppliers}
      warehouses={warehouses}
    />
  )
}
