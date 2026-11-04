'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'

import { requireWritableTenant } from '@/lib/tenancy/writable-context'

export type PaymentMethodActionResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

const PATH = '/torzsadatok/rendszer/fizetesi-modok'
const AJANLATOK_PATH = '/ajanlatok'
const MEGRENDELESEK_PATH = '/megrendelesek'
const ERTEKESITESEK_PATH = '/ertekesitesek'

function revalidatePaymentPaths() {
  revalidatePath(PATH)
  revalidatePath(AJANLATOK_PATH)
  revalidatePath(MEGRENDELESEK_PATH)
  revalidatePath(ERTEKESITESEK_PATH)
}

function mapDbError(message: string): {
  message: string
  field?: string
} | null {
  if (
    message.includes('payment_methods_tenant_name_alive') ||
    message.includes('duplicate key')
  ) {
    if (message.includes('payment_methods_one_default_alive')) {
      return {
        message: 'Egyszerre csak egy alapértelmezett fizetési mód lehet.'
      }
    }
    return {
      message: 'Már van ilyen nevű fizetési mód ebben a cégben.',
      field: 'name'
    }
  }
  if (message.includes('payment_methods_one_default_alive')) {
    return {
      message: 'Egyszerre csak egy alapértelmezett fizetési mód lehet.'
    }
  }
  return null
}

function validateName(name: string):
  | { ok: true; name: string }
  | {
      ok: false
      message: string
      fieldErrors: Record<string, string>
    } {
  const trimmed = name.trim()
  if (!trimmed) {
    return {
      ok: false,
      message: 'Ellenőrizd a megadott adatokat.',
      fieldErrors: { name: 'A név kötelező.' }
    }
  }
  if (trimmed.length > 50) {
    return {
      ok: false,
      message: 'Ellenőrizd a megadott adatokat.',
      fieldErrors: { name: 'A név maximum 50 karakter lehet.' }
    }
  }
  return { ok: true, name: trimmed }
}

async function clearOtherDefaults(
  supabase: SupabaseClient,
  tenantId: string,
  exceptId?: string
) {
  let q = supabase
    .from('payment_methods')
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
    console.error('clearOtherPaymentDefaults', error.message)
    throw new Error('Nem sikerült frissíteni az alapértelmezett fizetési módot.')
  }
}

async function countAlive(
  supabase: SupabaseClient,
  tenantId: string,
  opts?: { activeOnly?: boolean; excludeId?: string }
): Promise<number> {
  let q = supabase
    .from('payment_methods')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)

  if (opts?.activeOnly) {
    q = q.eq('active', true)
  }
  if (opts?.excludeId) {
    q = q.neq('id', opts.excludeId)
  }

  const { count, error } = await q
  if (error) {
    console.error('countAlivePaymentMethods', error.message)
    throw new Error('Nem sikerült ellenőrizni a fizetési módokat.')
  }
  return count ?? 0
}

export async function createPaymentMethod(input: {
  name: string
  comment: string
  active: boolean
  isDefault: boolean
}): Promise<PaymentMethodActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const validated = validateName(input.name)
  if (!validated.ok) return validated

  const tenantId = ctx.user.tenantId!
  const comment = input.comment.trim()
  const activeCount = await countAlive(ctx.supabase, tenantId, {
    activeOnly: true
  })

  let isDefault = input.isDefault
  let active = input.active

  // Első aktív mód → mindig default (certainty).
  if (activeCount === 0 && active) {
    isDefault = true
  }

  if (isDefault) {
    active = true
    await clearOtherDefaults(ctx.supabase, tenantId)
  }

  const { error } = await ctx.supabase.from('payment_methods').insert({
    tenant_id: tenantId,
    name: validated.name,
    comment: comment === '' ? null : comment,
    active,
    is_default: isDefault
  })

  if (error) {
    const mapped = mapDbError(error.message)
    return {
      ok: false,
      message: mapped?.message ?? 'Nem sikerült létrehozni a fizetési módot.',
      fieldErrors: mapped?.field ? { [mapped.field]: mapped.message } : undefined
    }
  }

  revalidatePaymentPaths()
  return { ok: true }
}

export async function updatePaymentMethod(input: {
  id: string
  name: string
  comment: string
  active: boolean
  isDefault: boolean
}): Promise<PaymentMethodActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const validated = validateName(input.name)
  if (!validated.ok) return validated

  const tenantId = ctx.user.tenantId!
  const comment = input.comment.trim()

  const { data: current, error: loadErr } = await ctx.supabase
    .from('payment_methods')
    .select('id, is_default, active')
    .eq('id', input.id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle()

  if (loadErr || !current) {
    return { ok: false, message: 'A fizetési mód nem található.' }
  }

  const isDefault = input.isDefault
  let active = input.active

  if (current.is_default && !isDefault) {
    const others = await countAlive(ctx.supabase, tenantId, {
      activeOnly: true,
      excludeId: input.id
    })
    if (others === 0) {
      return {
        ok: false,
        message:
          'Az egyetlen aktív fizetési módnak alapértelmezettnek kell maradnia.',
        fieldErrors: {
          isDefault:
            'Az egyetlen aktív módnak alapértelmezettnek kell maradnia.'
        }
      }
    }
    return {
      ok: false,
      message:
        'Előbb jelölj ki másik alapértelmezett módot, mielőtt erről levennéd.',
      fieldErrors: {
        isDefault: 'Jelölj ki előbb másik alapértelmezett módot.'
      }
    }
  }

  if (current.active && !active) {
    if (current.is_default || isDefault) {
      return {
        ok: false,
        message:
          'Az alapértelmezett fizetési mód nem inaktiválható. Előbb jelölj ki mást.',
        fieldErrors: {
          active: 'Az alapértelmezett mód nem inaktiválható.'
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
        message: 'Legalább egy aktív fizetési módnak maradnia kell.',
        fieldErrors: {
          active: 'Legalább egy aktív módnak maradnia kell.'
        }
      }
    }
  }

  if (isDefault) {
    active = true
    await clearOtherDefaults(ctx.supabase, tenantId, input.id)
  }

  const { data, error } = await ctx.supabase
    .from('payment_methods')
    .update({
      name: validated.name,
      comment: comment === '' ? null : comment,
      active,
      is_default: isDefault,
      updated_at: new Date().toISOString()
    })
    .eq('id', input.id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  if (error) {
    const mapped = mapDbError(error.message)
    return {
      ok: false,
      message: mapped?.message ?? 'Nem sikerült menteni a fizetési módot.',
      fieldErrors: mapped?.field ? { [mapped.field]: mapped.message } : undefined
    }
  }

  if (!data) {
    return { ok: false, message: 'A fizetési mód nem található.' }
  }

  revalidatePaymentPaths()
  return { ok: true }
}

/** Lista „Alapnak” — másik mód defaulttá tétele egy kattintással. */
export async function setDefaultPaymentMethod(
  id: string
): Promise<PaymentMethodActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const tenantId = ctx.user.tenantId!

  const { data: current, error: loadErr } = await ctx.supabase
    .from('payment_methods')
    .select('id, is_default, active')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle()

  if (loadErr || !current) {
    return { ok: false, message: 'A fizetési mód nem található.' }
  }

  if (current.is_default) {
    return { ok: true }
  }

  await clearOtherDefaults(ctx.supabase, tenantId, id)

  const { data, error } = await ctx.supabase
    .from('payment_methods')
    .update({
      is_default: true,
      active: true,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  if (error) {
    const mapped = mapDbError(error.message)
    return {
      ok: false,
      message:
        mapped?.message ?? 'Nem sikerült beállítani az alapértelmezettet.'
    }
  }

  if (!data) {
    return { ok: false, message: 'A fizetési mód nem található.' }
  }

  revalidatePaymentPaths()
  return { ok: true }
}

export async function softDeletePaymentMethod(
  id: string
): Promise<PaymentMethodActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const tenantId = ctx.user.tenantId!

  const { data: current, error: loadErr } = await ctx.supabase
    .from('payment_methods')
    .select('id, is_default, active')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle()

  if (loadErr || !current) {
    return { ok: false, message: 'A fizetési mód nem található.' }
  }

  if (current.is_default) {
    return {
      ok: false,
      message:
        'Az alapértelmezett fizetési mód nem törölhető. Előbb jelölj ki másikat.'
    }
  }

  if (current.active) {
    const otherActive = await countAlive(ctx.supabase, tenantId, {
      activeOnly: true,
      excludeId: id
    })
    if (otherActive === 0) {
      return {
        ok: false,
        message: 'Legalább egy aktív fizetési módnak maradnia kell.'
      }
    }
  }

  const { data, error } = await ctx.supabase
    .from('payment_methods')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      active: false,
      is_default: false
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  if (error) {
    return { ok: false, message: 'Nem sikerült törölni a fizetési módot.' }
  }

  if (!data) {
    return { ok: false, message: 'A fizetési mód nem található.' }
  }

  revalidatePaymentPaths()
  return { ok: true }
}
