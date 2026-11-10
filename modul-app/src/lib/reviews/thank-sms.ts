import { addDaysYmd, toBudapestYmdFromIso } from '@/lib/home/date'
import type { ThankSmsTiming } from '@/lib/reviews/settings'

/** Köszönő SMS (Google értékelés kérés) — időzítés és jogosultság, tiszta függvények. */

export const SEND_WINDOW_START_HOUR = 9
export const SEND_WINDOW_END_HOUR = 19
export const NEXT_DAY_SEND_HOUR = 10
/** Ennél régebbi átadásra már nem küldünk (pl. cron kiesés után). */
export const THANK_SMS_STALE_DAYS = 3

const DAY_MS = 24 * 60 * 60 * 1000

function budapestHour(date: Date): number {
  const h = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Budapest',
    hour: '2-digit',
    hourCycle: 'h23'
  }).format(date)
  return Number(h)
}

/** Budapest helyi idő → UTC Date (CET/CEST automatikusan). */
export function budapestLocalToDate(ymd: string, hour: number, minute = 0): Date {
  const hh = String(hour).padStart(2, '0')
  const mm = String(minute).padStart(2, '0')
  for (const offset of ['+01:00', '+02:00'] as const) {
    const d = new Date(`${ymd}T${hh}:${mm}:00${offset}`)
    if (toBudapestYmdFromIso(d.toISOString()) === ymd && budapestHour(d) === hour) return d
  }
  return new Date(`${ymd}T${hh}:${mm}:00+01:00`)
}

export function isWithinSendWindow(date: Date): boolean {
  const h = budapestHour(date)
  return h >= SEND_WINDOW_START_HOUR && h < SEND_WINDOW_END_HOUR
}

/** Ha a pillanat a küldési ablakon kívül esik, a következő ablak eleje. */
export function clampToSendWindow(date: Date): Date {
  const h = budapestHour(date)
  const ymd = toBudapestYmdFromIso(date.toISOString())
  if (h < SEND_WINDOW_START_HOUR) return budapestLocalToDate(ymd, SEND_WINDOW_START_HOUR)
  if (h >= SEND_WINDOW_END_HOUR) return budapestLocalToDate(addDaysYmd(ymd, 1), NEXT_DAY_SEND_HOUR)
  return date
}

export function computeThankSmsSendAfter(handedOverAt: Date, timing: ThankSmsTiming): Date {
  if (timing === 'next_morning') {
    const ymd = toBudapestYmdFromIso(handedOverAt.toISOString())
    return budapestLocalToDate(addDaysYmd(ymd, 1), NEXT_DAY_SEND_HOUR)
  }
  return clampToSendWindow(new Date(handedOverAt.getTime() + 2 * 60 * 60 * 1000))
}

export type ThankSmsSkipReason =
  | 'disabled'
  | 'no_review_url'
  | 'no_entitlement'
  | 'no_customer'
  | 'no_review_consent'
  | 'bad_phone'
  | 'review_capped'
  | 'stale'

export function evaluateThankSms(input: {
  settingsEnabled: boolean
  hasReviewUrl: boolean
  hasSmsAddon: boolean
  customerExists: boolean
  consent: boolean
  phoneOk: boolean
  lastRequestAt: string | null
  lastClickAt: string | null
  frequencyDays: number
  handedOverAt: string
  now: Date
}): { ok: true } | { ok: false; reason: ThankSmsSkipReason } {
  if (!input.settingsEnabled) return { ok: false, reason: 'disabled' }
  if (!input.hasReviewUrl) return { ok: false, reason: 'no_review_url' }
  if (!input.hasSmsAddon) return { ok: false, reason: 'no_entitlement' }
  if (!input.customerExists) return { ok: false, reason: 'no_customer' }
  if (!input.consent) return { ok: false, reason: 'no_review_consent' }
  if (!input.phoneOk) return { ok: false, reason: 'bad_phone' }

  const nowMs = input.now.getTime()
  if (nowMs - new Date(input.handedOverAt).getTime() > THANK_SMS_STALE_DAYS * DAY_MS) {
    return { ok: false, reason: 'stale' }
  }
  const windowMs = input.frequencyDays * DAY_MS
  for (const at of [input.lastRequestAt, input.lastClickAt]) {
    if (at && nowMs - new Date(at).getTime() < windowMs) {
      return { ok: false, reason: 'review_capped' }
    }
  }
  return { ok: true }
}

export const THANK_SMS_SKIP_LABEL: Record<ThankSmsSkipReason, string> = {
  disabled: 'Ki van kapcsolva',
  no_review_url: 'Nincs Google értékelő link',
  no_entitlement: 'Nincs SMS add-on',
  no_customer: 'Nincs ügyfél',
  no_review_consent: 'Nem kér értékelés-kérő SMS-t',
  bad_phone: 'Hibás telefonszám',
  review_capped: 'Nemrég már kértük',
  stale: 'Túl régi átadás'
}
