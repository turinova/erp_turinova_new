'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'

import { requireWritableTenant } from '@/lib/tenancy/writable-context'
import {
  warehouseFormSchema,
  type WarehouseFormInput
} from '@/lib/warehouses/parse'

export type WarehouseActionResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

const RAKTARAK_PATH = '/torzsadatok/rendszer/raktarak'

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

function mapUniqueError(message: string): {
  message: string
  field?: string
} | null {
  if (
    message.includes('warehouses_tenant_code_alive') ||
    (message.includes('duplicate key') && message.includes('code'))
  ) {
    return {
      message: 'Már van ilyen kódú raktár ebben a cégben.',
      field: 'code'
    }
  }
  if (
    message.includes('warehouses_tenant_name_alive') ||
    (message.includes('duplicate key') && message.includes('name'))
  ) {
    return {
      message: 'Már van ilyen nevű raktár ebben a cégben.',
      field: 'name'
    }
  }
  if (message.includes('warehouses_one_default_alive')) {
    return {
      message: 'Egyszerre csak egy alapértelmezett raktár lehet.'
    }
  }
  if (message.includes('duplicate key')) {
    return { message: 'Már létezik ilyen raktár ebben a cégben.' }
  }
  return null
}

async function clearOtherDefaults(
  supabase: SupabaseClient,
  tenantId: string,
  exceptId?: string
) {
  let q = supabase
    .from('warehouses')
    .update({
      is_default: false,
      updated_at: new Date().toISOString()
    })
    .eq('tenant_id', tenantId)
    .eq('is_default', true)
    .is('deleted_at', null)

  if (exceptId) {
    q = q.neq('id', exceptId)
  }

  const { error } = await q
  if (error) {
    console.error('clearOtherDefaults', error.message)
    throw new Error('Nem sikerült frissíteni az alapértelmezett raktárat.')
  }
}

async function countAlive(
  supabase: SupabaseClient,
  tenantId: string,
  opts?: { activeOnly?: boolean; excludeId?: string }
): Promise<number> {
  let q = supabase
    .from('warehouses')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)

  if (opts?.activeOnly) {
    q = q.eq('is_active', true)
  }
  if (opts?.excludeId) {
    q = q.neq('id', opts.excludeId)
  }

  const { count, error } = await q
  if (error) {
    console.error('countAlive warehouses', error.message)
    throw new Error('Nem sikerült ellenőrizni a raktárakat.')
  }
  return count ?? 0
}

export async function createWarehouse(
  input: WarehouseFormInput
): Promise<WarehouseActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = warehouseFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Ellenőrizd a megadott adatokat.',
      fieldErrors: fieldErrorsFromZod(parsed.error.issues)
    }
  }

  const tenantId = ctx.user.tenantId!
  const aliveCount = await countAlive(ctx.supabase, tenantId)
  const isDefault = aliveCount === 0 ? true : parsed.data.isDefault
  const isActive = isDefault ? true : parsed.data.isActive

  if (isDefault) {
    await clearOtherDefaults(ctx.supabase, tenantId)
  }

  const { error } = await ctx.supabase.from('warehouses').insert({
    tenant_id: tenantId,
    name: parsed.data.name,
    code: parsed.data.code,
    is_default: isDefault,
    is_active: isActive,
    country: parsed.data.country,
    postal_code: parsed.data.postalCode,
    city: parsed.data.city,
    street: parsed.data.street,
    house_number: parsed.data.houseNumber,
    note: parsed.data.note
  })

  if (error) {
    const unique = mapUniqueError(error.message)
    return {
      ok: false,
      message: unique?.message ?? 'Nem sikerült létrehozni a raktárat.',
      fieldErrors: unique?.field
        ? { [unique.field]: unique.message }
        : undefined
    }
  }

  revalidatePath(RAKTARAK_PATH)
  return { ok: true }
}

export async function updateWarehouse(
  input: WarehouseFormInput & { id: string }
): Promise<WarehouseActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = warehouseFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Ellenőrizd a megadott adatokat.',
      fieldErrors: fieldErrorsFromZod(parsed.error.issues)
    }
  }

  const tenantId = ctx.user.tenantId!

  const { data: current, error: loadErr } = await ctx.supabase
    .from('warehouses')
    .select('id, is_default, is_active')
    .eq('id', input.id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle()

  if (loadErr || !current) {
    return { ok: false, message: 'A raktár nem található.' }
  }

  let isDefault = parsed.data.isDefault
  let isActive = parsed.data.isActive

  if (current.is_default && !isDefault) {
    const others = await countAlive(ctx.supabase, tenantId, {
      activeOnly: true,
      excludeId: input.id
    })
    if (others === 0) {
      return {
        ok: false,
        message:
          'Az egyetlen raktárnak alapértelmezettnek kell maradnia. Előbb hozz létre másikat.',
        fieldErrors: {
          isDefault:
            'Az egyetlen raktárnak alapértelmezettnek kell maradnia.'
        }
      }
    }
    return {
      ok: false,
      message:
        'Előbb jelölj ki másik alapértelmezett raktárat, mielőtt erről levennéd.',
      fieldErrors: {
        isDefault: 'Jelölj ki előbb másik alapértelmezett raktárat.'
      }
    }
  }

  if (current.is_active && !isActive) {
    if (current.is_default || isDefault) {
      return {
        ok: false,
        message:
          'Az alapértelmezett raktár nem inaktiválható. Előbb jelölj ki másikat.',
        fieldErrors: {
          isActive: 'Az alapértelmezett raktár nem inaktiválható.'
        }
      }
    }
    const otherActive = await countAlive(ctx.supabase, tenantId, {
      activeOnly: true,
      excludeId: input.id
    })
    if (otherActive === 0) {
      return {
        ok: false,
        message: 'Legalább egy aktív raktárnak maradnia kell.',
        fieldErrors: {
          isActive: 'Legalább egy aktív raktárnak maradnia kell.'
        }
      }
    }
  }

  if (isDefault) {
    isActive = true
    await clearOtherDefaults(ctx.supabase, tenantId, input.id)
  }

  const { data, error } = await ctx.supabase
    .from('warehouses')
    .update({
      name: parsed.data.name,
      code: parsed.data.code,
      is_default: isDefault,
      is_active: isActive,
      country: parsed.data.country,
      postal_code: parsed.data.postalCode,
      city: parsed.data.city,
      street: parsed.data.street,
      house_number: parsed.data.houseNumber,
      note: parsed.data.note,
      updated_at: new Date().toISOString()
    })
    .eq('id', input.id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  if (error) {
    const unique = mapUniqueError(error.message)
    return {
      ok: false,
      message: unique?.message ?? 'Nem sikerült menteni a raktárat.',
      fieldErrors: unique?.field
        ? { [unique.field]: unique.message }
        : undefined
    }
  }

  if (!data) {
    return { ok: false, message: 'A raktár nem található.' }
  }

  revalidatePath(RAKTARAK_PATH)
  return { ok: true }
}

export async function softDeleteWarehouse(
  id: string
): Promise<WarehouseActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const tenantId = ctx.user.tenantId!

  const { data: current, error: loadErr } = await ctx.supabase
    .from('warehouses')
    .select('id, is_default, is_active')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle()

  if (loadErr || !current) {
    return { ok: false, message: 'A raktár nem található.' }
  }

  if (current.is_default) {
    return {
      ok: false,
      message:
        'Az alapértelmezett raktár nem törölhető. Előbb jelölj ki másikat.'
    }
  }

  const otherActive = await countAlive(ctx.supabase, tenantId, {
    activeOnly: true,
    excludeId: id
  })
  if (current.is_active && otherActive === 0) {
    return {
      ok: false,
      message: 'Legalább egy aktív raktárnak maradnia kell.'
    }
  }

  const { count: poCount, error: poErr } = await ctx.supabase
    .from('purchase_orders')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('warehouse_id', id)
    .is('deleted_at', null)

  if (poErr) {
    return { ok: false, message: 'Nem sikerült ellenőrizni a rendeléseket.' }
  }

  if ((poCount ?? 0) > 0) {
    return {
      ok: false,
      message:
        'Ehhez a raktárhoz már tartozik rendelés. Inaktiváld inkább, ne töröld.'
    }
  }

  const { data, error } = await ctx.supabase
    .from('warehouses')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_default: false
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  if (error) {
    return { ok: false, message: 'Nem sikerült törölni a raktárat.' }
  }

  if (!data) {
    return { ok: false, message: 'A raktár nem található.' }
  }

  revalidatePath(RAKTARAK_PATH)
  return { ok: true }
}
