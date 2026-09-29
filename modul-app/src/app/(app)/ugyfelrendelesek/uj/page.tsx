import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { CustomerOrderFormClient } from '@/components/customer-orders/customer-order-form-client'
import type { CsoDraftLine } from '@/components/customer-orders/cso-lines'
import { getAccessory } from '@/lib/accessories/queries'
import { grossFromNet } from '@/lib/accessories/parse'
import { getSessionUser } from '@/lib/auth/session'
import { listCustomersForSelect } from '@/lib/customers/queries'
import { listActiveSuppliersForSelect } from '@/lib/suppliers/queries'
import { createClient } from '@/lib/supabase/server'
import { listUnits } from '@/lib/units/queries'

export const metadata: Metadata = { title: 'Új ügyfélrendelés' }

type SearchParams = Promise<{ accessory?: string }>

export default async function UjUgyfelrendelesPage({
  searchParams
}: {
  searchParams: SearchParams
}) {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) notFound()

  const canWrite = Boolean(user.role && user.role !== 'viewer')
  const supabase = await createClient()
  if (!supabase) notFound()

  const params = await searchParams
  const accessoryId = params.accessory?.trim() || ''

  const [customers, suppliers, units, accessory] = await Promise.all([
    listCustomersForSelect(supabase, user.tenantId),
    listActiveSuppliersForSelect(supabase, user.tenantId),
    listUnits(supabase, user.tenantId),
    accessoryId
      ? getAccessory(supabase, user.tenantId, accessoryId).catch(() => null)
      : Promise.resolve(null)
  ])

  let initialLines: CsoDraftLine[] | undefined
  if (accessory) {
    const unit =
      units.find((u) => u.id === accessory.unit_id)?.shortform ??
      units.find((u) => u.shortform === 'db')?.shortform ??
      units[0]?.shortform ??
      'db'
    initialLines = [
      {
        key: crypto.randomUUID(),
        name: accessory.name,
        sku: accessory.sku ?? '',
        qty: 1,
        unitShortform: unit,
        unitPriceGross: grossFromNet(
          accessory.price_net,
          accessory.tax_rate_percent
        ),
        accessoryId: accessory.id,
        supplierId: accessory.supplier_ids[0] ?? null,
        note: ''
      }
    ]
  }

  return (
    <CustomerOrderFormClient
      customers={customers}
      suppliers={suppliers}
      units={units}
      canWrite={canWrite}
      initialLines={initialLines}
    />
  )
}
