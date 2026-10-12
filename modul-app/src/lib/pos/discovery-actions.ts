'use server'

import { getSessionUser } from '@/lib/auth/session'
import {
  loadAccessorySearchAliases,
  loadPosFrequentProducts,
  loadPosManufacturerChips,
  logPosSearchEvent,
  saveAccessorySearchAliases,
  type PosManufacturerChip
} from '@/lib/pos/discovery'
import type { SaleProductSearchItem } from '@/lib/sales/queries'
import { createClient } from '@/lib/supabase/server'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'

export async function loadPosFrequentAction(
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
    const rows = await loadPosFrequentProducts(
      supabase,
      user.tenantId,
      warehouseId
    )
    return { ok: true, rows }
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : 'Nem sikerült a gyakori termékeket betölteni.'
    }
  }
}

export async function loadPosManufacturerChipsAction(): Promise<
  | { ok: true; chips: PosManufacturerChip[] }
  | { ok: false; message: string }
> {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return { ok: false, message: 'Nincs munkamenet.' }
  }
  const supabase = await createClient()
  if (!supabase) return { ok: false, message: 'Nincs adatbázis kapcsolat.' }
  try {
    const chips = await loadPosManufacturerChips(supabase, user.tenantId, 6)
    return { ok: true, chips }
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : 'Nem sikerült a gyártókat betölteni.'
    }
  }
}

export async function logPosSearchEventAction(input: {
  warehouseId: string | null
  registerId: string | null
  q: string
  hitCount: number
  pickedAccessoryId?: string | null
  latencyMs?: number | null
}): Promise<void> {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) return
  const supabase = await createClient()
  if (!supabase) return
  await logPosSearchEvent(supabase, {
    tenantId: user.tenantId,
    warehouseId: input.warehouseId,
    registerId: input.registerId,
    userId: user.id ?? null,
    q: input.q,
    hitCount: input.hitCount,
    pickedAccessoryId: input.pickedAccessoryId,
    latencyMs: input.latencyMs
  })
}

export async function loadPosAliasesAction(
  accessoryId: string
): Promise<
  | { ok: true; aliases: string[] }
  | { ok: false; message: string }
> {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return { ok: false, message: 'Nincs munkamenet.' }
  }
  const supabase = await createClient()
  if (!supabase) return { ok: false, message: 'Nincs adatbázis kapcsolat.' }
  try {
    const aliases = await loadAccessorySearchAliases(
      supabase,
      user.tenantId,
      accessoryId
    )
    return { ok: true, aliases }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Nem sikerült betölteni.'
    }
  }
}

export async function savePosAliasesAction(
  accessoryId: string,
  aliasesRaw: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  const aliases = aliasesRaw
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  try {
    await saveAccessorySearchAliases(
      ctx.supabase,
      ctx.user.tenantId!,
      accessoryId,
      aliases
    )
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Nem sikerült menteni.'
    }
  }
}
