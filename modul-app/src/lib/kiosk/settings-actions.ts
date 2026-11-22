'use server'

import { revalidatePath } from 'next/cache'

import {
  generateKioskToken,
  hashKioskToken
} from '@/lib/kiosk/device-token'
import {
  isKioskEdgeTypeId,
  KIOSK_EDGE_TYPE_IDS,
  KIOSK_EDGE_TYPES
} from '@/lib/kiosk/edge-types'
import {
  ensureKioskSettingsRow,
  settingsToDbRow
} from '@/lib/kiosk/settings-queries'
import {
  isKioskCatalogMode,
  type KioskSettings
} from '@/lib/kiosk/settings-types'
import { tenantHasLapszabaszat } from '@/lib/lapszabaszat/entitlement'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'

const SETTINGS_PATH = '/beallitasok/kiosk'

export type KioskSettingsActionResult =
  | { ok: true; message?: string }
  | { ok: false; message: string }

export type KioskDeviceActionResult =
  | { ok: true; message?: string; token?: string; deviceId?: string }
  | { ok: false; message: string }

function clampInt(n: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

function normalizeSettings(input: KioskSettings): KioskSettings | string {
  if (!isKioskCatalogMode(input.catalogMode)) {
    return 'Érvénytelen anyagkatalógus mód.'
  }

  const edgeTypeMap: KioskSettings['edgeTypeMap'] = {}
  for (const [key, value] of Object.entries(input.edgeTypeMap ?? {})) {
    if (!isKioskEdgeTypeId(key)) continue
    const id = typeof value === 'string' ? value.trim() : ''
    if (id) edgeTypeMap[key] = id
  }

  const favoriteSheetIds = Array.from(
    new Set(
      (input.favoriteSheetIds ?? []).filter(
        (id) => typeof id === 'string' && id.trim().length > 0
      )
    )
  )

  const needsFavorites =
    input.catalogMode === 'favorites' ||
    input.catalogMode === 'stock_and_favorites'
  if (needsFavorites && favoriteSheetIds.length === 0) {
    return 'Jelölj ki legalább egy lapot.'
  }

  const maxPanelRows = clampInt(input.maxPanelRows, 1, 40, 8)
  const maxQtyPerLine = clampInt(input.maxQtyPerLine, 1, 100, 20)
  const idleWarnSec = clampInt(input.idleWarnSec, 30, 600, 75)
  const idleResetSec = clampInt(input.idleResetSec, 45, 900, 90)
  if (idleResetSec <= idleWarnSec) {
    return 'Az újrakezdés ideje legyen hosszabb, mint a figyelmeztetésé.'
  }

  return {
    enabled: Boolean(input.enabled),
    catalogMode: input.catalogMode,
    favoriteSheetIds,
    edgeTypeMap,
    maxPanelRows,
    maxQtyPerLine,
    idleWarnSec,
    idleResetSec
  }
}

export async function saveKioskSettingsAction(
  input: KioskSettings
): Promise<KioskSettingsActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const tenantId = ctx.user.tenantId!
  if (!(await tenantHasLapszabaszat(ctx.supabase, tenantId))) {
    return {
      ok: false,
      message: 'A Lapszabászat modul nincs bekapcsolva ennél a cégnél.'
    }
  }

  const normalized = normalizeSettings(input)
  if (typeof normalized === 'string') {
    return { ok: false, message: normalized }
  }

  // Élanyag UUID-k a tenant saját törzséből legyenek
  const mappedIds = Object.values(normalized.edgeTypeMap)
  if (mappedIds.length > 0) {
    const { data: edges, error } = await ctx.supabase
      .from('edge_materials')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .is('deleted_at', null)
      .in('id', mappedIds)

    if (error) {
      console.error('saveKioskSettings edges', error.message)
      return { ok: false, message: 'Nem sikerült ellenőrizni az élzárókat.' }
    }
    const okIds = new Set((edges ?? []).map((e) => e.id as string))
    for (const typeId of KIOSK_EDGE_TYPE_IDS) {
      const edgeId = normalized.edgeTypeMap[typeId]
      if (edgeId && !okIds.has(edgeId)) {
        const typeName =
          KIOSK_EDGE_TYPES.find((t) => t.id === typeId)?.name ?? typeId
        return {
          ok: false,
          message: `A(z) ${typeName} típushoz választott élzáró már nem elérhető. Válassz másikat.`
        }
      }
    }
  }

  if (normalized.favoriteSheetIds.length > 0) {
    const { data: sheets, error } = await ctx.supabase
      .from('sheet_materials')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .is('deleted_at', null)
      .in('id', normalized.favoriteSheetIds)

    if (error) {
      console.error('saveKioskSettings sheets', error.message)
      return { ok: false, message: 'Nem sikerült ellenőrizni a lapanyagokat.' }
    }
    const okIds = new Set((sheets ?? []).map((s) => s.id as string))
    if (normalized.favoriteSheetIds.some((id) => !okIds.has(id))) {
      return {
        ok: false,
        message: 'A kiválasztott lapok közül valamelyik már nem elérhető. Vedd ki a listából.'
      }
    }
  }

  await ensureKioskSettingsRow(ctx.supabase, tenantId)

  const { error: upsertError } = await ctx.supabase
    .from('tenant_kiosk_settings')
    .upsert(settingsToDbRow(tenantId, normalized), { onConflict: 'tenant_id' })

  if (upsertError) {
    console.error('saveKioskSettings', upsertError.message)
    return { ok: false, message: 'Nem sikerült menteni a kiosk beállításokat.' }
  }

  revalidatePath(SETTINGS_PATH)
  return { ok: true }
}

export async function createKioskDeviceAction(input: {
  name: string
}): Promise<KioskDeviceActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const tenantId = ctx.user.tenantId!
  if (!(await tenantHasLapszabaszat(ctx.supabase, tenantId))) {
    return {
      ok: false,
      message: 'A Lapszabászat modul nincs bekapcsolva ennél a cégnél.'
    }
  }

  const name = input.name.trim()
  if (!name) return { ok: false, message: 'Adj nevet a gépnek.' }
  if (name.length > 80) {
    return { ok: false, message: 'A gép neve legfeljebb 80 karakter lehet.' }
  }

  const token = generateKioskToken()
  const tokenHash = hashKioskToken(token)

  const { data, error } = await ctx.supabase
    .from('kiosk_devices')
    .insert({
      tenant_id: tenantId,
      name,
      token_hash: tokenHash,
      updated_at: new Date().toISOString()
    })
    .select('id')
    .single()

  if (error || !data?.id) {
    console.error('createKioskDevice', error?.message)
    return { ok: false, message: 'Nem sikerült hozzáadni a gépet.' }
  }

  revalidatePath(SETTINGS_PATH)
  return {
    ok: true,
    message: 'Gép hozzáadva. Nyisd meg a párosító linket a kiosk gépen.',
    token,
    deviceId: data.id as string
  }
}

export async function rotateKioskDeviceTokenAction(input: {
  deviceId: string
}): Promise<KioskDeviceActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const tenantId = ctx.user.tenantId!
  const token = generateKioskToken()
  const tokenHash = hashKioskToken(token)

  const { data, error } = await ctx.supabase
    .from('kiosk_devices')
    .update({
      token_hash: tokenHash,
      updated_at: new Date().toISOString()
    })
    .eq('id', input.deviceId)
    .eq('tenant_id', tenantId)
    .is('revoked_at', null)
    .select('id')
    .maybeSingle()

  if (error || !data?.id) {
    return { ok: false, message: 'Nem sikerült új párosító linket készíteni.' }
  }

  revalidatePath(SETTINGS_PATH)
  return {
    ok: true,
    message: 'Új párosító link kész. A régi link már nem működik.',
    token,
    deviceId: data.id as string
  }
}

export async function revokeKioskDeviceAction(input: {
  deviceId: string
}): Promise<KioskDeviceActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const tenantId = ctx.user.tenantId!
  const { data, error } = await ctx.supabase
    .from('kiosk_devices')
    .update({
      revoked_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', input.deviceId)
    .eq('tenant_id', tenantId)
    .is('revoked_at', null)
    .select('id')
    .maybeSingle()

  if (error || !data?.id) {
    return { ok: false, message: 'Nem sikerült eltávolítani a gépet.' }
  }

  revalidatePath(SETTINGS_PATH)
  return { ok: true, message: 'Gép eltávolítva.' }
}
