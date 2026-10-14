import type { Metadata } from 'next'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'

import { AccessoryForm } from '@/components/accessories/accessory-form'
import { AccessoryProcurementStockSection } from '@/components/accessories/accessory-procurement-stock-section'
import { AccessoryShopCard } from '@/components/accessories/accessory-shop-card'
import { getSessionUser } from '@/lib/auth/session'
import {
  getAccessory,
  listAccessoryManufacturerOptions,
  listAccessorySupplierOptions,
  listAccessoryTaxOptions,
  listAccessoryUnitOptions
} from '@/lib/accessories/queries'
import { tenantHasBeszerzes } from '@/lib/beszerzes/entitlement'
import { tenantHasProductLabels } from '@/lib/labels/entitlement'
import { namedEntityTabTitle } from '@/lib/seo/tab-titles'
import { getAccessoryProcurementStock } from '@/lib/stock/accessory-panel'
import { createClient } from '@/lib/supabase/server'
import { tenantHasWebshop } from '@/lib/webshop/entitlement'
import { getShopCardStatus } from '@/lib/webshop/product-queries'

type Params = Promise<{ id: string }>

function DeferredPanelSkeleton({ label }: { label: string }) {
  return (
    <div
      className="mt-2 space-y-2 rounded-md border border-border p-3"
      aria-busy="true"
      aria-label={label}
    >
      <div className="h-4 w-40 animate-pulse rounded bg-subtle" />
      <div className="h-16 animate-pulse rounded bg-subtle" />
    </div>
  )
}

async function DeferredAccessoryStock({
  tenantId,
  accessoryId,
  unitShortform
}: {
  tenantId: string
  accessoryId: string
  unitShortform: string
}) {
  const supabase = await createClient()
  if (!supabase) return null
  try {
    const stock = await getAccessoryProcurementStock(
      supabase,
      tenantId,
      accessoryId
    )
    return (
      <AccessoryProcurementStockSection
        stock={stock}
        accessoryId={accessoryId}
        unitShortform={unitShortform}
      />
    )
  } catch (err) {
    console.error('DeferredAccessoryStock', err)
    return null
  }
}

async function DeferredAccessoryShop({
  tenantId,
  accessoryId,
  canWrite
}: {
  tenantId: string
  accessoryId: string
  canWrite: boolean
}) {
  const supabase = await createClient()
  if (!supabase) return null
  const status = await getShopCardStatus(supabase, tenantId, accessoryId)
  return (
    <AccessoryShopCard
      accessoryId={accessoryId}
      status={status}
      canWrite={canWrite}
    />
  )
}

export async function generateMetadata({
  params
}: {
  params: Params
}): Promise<Metadata> {
  const { id } = await params
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return { title: 'Termék' }
  }
  const supabase = await createClient()
  if (!supabase) return { title: 'Termék' }
  const label = await namedEntityTabTitle(
    supabase,
    'accessories',
    user.tenantId,
    id
  )
  return { title: label ?? 'Termék' }
}

export default async function EditTermekPage({
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

  const [
    accessory,
    manufacturers,
    suppliers,
    taxRates,
    units,
    canPrintLabels,
    hasBeszerzes,
    hasWebshop
  ] = await Promise.all([
    getAccessory(supabase, user.tenantId, id),
    listAccessoryManufacturerOptions(supabase, user.tenantId),
    listAccessorySupplierOptions(supabase, user.tenantId),
    listAccessoryTaxOptions(supabase, user.tenantId),
    listAccessoryUnitOptions(supabase, user.tenantId),
    tenantHasProductLabels(supabase, user.tenantId),
    tenantHasBeszerzes(supabase, user.tenantId),
    tenantHasWebshop(supabase, user.tenantId)
  ])

  if (!accessory) notFound()

  const unitShortform = accessory.unit_shortform || 'db'

  return (
    <AccessoryForm
      mode="edit"
      initial={accessory}
      manufacturers={manufacturers}
      suppliers={suppliers}
      taxRates={taxRates}
      units={units}
      canWrite={canWrite}
      tenantId={user.tenantId}
      canPrintLabels={canPrintLabels}
      hasWebshop={hasWebshop}
      deferredStockSection={
        hasBeszerzes ? (
          <Suspense
            fallback={<DeferredPanelSkeleton label="Készlet betöltése" />}
          >
            <DeferredAccessoryStock
              tenantId={user.tenantId}
              accessoryId={id}
              unitShortform={unitShortform}
            />
          </Suspense>
        ) : null
      }
      deferredShopSection={
        hasWebshop ? (
          <Suspense
            fallback={<DeferredPanelSkeleton label="Bolt státusz betöltése" />}
          >
            <DeferredAccessoryShop
              tenantId={user.tenantId}
              accessoryId={id}
              canWrite={canWrite}
            />
          </Suspense>
        ) : null
      }
    />
  )
}
