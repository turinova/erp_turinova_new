import type { SupabaseClient } from '@supabase/supabase-js'

import { tenantHasQuoteReadySms } from '@/lib/sms/entitlement'
import {
  getTenantSmsTemplate,
  insertSmsSendEvent
} from '@/lib/sms/templates'
import {
  joinMaterialNames,
  normalizeE164,
  renderSmsTemplate,
  smsSegments
} from '@/lib/sms/text'
import { sendTwilioSms } from '@/lib/sms/twilio'
import {
  QUOTE_READY_TEMPLATE_KEY,
  type QuoteReadySmsCandidate,
  type SmsSkipReason
} from '@/lib/sms/types'

export type QuoteReadySmsResult =
  | { status: 'sent'; sid: string }
  | { status: 'skipped'; reason: SmsSkipReason }
  | { status: 'failed'; error: string }

async function loadMaterialNames(
  supabase: SupabaseClient,
  quoteId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('quote_material_lines')
    .select('material_name')
    .eq('quote_id', quoteId)

  if (error) {
    console.error('loadMaterialNames', error.message)
    return []
  }

  return (data ?? []).map((r) => (r.material_name as string) || '')
}

async function loadCompanyName(
  supabase: SupabaseClient,
  tenantId: string,
  fallback: string
): Promise<string> {
  const { data } = await supabase
    .from('tenant_companies')
    .select('name')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  const name = data?.name?.trim()
  return name || fallback
}

function evaluateEligibility(input: {
  customerId: string | null
  customerName: string
  mobile: string | null
  smsNotification: boolean
  alreadySentAt: string | null
}): Pick<QuoteReadySmsCandidate, 'eligible' | 'skipReason'> {
  if (input.alreadySentAt) {
    return { eligible: false, skipReason: 'already_sent' }
  }
  if (!input.customerId) {
    return { eligible: false, skipReason: 'no_customer' }
  }
  if (!input.smsNotification) {
    return { eligible: false, skipReason: 'no_opt_in' }
  }
  if (!normalizeE164(input.mobile)) {
    return { eligible: false, skipReason: 'bad_phone' }
  }
  return { eligible: true, skipReason: null }
}

/** Preview for confirm modal (does not send). */
export async function listQuoteReadySmsCandidates(
  supabase: SupabaseClient,
  tenantId: string,
  quoteIds: string[]
): Promise<{
  hasAddon: boolean
  candidates: QuoteReadySmsCandidate[]
}> {
  const uniqueIds = [...new Set(quoteIds.filter(Boolean))]
  if (uniqueIds.length === 0) {
    return { hasAddon: false, candidates: [] }
  }

  const hasAddon = await tenantHasQuoteReadySms(supabase, tenantId)
  if (!hasAddon) {
    return {
      hasAddon: false,
      candidates: uniqueIds.map((quoteId) => ({
        quoteId,
        orderNumber: '—',
        customerId: null,
        customerName: '—',
        mobile: null,
        eligible: false,
        skipReason: 'no_entitlement',
        alreadySentAt: null
      }))
    }
  }

  const { data, error } = await supabase
    .from('quotes')
    .select(
      `
      id,
      order_number,
      ready_notification_sent_at,
      customer_id,
      customers (
        id,
        name,
        mobile,
        sms_notification
      )
    `
    )
    .eq('tenant_id', tenantId)
    .in('id', uniqueIds)
    .is('deleted_at', null)

  if (error) {
    console.error('listQuoteReadySmsCandidates', error.message)
    throw new Error('Nem sikerült betölteni az SMS jelölteket.')
  }

  const byId = new Map((data ?? []).map((row) => [row.id as string, row]))

  const candidates: QuoteReadySmsCandidate[] = uniqueIds.map((quoteId) => {
    const row = byId.get(quoteId)
    if (!row) {
      return {
        quoteId,
        orderNumber: '—',
        customerId: null,
        customerName: '—',
        mobile: null,
        eligible: false,
        skipReason: 'no_customer',
        alreadySentAt: null
      }
    }

    const customers = row.customers as
      | {
          id: string
          name: string
          mobile: string | null
          sms_notification: boolean
        }
      | {
          id: string
          name: string
          mobile: string | null
          sms_notification: boolean
        }[]
      | null
    const customer = Array.isArray(customers) ? customers[0] : customers
    const alreadySentAt =
      (row.ready_notification_sent_at as string | null) ?? null
    const evalResult = evaluateEligibility({
      customerId: customer?.id ?? (row.customer_id as string | null),
      customerName: customer?.name ?? '—',
      mobile: customer?.mobile ?? null,
      smsNotification: Boolean(customer?.sms_notification),
      alreadySentAt
    })

    return {
      quoteId,
      orderNumber: (row.order_number as string) || '—',
      customerId: customer?.id ?? null,
      customerName: customer?.name ?? '—',
      mobile: customer?.mobile ?? null,
      eligible: evalResult.eligible,
      skipReason: evalResult.skipReason,
      alreadySentAt
    }
  })

  return { hasAddon, candidates }
}

/**
 * Send quote-ready SMS after status→ready.
 * Never throws for Twilio failures — returns status for toast.
 */
export async function sendQuoteReadySms(input: {
  supabase: SupabaseClient
  tenantId: string
  tenantName: string
  quoteId: string
  userId: string | null
  /** Explicit user choice from modal. */
  sendSms: boolean
}): Promise<QuoteReadySmsResult> {
  const { supabase, tenantId, quoteId } = input

  if (!input.sendSms) {
    await insertSmsSendEvent(supabase, {
      tenantId,
      quoteId,
      templateKey: QUOTE_READY_TEMPLATE_KEY,
      status: 'skipped',
      skipReason: 'user_declined',
      createdBy: input.userId
    })
    return { status: 'skipped', reason: 'user_declined' }
  }

  const hasAddon = await tenantHasQuoteReadySms(supabase, tenantId)
  if (!hasAddon) {
    await insertSmsSendEvent(supabase, {
      tenantId,
      quoteId,
      templateKey: QUOTE_READY_TEMPLATE_KEY,
      status: 'skipped',
      skipReason: 'no_entitlement',
      createdBy: input.userId
    })
    return { status: 'skipped', reason: 'no_entitlement' }
  }

  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .select(
      `
      id,
      order_number,
      ready_notification_sent_at,
      customer_id,
      customers (
        id,
        name,
        mobile,
        sms_notification
      )
    `
    )
    .eq('id', quoteId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle()

  if (quoteError || !quote) {
    return { status: 'failed', error: 'Megrendelés nem található SMS-hez.' }
  }

  if (quote.ready_notification_sent_at) {
    await insertSmsSendEvent(supabase, {
      tenantId,
      quoteId,
      customerId: quote.customer_id as string | null,
      templateKey: QUOTE_READY_TEMPLATE_KEY,
      status: 'skipped',
      skipReason: 'already_sent',
      createdBy: input.userId
    })
    return { status: 'skipped', reason: 'already_sent' }
  }

  const customers = quote.customers as
    | {
        id: string
        name: string
        mobile: string | null
        sms_notification: boolean
      }
    | {
        id: string
        name: string
        mobile: string | null
        sms_notification: boolean
      }[]
    | null
  const customer = Array.isArray(customers) ? customers[0] : customers

  const evalResult = evaluateEligibility({
    customerId: customer?.id ?? (quote.customer_id as string | null),
    customerName: customer?.name ?? '',
    mobile: customer?.mobile ?? null,
    smsNotification: Boolean(customer?.sms_notification),
    alreadySentAt: null
  })

  if (!evalResult.eligible && evalResult.skipReason) {
    await insertSmsSendEvent(supabase, {
      tenantId,
      quoteId,
      customerId: customer?.id ?? null,
      templateKey: QUOTE_READY_TEMPLATE_KEY,
      toE164: normalizeE164(customer?.mobile ?? null),
      status: 'skipped',
      skipReason: evalResult.skipReason,
      createdBy: input.userId
    })
    return { status: 'skipped', reason: evalResult.skipReason }
  }

  const toE164 = normalizeE164(customer?.mobile ?? null)
  if (!toE164 || !customer) {
    await insertSmsSendEvent(supabase, {
      tenantId,
      quoteId,
      customerId: customer?.id ?? null,
      templateKey: QUOTE_READY_TEMPLATE_KEY,
      status: 'skipped',
      skipReason: 'bad_phone',
      createdBy: input.userId
    })
    return { status: 'skipped', reason: 'bad_phone' }
  }

  const [template, materials, companyName] = await Promise.all([
    getTenantSmsTemplate(supabase, tenantId),
    loadMaterialNames(supabase, quoteId),
    loadCompanyName(supabase, tenantId, input.tenantName)
  ])

  const body = renderSmsTemplate(template, {
    customer_name: customer.name,
    order_number: (quote.order_number as string) || '',
    company_name: companyName,
    material_name: joinMaterialNames(materials)
  })

  if (!body.trim()) {
    await insertSmsSendEvent(supabase, {
      tenantId,
      quoteId,
      customerId: customer.id,
      templateKey: QUOTE_READY_TEMPLATE_KEY,
      toE164,
      status: 'skipped',
      skipReason: 'empty_body',
      createdBy: input.userId
    })
    return { status: 'skipped', reason: 'empty_body' }
  }

  const twilio = await sendTwilioSms({ toE164, body })

  if (!twilio.ok) {
    await insertSmsSendEvent(supabase, {
      tenantId,
      quoteId,
      customerId: customer.id,
      templateKey: QUOTE_READY_TEMPLATE_KEY,
      toE164,
      bodyLength: twilio.bodyLength,
      segments: twilio.segments,
      status: 'failed',
      errorCode: twilio.error.slice(0, 200),
      createdBy: input.userId
    })
    return { status: 'failed', error: twilio.error }
  }

  const sentAt = new Date().toISOString()
  const { error: stampError } = await supabase
    .from('quotes')
    .update({ ready_notification_sent_at: sentAt })
    .eq('id', quoteId)
    .eq('tenant_id', tenantId)
    .is('ready_notification_sent_at', null)

  if (stampError) {
    console.error('ready_notification_sent_at', stampError.message)
  }

  await insertSmsSendEvent(supabase, {
    tenantId,
    quoteId,
    customerId: customer.id,
    templateKey: QUOTE_READY_TEMPLATE_KEY,
    toE164,
    bodyLength: twilio.bodyLength,
    segments: twilio.segments || smsSegments(body),
    providerSid: twilio.sid,
    status: 'sent',
    createdBy: input.userId
  })

  return { status: 'sent', sid: twilio.sid }
}
