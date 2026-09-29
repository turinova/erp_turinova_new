'use server'

import { revalidatePath } from 'next/cache'

import { buildHandoverSlipData } from '@/lib/handover-slip/build-data'
import {
  ensureHandoverSlipSettingsRow,
  getHandoverSlipSettings,
  settingsToDbRow
} from '@/lib/handover-slip/queries'
import {
  DEFAULT_HANDOVER_SLIP_SETTINGS,
  resolveSlipCopyTypes,
  shouldAutoPrint,
  type HandoverSlipData,
  type HandoverSlipSettings
} from '@/lib/handover-slip/types'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'

const SETTINGS_PATH = '/beallitasok/atveteli-blokk'

export type HandoverSlipActionResult =
  | { ok: true }
  | { ok: false; message: string }

async function tenantHasLapszabaszat(
  supabase: Parameters<typeof getHandoverSlipSettings>[0],
  tenantId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('tenant_entitlements')
    .select('feature_key')
    .eq('tenant_id', tenantId)
    .eq('feature_key', 'lapszabaszat')
    .maybeSingle()
  if (error) {
    console.error('tenantHasLapszabaszat', error.message)
    return false
  }
  return Boolean(data)
}

export async function saveHandoverSlipSettingsAction(
  input: HandoverSlipSettings
): Promise<HandoverSlipActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const tenantId = ctx.user.tenantId!
  if (!(await tenantHasLapszabaszat(ctx.supabase, tenantId))) {
    return {
      ok: false,
      message: 'A Lapszabászat modul nincs bekapcsolva ennél a cégnél.'
    }
  }

  if (input.copies === 0) {
    // ok
  } else if (input.copies !== 1 && input.copies !== 2) {
    return { ok: false, message: 'Érvénytelen példányszám.' }
  }

  if (!input.legalText.trim()) {
    return { ok: false, message: 'A jogi szöveg nem lehet üres.' }
  }

  const { error } = await ctx.supabase
    .from('tenant_handover_slip_settings')
    .upsert(settingsToDbRow(tenantId, input), { onConflict: 'tenant_id' })

  if (error) {
    console.error('saveHandoverSlipSettings', error.message)
    return { ok: false, message: 'Nem sikerült menteni a beállításokat.' }
  }

  revalidatePath(SETTINGS_PATH)
  return { ok: true }
}

export type PrepareHandoverSlipPrintResult =
  | { ok: true; print: false }
  | {
      ok: true
      print: true
      data: HandoverSlipData
      settings: HandoverSlipSettings
      copyTypes: Array<'original' | 'customer'>
    }
  | { ok: false; message: string }

/** Átadás után: kell-e nyomtatni + payload. */
export async function prepareHandoverSlipPrint(
  quoteId: string
): Promise<PrepareHandoverSlipPrintResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const tenantId = ctx.user.tenantId!
  if (!(await tenantHasLapszabaszat(ctx.supabase, tenantId))) {
    return { ok: true, print: false }
  }

  const settings = await ensureHandoverSlipSettingsRow(ctx.supabase, tenantId)
  if (!shouldAutoPrint(settings)) {
    return { ok: true, print: false }
  }

  const copyTypes = resolveSlipCopyTypes(settings)
  if (copyTypes.length === 0) return { ok: true, print: false }

  const data = await buildHandoverSlipData(ctx.supabase, tenantId, quoteId)
  if (!data) {
    return {
      ok: false,
      message: 'Nem sikerült összeállítani az átvételi blokk adatait.'
    }
  }

  return { ok: true, print: true, data, settings, copyTypes }
}

/** Beállítások oldal: aktuális settings (ensure row). */
export async function loadHandoverSlipSettingsAction(): Promise<HandoverSlipSettings> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ...DEFAULT_HANDOVER_SLIP_SETTINGS }
  return ensureHandoverSlipSettingsRow(ctx.supabase, ctx.user.tenantId!)
}
