import type { SupabaseClient } from '@supabase/supabase-js'

import {
  addDaysYmd,
  budapestDayRangeIso,
  budapestTodayYmd,
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
  openQuoteCount: number
  expiringQuoteCount: number
  todayReturnCount: number
  todayReturnGross: number
  openPurchaseOrderCount: number
  overduePurchaseOrderCount: number
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
}

export type HomeKpiBundle = {
  sales: HomeSalesKpis
  jelenlet: HomeJelenletKpis | null
}

const OPEN_QUOTE_STATUSES = ['draft', 'sent'] as const
const OPEN_PO_STATUSES = ['ordered', 'partial'] as const

const WEEKDAY_SHORT = ['V', 'H', 'K', 'Sze', 'Cs', 'P', 'Szo'] as const

function dayLabel(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()
  return `${WEEKDAY_SHORT[dow]} ${String(d).padStart(2, '0')}`
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

export async function getHomeSalesKpis(
  supabase: SupabaseClient,
  tenantId: string
): Promise<HomeSalesKpis> {
  const today = budapestTodayYmd()
  const start7 = addDaysYmd(today, -6)
  const { startIso: rangeStart } = budapestDayRangeIso(start7)
  const { endIso: rangeEnd } = budapestDayRangeIso(today)
  const todayRange = budapestDayRangeIso(today)

  const [
    fulfilledWeekRes,
    createdWeekRes,
    openQuotesRes,
    expiringQuotesRes,
    returnsRes,
    openPoRes,
    overduePoRes
  ] = await Promise.all([
    supabase
      .from('sales_orders')
      .select('id, total_gross, status, fulfilled_at, created_at')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .neq('status', 'cancelled')
      .gte('fulfilled_at', rangeStart)
      .lt('fulfilled_at', rangeEnd),
    supabase
      .from('sales_orders')
      .select('id, total_gross, status, fulfilled_at, created_at')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .in('status', ['fulfilled', 'partially_returned', 'returned'])
      .is('fulfilled_at', null)
      .gte('created_at', rangeStart)
      .lt('created_at', rangeEnd),
    supabase
      .from('sales_quotes')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .in('status', [...OPEN_QUOTE_STATUSES]),
    supabase
      .from('sales_quotes')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .in('status', [...OPEN_QUOTE_STATUSES])
      .not('valid_until', 'is', null)
      .lte('valid_until', today),
    supabase
      .from('sales_returns')
      .select('id, total_gross')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .gte('created_at', todayRange.startIso)
      .lt('created_at', todayRange.endIso),
    supabase
      .from('purchase_orders')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .in('status', [...OPEN_PO_STATUSES]),
    supabase
      .from('purchase_orders')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .in('status', [...OPEN_PO_STATUSES])
      .not('expected_date', 'is', null)
      .lt('expected_date', today)
  ])

  if (fulfilledWeekRes.error) {
    console.error('getHomeSalesKpis fulfilled', fulfilledWeekRes.error.message)
  }
  if (createdWeekRes.error) {
    console.error('getHomeSalesKpis created', createdWeekRes.error.message)
  }

  const weekMap = new Map<
    string,
    {
      id: string
      total_gross: number | string
      fulfilled_at: string | null
      created_at: string
    }
  >()
  for (const r of [
    ...(fulfilledWeekRes.data ?? []),
    ...(createdWeekRes.data ?? [])
  ]) {
    weekMap.set(String(r.id), {
      id: String(r.id),
      total_gross: r.total_gross as number | string,
      fulfilled_at: (r.fulfilled_at as string | null) ?? null,
      created_at: r.created_at as string
    })
  }
  const weekRows = [...weekMap.values()]

  const byDay = new Map<string, { gross: number; count: number }>()
  for (let i = 6; i >= 0; i--) {
    const ymd = addDaysYmd(today, -i)
    byDay.set(ymd, { gross: 0, count: 0 })
  }

  for (const r of weekRows) {
    const iso = (r.fulfilled_at as string | null) ?? (r.created_at as string)
    if (!iso) continue
    const ymd = toBudapestYmdFromIso(iso)
    const bucket = byDay.get(ymd)
    if (!bucket) continue
    bucket.gross += Number(r.total_gross) || 0
    bucket.count += 1
  }

  const last7Days: SalesDayPoint[] = [...byDay.entries()].map(
    ([ymd, v]) => ({
      ymd,
      label: dayLabel(ymd),
      gross: v.gross,
      count: v.count
    })
  )

  const todayPoint = byDay.get(today) ?? { gross: 0, count: 0 }
  const returns = returnsRes.data ?? []
  if (returnsRes.error) {
    console.error('getHomeSalesKpis returns', returnsRes.error.message)
  }

  return {
    todayGross: todayPoint.gross,
    todaySaleCount: todayPoint.count,
    openQuoteCount: openQuotesRes.count ?? 0,
    expiringQuoteCount: expiringQuotesRes.count ?? 0,
    todayReturnCount: returns.length,
    todayReturnGross: returns.reduce(
      (s, r) => s + (Number(r.total_gross) || 0),
      0
    ),
    openPurchaseOrderCount: openPoRes.count ?? 0,
    overduePurchaseOrderCount: overduePoRes.count ?? 0,
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

    // Távollét mindig számít a mai képbe
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
    if (nowMin >= shiftMin) late += 1
  }

  return {
    present,
    expectedToday,
    late,
    vacation,
    sick,
    otherAway,
    missingDayCount,
    awayNames
  }
}

export async function getHomeKpiBundle(
  supabase: SupabaseClient,
  tenantId: string,
  opts: { includeJelenlet: boolean }
): Promise<HomeKpiBundle> {
  const [sales, jelenlet] = await Promise.all([
    getHomeSalesKpis(supabase, tenantId),
    opts.includeJelenlet
      ? getHomeJelenletKpis(supabase, tenantId)
      : Promise.resolve(null)
  ])
  return { sales, jelenlet }
}
