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
 * Partner badge tones — minden státusz külön szín:
 * draft=info (kék), ordered=success, in_production=active (lila),
 * ready=warning (átvehető figyelem), finished=neutral, cancelled=danger.
 */
export function partnerQuoteStatusTone(
  status: QuoteStatus
): 'neutral' | 'success' | 'warning' | 'info' | 'danger' | 'active' {
  switch (status) {
    case 'draft':
      return 'info'
    case 'ordered':
      return 'success'
    case 'in_production':
      return 'active'
    case 'ready':
      return 'warning'
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
