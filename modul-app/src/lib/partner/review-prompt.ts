/**
 * Partner kezdőlap: Google értékelés kérése a kapcsolt boltnak (docs/55).
 * Nem az NPS-hez kötött: az elégedettség nem befolyásolja, ki látja (nincs review gating).
 */

const MS_DAY = 24 * 60 * 60 * 1000

/** Ennyi napon belül átadott rendelés kell: a viszonosság pillanata. */
export const PARTNER_REVIEW_RECENT_ORDER_DAYS = 30
/**
 * TESZT: false = átadott rendelés nélkül is megjelenik a kártya.
 * Élesítés előtt állítsd vissza true-ra.
 */
export const PARTNER_REVIEW_REQUIRE_RECENT_ORDER = false
/** Ennyi átadott rendeléstől „törzspartner” szöveg. */
export const PARTNER_REVIEW_REGULAR_MIN_ORDERS = 5
/** „Most nem” után: első alkalommal. */
export const PARTNER_REVIEW_SNOOZE_FIRST_DAYS = 30
/** „Most nem” után: második alkalommal. */
export const PARTNER_REVIEW_SNOOZE_NEXT_DAYS = 90
/** Ennyi elhalasztás után többet nem kérjük. */
export const PARTNER_REVIEW_MAX_DISMISSALS = 3

export type PartnerReviewVariant = 'first' | 'regular'

export type PartnerReviewPrompt = {
  href: string
  tenantId: string
  companyName: string
  variant: PartnerReviewVariant
  finishedCount: number
  lastOrder: { number: string; finishedAt: string } | null
}

export function shouldShowPartnerReviewCard(opts: {
  hasTenant: boolean
  mustSetPassword: boolean
  enabled: boolean
  hasReviewUrl: boolean
  finishedCount: number
  lastFinishedAt: string | null
  clickedAt: string | null
  selfReportedAt: string | null
  dismissedAt: string | null
  dismissCount: number
  frequencyDays: number
  requireRecentOrder?: boolean
  nowMs?: number
}): boolean {
  if (!opts.hasTenant || opts.mustSetPassword) return false
  if (!opts.enabled || !opts.hasReviewUrl) return false

  const now = opts.nowMs ?? Date.now()
  const ageDays = (iso: string) => (now - new Date(iso).getTime()) / MS_DAY

  if (opts.requireRecentOrder ?? PARTNER_REVIEW_REQUIRE_RECENT_ORDER) {
    if (opts.finishedCount < 1 || !opts.lastFinishedAt) return false
    if (ageDays(opts.lastFinishedAt) > PARTNER_REVIEW_RECENT_ORDER_DAYS) return false
  }
  if (opts.selfReportedAt) return false
  if (opts.clickedAt && ageDays(opts.clickedAt) < opts.frequencyDays) return false
  if (opts.dismissCount >= PARTNER_REVIEW_MAX_DISMISSALS) return false
  if (opts.dismissedAt) {
    const snooze =
      opts.dismissCount >= 2 ? PARTNER_REVIEW_SNOOZE_NEXT_DAYS : PARTNER_REVIEW_SNOOZE_FIRST_DAYS
    if (ageDays(opts.dismissedAt) < snooze) return false
  }
  return true
}

/** Magyar névelő: „az Alfa Kft.”, „a Bútor Bt.” (1 és 5 kezdetű számnál is „az”). */
export function withHuArticle(name: string): string {
  const first = name.trim().charAt(0).toLowerCase()
  return /[aáeéiíoóöőuúüű15]/.test(first) ? `az ${name.trim()}` : `a ${name.trim()}`
}

export function partnerReviewVariant(finishedCount: number): PartnerReviewVariant {
  return finishedCount >= PARTNER_REVIEW_REGULAR_MIN_ORDERS ? 'regular' : 'first'
}

export function partnerReviewCopy(
  variant: PartnerReviewVariant,
  companyName: string,
  finishedCount: number
): { title: string; body: string } {
  if (variant === 'regular') {
    return {
      title: `${finishedCount} rendelésen vagyunk túl együtt, köszönjük!`,
      body: 'Ha pár mondatban leírnád a Google-ön, miért rendelsz nálunk, az nekünk a legtöbbet segít.'
    }
  }
  return {
    title: `Írnál pár szót ${withHuArticle(companyName)} munkájáról?`,
    body: 'Kis csapat vagyunk, minden Google-értékelést elolvasunk. A te pár mondatod segít, hogy más szakemberek is megtaláljanak minket.'
  }
}

export const PARTNER_REVIEW_COPY = {
  topics: 'Miről írhatsz: pontosság, minőség, kiszolgálás.',
  button: 'Értékelés a Google-ön',
  alreadyWrote: 'Már írtam',
  notNow: 'Most nem',
  lastOrder: 'Legutóbb átvett rendelés',
  thanksTitle: 'Köszönjük!',
  thanksBody: (companyName: string) => `Sokat segítesz ${withHuArticle(companyName)} csapatának.`,
  selfReportedToast: 'Köszönjük, hogy írtál! Ezt a kártyát többet nem mutatjuk.',
  dismissedToast: 'Rendben, most nem kérdezünk.'
}
