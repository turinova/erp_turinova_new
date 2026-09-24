'use server'

import { revalidatePath } from 'next/cache'

import { getSessionUser } from '@/lib/auth/session'
import {
  listPosQuickItemsAdmin,
  listPosQuickProductsForSale,
  POS_QUICK_ITEMS_MAX,
  replacePosQuickItems,
  type PosQuickItemAdmin,
  type PosQuickItemInput
} from '@/lib/pos/quick-items'
import type { SaleProductSearchItem } from '@/lib/sales/queries'
import { createClient } from '@/lib/supabase/server'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'

export async function loadPosQuickItemsAdminAction(): Promise<
  | { ok: true; items: PosQuickItemAdmin[]; canWrite: boolean; max: number }
  | { ok: false; message: string }
> {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return { ok: false, message: 'Nincs munkamenet.' }
  }
  const supabase = await createClient()
  if (!supabase) return { ok: false, message: 'Nincs adatbázis kapcsolat.' }

  try {
    const items = await listPosQuickItemsAdmin(supabase, user.tenantId)
    return {
      ok: true,
      items,
      canWrite: Boolean(user.role && user.role !== 'viewer'),
      max: POS_QUICK_ITEMS_MAX
    }
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error
          ? err.message
          : 'Nem sikerült betölteni a gyors termékeket.'
    }
  }
}

export async function savePosQuickItemsAction(
  items: PosQuickItemInput[]
): Promise<{ ok: true } | { ok: false; message: string }> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  if (items.length > POS_QUICK_ITEMS_MAX) {
    return {
      ok: false,
      message: `Legfeljebb ${POS_QUICK_ITEMS_MAX} gyors termék lehet.`
    }
  }

  try {
    await replacePosQuickItems(ctx.supabase, ctx.user.tenantId!, items)
    revalidatePath('/pos')
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error
          ? err.message
          : 'Nem sikerült menteni a gyors termékeket.'
    }
  }
}

export async function loadPosQuickProductsAction(
  warehouseId: string
): Promise<
  | { ok: true; rows: SaleProductSearchItem[] }
  | { ok: false; message: string }
> {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return { ok: false, message: 'Nincs munkamenet.' }
  }
  const supabase = await createClient()
  if (!supabase) return { ok: false, message: 'Nincs adatbázis kapcsolat.' }
  if (!warehouseId) return { ok: true, rows: [] }

  try {
    const rows = await listPosQuickProductsForSale(
      supabase,
      user.tenantId,
      warehouseId
    )
    return { ok: true, rows }
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error
          ? err.message
          : 'Nem sikerült betölteni a gyors termékeket.'
    }
  }
}
