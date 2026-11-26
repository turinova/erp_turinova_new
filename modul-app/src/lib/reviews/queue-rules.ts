/** Köszönő SMS sor kezelése — tiszta szabályok (halasztás, törlés), docs/55. */

export const MAX_POSTPONES = 3
export const POSTPONE_DAY_OPTIONS = [7, 14, 30] as const
export type PostponeDays = (typeof POSTPONE_DAY_OPTIONS)[number]

export const CANCEL_NOTE_MAX = 200

/** Nincs „rossz vélemény” ok: a szelektív kérést (review gating) a Google tiltja. */
export const REVIEW_CANCEL_REASONS = [
  'customer_request',
  'wrong_contact',
  'not_recipient',
  'duplicate',
  'other'
] as const
export type ReviewCancelReason = (typeof REVIEW_CANCEL_REASONS)[number]

export const REVIEW_CANCEL_REASON_LABEL: Record<ReviewCancelReason, string> = {
  customer_request: 'A vevő kérte, hogy ne keressük',
  wrong_contact: 'Hibás telefonszám',
  not_recipient: 'Nem ő vitte el (pl. futár, kolléga)',
  duplicate: 'Duplikált vagy teszt rendelés',
  other: 'Egyéb'
}

export type ReviewQueueStatus = 'pending' | 'sent' | 'skipped' | 'failed' | 'cancelled'

export const REVIEW_QUEUE_STATUS_LABEL: Record<ReviewQueueStatus, string> = {
  pending: 'Ütemezve',
  sent: 'Elküldve',
  skipped: 'Kihagyva',
  failed: 'Sikertelen',
  cancelled: 'Törölve'
}

export function isPostponeDays(n: number): n is PostponeDays {
  return (POSTPONE_DAY_OPTIONS as readonly number[]).includes(n)
}

export function isReviewCancelReason(v: string): v is ReviewCancelReason {
  return (REVIEW_CANCEL_REASONS as readonly string[]).includes(v)
}

export function canPostpone(row: { status: string; postponed_count: number }): boolean {
  return row.status === 'pending' && row.postponed_count < MAX_POSTPONES
}

/** Az új küldési idő: a régi (vagy most, ha már esedékes) + N nap. */
export function postponedSendAfter(currentSendAfter: string, days: PostponeDays, now: Date): Date {
  const base = Math.max(new Date(currentSendAfter).getTime(), now.getTime())
  return new Date(base + days * 24 * 60 * 60 * 1000)
}
