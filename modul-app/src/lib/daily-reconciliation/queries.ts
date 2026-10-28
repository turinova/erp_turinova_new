import type { SupabaseClient } from '@supabase/supabase-js'

import {
  computeDayStatus,
  listWorkdaysInMonth,
  parseYearMonth,
  reconBonusManagerFt,
  reconBonusStaffFt,
  resolveReconBonusTier,
  toBudapestDate,
  type DayChipStatus,
  type ReconBonusTier,
  type TenderAmounts
} from '@/lib/daily-reconciliation/parse'
import {
  isCardPaymentMethodName,
  isCashPaymentMethodName,
  isDeferredPaymentMethodName
} from '@/lib/sales/payment-kind'

export type DailyReconStoreRow = {
  id: string
  business_date: string
  store_cash: number | null
  store_card: number | null
  store_transfer: number | null
  note: string | null
  updated_at: string
}

export type DailyReconDay = {
  date: string
  /** Összesen (termék + lapszab) — ehhez hasonlít a bolt. */
  system: TenderAmounts
  /** Értékesítés / POS (`sales_payments`). */
  systemSales: TenderAmounts
  /** Lapszabászati megrendelés (`quote_payments`). */
  systemLapszab: TenderAmounts
  store: {
    cash: number | null
    card: number | null
    transfer: number | null
  }
  note: string | null
  status: DayChipStatus
  rowId: string | null
}

export type DailyReconMonthSummary = {
  workdayCount: number
  filledCount: number
  okCount: number
  varianceCount: number
  partialCount: number
  emptyCount: number
  /** Múltbeli / mai munkanapok, amik még üresek. */
  missingPastCount: number
  accuracyPct: number | null
  streak: number
  bonusTier: ReconBonusTier
  /** Bolti + műszaki járó bónusz Ft / fő. */
  bonusStaffFt: number
  /** Üzletvezető járó bónusz Ft. */
  bonusManagerFt: number
  /** @deprecated használj bonusStaffFt — kompat a home widgethez */
  bonusFt: number
}

export type DailyReconMonthResult = {
  yearMonth: string
  days: DailyReconDay[]
  summary: DailyReconMonthSummary
}

function emptyTenders(): TenderAmounts {
  return { cash: 0, card: 0, transfer: 0 }
}

function addTenders(a: TenderAmounts, b: TenderAmounts): TenderAmounts {
  return {
    cash: a.cash + b.cash,
    card: a.card + b.card,
    transfer: a.transfer + b.transfer
  }
}

function classifyPayment(name: string): keyof TenderAmounts {
  if (isCashPaymentMethodName(name)) return 'cash'
  if (isCardPaymentMethodName(name)) return 'card'
  if (isDeferredPaymentMethodName(name)) return 'transfer'
  return 'card'
}

function monthPaidAtRange(year: number, month: number) {
  const fromIso = new Date(Date.UTC(year, month - 1, 1) - 2 * 86400000)
  const toIso = new Date(Date.UTC(year, month, 2))
  return { fromIso, toIso }
}

function accumulatePayments(
  map: Map<string, TenderAmounts>,
  rows: {
    amount: unknown
    payment_method_name: unknown
    paidAt: string
  }[],
  prefix: string
) {
  for (const row of rows) {
    const day = toBudapestDate(row.paidAt)
    if (!day.startsWith(prefix)) continue
    const bucket = map.get(day) ?? emptyTenders()
    const kind = classifyPayment(String(row.payment_method_name ?? ''))
    bucket[kind] += Math.round(Number(row.amount) || 0)
    map.set(day, bucket)
  }
}

async function loadSalesTotalsByDay(
  supabase: SupabaseClient,
  tenantId: string,
  year: number,
  month: number
): Promise<Map<string, TenderAmounts>> {
  const pad = (n: number) => String(n).padStart(2, '0')
  const { fromIso, toIso } = monthPaidAtRange(year, month)

  const { data, error } = await supabase
    .from('sales_payments')
    .select('amount, payment_method_name, paid_at, status')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .eq('status', 'completed')
    .gte('paid_at', fromIso.toISOString())
    .lt('paid_at', toIso.toISOString())
    .limit(5000)

  if (error) {
    console.error('loadSalesTotalsByDay', error.message)
    throw new Error('Nem sikerült betölteni az értékesítés forgalmat.')
  }

  const prefix = `${year}-${pad(month)}-`
  const map = new Map<string, TenderAmounts>()
  accumulatePayments(
    map,
    (data ?? []).map((row) => ({
      amount: row.amount,
      payment_method_name: row.payment_method_name,
      paidAt: row.paid_at as string
    })),
    prefix
  )
  return map
}

async function loadLapszabTotalsByDay(
  supabase: SupabaseClient,
  tenantId: string,
  year: number,
  month: number
): Promise<Map<string, TenderAmounts>> {
  const pad = (n: number) => String(n).padStart(2, '0')
  const { fromIso, toIso } = monthPaidAtRange(year, month)

  const { data, error } = await supabase
    .from('quote_payments')
    .select('amount, payment_method_name, payment_date')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .gte('payment_date', fromIso.toISOString())
    .lt('payment_date', toIso.toISOString())
    .limit(5000)

  if (error) {
    console.error('loadLapszabTotalsByDay', error.message)
    throw new Error('Nem sikerült betölteni a lapszab forgalmat.')
  }

  const prefix = `${year}-${pad(month)}-`
  const map = new Map<string, TenderAmounts>()
  accumulatePayments(
    map,
    (data ?? []).map((row) => ({
      amount: row.amount,
      payment_method_name: row.payment_method_name,
      paidAt: row.payment_date as string
    })),
    prefix
  )
  return map
}

async function loadStoreRows(
  supabase: SupabaseClient,
  tenantId: string,
  year: number,
  month: number
): Promise<Map<string, DailyReconStoreRow>> {
  const pad = (n: number) => String(n).padStart(2, '0')
  const from = `${year}-${pad(month)}-01`
  const last = new Date(year, month, 0).getDate()
  const to = `${year}-${pad(month)}-${pad(last)}`

  const { data, error } = await supabase
    .from('daily_reconciliations')
    .select(
      'id, business_date, store_cash, store_card, store_transfer, note, updated_at'
    )
    .eq('tenant_id', tenantId)
    .gte('business_date', from)
    .lte('business_date', to)

  if (error) {
    console.error('loadStoreRows', error.message)
    throw new Error(
      'Nem sikerült betölteni az egyeztetéseket. Futtasd a 20260615 migrációt.'
    )
  }

  const map = new Map<string, DailyReconStoreRow>()
  for (const row of data ?? []) {
    const date = String(row.business_date).slice(0, 10)
    map.set(date, {
      id: row.id as string,
      business_date: date,
      store_cash:
        row.store_cash == null ? null : Math.round(Number(row.store_cash)),
      store_card:
        row.store_card == null ? null : Math.round(Number(row.store_card)),
      store_transfer:
        row.store_transfer == null
          ? null
          : Math.round(Number(row.store_transfer)),
      note: (row.note as string | null) ?? null,
      updated_at: row.updated_at as string
    })
  }
  return map
}

function buildSummary(days: DailyReconDay[]): DailyReconMonthSummary {
  const today = toBudapestDate(new Date())
  const workdayCount = days.length
  const okCount = days.filter((d) => d.status === 'ok').length
  const varianceCount = days.filter((d) => d.status === 'variance').length
  const partialCount = days.filter((d) => d.status === 'partial').length
  const emptyCount = days.filter((d) => d.status === 'empty').length
  const filledCount = workdayCount - emptyCount
  const missingPastCount = days.filter(
    (d) => d.status === 'empty' && d.date <= today
  ).length
  const accuracyPct =
    filledCount === 0 ? null : Math.round((okCount / filledCount) * 1000) / 10

  let streak = 0
  const chronological = [...days].sort((a, b) => a.date.localeCompare(b.date))
  const endIdx = chronological.reduce((acc, d, i) => {
    if (d.date <= today) return i
    return acc
  }, -1)

  for (let i = endIdx; i >= 0; i--) {
    if (chronological[i].status === 'ok') streak += 1
    else break
  }

  const bonusTier = resolveReconBonusTier(accuracyPct, filledCount)
  const bonusStaffFt = reconBonusStaffFt(bonusTier)
  const bonusManagerFt = reconBonusManagerFt(bonusTier)

  return {
    workdayCount,
    filledCount,
    okCount,
    varianceCount,
    partialCount,
    emptyCount,
    missingPastCount,
    accuracyPct,
    streak,
    bonusTier,
    bonusStaffFt,
    bonusManagerFt,
    bonusFt: bonusStaffFt
  }
}

export async function getDailyReconciliationMonth(
  supabase: SupabaseClient,
  params: { tenantId: string; yearMonth: string }
): Promise<DailyReconMonthResult> {
  const { year, month } = parseYearMonth(params.yearMonth)
  const yearMonth = `${year}-${String(month).padStart(2, '0')}`
  const workdays = listWorkdaysInMonth(year, month)

  const [salesMap, lapszabMap, storeMap] = await Promise.all([
    loadSalesTotalsByDay(supabase, params.tenantId, year, month),
    loadLapszabTotalsByDay(supabase, params.tenantId, year, month),
    loadStoreRows(supabase, params.tenantId, year, month)
  ])

  const days: DailyReconDay[] = workdays.map((date) => {
    const systemSales = salesMap.get(date) ?? emptyTenders()
    const systemLapszab = lapszabMap.get(date) ?? emptyTenders()
    const system = addTenders(systemSales, systemLapszab)
    const row = storeMap.get(date)
    const store = {
      cash: row?.store_cash ?? null,
      card: row?.store_card ?? null,
      transfer: row?.store_transfer ?? null
    }
    return {
      date,
      system,
      systemSales,
      systemLapszab,
      store,
      note: row?.note ?? null,
      status: computeDayStatus(system, store),
      rowId: row?.id ?? null
    }
  })

  return {
    yearMonth,
    days,
    summary: buildSummary(days)
  }
}
