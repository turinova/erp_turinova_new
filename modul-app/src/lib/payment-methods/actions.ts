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
const PARTNER_SETTINGS_PATH = '/beallitasok/partner'

function revalidatePaymentPaths() {
  revalidatePath(PATH)
  revalidatePath(AJANLATOK_PATH)
  revalidatePath(MEGRENDELESEK_PATH)
  revalidatePath(ERTEKESITESEK_PATH)
  revalidatePath(PARTNER_SETTINGS_PATH)
}

function mapDbError(message: string): string | null {
  if (message.includes('payment_methods_one_default_alive')) {
    return 'Egyszerre csak egy alapértelmezett fizetési mód lehet.'
  }
  if (message.includes('payment_methods_legacy_reactivate_forbidden')) {
    return 'Ez egy régi fizetési mód, nem kapcsolható be újra.'
  }
  if (
    message.includes('payment_methods_system_name_locked') ||
    message.includes('payment_methods_system_kind_locked') ||
    message.includes('payment_methods_delete_forbidden')
  ) {
    return 'A fizetési módok neve fix, és nem törölhetők.'
  }
  return null
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

async function countActiveOthers(
  supabase: SupabaseClient,
  tenantId: string,
  excludeId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('payment_methods')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .eq('active', true)
    .neq('id', excludeId)

  if (error) {
    console.error('countActivePaymentMethods', error.message)
    throw new Error('Nem sikerült ellenőrizni a fizetési módokat.')
  }
  return count ?? 0
}

/** Fix rendszer-mód: csak megjegyzés, aktív, partner láthatóság, alapértelmezett. */
export async function updatePaymentMethod(input: {
  id: string
  comment: string
  active: boolean
  isDefault: boolean
  partnerVisible: boolean
}): Promise<PaymentMethodActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const tenantId = ctx.user.tenantId!
  const comment = input.comment.trim()
  if (comment.length > 500) {
    return {
      ok: false,
      message: 'Ellenőrizd a megadott adatokat.',
      fieldErrors: { comment: 'A megjegyzés maximum 500 karakter lehet.' }
    }
  }

  const { data: current, error: loadErr } = await ctx.supabase
    .from('payment_methods')
    .select('id, kind, is_default, active')
    .eq('id', input.id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle()

  if (loadErr || !current) {
    return { ok: false, message: 'A fizetési mód nem található.' }
  }

  const isDefault = input.isDefault
  let active = input.active

  if (!current.kind && active && !current.active) {
    return {
      ok: false,
      message: 'Ez egy régi fizetési mód, nem kapcsolható be újra.',
      fieldErrors: { active: 'Régi mód, nem kapcsolható be.' }
    }
  }
  if (!current.kind && isDefault && !current.is_default) {
    return {
      ok: false,
      message: 'Régi fizetési mód nem lehet alapértelmezett.'
    }
  }

  if (current.is_default && !isDefault) {
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
          'Az alapértelmezett fizetési mód nem kapcsolható ki. Előbb jelölj ki mást.',
        fieldErrors: {
          active: 'Az alapértelmezett mód nem kapcsolható ki.'
        }
      }
    }
    const otherActive = await countActiveOthers(
      ctx.supabase,
      tenantId,
      input.id
    )
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
      comment: comment === '' ? null : comment,
      active,
      is_default: isDefault,
      partner_visible: input.partnerVisible,
      updated_at: new Date().toISOString()
    })
    .eq('id', input.id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  if (error) {
    return {
      ok: false,
      message: mapDbError(error.message) ?? 'Nem sikerült menteni a fizetési módot.'
    }
  }

  if (!data) {
    return { ok: false, message: 'A fizetési mód nem található.' }
  }

  revalidatePaymentPaths()
  return { ok: true }
}

/** Lista sorakció: aktív ki / be egy kattintással (ugyanazok a szabályok). */
export async function setPaymentMethodActive(
  id: string,
  active: boolean
): Promise<PaymentMethodActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const tenantId = ctx.user.tenantId!
  const { data: current, error: loadErr } = await ctx.supabase
    .from('payment_methods')
    .select('id, comment, is_default, partner_visible')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle()

  if (loadErr || !current) {
    return { ok: false, message: 'A fizetési mód nem található.' }
  }

  return updatePaymentMethod({
    id,
    comment: (current.comment as string | null) ?? '',
    active,
    isDefault: Boolean(current.is_default),
    partnerVisible: current.partner_visible !== false
  })
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
    .select('id, kind, is_default, active')
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
  if (!current.kind) {
    return {
      ok: false,
      message: 'Régi fizetési mód nem lehet alapértelmezett.'
    }
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
    return {
      ok: false,
      message:
        mapDbError(error.message) ?? 'Nem sikerült beállítani az alapértelmezettet.'
    }
  }

  if (!data) {
    return { ok: false, message: 'A fizetési mód nem található.' }
  }

  revalidatePaymentPaths()
  return { ok: true }
}
