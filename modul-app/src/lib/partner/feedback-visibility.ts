const MS_DAY = 24 * 60 * 60 * 1000

/** NPS hullám: ennyi napig nem kérdezünk újra. */
export const FEEDBACK_RESUBMIT_DAYS = 90
/** Első „Most nem” után. */
export const FEEDBACK_DISMISS_SNOOZE_FIRST_DAYS = 14
/** Második+ dismiss után. */
export const FEEDBACK_DISMISS_SNOOZE_NEXT_DAYS = 30
/** Új fióknál előbb használja a portált. */
export const NPS_MIN_ACCOUNT_AGE_DAYS = 7
/** Legalább ennyi beküldött rendelés kell, hogy legyen mit értékelni. */
export const NPS_MIN_SUBMITTED_ORDERS = 1

/** NPS kártya (0–10) — ritka, feltételhez kötött. */
export function shouldShowPartnerFeedbackCard(opts: {
  hasTenant: boolean
  mustSetPassword: boolean
  submittedOrderCount: number
  accountCreatedAt: string | null
  lastFeedbackAt: string | null
  dismissedAt: string | null
  dismissCount: number
  nowMs?: number
}): boolean {
  if (!opts.hasTenant) return false
  if (opts.mustSetPassword) return false
  if (opts.submittedOrderCount < NPS_MIN_SUBMITTED_ORDERS) return false

  const now = opts.nowMs ?? Date.now()

  if (opts.accountCreatedAt) {
    const created = new Date(opts.accountCreatedAt).getTime()
    if (now - created < NPS_MIN_ACCOUNT_AGE_DAYS * MS_DAY) return false
  }

  if (opts.lastFeedbackAt) {
    const submitted = new Date(opts.lastFeedbackAt).getTime()
    if (now - submitted < FEEDBACK_RESUBMIT_DAYS * MS_DAY) return false
  }

  if (opts.dismissedAt) {
    const dismissed = new Date(opts.dismissedAt).getTime()
    const snoozeDays =
      opts.dismissCount >= 2
        ? FEEDBACK_DISMISS_SNOOZE_NEXT_DAYS
        : FEEDBACK_DISMISS_SNOOZE_FIRST_DAYS
    if (now - dismissed < snoozeDays * MS_DAY) return false
  }

  return true
}

/** Javaslat-bedobó — mindig, ha van cég és nem claim-flow. */
export function shouldShowPartnerSuggestionBox(opts: {
  hasTenant: boolean
  mustSetPassword: boolean
}): boolean {
  return opts.hasTenant && !opts.mustSetPassword
}
