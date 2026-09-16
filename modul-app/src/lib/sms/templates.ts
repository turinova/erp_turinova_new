import type { SupabaseClient } from '@supabase/supabase-js'

import {
  DEFAULT_QUOTE_READY_SMS_BODY,
  QUOTE_READY_TEMPLATE_KEY,
  type SmsSendStatus,
  type SmsSkipReason,
  type SmsTemplateKey
} from '@/lib/sms/types'

export async function getTenantSmsTemplate(
  supabase: SupabaseClient,
  tenantId: string,
  templateKey: SmsTemplateKey = QUOTE_READY_TEMPLATE_KEY
): Promise<string> {
  const { data, error } = await supabase
    .from('tenant_sms_templates')
    .select('body')
    .eq('tenant_id', tenantId)
    .eq('template_key', templateKey)
    .maybeSingle()

  if (error) {
    console.error('getTenantSmsTemplate', error.message)
    return DEFAULT_QUOTE_READY_SMS_BODY
  }

  const body = data?.body?.trim()
  return body || DEFAULT_QUOTE_READY_SMS_BODY
}

export async function upsertTenantSmsTemplate(
  supabase: SupabaseClient,
  input: {
    tenantId: string
    templateKey: SmsTemplateKey
    body: string
  }
): Promise<{ ok: true } | { ok: false; message: string }> {
  const body = input.body.trim()
  if (!body) {
    return { ok: false, message: 'A sablon szövege nem lehet üres.' }
  }
  if (body.length > 600) {
    return { ok: false, message: 'A sablon legfeljebb 600 karakter.' }
  }

  const { error } = await supabase.from('tenant_sms_templates').upsert(
    {
      tenant_id: input.tenantId,
      template_key: input.templateKey,
      body,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'tenant_id,template_key' }
  )

  if (error) {
    console.error('upsertTenantSmsTemplate', error.message)
    return { ok: false, message: 'Nem sikerült menteni a sablont.' }
  }

  return { ok: true }
}

export type SmsLedgerInsert = {
  tenantId: string
  quoteId?: string | null
  customerId?: string | null
  templateKey: SmsTemplateKey
  toE164?: string | null
  bodyLength?: number
  segments?: number
  providerSid?: string | null
  status: SmsSendStatus
  errorCode?: string | null
  skipReason?: SmsSkipReason | null
  createdBy?: string | null
}

export async function insertSmsSendEvent(
  supabase: SupabaseClient,
  row: SmsLedgerInsert
): Promise<void> {
  const { error } = await supabase.from('sms_send_events').insert({
    tenant_id: row.tenantId,
    quote_id: row.quoteId ?? null,
    customer_id: row.customerId ?? null,
    template_key: row.templateKey,
    to_e164: row.toE164 ?? null,
    body_length: row.bodyLength ?? 0,
    segments: row.segments ?? 0,
    provider: 'twilio',
    provider_sid: row.providerSid ?? null,
    status: row.status,
    error_code: row.errorCode ?? null,
    skip_reason: row.skipReason ?? null,
    created_by: row.createdBy ?? null
  })

  if (error) {
    console.error('insertSmsSendEvent', error.message)
  }
}

/** Billable SMS count for a calendar month (UTC). */
export async function countBillableSmsForMonth(
  supabase: SupabaseClient,
  tenantId: string,
  year: number,
  month: number
): Promise<number> {
  const start = new Date(Date.UTC(year, month - 1, 1)).toISOString()
  const end = new Date(Date.UTC(year, month, 1)).toISOString()

  const { count, error } = await supabase
    .from('sms_send_events')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .in('status', ['sent', 'delivered'])
    .gte('created_at', start)
    .lt('created_at', end)

  if (error) {
    console.error('countBillableSmsForMonth', error.message)
    return 0
  }

  return count ?? 0
}
