import {
  returnDateWindowRange,
  type ReturnDateWindow
} from '@/lib/sales/return-search'

/** Értékesítések lista idő-chipjei (lokális nap). */
export type SaleListPeriod = ReturnDateWindow | 'all'

export const SALE_LIST_PERIOD_VALUES = [
  'all',
  'today',
  'yesterday',
  '7d',
  '30d'
] as const satisfies readonly SaleListPeriod[]

export function parseSaleListPeriod(raw: string | undefined): SaleListPeriod {
  if (
    raw === 'today' ||
    raw === 'yesterday' ||
    raw === '7d' ||
    raw === '30d'
  ) {
    return raw
  }
  return 'all'
}

export function saleListPeriodRange(
  period: SaleListPeriod,
  now = new Date()
): { createdFrom?: string; createdTo?: string } {
  if (period === 'all') return {}
  const { fromIso, toIso } = returnDateWindowRange(period, now)
  return { createdFrom: fromIso, createdTo: toIso }
}
