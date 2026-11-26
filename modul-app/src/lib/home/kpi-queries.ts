import type { SupabaseClient } from '@supabase/supabase-js'

import {
  addDaysYmd,
  budapestDayRangeIso,
  budapestTodayYmd,
  MONTH_NAMES_HU,
  toBudapestYmdFromIso
} from '@/lib/home/date'
import {
  budapestYearMonth,
  daysInMonth,
  isExpectedAttendanceDay,
  normalizeTime,
  timeToMinutes
} from '@/lib/jelenlet/hours'
import type { AbsenceType } from '@/lib/jelenlet/types'

export type SalesDayPoint = {
  ymd: string
  label: string
  gross: number
  count: number
}

export type HomeSalesKpis = {
  todayGross: number
  todaySaleCount: number
  /** Hónap elejétől máig (Budapest). */
  monthGross: number
  monthSaleCount: number
  /** Előző hónap ugyanarra a napra (1…D) — progress összehasonlítás. */
  priorMonthGross: number
  monthLabel: string
  todayReturnCount: number
  todayReturnGross: number
  /** Eladás kintlévő: unpaid/partial remaining (sales_payments nettó). */
  openDue: number
  /** Unpaid/partial eladások bruttó összege (ring nevező). */
  openInvoiceGross: number
  openInvoiceCount: number
  last7Days: SalesDayPoint[]
}

export type HomeJelenletKpis = {
  /** Ma bent (megérkezett vagy már távozott, de beírt) */
  present: number
  /** Ma elvárt munkaerő (bent + hiányzik + várható + távollét) */
  expectedToday: number
  late: number
  vacation: number
  sick: number
  otherAway: number
  missingDayCount: number
  /** Max 3 név a távolléthez (glance) */
  awayNames: string[]
  /** Max 3 név a „Nincs itt” (elvárt, nincs érkezés) glance-hez */
  lateNames: string[]
}

/** Mai + 7 nap lapszabászat megrendelés-intake (`ordered_at`) + kintlévő. */
export type HomeLapszabaszatKpis = {
  todayGross: number
  todayCount: number
  last7Days: SalesDayPoint[]
  /** Hónap elejétől máig megrendelt (Budapest, ordered_at). */
  monthGross: number
  monthCount: number
  /** Előző hónap ugyanarra a napra (1…D). */
  priorMonthGross: number
  monthLabel: string
  /** Múlt hét azonos napján felvett megrendelések száma. */
  sameDayLastWeekCount: number
  /** Pl. „Cs” — a múlt heti összevetés felirata. */
  sameDayLastWeekLabel: string
  /** Átadva (finished), de nem / részben fizetve — hiányzó összeg. */
  openDue: number
  /** Átadva, nem fizetve — bruttó összesen. */
  openOrderGross: number
  openOrderCount: number
  /** Legrégebbi átadott, nem fizetett rendelés kora napban (null ha nincs). */
  oldestUnpaidDays: number | null
  /** status = ready, várakozási kor szerint. */
  ready: { total: number; fresh: number; mid: number; old: number; noSms: number }
  /** Ma átadott (finished_at). */
  finishedToday: number
  /** Előző 4 hét azonos napjainak átadási átlaga. */
  finishedTypical: number
  /** Ugyanez, de csak a mostani napszakig (Budapest óra:perc). */
  finishedTypicalByNow: number
  /** Ma rögzített befizetések (quote_payments.payment_date). */
  collectedToday: number
  /** Gyártási nap > 1 munkanapja elmúlt, még nincs kész. */
  lateCount: number
}

function emptyLapszabaszatKpis(today: string): HomeLapszabaszatKpis {
  return {
    todayGross: 0,
    todayCount: 0,
    last7Days: Array.from({ length: 7 }, (_, i) => {
      const ymd = addDaysYmd(today, -6 + i)
      return { ymd, label: dayLabel(ymd), gross: 0, count: 0 }
    }),
    monthGross: 0,
    monthCount: 0,
    priorMonthGross: 0,
    monthLabel: MONTH_NAMES_HU[budapestYearMonth().month - 1] ?? '',
    sameDayLastWeekCount: 0,
    sameDayLastWeekLabel: '',
    openDue: 0,
    openOrderGross: 0,
    openOrderCount: 0,
    oldestUnpaidDays: null,
    ready: { total: 0, fresh: 0, mid: 0, old: 0, noSms: 0 },
    finishedToday: 0,
    finishedTypical: 0,
    finishedTypicalByNow: 0,
    collectedToday: 0,
    lateCount: 0
  }
}

/** Átadva (finished), de nem / részben fizetve — a valódi behajtandó. */
async function getHomeLapszabaszatOpenDue(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{
  openDue: number
  openOrderGross: number
  openOrderCount: number
  oldestUnpaidDays: number | null
}> {
  const empty = { openDue: 0, openOrderGross: 0, openOrderCount: 0, oldestUnpaidDays: null }
  const { data: quotes, error } = await supabase
    .from('quotes')
    .select('id, final_total_gross, total_gross, finished_at')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .is('archived_at', null)
    .not('order_number', 'is', null)
    .eq('status', 'finished')
    .in('payment_status', ['not_paid', 'partial'])

  if (error) {
    console.error('getHomeLapszabaszatOpenDue', error.message)
    return empty
  }

  const rows = (quotes ?? []) as {
    id: string
    final_total_gross: number | null
    total_gross: number | null
    finished_at: string | null
  }[]

  if (rows.length === 0) return empty

  const paidByQuote = new Map<string, number>()
  const { data: payments, error: payErr } = await supabase
    .from('quote_payments')
    .select('quote_id, amount')
    .in(
      'quote_id',
      rows.map((r) => r.id)
    )
    .is('deleted_at', null)

  if (payErr) {
    console.error('getHomeLapszabaszatOpenDue payments', payErr.message)
  } else {
    for (const p of payments ?? []) {
      const id = p.quote_id as string
      paidByQuote.set(id, (paidByQuote.get(id) ?? 0) + (Number(p.amount) || 0))
    }
  }

  let openDue = 0
  let openOrderGross = 0
  let oldest: string | null = null
  for (const r of rows) {
    if (r.finished_at && (!oldest || r.finished_at < oldest)) oldest = r.finished_at
    const gross = Math.round(Number(r.final_total_gross ?? r.total_gross) || 0)
    openOrderGross += gross
    openDue += Math.max(0, gross - (paidByQuote.get(r.id) ?? 0))
  }

  return {
    openDue: Math.round(openDue),
    openOrderGross: Math.round(openOrderGross),
    openOrderCount: rows.length,
    oldestUnpaidDays: oldest ? daysBetweenYmd(toBudapestYmdFromIso(oldest), budapestTodayYmd()) : null
  }
}

function daysBetweenYmd(fromYmd: string, toYmd: string): number {
  const a = Date.parse(`${fromYmd}T12:00:00Z`)
  const b = Date.parse(`${toYmd}T12:00:00Z`)
  return Math.max(0, Math.round((b - a) / 86_400_000))
}

function previousWorkdayYmd(ymd: string): string {
  let d = addDaysYmd(ymd, -1)
  for (;;) {
    const dow = new Date(`${d}T12:00:00Z`).getUTCDay()
    if (dow !== 0 && dow !== 6) return d
    d = addDaysYmd(d, -1)
  }
}

async function getHomeLapszabaszatFlow(
  supabase: SupabaseClient,
  tenantId: string,
  today: string
): Promise<Pick<
  HomeLapszabaszatKpis,
  'ready' | 'finishedToday' | 'finishedTypical' | 'finishedTypicalByNow' | 'collectedToday' | 'lateCount'
>> {
  const todayRange = budapestDayRangeIso(today)
  const { startIso: fourWeeksStart } = budapestDayRangeIso(addDaysYmd(today, -28))
  const lateBefore = previousWorkdayYmd(today)

  const [readyRes, finishedRes, paidRes, lateRes] = await Promise.all([
    supabase
      .from('quotes')
      .select('ready_at, ready_notification_sent_at')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .is('archived_at', null)
      .eq('status', 'ready'),
    supabase
      .from('quotes')
      .select('finished_at')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .eq('status', 'finished')
      .gte('finished_at', fourWeeksStart)
      .lt('finished_at', todayRange.endIso),
    supabase
      .from('quote_payments')
      .select('amount')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .gte('payment_date', todayRange.startIso)
      .lt('payment_date', todayRange.endIso),
    supabase
      .from('quotes')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .is('archived_at', null)
      .in('status', ['ordered', 'in_production'])
      .lt('production_date', lateBefore)
  ])

  for (const [name, r] of [['ready', readyRes], ['finished', finishedRes], ['paid', paidRes], ['late', lateRes]] as const) {
    if (r.error) console.error(`getHomeLapszabaszatFlow ${name}`, r.error.message)
  }

  const ready = { total: 0, fresh: 0, mid: 0, old: 0, noSms: 0 }
  for (const r of readyRes.data ?? []) {
    ready.total += 1
    if (!r.ready_notification_sent_at) ready.noSms += 1
    const age = r.ready_at ? daysBetweenYmd(toBudapestYmdFromIso(r.ready_at as string), today) : 0
    if (age >= 7) ready.old += 1
    else if (age >= 3) ready.mid += 1
    else ready.fresh += 1
  }

  const sameWeekdays = new Set([7, 14, 21, 28].map((n) => addDaysYmd(today, -n)))
  const nowMin = budapestNowMinutes()
  let finishedToday = 0
  let typicalSum = 0
  let typicalByNowSum = 0
  for (const r of finishedRes.data ?? []) {
    if (!r.finished_at) continue
    const iso = r.finished_at as string
    const ymd = toBudapestYmdFromIso(iso)
    if (ymd === today) finishedToday += 1
    else if (sameWeekdays.has(ymd)) {
      typicalSum += 1
      if (budapestMinutesOfIso(iso) <= nowMin) typicalByNowSum += 1
    }
  }

  return {
    ready,
    finishedToday,
    finishedTypical: Math.round(typicalSum / 4),
    finishedTypicalByNow: Math.round(typicalByNowSum / 4),
    collectedToday: Math.round(
      (paidRes.data ?? []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
    ),
    lateCount: lateRes.count ?? 0
  }
}

export type HomeKpiBundle = {
  sales: HomeSalesKpis
  jelenlet: HomeJelenletKpis | null
  /** null = lapszabászat entitlement OFF / nem kértük */
  lapszabaszat: HomeLapszabaszatKpis | null
}

const WEEKDAY_SHORT = ['V', 'H', 'K', 'Sze', 'Cs', 'P', 'Szo'] as const

function dayLabel(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()
  return `${WEEKDAY_SHORT[dow]} ${String(d).padStart(2, '0')}`
}

function budapestMinutesOfIso(iso: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Budapest',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date(iso))
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const min = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  return h * 60 + min
}

function budapestNowMinutes(): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Budapest',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date())
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const min = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  return h * 60 + min
}

function priorMonthRangeYmd(todayYmd: string): {
  start: string
  end: string
} {
  const { year, month } = budapestYearMonth()
  const dayOfMonth = Number(todayYmd.slice(8, 10))
  let py = year
  let pm = month - 1
  if (pm < 1) {
    pm = 12
    py -= 1
  }
  const dates = daysInMonth(py, pm)
  const endIdx = Math.min(dayOfMonth, dates.length) - 1
  return { start: dates[0]!, end: dates[endIdx]! }
}

type SaleAggRow = {
  id: string
  total_gross: number | string
  fulfilled_at: string | null
  created_at: string
}

function sumGrossInRange(
  byDay: Map<string, { gross: number; count: number }>,
  startYmd: string,
  endYmd: string
): { gross: number; count: number } {
  let gross = 0
  let count = 0
  for (const [ymd, v] of byDay) {
    if (ymd >= startYmd && ymd <= endYmd) {
      gross += v.gross
      count += v.count
    }
  }
  return { gross, count }
}

export async function getHomeSalesKpis(
  supabase: SupabaseClient,
  tenantId: string
): Promise<HomeSalesKpis> {
  const today = budapestTodayYmd()
  const { year, month } = budapestYearMonth()
  const monthDates = daysInMonth(year, month)
  const monthStart = monthDates[0]!
  const prior = priorMonthRangeYmd(today)
  const rangeStartYmd = prior.start < monthStart ? prior.start : monthStart
  const { startIso: rangeStart } = budapestDayRangeIso(rangeStartYmd)
  const { endIso: rangeEnd } = budapestDayRangeIso(today)
  const todayRange = budapestDayRangeIso(today)

  const [fulfilledRes, createdRes, returnsRes, openInvoicesRes] =
    await Promise.all([
      supabase
        .from('sales_orders')
        .select('id, total_gross, status, fulfilled_at, created_at')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .is('archived_at', null)
        .neq('status', 'cancelled')
        .gte('fulfilled_at', rangeStart)
        .lt('fulfilled_at', rangeEnd),
      supabase
        .from('sales_orders')
        .select('id, total_gross, status, fulfilled_at, created_at')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .is('archived_at', null)
        .in('status', ['fulfilled', 'partially_returned', 'returned'])
        .is('fulfilled_at', null)
        .gte('created_at', rangeStart)
        .lt('created_at', rangeEnd),
      supabase
        .from('sales_returns')
        .select('id, total_gross')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .gte('created_at', todayRange.startIso)
        .lt('created_at', todayRange.endIso),
      supabase
        .from('sales_orders')
        .select('id, total_gross, cash_rounding_amount, payment_status')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .is('archived_at', null)
        .not('status', 'in', '(cancelled,returned)')
        .in('payment_status', ['unpaid', 'partial'])
    ])

  if (fulfilledRes.error) {
    console.error('getHomeSalesKpis fulfilled', fulfilledRes.error.message)
  }
  if (createdRes.error) {
    console.error('getHomeSalesKpis created', createdRes.error.message)
  }

  const weekMap = new Map<string, SaleAggRow>()
  for (const r of [...(fulfilledRes.data ?? []), ...(createdRes.data ?? [])]) {
    weekMap.set(String(r.id), {
      id: String(r.id),
      total_gross: r.total_gross as number | string,
      fulfilled_at: (r.fulfilled_at as string | null) ?? null,
      created_at: r.created_at as string
    })
  }

  const byDay = new Map<string, { gross: number; count: number }>()
  // Fill last-7 buckets for spark (always present)
  for (let i = 6; i >= 0; i--) {
    byDay.set(addDaysYmd(today, -i), { gross: 0, count: 0 })
  }

  for (const r of weekMap.values()) {
    const iso = r.fulfilled_at ?? r.created_at
    if (!iso) continue
    const ymd = toBudapestYmdFromIso(iso)
    let bucket = byDay.get(ymd)
    if (!bucket) {
      bucket = { gross: 0, count: 0 }
      byDay.set(ymd, bucket)
    }
    bucket.gross += Number(r.total_gross) || 0
    bucket.count += 1
  }

  const last7Days: SalesDayPoint[] = []
  for (let i = 6; i >= 0; i--) {
    const ymd = addDaysYmd(today, -i)
    const v = byDay.get(ymd) ?? { gross: 0, count: 0 }
    last7Days.push({
      ymd,
      label: dayLabel(ymd),
      gross: v.gross,
      count: v.count
    })
  }

  const todayPoint = byDay.get(today) ?? { gross: 0, count: 0 }
  const monthAgg = sumGrossInRange(byDay, monthStart, today)
  const priorAgg = sumGrossInRange(byDay, prior.start, prior.end)

  const returns = returnsRes.data ?? []
  if (returnsRes.error) {
    console.error('getHomeSalesKpis returns', returnsRes.error.message)
  }

  let openDue = 0
  let openInvoiceGross = 0
  const openRows = (openInvoicesRes.data ?? []) as {
    id: string
    total_gross: number
    cash_rounding_amount: number | null
    payment_status: string
  }[]

  if (openInvoicesRes.error) {
    console.error('getHomeSalesKpis openDue', openInvoicesRes.error.message)
  } else if (openRows.length > 0) {
    const openIds = openRows.map((r) => r.id)
    const paidBySale = new Map<string, number>()
    const { data: payments, error: payErr } = await supabase
      .from('sales_payments')
      .select('sales_order_id, amount, kind')
      .in('sales_order_id', openIds)
      .is('deleted_at', null)

    if (payErr) {
      console.error('getHomeSalesKpis payments', payErr.message)
    } else {
      for (const p of payments ?? []) {
        const id = p.sales_order_id as string
        const amt = Number(p.amount) || 0
        const signed = p.kind === 'refund' ? -amt : amt
        paidBySale.set(id, (paidBySale.get(id) ?? 0) + signed)
      }
    }

    for (const r of openRows) {
      const gross = Number(r.total_gross) || 0
      const rounding = Number(r.cash_rounding_amount) || 0
      const due = Math.round(gross + rounding)
      openInvoiceGross += due
      const netPaid = paidBySale.get(r.id) ?? 0
      openDue += Math.max(0, due - netPaid)
    }
  }

  return {
    todayGross: todayPoint.gross,
    todaySaleCount: todayPoint.count,
    monthGross: monthAgg.gross,
    monthSaleCount: monthAgg.count,
    priorMonthGross: priorAgg.gross,
    monthLabel: MONTH_NAMES_HU[month - 1] ?? '',
    todayReturnCount: returns.length,
    todayReturnGross: returns.reduce(
      (s, r) => s + (Number(r.total_gross) || 0),
      0
    ),
    openDue: Math.round(openDue),
    openInvoiceGross: Math.round(openInvoiceGross),
    openInvoiceCount: openRows.length,
    last7Days
  }
}

function absenceStatus(type: string): 'vacation' | 'sick' | 'other' {
  if (type === 'vacation') return 'vacation'
  if (type === 'sick') return 'sick'
  return 'other'
}

export async function getHomeJelenletKpis(
  supabase: SupabaseClient,
  tenantId: string
): Promise<HomeJelenletKpis> {
  const today = budapestTodayYmd()
  const nowMin = budapestNowMinutes()
  const { year, month } = budapestYearMonth()
  const monthDates = daysInMonth(year, month)
  const monthStart = monthDates[0]!
  const monthEnd = monthDates[monthDates.length - 1]!

  const [{ data: empRows }, { data: att }, { data: abs }, { data: cal }] =
    await Promise.all([
      supabase
        .from('hr_employees')
        .select(
          'id, name, active, works_on_saturday, shift_start, shift_end'
        )
        .eq('tenant_id', tenantId)
        .eq('active', true)
        .is('deleted_at', null)
        .order('name', { ascending: true }),
      supabase
        .from('hr_attendance_days')
        .select(
          'employee_id, work_date, arrival_time, departure_time'
        )
        .eq('tenant_id', tenantId)
        .gte('work_date', monthStart)
        .lte('work_date', monthEnd),
      supabase
        .from('hr_absences')
        .select('employee_id, start_date, end_date, absence_type')
        .eq('tenant_id', tenantId)
        .lte('start_date', monthEnd)
        .gte('end_date', monthStart),
      supabase
        .from('hr_work_calendar')
        .select('work_date, day_type')
        .eq('tenant_id', tenantId)
        .gte('work_date', monthStart)
        .lte('work_date', monthEnd)
    ])

  const employees = empRows ?? []
  const calendarRest = new Set<string>()
  const relocatedWork = new Set<string>()
  for (const row of cal ?? []) {
    const ymd = row.work_date as string
    const t = row.day_type as string
    if (t === 'relocated_work') relocatedWork.add(ymd)
    else if (t === 'national' || t === 'company' || t === 'relocated_rest') {
      calendarRest.add(ymd)
    }
  }

  const attByKey = new Map<
    string,
    { arrival: string | null; departure: string | null }
  >()
  for (const row of att ?? []) {
    attByKey.set(`${row.employee_id}|${row.work_date}`, {
      arrival: normalizeTime(row.arrival_time as string | null),
      departure: normalizeTime(row.departure_time as string | null)
    })
  }

  const absByEmpDate = new Map<string, AbsenceType | string>()
  for (const row of abs ?? []) {
    const eid = row.employee_id as string
    const s = row.start_date as string
    const e = row.end_date as string
    const t = row.absence_type as string
    for (const ymd of monthDates) {
      if (ymd >= s && ymd <= e) absByEmpDate.set(`${eid}|${ymd}`, t)
    }
  }

  let missingDayCount = 0
  let present = 0
  let late = 0
  let vacation = 0
  let sick = 0
  let otherAway = 0
  let expectedToday = 0
  const awayNames: string[] = []
  const lateNames: string[] = []

  for (const emp of employees) {
    const eid = emp.id as string
    const name = (emp.name as string) || '—'
    const worksSat = Boolean(emp.works_on_saturday)
    const shiftStart = normalizeTime(emp.shift_start as string | null)

    for (const ymd of monthDates) {
      const key = `${eid}|${ymd}`
      const expected = isExpectedAttendanceDay({
        ymd,
        worksOnSaturday: worksSat,
        isCalendarRest: calendarRest.has(ymd),
        isRelocatedWork: relocatedWork.has(ymd),
        onlyPast: true,
        todayYmd: today
      })
      if (!expected) continue
      if (absByEmpDate.has(key)) continue
      if (!attByKey.has(key)) missingDayCount += 1
    }

    const todayKey = `${eid}|${today}`
    const awayType = absByEmpDate.get(todayKey)
    const dayAtt = attByKey.get(todayKey)
    const todayExpected = isExpectedAttendanceDay({
      ymd: today,
      worksOnSaturday: worksSat,
      isCalendarRest: calendarRest.has(today),
      isRelocatedWork: relocatedWork.has(today),
      onlyPast: false,
      todayYmd: today
    })

    if (awayType) {
      expectedToday += 1
      const kind = absenceStatus(awayType)
      if (kind === 'vacation') vacation += 1
      else if (kind === 'sick') sick += 1
      else otherAway += 1
      if (awayNames.length < 3) awayNames.push(name)
      continue
    }

    if (!todayExpected) continue

    expectedToday += 1

    if (dayAtt?.arrival) {
      present += 1
      continue
    }

    const shiftMin = timeToMinutes(shiftStart) ?? 8 * 60
    if (nowMin >= shiftMin) {
      late += 1
      if (lateNames.length < 3) lateNames.push(name)
    }
  }

  return {
    present,
    expectedToday,
    late,
    vacation,
    sick,
    otherAway,
    missingDayCount,
    awayNames,
    lateNames
  }
}

/**
 * Lapszabászat megrendelések: `ordered_at` nap szerint, nem cancelled.
 * Status (ordered → finished) nem számít — intake GMV.
 */
export async function getHomeLapszabaszatKpis(
  supabase: SupabaseClient,
  tenantId: string
): Promise<HomeLapszabaszatKpis> {
  const today = budapestTodayYmd()
  const start7 = addDaysYmd(today, -6)
  const { year, month } = budapestYearMonth()
  const monthStart = daysInMonth(year, month)[0]!
  const prior = priorMonthRangeYmd(today)
  const rangeStartYmd = [start7, monthStart, prior.start].sort()[0]!
  const { startIso: rangeStart } = budapestDayRangeIso(rangeStartYmd)
  const { endIso: rangeEnd } = budapestDayRangeIso(today)

  const [intakeRes, open, flow] = await Promise.all([
    supabase
      .from('quotes')
      .select('final_total_gross, total_gross, ordered_at')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .is('archived_at', null)
      .not('order_number', 'is', null)
      .neq('status', 'cancelled')
      .gte('ordered_at', rangeStart)
      .lt('ordered_at', rangeEnd),
    getHomeLapszabaszatOpenDue(supabase, tenantId),
    getHomeLapszabaszatFlow(supabase, tenantId, today)
  ])

  const { data, error } = intakeRes

  if (error) {
    console.error('getHomeLapszabaszatKpis', error.message)
    return { ...emptyLapszabaszatKpis(today), ...open, ...flow }
  }

  const byDay = new Map<string, { gross: number; count: number }>()
  for (let i = 6; i >= 0; i--) {
    byDay.set(addDaysYmd(today, -i), { gross: 0, count: 0 })
  }

  for (const row of data ?? []) {
    const iso = row.ordered_at as string | null
    if (!iso) continue
    const ymd = toBudapestYmdFromIso(iso)
    let bucket = byDay.get(ymd)
    if (!bucket) {
      bucket = { gross: 0, count: 0 }
      byDay.set(ymd, bucket)
    }
    bucket.gross += Number(row.final_total_gross ?? row.total_gross) || 0
    bucket.count += 1
  }

  const last7Days: SalesDayPoint[] = []
  for (let i = 6; i >= 0; i--) {
    const ymd = addDaysYmd(today, -i)
    const v = byDay.get(ymd) ?? { gross: 0, count: 0 }
    last7Days.push({
      ymd,
      label: dayLabel(ymd),
      gross: v.gross,
      count: v.count
    })
  }

  const todayPoint = byDay.get(today) ?? { gross: 0, count: 0 }
  const monthAgg = sumGrossInRange(byDay, monthStart, today)
  const priorAgg = sumGrossInRange(byDay, prior.start, prior.end)
  return {
    todayGross: todayPoint.gross,
    todayCount: todayPoint.count,
    last7Days,
    monthGross: monthAgg.gross,
    monthCount: monthAgg.count,
    priorMonthGross: priorAgg.gross,
    monthLabel: MONTH_NAMES_HU[month - 1] ?? '',
    sameDayLastWeekCount: byDay.get(addDaysYmd(today, -7))?.count ?? 0,
    sameDayLastWeekLabel: dayLabel(addDaysYmd(today, -7)).split(' ')[0] ?? '',
    ...open,
    ...flow
  }
}

export async function getHomeKpiBundle(
  supabase: SupabaseClient,
  tenantId: string,
  opts: { includeJelenlet: boolean; includeLapszabaszat: boolean }
): Promise<HomeKpiBundle> {
  const [sales, jelenlet, lapszabaszat] = await Promise.all([
    getHomeSalesKpis(supabase, tenantId),
    opts.includeJelenlet
      ? getHomeJelenletKpis(supabase, tenantId)
      : Promise.resolve(null),
    opts.includeLapszabaszat
      ? getHomeLapszabaszatKpis(supabase, tenantId)
      : Promise.resolve(null)
  ])
  return { sales, jelenlet, lapszabaszat }
}
