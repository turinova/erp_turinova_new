import type { QuoteStatus } from '@/lib/quotes/queries'

/** Partner-facing quote status labels (customer-portal szemantika). */
export const PARTNER_QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  draft: 'Beküldve',
  ordered: 'Megrendelve',
  in_production: 'Gyártásban',
  ready: 'Gyártás kész',
  finished: 'Átadva',
  cancelled: 'Törölve'
}

/**
 * Partner badge tones — ready = success (átvehető),
 * ordered = info (elfogadva, még nem gyártásban).
 */
export function partnerQuoteStatusTone(
  status: QuoteStatus
): 'neutral' | 'success' | 'warning' | 'info' | 'danger' {
  switch (status) {
    case 'draft':
      return 'warning'
    case 'ordered':
      return 'info'
    case 'in_production':
      return 'warning'
    case 'ready':
      return 'success'
    case 'finished':
      return 'neutral'
    case 'cancelled':
      return 'danger'
    default:
      return 'neutral'
  }
}

export function partnerQuoteStatusLabel(status: QuoteStatus): string {
  return PARTNER_QUOTE_STATUS_LABEL[status] ?? status
}
