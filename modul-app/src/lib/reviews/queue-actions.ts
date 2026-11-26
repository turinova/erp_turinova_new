'use server'

import { revalidatePath } from 'next/cache'

import {
  loadTenantContext,
  processOneReviewRow,
  type QueueRow
} from '@/lib/reviews/process-queue'
import {
  CANCEL_NOTE_MAX,
  canPostpone,
  isPostponeDays,
  isReviewCancelReason,
  postponedSendAfter
} from '@/lib/reviews/queue-rules'
import { THANK_SMS_SKIP_LABEL, isWithinSendWindow, type ThankSmsSkipReason } from '@/lib/reviews/thank-sms'
import { createServiceClient } from '@/lib/supabase/service'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'

export type ReviewQueueActionResult = { ok: true; message?: string } | { ok: false; message: string }

const PAGE = '/beallitasok/google-ertekelesek'
const MIGRATION_HINT = 'Ehhez futtasd a 20261026_review_queue_manage.sql migrációt.'

function isMissingMigration(code: string | undefined): boolean {
  return code === '42703' || code === '23514'
}

export async function postponeReviewSmsAction(
  id: string,
  days: number,
  note?: string
): Promise<ReviewQueueActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  if (!isPostponeDays(days)) return { ok: false, message: 'Érvénytelen halasztás.' }

  const { data: row, error } = await ctx.supabase
    .from('review_request_queue')
    .select('id, status, send_after, postponed_count')
    .eq('id', id)
    .eq('tenant_id', ctx.user.tenantId!)
    .maybeSingle()
  if (error) {
    return { ok: false, message: isMissingMigration(error.code) ? MIGRATION_HINT : 'Nem található.' }
  }
  if (!row) return { ok: false, message: 'Nem található.' }
  if (!canPostpone(row)) {
    return {
      ok: false,
      message: row.status === 'pending' ? 'Legfeljebb 3-szor halasztható. Töröld, ha nem kell.' : 'Már nem ütemezett.'
    }
  }

  const trimmed = note?.trim().slice(0, CANCEL_NOTE_MAX) || null
  const { error: upErr } = await ctx.supabase
    .from('review_request_queue')
    .update({
      send_after: postponedSendAfter(row.send_after, days, new Date()).toISOString(),
      postponed_count: row.postponed_count + 1,
      ...(trimmed ? { cancel_note: trimmed } : {})
    })
    .eq('id', id)
    .eq('status', 'pending')
  if (upErr) {
    console.error('postponeReviewSmsAction', upErr.message)
    return { ok: false, message: isMissingMigration(upErr.code) ? MIGRATION_HINT : 'Nem sikerült halasztani.' }
  }
  revalidatePath(PAGE)
  return { ok: true }
}

export async function cancelReviewSmsAction(
  id: string,
  reason: string,
  note?: string
): Promise<ReviewQueueActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  if (!isReviewCancelReason(reason)) return { ok: false, message: 'Válassz okot.' }

  const tenantId = ctx.user.tenantId!
  const { data, error } = await ctx.supabase
    .from('review_request_queue')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancelled_by: ctx.user.id,
      cancel_reason: reason,
      cancel_note: note?.trim().slice(0, CANCEL_NOTE_MAX) || null
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .eq('status', 'pending')
    .select('customer_id')
  if (error) {
    console.error('cancelReviewSmsAction', error.message)
    return { ok: false, message: isMissingMigration(error.code) ? MIGRATION_HINT : 'Nem sikerült törölni.' }
  }
  const customerId = data?.[0]?.customer_id as string | undefined
  if (!customerId) return { ok: false, message: 'Már nem ütemezett.' }

  if (reason === 'customer_request') {
    await ctx.supabase
      .from('customers')
      .update({ review_sms_consent: false })
      .eq('id', customerId)
      .eq('tenant_id', tenantId)
  }
  revalidatePath(PAGE)
  return { ok: true }
}

export async function sendReviewSmsNowAction(id: string): Promise<ReviewQueueActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  const now = new Date()
  if (!isWithinSendWindow(now)) {
    return { ok: false, message: 'Csak 9 és 19 óra között küldhető.' }
  }

  const tenantId = ctx.user.tenantId!
  const { data: own } = await ctx.supabase
    .from('review_request_queue')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .eq('status', 'pending')
    .maybeSingle()
  if (!own) return { ok: false, message: 'Már nem ütemezett.' }

  const admin = createServiceClient()
  if (!admin) return { ok: false, message: 'Az SMS küldés most nem elérhető.' }

  const { data: claimed } = await admin
    .from('review_request_queue')
    .update({ processed_at: now.toISOString() })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .eq('status', 'pending')
    .is('processed_at', null)
    .select('id, tenant_id, customer_id, quote_id, customer_special_order_id, handed_over_at, send_after')
  const row = claimed?.[0] as QueueRow | undefined
  if (!row) return { ok: false, message: 'Már feldolgozás alatt.' }

  const tenantCtx = await loadTenantContext(admin, tenantId)
  const { outcome, reason } = await processOneReviewRow(admin, row, tenantCtx, now, ctx.user.id)
  revalidatePath(PAGE)

  if (outcome === 'sent') return { ok: true, message: 'SMS elküldve.' }
  if (outcome === 'skipped') {
    const label = THANK_SMS_SKIP_LABEL[reason as ThankSmsSkipReason] ?? reason
    return { ok: false, message: `Nem küldtük el: ${label}.` }
  }
  return { ok: false, message: 'Az SMS küldése nem sikerült.' }
}
