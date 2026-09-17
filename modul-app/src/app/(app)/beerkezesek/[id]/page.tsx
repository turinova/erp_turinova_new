import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { GoodsReceiptDetailClient } from '@/components/goods-receipts/goods-receipt-detail-client'
import { listAccessoryUnitOptions } from '@/lib/accessories/queries'
import { getSessionUser } from '@/lib/auth/session'
import { getGoodsReceipt } from '@/lib/goods-receipts/queries'
import { tenantHasProductLabels } from '@/lib/labels/entitlement'
import { getAccessoriesOnHandMap } from '@/lib/stock/queries'
import { listActiveWarehouses } from '@/lib/warehouses/queries'
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
    return { title: 'Beérkezés' }
  }
  const supabase = await createClient()
  if (!supabase) return { title: 'Beérkezés' }
  const receipt = await getGoodsReceipt(supabase, user.tenantId, id)
  return { title: receipt?.receipt_number ?? 'Beérkezés' }
}

export default async function BeerkezesDetailPage({
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

  const [receipt, warehouses, canPrintLabels] = await Promise.all([
    getGoodsReceipt(supabase, user.tenantId, id),
    listActiveWarehouses(supabase, user.tenantId),
    tenantHasProductLabels(supabase, user.tenantId)
  ])
  if (!receipt) notFound()

  const warehouseOptions = [...warehouses]
  if (
    receipt.warehouse_id &&
    !warehouseOptions.some((w) => w.id === receipt.warehouse_id)
  ) {
    warehouseOptions.unshift({
      id: receipt.warehouse_id,
      name: receipt.warehouse_name,
      code: '—',
      is_default: false
    })
  }

  let onHandByAccessory: Record<string, number> = {}
  try {
    const map = await getAccessoriesOnHandMap(
      supabase,
      user.tenantId,
      receipt.items.map((it) => it.accessory_id),
      receipt.warehouse_id
    )
    onHandByAccessory = Object.fromEntries(map.entries())
  } catch {
    onHandByAccessory = {}
  }

  let units: Awaited<ReturnType<typeof listAccessoryUnitOptions>> = []
  if (canPrintLabels) {
    try {
      units = await listAccessoryUnitOptions(supabase, user.tenantId)
    } catch {
      units = []
    }
  }

  return (
    <GoodsReceiptDetailClient
      initial={receipt}
      canWrite={canWrite}
      onHandByAccessory={onHandByAccessory}
      warehouses={warehouseOptions}
      canPrintLabels={canPrintLabels}
      units={units}
    />
  )
}
