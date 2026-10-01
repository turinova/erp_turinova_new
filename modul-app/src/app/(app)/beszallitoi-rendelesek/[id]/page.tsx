import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { PurchaseOrderForm } from '@/components/purchase-orders/purchase-order-form'
import { getSessionUser } from '@/lib/auth/session'
import { listGoodsReceiptsForPo } from '@/lib/goods-receipts/queries'
import { tenantHasLapszabaszat } from '@/lib/lapszabaszat/entitlement'
import { purchaseOrderTabTitle } from '@/lib/seo/tab-titles'
import { getPurchaseOrder } from '@/lib/purchase-orders/queries'
import {
  getSupplierProcurementAids,
  mapAccessorySupplierSkus
} from '@/lib/suppliers/queries'
import { listActiveSuppliersForSelect } from '@/lib/suppliers/queries'
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
    return { title: 'Beszállítói rendelés' }
  }
  const supabase = await createClient()
  if (!supabase) return { title: 'Beszállítói rendelés' }
  const label = await purchaseOrderTabTitle(supabase, user.tenantId, id)
  return { title: label ?? 'Beszállítói rendelés' }
}

export default async function EditBeszallitoiRendelesPage({
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

  const [order, suppliers, warehouses, receipts, canOrderMaterial] =
    await Promise.all([
      getPurchaseOrder(supabase, user.tenantId, id),
      listActiveSuppliersForSelect(supabase, user.tenantId),
      listActiveWarehouses(supabase, user.tenantId),
      listGoodsReceiptsForPo(supabase, user.tenantId, id),
      tenantHasLapszabaszat(supabase, user.tenantId)
    ])

  if (!order) notFound()

  const accessoryIds = order.items
    .filter((it) => it.line_kind === 'accessory' && it.accessory_id)
    .map((it) => it.accessory_id!)
  const [procurementAids, supplierSkus] = await Promise.all([
    getSupplierProcurementAids(supabase, user.tenantId, order.supplier_id),
    mapAccessorySupplierSkus(
      supabase,
      user.tenantId,
      order.supplier_id,
      accessoryIds
    )
  ])

  // Include current supplier even if inactive (so MenuSelect shows name)
  const supplierOptions = [...suppliers]
  if (
    order.supplier_id &&
    !supplierOptions.some((s) => s.id === order.supplier_id)
  ) {
    supplierOptions.unshift({
      id: order.supplier_id,
      name: order.supplier_name,
      default_currency: 'HUF',
      default_tax_rate_id: null,
      default_payment_method_id: null,
      default_payment_terms_days: 30
    })
  }

  const warehouseOptions = [...warehouses]
  if (
    order.warehouse_id &&
    !warehouseOptions.some((w) => w.id === order.warehouse_id)
  ) {
    warehouseOptions.unshift({
      id: order.warehouse_id,
      name: order.warehouse_name,
      code: order.warehouse_code || '—',
      is_default: false
    })
  }

  return (
    <PurchaseOrderForm
      mode="edit"
      initial={order}
      canWrite={canWrite}
      canOrderMaterial={canOrderMaterial}
      suppliers={supplierOptions}
      warehouses={warehouseOptions}
      receipts={receipts}
      initialProcurementAids={procurementAids}
      initialSupplierSkus={supplierSkus}
    />
  )
}
