'use server'

import { revalidatePath } from 'next/cache'

import { getSessionUser } from '@/lib/auth/session'
import {
  getDailySalesTarget,
  listPosAdoptionAwards,
  loadPosAdoptionStats,
  logPosScanEvent,
  startOfWeekMonday,
  toLocalDateStr,
  upsertDailySalesTarget,
  upsertPosAdoptionAward,
  type PosAdoptionAward,
  type PosAdoptionRange,
  type PosAdoptionStats,
  type PosScanSource
} from '@/lib/pos/adoption'
import { createClient } from '@/lib/supabase/server'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'

const PATH = '/ertekesitesek/pos-hasznalat'

export async function logPosScanEventAction(input: {
  warehouseId: string | null
  registerId: string | null
  shiftId?: string | null
  source: PosScanSource
  accessoryId?: string | null
}): Promise<void> {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) return
  const supabase = await createClient()
  if (!supabase) return
  await logPosScanEvent(supabase, {
    tenantId: user.tenantId,
    warehouseId: input.warehouseId,
    registerId: input.registerId,
    shiftId: input.shiftId,
    userId: user.id ?? null,
    source: input.source,
    accessoryId: input.accessoryId
  })
}

export async function loadPosAdoptionStatsAction(
  range: PosAdoptionRange,
  warehouseId?: string | null
): Promise<
  | { ok: true; stats: PosAdoptionStats }
  | { ok: false; message: string }
> {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return { ok: false, message: 'Nincs munkamenet.' }
  }
  const supabase = await createClient()
  if (!supabase) return { ok: false, message: 'Nincs adatbázis kapcsolat.' }
  try {
    const stats = await loadPosAdoptionStats(
      supabase,
      user.tenantId,
      range,
      warehouseId
    )
    return { ok: true, stats }
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error
          ? err.message
          : 'Nem sikerült betölteni a POS használatot.'
    }
  }
}

/** Mai bolt-szintű progress a pultos soft sávhoz. */
export async function loadPosTodayProgressAction(): Promise<
  | { ok: true; salesCount: number; dailyTarget: number }
  | { ok: false; message: string }
> {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return { ok: false, message: 'Nincs munkamenet.' }
  }
  const supabase = await createClient()
  if (!supabase) return { ok: false, message: 'Nincs adatbázis kapcsolat.' }
  try {
    const stats = await loadPosAdoptionStats(supabase, user.tenantId, 'today')
    return {
      ok: true,
      salesCount: stats.sales_count,
      dailyTarget: stats.daily_sales_target
    }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Hiba.'
    }
  }
}

export async function loadPosAdoptionPageDataAction(
  range: PosAdoptionRange
): Promise<
  | {
      ok: true
      stats: PosAdoptionStats
      awards: PosAdoptionAward[]
      weekStart: string
      dailyTarget: number
    }
  | { ok: false; message: string }
> {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return { ok: false, message: 'Nincs munkamenet.' }
  }
  const supabase = await createClient()
  if (!supabase) return { ok: false, message: 'Nincs adatbázis kapcsolat.' }
  try {
    const [stats, awards, dailyTarget] = await Promise.all([
      loadPosAdoptionStats(supabase, user.tenantId, range),
      listPosAdoptionAwards(supabase, user.tenantId, 8),
      getDailySalesTarget(supabase, user.tenantId)
    ])
    const weekStart = toLocalDateStr(startOfWeekMonday())
    return { ok: true, stats, awards, weekStart, dailyTarget }
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error
          ? err.message
          : 'Nem sikerült betölteni az oldalt.'
    }
  }
}

export async function saveDailyPosSalesTargetAction(
  target: number
): Promise<{ ok: true } | { ok: false; message: string }> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  try {
    await upsertDailySalesTarget(
      ctx.supabase,
      ctx.user.tenantId!,
      target,
      ctx.user.id ?? null
    )
    revalidatePath(PATH)
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Mentés sikertelen.'
    }
  }
}

export async function awardPosWeeklyWinnerAction(input: {
  userLabel: string
  userId?: string | null
  metricValue: number
  rewardNote: string
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  if (!input.userLabel.trim()) {
    return { ok: false, message: 'Válaszd ki a győztest.' }
  }
  try {
    const weekStart = toLocalDateStr(startOfWeekMonday())
    const label =
      ctx.user.email?.split('@')[0] ||
      ctx.user.id?.slice(0, 8) ||
      'manager'
    await upsertPosAdoptionAward(ctx.supabase, {
      tenantId: ctx.user.tenantId!,
      weekStart,
      userId: input.userId ?? null,
      userLabel: input.userLabel,
      metricValue: input.metricValue,
      rewardNote: input.rewardNote || 'Heti elismerés',
      awardedBy: ctx.user.id ?? null,
      awardedByLabel: label
    })
    revalidatePath(PATH)
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Mentés sikertelen.'
    }
  }
}
