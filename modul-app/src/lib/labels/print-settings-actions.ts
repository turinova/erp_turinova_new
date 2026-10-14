'use server'

import { getSessionUser } from '@/lib/auth/session'
import {
  getLabelPrintSettings,
  normalizeLabelPrintSettings,
  type LabelPrintSettings
} from '@/lib/labels/print-settings'
import { createClient } from '@/lib/supabase/server'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'

export type LoadLabelPrintSettingsResult =
  | { ok: true; settings: LabelPrintSettings; canWrite: boolean }
  | { ok: false; message: string }

export type SaveLabelPrintSettingsResult =
  | { ok: true; settings: LabelPrintSettings }
  | { ok: false; message: string }

export async function loadLabelPrintSettingsAction(): Promise<LoadLabelPrintSettingsResult> {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return { ok: false, message: 'Nincs munkamenet.' }
  }
  const supabase = await createClient()
  if (!supabase) return { ok: false, message: 'Nincs adatbázis kapcsolat.' }

  const settings = await getLabelPrintSettings(supabase, user.tenantId)
  return {
    ok: true,
    settings,
    canWrite: Boolean(user.role && user.role !== 'viewer')
  }
}

export async function saveLabelPrintSettingsAction(input: {
  offsetXMm: number
  offsetYMm: number
}): Promise<SaveLabelPrintSettingsResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const settings = normalizeLabelPrintSettings(input)
  const tenantId = ctx.user.tenantId!

  const { error } = await ctx.supabase.from('tenant_label_print_settings').upsert(
    {
      tenant_id: tenantId,
      offset_x_mm: settings.offsetXMm,
      offset_y_mm: settings.offsetYMm,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'tenant_id' }
  )

  if (error) {
    console.error('saveLabelPrintSettingsAction', error.message)
    return { ok: false, message: 'Nem sikerült menteni az illesztést.' }
  }

  return { ok: true, settings }
}
