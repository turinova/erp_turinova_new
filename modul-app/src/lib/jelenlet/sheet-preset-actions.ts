'use server'

import { z } from 'zod'

import { getSessionUser } from '@/lib/auth/session'
import { listEmployeeTypes } from '@/lib/jelenlet/employee-types-queries'
import {
  normalizeSheetRules,
  sheetRulesSchema,
  type SheetPresetOption
} from '@/lib/jelenlet/sheet-rules'
import { createClient } from '@/lib/supabase/server'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'

export type SheetWizardData = {
  presets: SheetPresetOption[]
  employeeTypes: { id: string; name: string; code: string }[]
  /** Hivatalos sablon nyitó/záró rotáció alapja: Bolt + Iroda típus. */
  defaultRotationTypeIds: string[]
  canWrite: boolean
}

export type SheetWizardDataResult =
  | { ok: true; data: SheetWizardData }
  | { ok: false; message: string }

export async function loadSheetWizardDataAction(): Promise<SheetWizardDataResult> {
  const user = await getSessionUser()
  if (!user?.tenantId || !user.hasMembership || user.isDevSession) {
    return { ok: false, message: 'Nincs aktív céged.' }
  }
  const supabase = await createClient()
  if (!supabase) return { ok: false, message: 'Az adatbázis kapcsolat nem elérhető.' }

  const [types, presetsRes] = await Promise.all([
    listEmployeeTypes(supabase, user.tenantId),
    supabase
      .from('hr_sheet_presets')
      .select('id, name, rules')
      .eq('tenant_id', user.tenantId)
      .order('name', { ascending: true })
      .limit(50)
  ])
  if (presetsRes.error) return { ok: false, message: presetsRes.error.message }

  return {
    ok: true,
    data: {
      presets: (presetsRes.data ?? []).map((p) => ({
        id: p.id as string,
        name: p.name as string,
        rules: normalizeSheetRules(p.rules),
        builtin: false
      })),
      employeeTypes: types.map((t) => ({ id: t.id, name: t.name, code: t.code })),
      defaultRotationTypeIds: types
        .filter((t) => ['bolt', 'iroda', 'bolti_dolgozo'].includes(t.code.toLowerCase()))
        .map((t) => t.id),
      canWrite: user.role !== 'viewer'
    }
  }
}

const savePresetSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  name: z.string().trim().min(1, 'Add meg a sablon nevét.').max(80),
  rules: sheetRulesSchema
})

export type SavePresetResult =
  | { ok: true; preset: SheetPresetOption }
  | { ok: false; message: string }

export async function saveSheetPresetAction(
  input: z.input<typeof savePresetSchema>
): Promise<SavePresetResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = savePresetSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Érvénytelen sablon.' }
  }
  const d = parsed.data
  const row = {
    tenant_id: ctx.user.tenantId!,
    name: d.name,
    base: d.rules.base,
    rules: d.rules,
    updated_at: new Date().toISOString()
  }

  const query = d.id
    ? ctx.supabase
        .from('hr_sheet_presets')
        .update(row)
        .eq('id', d.id)
        .eq('tenant_id', ctx.user.tenantId!)
        .select('id, name, rules')
        .single()
    : ctx.supabase
        .from('hr_sheet_presets')
        .insert({ ...row, created_by: ctx.user.id })
        .select('id, name, rules')
        .single()

  const { data, error } = await query
  if (error || !data) {
    if (error?.message.includes('hr_sheet_presets_tenant_name')) {
      return { ok: false, message: 'Ilyen nevű sablon már van.' }
    }
    return { ok: false, message: error?.message ?? 'Mentés sikertelen.' }
  }

  return {
    ok: true,
    preset: {
      id: data.id as string,
      name: data.name as string,
      rules: normalizeSheetRules(data.rules),
      builtin: false
    }
  }
}

export async function deleteSheetPresetAction(input: {
  id: string
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  if (!z.string().uuid().safeParse(input.id).success) {
    return { ok: false, message: 'Érvénytelen sablon.' }
  }
  const { error } = await ctx.supabase
    .from('hr_sheet_presets')
    .delete()
    .eq('id', input.id)
    .eq('tenant_id', ctx.user.tenantId!)
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}
