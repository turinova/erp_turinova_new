'use server'

import { revalidatePath } from 'next/cache'

import { requireWritableTenant } from '@/lib/tenancy/writable-context'
import { unitFormSchema } from '@/lib/units/parse'

export type UnitActionResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

const EGYSEGEK_PATH = '/torzsadatok/rendszer/egysegek'

function mapUniqueError(message: string): {
  field?: 'name' | 'shortform'
  message: string
} | null {
  if (
    message.includes('units_tenant_name_alive') ||
    (message.includes('duplicate key') && message.includes('name'))
  ) {
    return {
      field: 'name',
      message: 'Már van ilyen nevű egység ebben a cégben.'
    }
  }
  if (
    message.includes('units_tenant_shortform_alive') ||
    (message.includes('duplicate key') && message.includes('shortform'))
  ) {
    return {
      field: 'shortform',
      message: 'Már van ilyen rövidítésű egység ebben a cégben.'
    }
  }
  if (message.includes('duplicate key')) {
    return {
      message: 'Már van ilyen nevű vagy rövidítésű egység ebben a cégben.'
    }
  }
  return null
}

function fieldErrorsFromZod(
  issues: { path: (string | number)[]; message: string }[]
): Record<string, string> {
  const fieldErrors: Record<string, string> = {}
  for (const issue of issues) {
    const key = issue.path[0]
    if (typeof key === 'string' && !fieldErrors[key]) {
      fieldErrors[key] = issue.message
    }
  }
  return fieldErrors
}

export async function createUnit(input: {
  name: string
  shortform: string
}): Promise<UnitActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = unitFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Ellenőrizd a megadott adatokat.',
      fieldErrors: fieldErrorsFromZod(parsed.error.issues)
    }
  }

  const { error } = await ctx.supabase.from('units').insert({
    tenant_id: ctx.user.tenantId!,
    name: parsed.data.name,
    shortform: parsed.data.shortform
  })

  if (error) {
    const unique = mapUniqueError(error.message)
    return {
      ok: false,
      message: unique?.message ?? 'Nem sikerült létrehozni az egységet.',
      fieldErrors:
        unique?.field != null
          ? { [unique.field]: unique.message }
          : undefined
    }
  }

  revalidatePath(EGYSEGEK_PATH)
  return { ok: true }
}

export async function updateUnit(input: {
  id: string
  name: string
  shortform: string
}): Promise<UnitActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = unitFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Ellenőrizd a megadott adatokat.',
      fieldErrors: fieldErrorsFromZod(parsed.error.issues)
    }
  }

  const { data, error } = await ctx.supabase
    .from('units')
    .update({
      name: parsed.data.name,
      shortform: parsed.data.shortform,
      updated_at: new Date().toISOString()
    })
    .eq('id', input.id)
    .eq('tenant_id', ctx.user.tenantId!)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  if (error) {
    const unique = mapUniqueError(error.message)
    return {
      ok: false,
      message: unique?.message ?? 'Nem sikerült menteni az egységet.',
      fieldErrors:
        unique?.field != null
          ? { [unique.field]: unique.message }
          : undefined
    }
  }

  if (!data) {
    return { ok: false, message: 'Az egység nem található.' }
  }

  revalidatePath(EGYSEGEK_PATH)
  return { ok: true }
}

export async function softDeleteUnit(
  id: string
): Promise<UnitActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const { data, error } = await ctx.supabase
    .from('units')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('tenant_id', ctx.user.tenantId!)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  if (error) {
    return { ok: false, message: 'Nem sikerült törölni az egységet.' }
  }

  if (!data) {
    return { ok: false, message: 'Az egység nem található.' }
  }

  revalidatePath(EGYSEGEK_PATH)
  return { ok: true }
}
