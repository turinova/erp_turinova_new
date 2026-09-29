'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

import {
  getTenantSmsTemplate,
  upsertTenantSmsTemplate
} from '@/lib/sms/templates'
import {
  CSO_READY_TEMPLATE_KEY,
  QUOTE_READY_TEMPLATE_KEY
} from '@/lib/sms/types'
import { tenantHasQuoteReadySms } from '@/lib/sms/entitlement'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'

const SETTINGS_PATH = '/beallitasok/sms'

async function tenantHasCsoFeature(
  supabase: SupabaseClient,
  tenantId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('tenant_entitlements')
    .select('feature_key')
    .eq('tenant_id', tenantId)
    .eq('feature_key', 'customer_special_orders')
    .maybeSingle()

  if (error) {
    console.error('tenantHasCsoFeature', error.message)
    return false
  }
  return Boolean(data)
}

export async function saveQuoteReadySmsTemplate(
  body: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const hasAddon = await tenantHasQuoteReadySms(
    ctx.supabase,
    ctx.user.tenantId!
  )
  if (!hasAddon) {
    return { ok: false, message: 'Az SMS add-on nincs bekapcsolva.' }
  }

  const result = await upsertTenantSmsTemplate(ctx.supabase, {
    tenantId: ctx.user.tenantId!,
    templateKey: QUOTE_READY_TEMPLATE_KEY,
    body
  })

  if (!result.ok) return result

  revalidatePath(SETTINGS_PATH)
  return { ok: true }
}

export async function saveCsoReadySmsTemplate(
  body: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const hasCso = await tenantHasCsoFeature(ctx.supabase, ctx.user.tenantId!)
  const hasQuote = await tenantHasQuoteReadySms(
    ctx.supabase,
    ctx.user.tenantId!
  )
  if (!hasCso && !hasQuote) {
    return {
      ok: false,
      message: 'Nincs jogosultság az ügyfélrendelés SMS sablonhoz.'
    }
  }

  const result = await upsertTenantSmsTemplate(ctx.supabase, {
    tenantId: ctx.user.tenantId!,
    templateKey: CSO_READY_TEMPLATE_KEY,
    body
  })

  if (!result.ok) return result

  revalidatePath(SETTINGS_PATH)
  return { ok: true }
}

export async function loadQuoteReadySmsTemplate(): Promise<
  | { ok: true; body: string }
  | { ok: false; message: string }
> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const body = await getTenantSmsTemplate(
    ctx.supabase,
    ctx.user.tenantId!,
    QUOTE_READY_TEMPLATE_KEY
  )
  return { ok: true, body }
}

export async function loadCsoReadySmsTemplate(): Promise<
  | { ok: true; body: string }
  | { ok: false; message: string }
> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const body = await getTenantSmsTemplate(
    ctx.supabase,
    ctx.user.tenantId!,
    CSO_READY_TEMPLATE_KEY
  )
  return { ok: true, body }
}
