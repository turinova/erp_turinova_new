import type { SupabaseClient } from '@supabase/supabase-js'

import { loadPosAdoptionStats } from '@/lib/pos/adoption'
import {
  loadPosFrequentProducts,
  loadPosManufacturerChips,
  type PosManufacturerChip
} from '@/lib/pos/discovery'
import { listPosQuickProductsForSale } from '@/lib/pos/quick-items'
import { getOpenPosShift } from '@/lib/pos/shifts'
import type { SaleProductSearchItem } from '@/lib/sales/queries'

export type PosBootstrapShift = {
  id: string
  openingCash: number
  openedAt: string
  openedByLabel: string | null
}

export type PosBootstrapProgress = {
  salesCount: number
  weekSalesCount: number
  monthSalesCount: number
  dailyTarget: number
}

export type PosBootstrapPayload = {
  shift: PosBootstrapShift | null
  quick: SaleProductSearchItem[]
  frequent: SaleProductSearchItem[]
  progress: PosBootstrapProgress | null
  chips: PosManufacturerChip[]
}

export type PosBootstrapInclude = {
  shift: boolean
  catalog: boolean
  progress: boolean
  chips: boolean
}

export function parsePosBootstrapInclude(raw: string | null): PosBootstrapInclude {
  if (!raw || raw === 'all') {
    return { shift: true, catalog: true, progress: true, chips: true }
  }
  const parts = new Set(
    raw
      .split(',')
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean)
  )
  if (parts.has('all')) {
    return { shift: true, catalog: true, progress: true, chips: true }
  }
  return {
    shift: parts.has('shift') || parts.size === 0,
    catalog: parts.has('catalog') || parts.has('quick') || parts.has('frequent'),
    progress: parts.has('progress'),
    chips: parts.has('chips')
  }
}

/**
 * POS mount / register·warehouse refresh — egy round-trip read bundle.
 * Mutációk (sale, shift open/close) továbbra is Server Actionök.
 */
export async function loadPosBootstrap(
  supabase: SupabaseClient,
  tenantId: string,
  opts: {
    warehouseId: string
    registerId: string
    include: PosBootstrapInclude
  }
): Promise<PosBootstrapPayload> {
  const { warehouseId, registerId, include } = opts

  const shiftPromise = include.shift
    ? (async (): Promise<PosBootstrapShift | null> => {
        if (!registerId) return null
        const shift = await getOpenPosShift(supabase, tenantId, registerId)
        if (!shift) return null
        return {
          id: shift.id,
          openingCash: shift.opening_cash,
          openedAt: shift.opened_at,
          openedByLabel: shift.opened_by_label
        }
      })()
    : Promise.resolve(null)

  const catalogPromise = include.catalog
    ? (async () => {
        if (!warehouseId) {
          return {
            quick: [] as SaleProductSearchItem[],
            frequent: [] as SaleProductSearchItem[]
          }
        }
        const [quick, frequent] = await Promise.all([
          listPosQuickProductsForSale(supabase, tenantId, warehouseId),
          loadPosFrequentProducts(supabase, tenantId, warehouseId)
        ])
        return { quick, frequent }
      })()
    : Promise.resolve({
        quick: [] as SaleProductSearchItem[],
        frequent: [] as SaleProductSearchItem[]
      })

  const progressPromise = include.progress
    ? (async (): Promise<PosBootstrapProgress | null> => {
        try {
          const [today, week, month] = await Promise.all([
            loadPosAdoptionStats(supabase, tenantId, 'today'),
            loadPosAdoptionStats(supabase, tenantId, 'week'),
            loadPosAdoptionStats(supabase, tenantId, 'month')
          ])
          return {
            salesCount: today.sales_count,
            weekSalesCount: week.sales_count,
            monthSalesCount: month.sales_count,
            dailyTarget: today.daily_sales_target
          }
        } catch {
          return null
        }
      })()
    : Promise.resolve(null)

  const chipsPromise = include.chips
    ? loadPosManufacturerChips(supabase, tenantId, 6).catch(
        () => [] as PosManufacturerChip[]
      )
    : Promise.resolve([] as PosManufacturerChip[])

  const [shift, catalog, progress, chips] = await Promise.all([
    shiftPromise,
    catalogPromise,
    progressPromise,
    chipsPromise
  ])

  return {
    shift,
    quick: catalog.quick,
    frequent: catalog.frequent,
    progress,
    chips
  }
}
