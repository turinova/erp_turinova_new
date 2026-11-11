import type { PaymentMethodKind } from '@/lib/payment-methods/kinds'

export type AutoProformaStatus =
  | 'pending'
  | 'processing'
  | 'issued'
  | 'failed'
  | 'skipped'

export const AUTO_PROFORMA_DUE_DAYS_DEFAULT = 8
export const AUTO_PROFORMA_DUE_DAYS_MIN = 1
export const AUTO_PROFORMA_DUE_DAYS_MAX = 60

/** pending ennyi perc után a cron maga indítja (az after() elhalt). */
export const AUTO_PROFORMA_PENDING_RESCUE_MINUTES = 2
/** processing ennyi perc után megszakadtnak számít. */
export const AUTO_PROFORMA_PROCESSING_STALE_MINUTES = 10

export function parseAutoProformaStatus(v: unknown): AutoProformaStatus | null {
  return v === 'pending' ||
    v === 'processing' ||
    v === 'issued' ||
    v === 'failed' ||
    v === 'skipped'
    ? v
    : null
}

export function normalizeAutoProformaDueDays(raw: unknown): number {
  if (raw === null || raw === undefined || raw === '') {
    return AUTO_PROFORMA_DUE_DAYS_DEFAULT
  }
  const n = Math.round(Number(raw))
  if (!Number.isFinite(n)) return AUTO_PROFORMA_DUE_DAYS_DEFAULT
  return Math.min(
    AUTO_PROFORMA_DUE_DAYS_MAX,
    Math.max(AUTO_PROFORMA_DUE_DAYS_MIN, n)
  )
}

/** Beküldéskor: kell-e automatikus díjbekérő. */
export function shouldAutoProforma(input: {
  enabled: boolean
  hasAgentKey: boolean
  methodKind: PaymentMethodKind | null
}): boolean {
  return input.enabled && input.hasAgentKey && input.methodKind === 'transfer'
}

export type AutoProformaQuoteFacts = {
  status: string
  payment_status: string
  final_total_gross: number
  total_gross: number
  total_paid: number
  customer: {
    name: string | null
    email: string | null
    billing_name: string | null
    billing_postal_code: string | null
    billing_city: string | null
    billing_street: string | null
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type PartnerBillingForProformaInput = {
  name?: string | null
  billing_name?: string | null
  email?: string | null
  billing_postal_code?: string | null
  billing_city?: string | null
  billing_street?: string | null
}

export type PartnerBillingMissing =
  | 'name'
  | 'postal'
  | 'city'
  | 'street'
  | 'email'

export type PartnerBillingForProformaResult =
  | { ok: true }
  | { ok: false; missing: PartnerBillingMissing[] }

/**
 * Auto díjbekérőhöz kellő számlázási adat + e-mail.
 * Stripe-szerű: hiányzó kötelező mező → ne engedd a beküldést.
 */
export function partnerBillingForProformaReady(
  input: PartnerBillingForProformaInput
): PartnerBillingForProformaResult {
  const missing: PartnerBillingMissing[] = []
  const name = (input.billing_name || input.name || '').trim()
  if (!name) missing.push('name')
  if (!input.billing_postal_code?.trim()) missing.push('postal')
  if (!input.billing_city?.trim()) missing.push('city')
  if (!input.billing_street?.trim()) missing.push('street')
  if (!EMAIL_RE.test((input.email ?? '').trim())) missing.push('email')
  return missing.length === 0 ? { ok: true } : { ok: false, missing }
}

export function partnerBillingIncompleteMessage(
  result: PartnerBillingForProformaResult
): string {
  if (result.ok) return ''
  if (result.missing.includes('email') && result.missing.length === 1) {
    return 'A díjbekérőhöz érvényes e-mail cím kell. Ellenőrizd a Beállításokban.'
  }
  return 'A díjbekérőhöz kell a számlázási címed (név, irányítószám, város, utca) és érvényes e-mail. Töltsd ki a Beállításokban, utána küldheted be.'
}

export function isBillingIncompleteNote(note: string | null | undefined): boolean {
  const n = (note ?? '').toLowerCase()
  return n.includes('számlázási') || n.includes('e-mail')
}

/** Miért nem mehet ki automatikusan (null = mehet). Staff felé mutatott szöveg. */
export function autoProformaBlocker(q: AutoProformaQuoteFacts): string | null {
  if (q.status === 'cancelled') return 'Az ajánlatot törölték.'
  if (q.payment_status === 'paid') return 'A rendelés már ki van fizetve.'
  const due = Number(q.final_total_gross || q.total_gross) || 0
  if (due - (Number(q.total_paid) || 0) <= 0) {
    return 'Nincs fizetendő összeg.'
  }
  const billing = partnerBillingForProformaReady({
    name: q.customer.name,
    billing_name: q.customer.billing_name,
    email: q.customer.email,
    billing_postal_code: q.customer.billing_postal_code,
    billing_city: q.customer.billing_city,
    billing_street: q.customer.billing_street
  })
  if (!billing.ok) {
    if (billing.missing.includes('email') && billing.missing.length === 1) {
      return 'Nincs érvényes e-mail cím a partnernél.'
    }
    return 'Hiányos számlázási adat a partnernél (név, irányítószám, város, utca).'
  }
  return null
}

export const AUTO_PROFORMA_BADGE: Record<AutoProformaStatus, string> = {
  pending: 'Folyamatban',
  processing: 'Folyamatban',
  issued: 'Elküldve',
  failed: 'Nem ment ki',
  skipped: 'Kihagyva'
}

export type PartnerAutoProformaCopy = {
  badge: string
  tone: 'neutral' | 'success' | 'warning'
  text: string
  /** Partner Beállítások linket mutathat (hiányos számlázás). */
  showSettingsLink?: boolean
}

/**
 * Partner felé: csak auto_proforma_status alapján.
 * Átutalás önmagában soha nem indokol díjbekérő szöveget (status null → null).
 */
export function partnerAutoProformaCopy(
  status: AutoProformaStatus | null | undefined,
  note?: string | null
): PartnerAutoProformaCopy | null {
  if (!status) return null
  switch (status) {
    case 'pending':
    case 'processing':
      return {
        badge: 'Folyamatban',
        tone: 'neutral',
        text: 'Díjbekérő küldése folyamatban.'
      }
    case 'issued': {
      const num = (note ?? '').trim()
      // Kiállításkor a note a Számlázz számlaszám; hibaszöveget ne mutassunk.
      const showNumber =
        num.length > 0 &&
        num.length <= 40 &&
        /[0-9]/.test(num) &&
        !/\s/.test(num)
      return {
        badge: 'Elküldve',
        tone: 'success',
        text: showNumber
          ? `Díjbekérő elküldve e-mailben (${num}).`
          : 'Díjbekérő elküldve e-mailben.'
      }
    }
    case 'failed':
    case 'skipped':
      if (isBillingIncompleteNote(note)) {
        return {
          badge: 'Hiányos adat',
          tone: 'warning',
          text: 'Hiányzik a számlázási adatod. Töltsd ki a Beállításokban, a cég utána elküldheti a díjbekérőt.',
          showSettingsLink: true
        }
      }
      return {
        badge: 'A cég intézi',
        tone: 'warning',
        text: 'A díjbekérőt a cég intézi.'
      }
  }
}
