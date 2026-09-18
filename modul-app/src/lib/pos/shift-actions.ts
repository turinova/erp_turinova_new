'use server'

import { revalidatePath } from 'next/cache'

import {
  computePosShiftExpectedRpc,
  type PosShiftExpected
} from '@/lib/pos/shift-actions-shared'
import { getOpenPosShift } from '@/lib/pos/shifts'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/auth/session'

export type ShiftActionResult =
  | { ok: true; id?: string; openingCash?: number; [k: string]: unknown }
  | { ok: false; message: string }

function revalidateShiftPaths(shiftId?: string) {
  revalidatePath('/pos')
  revalidatePath('/ertekesitesek/muszakok')
  revalidatePath('/ertekesitesek')
  if (shiftId) revalidatePath(`/ertekesitesek/muszakok/${shiftId}`)
}

export async function openPosShiftAction(
  registerId: string,
  openingCash: number
): Promise<ShiftActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const { data, error } = await ctx.supabase.rpc('open_pos_shift', {
    p_pos_register_id: registerId,
    p_opening_cash: Math.round(openingCash)
  })
  if (error) {
    console.error('openPosShiftAction', error.message)
    return { ok: false, message: 'Nem sikerült megnyitni a műszakot.' }
  }
  const result = data as { ok?: boolean; id?: string; message?: string; opening_cash?: number }
  if (!result?.ok || !result.id) {
    return { ok: false, message: result?.message ?? 'Nem sikerült megnyitni a műszakot.' }
  }
  revalidateShiftPaths(result.id)
  return { ok: true, id: result.id, openingCash: result.opening_cash }
}

export async function closePosShiftAction(input: {
  shiftId: string
  countedCash: number
  countedCard: number
  note?: string | null
  denominationJson?: Record<string, number> | null
}): Promise<ShiftActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const { data, error } = await ctx.supabase.rpc('close_pos_shift', {
    p_pos_shift_id: input.shiftId,
    p_counted_cash: Math.round(input.countedCash),
    p_counted_card: Math.round(input.countedCard),
    p_note: input.note ?? null,
    p_denomination_json: input.denominationJson ?? null
  })
  if (error) {
    console.error('closePosShiftAction', error.message)
    return { ok: false, message: 'Nem sikerült lezárni a műszakot.' }
  }
  const result = data as { ok?: boolean; id?: string; message?: string }
  if (!result?.ok) {
    return { ok: false, message: result?.message ?? 'Nem sikerült lezárni a műszakot.' }
  }
  revalidateShiftPaths(input.shiftId)
  return { ok: true, id: input.shiftId }
}

export async function addPosShiftCashMoveAction(input: {
  shiftId: string
  kind: 'in' | 'out'
  amount: number
  note: string
}): Promise<ShiftActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const { data, error } = await ctx.supabase.rpc('add_pos_shift_cash_move', {
    p_pos_shift_id: input.shiftId,
    p_kind: input.kind,
    p_amount: Math.round(input.amount),
    p_note: input.note
  })
  if (error) {
    console.error('addPosShiftCashMoveAction', error.message)
    return { ok: false, message: 'Nem sikerült rögzíteni a KP mozgást.' }
  }
  const result = data as { ok?: boolean; message?: string }
  if (!result?.ok) {
    return { ok: false, message: result?.message ?? 'Nem sikerült rögzíteni.' }
  }
  revalidateShiftPaths(input.shiftId)
  return { ok: true }
}

export async function previewPosShiftExpectedAction(
  shiftId: string
): Promise<{ ok: true; data: PosShiftExpected } | { ok: false; message: string }> {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return { ok: false, message: 'Nincs munkamenet.' }
  }
  const supabase = await createClient()
  if (!supabase) return { ok: false, message: 'Nincs adatbázis kapcsolat.' }
  return computePosShiftExpectedRpc(supabase, shiftId)
}

export async function getLastClosedCashAction(
  registerId: string
): Promise<{ ok: true; amount: number | null } | { ok: false; message: string }> {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return { ok: false, message: 'Nincs munkamenet.' }
  }
  const supabase = await createClient()
  if (!supabase) return { ok: false, message: 'Nincs adatbázis kapcsolat.' }
  const { data, error } = await supabase.rpc('get_last_closed_shift_cash', {
    p_pos_register_id: registerId
  })
  if (error) {
    console.error('getLastClosedCashAction', error.message)
    return { ok: false, message: 'Nem sikerült lekérni az előző zárót.' }
  }
  return {
    ok: true,
    amount: data == null ? null : Number(data)
  }
}

export async function getOpenPosShiftAction(
  registerId: string
): Promise<
  | {
      ok: true
      shift: {
        id: string
        openingCash: number
        openedAt: string
        openedByLabel: string | null
      } | null
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
    const shift = await getOpenPosShift(supabase, user.tenantId, registerId)
    if (!shift) return { ok: true, shift: null }
    return {
      ok: true,
      shift: {
        id: shift.id,
        openingCash: shift.opening_cash,
        openedAt: shift.opened_at,
        openedByLabel: shift.opened_by_label
      }
    }
  } catch (err) {
    console.error('getOpenPosShiftAction', err)
    return { ok: false, message: 'Nem sikerült betölteni a műszakot.' }
  }
}
