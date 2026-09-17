import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { StockTransferCreateClient } from '@/components/stock-transfers/stock-transfer-create-client'
import { getSessionUser } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { listActiveWarehouses } from '@/lib/warehouses/queries'

export const metadata: Metadata = {
  title: 'Új áttárolás'
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function UjAtadasPage({
  searchParams
}: {
  searchParams: SearchParams
}) {
  const sp = await searchParams
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) notFound()

  const canWrite = Boolean(user.role && user.role !== 'viewer')
  const supabase = await createClient()
  if (!supabase) notFound()

  const warehouses = await listActiveWarehouses(supabase, user.tenantId)

  const accessoryId =
    typeof sp.accessoryId === 'string' ? sp.accessoryId : undefined
  const fromWarehouseId =
    typeof sp.fromWarehouseId === 'string' ? sp.fromWarehouseId : undefined

  let initialAccessory: {
    id: string
    name: string
    sku: string
    unitShortform: string
  } | null = null

  if (accessoryId) {
    const { data } = await supabase
      .from('accessories')
      .select('id, name, sku, units ( shortform )')
      .eq('tenant_id', user.tenantId)
      .eq('id', accessoryId)
      .is('deleted_at', null)
      .maybeSingle()
    if (data) {
      const units = data.units as
        | { shortform: string }
        | { shortform: string }[]
        | null
      const unit = Array.isArray(units) ? units[0] : units
      initialAccessory = {
        id: data.id,
        name: data.name,
        sku: data.sku,
        unitShortform: unit?.shortform ?? 'db'
      }
    }
  }

  return (
    <StockTransferCreateClient
      warehouses={warehouses}
      canWrite={canWrite}
      initialFromWarehouseId={fromWarehouseId}
      initialAccessory={initialAccessory}
    />
  )
}
