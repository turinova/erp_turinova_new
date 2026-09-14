'use server'

import { revalidatePath } from 'next/cache'

import { requireWritableTenant } from '@/lib/tenancy/writable-context'

export type PaymentMethodActionResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

const PATH = '/torzsadatok/rendszer/fizetesi-modok'
const AJANLATOK_PATH = '/ajanlatok'

function mapUniqueNameError(message: string): string | null {
  if (
    message.includes('payment_methods_tenant_name_alive') ||
    message.includes('duplicate key')
  ) {
    return 'Már van ilyen nevű fizetési mód ebben a cégben.'
  }
  return null
}

function validateName(name: string): {
  ok: true
  name: string
} | {
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

export async function createPaymentMethod(input: {
  name: string
  comment: string
  active: boolean
}): Promise<PaymentMethodActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const validated = validateName(input.name)
  if (!validated.ok) return validated

  const comment = input.comment.trim()

  const { error } = await ctx.supabase.from('payment_methods').insert({
    tenant_id: ctx.user.tenantId!,
    name: validated.name,
    comment: comment === '' ? null : comment,
    active: input.active
  })

  if (error) {
    const unique = mapUniqueNameError(error.message)
    return {
      ok: false,
      message: unique ?? 'Nem sikerült létrehozni a fizetési módot.',
      fieldErrors: unique ? { name: unique } : undefined
    }
  }

  revalidatePath(PATH)
  revalidatePath(AJANLATOK_PATH)
  return { ok: true }
}

export async function updatePaymentMethod(input: {
  id: string
  name: string
  comment: string
  active: boolean
}): Promise<PaymentMethodActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const validated = validateName(input.name)
  if (!validated.ok) return validated

  const comment = input.comment.trim()

  const { data, error } = await ctx.supabase
    .from('payment_methods')
    .update({
      name: validated.name,
      comment: comment === '' ? null : comment,
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
      message: unique ?? 'Nem sikerült menteni a fizetési módot.',
      fieldErrors: unique ? { name: unique } : undefined
    }
  }

  if (!data) {
    return { ok: false, message: 'A fizetési mód nem található.' }
  }

  revalidatePath(PATH)
  revalidatePath(AJANLATOK_PATH)
  return { ok: true }
}

export async function softDeletePaymentMethod(
  id: string
): Promise<PaymentMethodActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const { data, error } = await ctx.supabase
    .from('payment_methods')
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
    return { ok: false, message: 'Nem sikerült törölni a fizetési módot.' }
  }

  if (!data) {
    return { ok: false, message: 'A fizetési mód nem található.' }
  }

  revalidatePath(PATH)
  revalidatePath(AJANLATOK_PATH)
  return { ok: true }
}
