import type { SupabaseClient } from '@supabase/supabase-js'

/** Google értékelés kérése — tenant beállítások (docs/55). */

export type ThankSmsTiming = 'after_2h' | 'next_morning'
export type ReviewFrequencyDays = 90 | 180 | 365

export type ReviewSettings = {
  statusPageEnabled: boolean
  handoverQrEnabled: boolean
  handoverQrText: string
  thankSmsEnabled: boolean
  thankSmsTiming: ThankSmsTiming
  frequencyDays: ReviewFrequencyDays
  partnerPortalEnabled: boolean
}

export const DEFAULT_HANDOVER_QR_TEXT = 'Írnál rólunk pár szót a Google-ön?'
export const HANDOVER_QR_TEXT_MAX = 80

export const DEFAULT_REVIEW_SETTINGS: ReviewSettings = {
  statusPageEnabled: true,
  handoverQrEnabled: false,
  handoverQrText: DEFAULT_HANDOVER_QR_TEXT,
  thankSmsEnabled: false,
  thankSmsTiming: 'next_morning',
  frequencyDays: 180,
  partnerPortalEnabled: true
}

export const THANK_SMS_TIMING_OPTIONS: { value: ThankSmsTiming; label: string; hint: string }[] = [
  {
    value: 'next_morning',
    label: 'Másnap 10 órakor',
    hint: 'Nyugodt pillanat, a vevő már kipróbálta, amit vitt.'
  },
  {
    value: 'after_2h',
    label: '2 órával átadás után',
    hint: 'Még friss az élmény. Este 7 után másnap reggelre csúszik.'
  }
]

export const REVIEW_FREQUENCY_OPTIONS: { value: ReviewFrequencyDays; label: string }[] = [
  { value: 90, label: '90 naponta' },
  { value: 180, label: '180 naponta' },
  { value: 365, label: 'Évente egyszer' }
]

const REVIEW_SETTINGS_SELECT_BASE =
  'status_page_enabled, handover_qr_enabled, handover_qr_text, thank_sms_enabled, thank_sms_timing, frequency_days'

export const REVIEW_SETTINGS_SELECT = `${REVIEW_SETTINGS_SELECT_BASE}, partner_portal_enabled`

type ReviewSettingsRow = {
  status_page_enabled?: boolean | null
  handover_qr_enabled?: boolean | null
  handover_qr_text?: string | null
  thank_sms_enabled?: boolean | null
  thank_sms_timing?: string | null
  frequency_days?: number | null
  partner_portal_enabled?: boolean | null
}

export function normalizeReviewSettings(row: ReviewSettingsRow | null | undefined): ReviewSettings {
  if (!row) return { ...DEFAULT_REVIEW_SETTINGS }
  const freq = Number(row.frequency_days)
  return {
    statusPageEnabled: row.status_page_enabled ?? DEFAULT_REVIEW_SETTINGS.statusPageEnabled,
    handoverQrEnabled: row.handover_qr_enabled ?? DEFAULT_REVIEW_SETTINGS.handoverQrEnabled,
    handoverQrText: row.handover_qr_text?.trim() || DEFAULT_HANDOVER_QR_TEXT,
    thankSmsEnabled: row.thank_sms_enabled ?? DEFAULT_REVIEW_SETTINGS.thankSmsEnabled,
    thankSmsTiming: row.thank_sms_timing === 'after_2h' ? 'after_2h' : 'next_morning',
    frequencyDays: freq === 90 || freq === 365 ? freq : 180,
    partnerPortalEnabled:
      row.partner_portal_enabled ?? DEFAULT_REVIEW_SETTINGS.partnerPortalEnabled
  }
}

export type TenantReviewSettings = {
  settings: ReviewSettings
  /** false = a 20261004 migráció még nincs lefuttatva. */
  available: boolean
}

export async function getTenantReviewSettings(
  supabase: SupabaseClient,
  tenantId: string
): Promise<TenantReviewSettings> {
  const query = (select: string) =>
    supabase
      .from('tenant_review_settings')
      .select(select)
      .eq('tenant_id', tenantId)
      .maybeSingle<ReviewSettingsRow>()

  let { data, error } = await query(REVIEW_SETTINGS_SELECT)
  // 42703 = undefined_column: a 20261007 migráció még nincs lefuttatva.
  if (error?.code === '42703') {
    ;({ data, error } = await query(REVIEW_SETTINGS_SELECT_BASE))
  }

  if (error) {
    // 42P01 = undefined_table: a migráció még nincs lefuttatva.
    if (error.code !== '42P01') console.error('getTenantReviewSettings', error.message)
    return { settings: { ...DEFAULT_REVIEW_SETTINGS }, available: false }
  }
  return { settings: normalizeReviewSettings(data), available: true }
}
