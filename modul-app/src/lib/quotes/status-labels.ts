import type { QuoteStatus } from '@/lib/quotes/queries'

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  draft: 'Piszkozat',
  ordered: 'Megrendelve',
  in_production: 'Gyártásban',
  ready: 'Kész',
  finished: 'Lezárva',
  cancelled: 'Törölve'
}

export function quoteStatusTone(
  status: QuoteStatus
): 'neutral' | 'success' | 'warning' | 'info' | 'danger' {
  switch (status) {
    case 'ordered':
    case 'ready':
      return 'success'
    case 'in_production':
      return 'warning'
    case 'finished':
      return 'info'
    case 'cancelled':
      return 'danger'
    case 'draft':
    default:
      return 'neutral'
  }
}
