'use server'

import { revalidatePath } from 'next/cache'

import { requireWritableTenant } from '@/lib/tenancy/writable-context'

export type ProductionMachineActionResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

const PATH = '/torzsadatok/rendszer/gyartogepek'

function mapUniqueNameError(message: string): string | null {
  if (
    message.includes('production_machines_tenant_name_alive') ||
    message.includes('duplicate key')
  ) {
    return 'Már van ilyen nevű gyártógép ebben a cégben.'
  }
  return null
}

function validateName(name: string):
  | { ok: true; name: string }
  | { ok: false; message: string; fieldErrors: Record<string, string> } {
  const trimmed = name.trim()
  if (!trimmed) {
    return {
      ok: false,
      message: 'Ellenőrizd a megadott adatokat.',
      fieldErrors: { name: 'A név kötelező.' }
    }
  }
  if (trimmed.length > 100) {
    return {
      ok: false,
      message: 'Ellenőrizd a megadott adatokat.',
      fieldErrors: { name: 'A név maximum 100 karakter lehet.' }
    }
  }
  return { ok: true, name: trimmed }
}

function parseUsageLimit(raw: string):
  | { ok: true; value: number }
  | { ok: false; message: string; fieldErrors: Record<string, string> } {
  const normalized = raw.trim().replace(/\s/g, '').replace(',', '.')
  const value = Number(normalized)
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    return {
      ok: false,
      message: 'Ellenőrizd a megadott adatokat.',
      fieldErrors: {
        usageLimitPerDay: 'Pozitív egész számot adj meg (napi kapacitás).'
      }
    }
  }
  if (value > 100000) {
    return {
      ok: false,
      message: 'Ellenőrizd a megadott adatokat.',
      fieldErrors: { usageLimitPerDay: 'A napi limit túl magas.' }
    }
  }
  return { ok: true, value }
}

export async function createProductionMachine(input: {
  name: string
  comment: string
  usageLimitPerDayRaw: string
  active: boolean
}): Promise<ProductionMachineActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const validated = validateName(input.name)
  if (!validated.ok) return validated

  const limit = parseUsageLimit(input.usageLimitPerDayRaw)
  if (!limit.ok) return limit

  const comment = input.comment.trim()

  const { error } = await ctx.supabase.from('production_machines').insert({
    tenant_id: ctx.user.tenantId!,
    name: validated.name,
    comment: comment === '' ? null : comment,
    usage_limit_per_day: limit.value,
    active: input.active
  })

  if (error) {
    const unique = mapUniqueNameError(error.message)
    return {
      ok: false,
      message: unique ?? 'Nem sikerült létrehozni a gyártógépet.',
      fieldErrors: unique ? { name: unique } : undefined
    }
  }

  revalidatePath(PATH)
  return { ok: true }
}

export async function updateProductionMachine(input: {
  id: string
  name: string
  comment: string
  usageLimitPerDayRaw: string
  active: boolean
}): Promise<ProductionMachineActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const validated = validateName(input.name)
  if (!validated.ok) return validated

  const limit = parseUsageLimit(input.usageLimitPerDayRaw)
  if (!limit.ok) return limit

  const comment = input.comment.trim()

  const { data, error } = await ctx.supabase
    .from('production_machines')
    .update({
      name: validated.name,
      comment: comment === '' ? null : comment,
      usage_limit_per_day: limit.value,
      active: input.active,
      updated_at: new Date().toISOString()
    })
    .eq('id', input.id)
    .eq('tenant_id', ctx.user.tenantId!)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  if (error) {
    const unique = mapUniqueNameError(error.message)
    return {
      ok: false,
      message: unique ?? 'Nem sikerült menteni a gyártógépet.',
      fieldErrors: unique ? { name: unique } : undefined
    }
  }

  if (!data) {
    return { ok: false, message: 'A gyártógép nem található.' }
  }

  revalidatePath(PATH)
  return { ok: true }
}

export async function softDeleteProductionMachine(
  id: string
): Promise<ProductionMachineActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const { data, error } = await ctx.supabase
    .from('production_machines')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      active: false
    })
    .eq('id', id)
    .eq('tenant_id', ctx.user.tenantId!)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  if (error) {
    return { ok: false, message: 'Nem sikerült törölni a gyártógépet.' }
  }

  if (!data) {
    return { ok: false, message: 'A gyártógép nem található.' }
  }

  revalidatePath(PATH)
  return { ok: true }
}
