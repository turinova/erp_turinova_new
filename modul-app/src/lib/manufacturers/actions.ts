'use server'

import { revalidatePath } from 'next/cache'

import { manufacturerFormSchema } from '@/lib/manufacturers/parse'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'

export type ManufacturerActionResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

const GYARTOK_PATH = '/torzsadatok/rendszer/gyartok'

function mapUniqueNameError(message: string): string | null {
  if (
    message.includes('manufacturers_tenant_name_alive') ||
    message.includes('duplicate key')
  ) {
    return 'Már van ilyen nevű gyártó ebben a cégben.'
  }
  return null
}

export async function createManufacturer(input: {
  name: string
}): Promise<ManufacturerActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = manufacturerFormSchema.safeParse({ name: input.name })
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (typeof key === 'string' && !fieldErrors[key]) {
        fieldErrors[key] = issue.message
      }
    }
    return {
      ok: false,
      message: 'Ellenőrizd a megadott adatokat.',
      fieldErrors
    }
  }

  const { error } = await ctx.supabase.from('manufacturers').insert({
    tenant_id: ctx.user.tenantId!,
    name: parsed.data.name
  })

  if (error) {
    const unique = mapUniqueNameError(error.message)
    return {
      ok: false,
      message: unique ?? 'Nem sikerült létrehozni a gyártót.',
      fieldErrors: unique ? { name: unique } : undefined
    }
  }

  revalidatePath(GYARTOK_PATH)
  return { ok: true }
}

export async function updateManufacturer(input: {
  id: string
  name: string
}): Promise<ManufacturerActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = manufacturerFormSchema.safeParse({ name: input.name })
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (typeof key === 'string' && !fieldErrors[key]) {
        fieldErrors[key] = issue.message
      }
    }
    return {
      ok: false,
      message: 'Ellenőrizd a megadott adatokat.',
      fieldErrors
    }
  }

  const { data, error } = await ctx.supabase
    .from('manufacturers')
    .update({
      name: parsed.data.name,
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
      message: unique ?? 'Nem sikerült menteni a gyártót.',
      fieldErrors: unique ? { name: unique } : undefined
    }
  }

  if (!data) {
    return { ok: false, message: 'A gyártó nem található.' }
  }

  revalidatePath(GYARTOK_PATH)
  return { ok: true }
}

export async function softDeleteManufacturer(
  id: string
): Promise<ManufacturerActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const { data, error } = await ctx.supabase
    .from('manufacturers')
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
    return { ok: false, message: 'Nem sikerült törölni a gyártót.' }
  }

  if (!data) {
    return { ok: false, message: 'A gyártó nem található.' }
  }

  revalidatePath(GYARTOK_PATH)
  return { ok: true }
}
