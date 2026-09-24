import type { QuoteStatus } from '@/lib/quotes/queries'

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  draft: 'Piszkozat',
  ordered: 'Megrendelve',
  in_production: 'Gyártásban',
  ready: 'Kész',
  finished: 'Lezárva',
  cancelled: 'Törölve'
}

/** Gyártási pipeline (cancelled nélkül) — detail stepper. */
export const QUOTE_PIPELINE_STEPS = [
  'draft',
  'ordered',
  'in_production',
  'ready',
  'finished'
] as const satisfies readonly QuoteStatus[]

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

/** Certainty: egy sor a detailen — mi a következő fő lépés. */
export function quoteNextStepLabel(status: QuoteStatus): string | null {
  switch (status) {
    case 'draft':
      return 'Megrendelés létrehozása'
    case 'ordered':
      return 'Gyártásba adás'
    case 'in_production':
      return 'Készre jelölés'
    case 'ready':
      return 'Átadás a megrendelőnek'
    case 'finished':
    case 'cancelled':
      return null
    default:
      return null
  }
}
