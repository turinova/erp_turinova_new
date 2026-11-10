'use server'

import { revalidatePath } from 'next/cache'

import {
  DEFAULT_HANDOVER_QR_TEXT,
  HANDOVER_QR_TEXT_MAX,
  type ReviewSettings
} from '@/lib/reviews/settings'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'

export type ReviewSettingsActionResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

export async function saveReviewSettingsAction(
  input: ReviewSettings
): Promise<ReviewSettingsActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const qrText = input.handoverQrText.trim()
  if (input.handoverQrEnabled && !qrText) {
    return {
      ok: false,
      message: 'Ellenőrizd a megadott adatokat.',
      fieldErrors: { handoverQrText: 'Adj meg egy rövid szöveget a QR-kód fölé.' }
    }
  }
  if (qrText.length > HANDOVER_QR_TEXT_MAX) {
    return {
      ok: false,
      message: 'Ellenőrizd a megadott adatokat.',
      fieldErrors: { handoverQrText: `Legfeljebb ${HANDOVER_QR_TEXT_MAX} karakter.` }
    }
  }
  if (![90, 180, 365].includes(input.frequencyDays)) {
    return { ok: false, message: 'Érvénytelen gyakoriság.' }
  }
  if (input.thankSmsTiming !== 'after_2h' && input.thankSmsTiming !== 'next_morning') {
    return { ok: false, message: 'Érvénytelen időzítés.' }
  }

  const tenantId = ctx.user.tenantId!
  const row = {
    tenant_id: tenantId,
    status_page_enabled: input.statusPageEnabled,
    handover_qr_enabled: input.handoverQrEnabled,
    handover_qr_text: qrText || DEFAULT_HANDOVER_QR_TEXT,
    thank_sms_enabled: input.thankSmsEnabled,
    thank_sms_timing: input.thankSmsTiming,
    frequency_days: input.frequencyDays,
    updated_at: new Date().toISOString(),
    updated_by: ctx.user.id
  }
  const upsert = (values: typeof row & { partner_portal_enabled?: boolean }) =>
    ctx.supabase.from('tenant_review_settings').upsert(values, { onConflict: 'tenant_id' })

  let { error } = await upsert({ ...row, partner_portal_enabled: input.partnerPortalEnabled })
  // 42703: a 20261007 migráció előtt a partner kapcsoló nélkül mentünk.
  if (error?.code === '42703') ({ error } = await upsert(row))

  if (error) {
    console.error('saveReviewSettingsAction', error.message)
    return {
      ok: false,
      message:
        error.code === '42P01'
          ? 'A mentéshez futtasd a 20261004 migrációt.'
          : 'Nem sikerült menteni a beállításokat.'
    }
  }

  revalidatePath('/beallitasok/google-ertekelesek')
  revalidatePath('/beallitasok/atveteli-blokk')
  revalidatePath('/beallitasok/sms')
  return { ok: true }
}
