'use server'

import { revalidatePath } from 'next/cache'

import {
  getTenantSmsTemplate,
  upsertTenantSmsTemplate
} from '@/lib/sms/templates'
import { QUOTE_READY_TEMPLATE_KEY } from '@/lib/sms/types'
import { tenantHasQuoteReadySms } from '@/lib/sms/entitlement'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'

const SETTINGS_PATH = '/beallitasok/sms'

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
