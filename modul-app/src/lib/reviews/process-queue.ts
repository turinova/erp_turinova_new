import type { SupabaseClient } from '@supabase/supabase-js'

import { googleReviewShortPath } from '@/lib/company/google-profile'
import { appOrigin } from '@/lib/order-status/format'
import { getTenantReviewSettings, type ReviewSettings } from '@/lib/reviews/settings'
import {
  evaluateThankSms,
  isWithinSendWindow,
  type ThankSmsSkipReason
} from '@/lib/reviews/thank-sms'
import { tenantHasAnySms } from '@/lib/sms/entitlement'
import { sendPlatformSms } from '@/lib/sms/send'
import { getTenantSmsTemplate, insertSmsSendEvent } from '@/lib/sms/templates'
import { normalizeE164, renderSmsTemplate, smsSegments } from '@/lib/sms/text'
import { REVIEW_THANKS_TEMPLATE_KEY } from '@/lib/sms/types'

const BATCH = 50

type QueueRow = {
  id: string
  tenant_id: string
  customer_id: string
  quote_id: string | null
  customer_special_order_id: string | null
  handed_over_at: string
}

type TenantContext = {
  settings: ReviewSettings
  hasSms: boolean
  reviewUrl: string | null
  shortUrl: string | null
  companyName: string
  template: string
}

export type ReviewQueueRunResult = {
  sent: number
  skipped: number
  failed: number
  deferred: boolean
}

async function loadTenantContext(admin: SupabaseClient, tenantId: string): Promise<TenantContext> {
  const [{ settings }, hasSms, companyRes, template] = await Promise.all([
    getTenantReviewSettings(admin, tenantId),
    tenantHasAnySms(admin, tenantId),
    admin
      .from('tenant_companies')
      .select('name, google_review_url, google_review_code')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    getTenantSmsTemplate(admin, tenantId, REVIEW_THANKS_TEMPLATE_KEY)
  ])
  const company = companyRes.data
  const code = company?.google_review_code ?? null
  return {
    settings,
    hasSms,
    reviewUrl: company?.google_review_url ?? null,
    shortUrl: code ? `${appOrigin()}${googleReviewShortPath(code)}?s=sms` : null,
    companyName: company?.name?.trim() || '',
    template
  }
}

async function finish(
  admin: SupabaseClient,
  rowId: string,
  status: 'sent' | 'skipped' | 'failed',
  skipReason: string | null
) {
  await admin
    .from('review_request_queue')
    .update({ status, skip_reason: skipReason })
    .eq('id', rowId)
}

/** Esedékes köszönő SMS-ek kiküldése (cron, service role). */
export async function processReviewThankSmsQueue(
  admin: SupabaseClient,
  now = new Date()
): Promise<ReviewQueueRunResult> {
  const result: ReviewQueueRunResult = { sent: 0, skipped: 0, failed: 0, deferred: false }
  if (!isWithinSendWindow(now)) return { ...result, deferred: true }

  const { data, error } = await admin
    .from('review_request_queue')
    .select('id, tenant_id, customer_id, quote_id, customer_special_order_id, handed_over_at')
    .eq('status', 'pending')
    .is('processed_at', null)
    .lte('send_after', now.toISOString())
    .order('send_after', { ascending: true })
    .limit(BATCH)

  if (error) {
    console.error('processReviewThankSmsQueue', error.message)
    return result
  }

  const tenants = new Map<string, TenantContext>()

  for (const row of (data ?? []) as QueueRow[]) {
    // Foglalás: párhuzamos futás ne küldjön kétszer.
    const { data: claimed } = await admin
      .from('review_request_queue')
      .update({ processed_at: now.toISOString() })
      .eq('id', row.id)
      .is('processed_at', null)
      .select('id')
    if (!claimed?.length) continue

    let ctx = tenants.get(row.tenant_id)
    if (!ctx) {
      ctx = await loadTenantContext(admin, row.tenant_id)
      tenants.set(row.tenant_id, ctx)
    }

    const [{ data: customer }, { data: lastClick }] = await Promise.all([
      admin
        .from('customers')
        .select('id, name, mobile, review_sms_consent, last_review_request_at, deleted_at')
        .eq('id', row.customer_id)
        .eq('tenant_id', row.tenant_id)
        .maybeSingle(),
      admin
        .from('google_review_link_clicks')
        .select('clicked_at')
        .eq('tenant_id', row.tenant_id)
        .eq('customer_id', row.customer_id)
        .order('clicked_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    ])

    const toE164 = normalizeE164(customer?.mobile ?? null)
    const verdict = evaluateThankSms({
      settingsEnabled: ctx.settings.thankSmsEnabled,
      hasReviewUrl: Boolean(ctx.reviewUrl && ctx.shortUrl),
      hasSmsAddon: ctx.hasSms,
      customerExists: Boolean(customer && !customer.deleted_at),
      consent: Boolean(customer?.review_sms_consent),
      phoneOk: Boolean(toE164),
      lastRequestAt: customer?.last_review_request_at ?? null,
      lastClickAt: lastClick?.clicked_at ?? null,
      frequencyDays: ctx.settings.frequencyDays,
      handedOverAt: row.handed_over_at,
      now
    })

    const ledgerBase = {
      tenantId: row.tenant_id,
      quoteId: row.quote_id,
      customerSpecialOrderId: row.customer_special_order_id,
      customerId: customer?.id ?? null,
      templateKey: REVIEW_THANKS_TEMPLATE_KEY,
      toE164
    }

    if (!verdict.ok) {
      await finish(admin, row.id, 'skipped', verdict.reason)
      if (verdict.reason !== 'disabled') {
        await insertSmsSendEvent(admin, {
          ...ledgerBase,
          status: 'skipped',
          skipReason: verdict.reason satisfies ThankSmsSkipReason
        })
      }
      result.skipped += 1
      continue
    }

    const body = renderSmsTemplate(ctx.template, {
      customer_name: customer?.name ?? '',
      company_name: ctx.companyName,
      review_url: ctx.shortUrl!
    })

    const sent = await sendPlatformSms({ toE164: toE164!, body })
    if (!sent.ok) {
      await finish(admin, row.id, 'failed', sent.error.slice(0, 200))
      await insertSmsSendEvent(admin, {
        ...ledgerBase,
        bodyLength: sent.bodyLength,
        segments: sent.segments,
        status: 'failed',
        errorCode: sent.error.slice(0, 200)
      })
      result.failed += 1
      continue
    }

    await finish(admin, row.id, 'sent', null)
    await admin
      .from('customers')
      .update({ last_review_request_at: now.toISOString() })
      .eq('id', row.customer_id)
      .eq('tenant_id', row.tenant_id)
    await insertSmsSendEvent(admin, {
      ...ledgerBase,
      bodyLength: sent.bodyLength,
      segments: sent.segments || smsSegments(body),
      providerSid: sent.sid,
      status: 'sent'
    })
    result.sent += 1
  }

  return result
}
