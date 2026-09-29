import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { CustomerOrderDetailClient } from '@/components/customer-orders/customer-order-detail-client'
import { getSessionUser } from '@/lib/auth/session'
import { getCustomerSpecialOrder } from '@/lib/customer-orders/queries'
import { listActiveSuppliersForSelect } from '@/lib/suppliers/queries'
import { createClient } from '@/lib/supabase/server'
import { listUnits } from '@/lib/units/queries'

type Params = Promise<{ id: string }>

export async function generateMetadata({
  params
}: {
  params: Params
}): Promise<Metadata> {
  const { id } = await params
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return { title: 'Ügyfélrendelés' }
  }
  const supabase = await createClient()
  if (!supabase) return { title: 'Ügyfélrendelés' }
  const order = await getCustomerSpecialOrder(supabase, user.tenantId, id)
  return { title: order?.orderNumber ?? 'Ügyfélrendelés' }
}

export default async function UgyfelrendelesDetailPage({
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

  const [order, suppliers, units] = await Promise.all([
    getCustomerSpecialOrder(supabase, user.tenantId, id),
    listActiveSuppliersForSelect(supabase, user.tenantId),
    listUnits(supabase, user.tenantId)
  ])

  if (!order) notFound()

  const supplierOptions = [...suppliers]
  for (const item of order.items) {
    if (
      item.supplierId &&
      item.supplierName &&
      !supplierOptions.some((s) => s.id === item.supplierId)
    ) {
      supplierOptions.unshift({
        id: item.supplierId,
        name: item.supplierName,
        default_currency: 'HUF',
        default_tax_rate_id: null,
        default_payment_method_id: null,
        default_payment_terms_days: 30
      })
    }
  }

  return (
    <CustomerOrderDetailClient
      order={order}
      suppliers={supplierOptions}
      units={units}
      canWrite={canWrite}
    />
  )
}
