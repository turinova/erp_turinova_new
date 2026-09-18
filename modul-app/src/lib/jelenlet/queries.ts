import type { SupabaseClient } from '@supabase/supabase-js'

import {
  budapestTodayYmd,
  computePaidMinutes,
  daysInMonth,
  isExpectedAttendanceDay,
  normalizeTime
} from '@/lib/jelenlet/hours'
import type {
  AbsenceType,
  WorkCalendarDayType
} from '@/lib/jelenlet/types'

export type HrEmployeeRow = {
  id: string
  name: string
  code: string
  employeeTypeId: string
  employeeTypeName: string
  active: boolean
  shiftStart: string | null
  shiftEnd: string | null
  lunchStart: string | null
  lunchEnd: string | null
  worksOnSaturday: boolean
  overtimeEnabled: boolean
  overtimeGraceMinutes: number
  overtimeDailyCapMinutes: number
  notes: string | null
}

export type EmployeeListItem = HrEmployeeRow & {
  emptyDays: number
  incompleteDays: number
}

function mapEmployee(row: Record<string, unknown>): HrEmployeeRow {
  const typeJoin = row.hr_employee_types as
    | { name?: string }
    | { name?: string }[]
    | null
  const typeName = Array.isArray(typeJoin)
    ? typeJoin[0]?.name
    : typeJoin?.name

  return {
    id: row.id as string,
    name: row.name as string,
    code: (row.code as string) ?? '',
    employeeTypeId: (row.employee_type_id as string) ?? '',
    employeeTypeName: typeName ?? '—',
    active: Boolean(row.active),
    shiftStart: normalizeTime(row.shift_start as string | null),
    shiftEnd: normalizeTime(row.shift_end as string | null),
    lunchStart: normalizeTime(row.lunch_start as string | null),
    lunchEnd: normalizeTime(row.lunch_end as string | null),
    worksOnSaturday: Boolean(row.works_on_saturday),
    overtimeEnabled: Boolean(row.overtime_enabled),
    overtimeGraceMinutes: Number(row.overtime_grace_minutes) || 15,
    overtimeDailyCapMinutes: Number(row.overtime_daily_cap_minutes) || 180,
    notes: (row.notes as string | null) ?? null
  }
}

const EMPLOYEE_SELECT =
  'id, name, code, employee_type_id, active, shift_start, shift_end, lunch_start, lunch_end, works_on_saturday, overtime_enabled, overtime_grace_minutes, overtime_daily_cap_minutes, notes, hr_employee_types ( name )'

export async function listEmployees(
  supabase: SupabaseClient,
  input: {
    tenantId: string
    q?: string
    active?: 'all' | 'active' | 'inactive'
    page?: number
    limit?: number
    year: number
    month: number
  }
): Promise<{ rows: EmployeeListItem[]; total: number; page: number; limit: number }> {
  const page = Math.max(1, input.page ?? 1)
  const limit = Math.min(100, Math.max(1, input.limit ?? 25))
  const from = (page - 1) * limit

  let query = supabase
    .from('hr_employees')
    .select(EMPLOYEE_SELECT, { count: 'exact' })
    .eq('tenant_id', input.tenantId)
    .order('name', { ascending: true })
    .range(from, from + limit - 1)

  if (input.active === 'active') query = query.eq('active', true)
  if (input.active === 'inactive') query = query.eq('active', false)
  if (input.q?.trim()) {
    const q = input.q.trim()
    query = query.or(`name.ilike.%${q}%,code.ilike.%${q}%`)
  }

  const { data, error, count } = await query
  if (error) throw new Error(error.message)

  const employees = (data ?? []).map((r) => mapEmployee(r as Record<string, unknown>))
  const attention = await getMonthlyAttention(supabase, {
    tenantId: input.tenantId,
    employeeIds: employees.map((e) => e.id),
    year: input.year,
    month: input.month,
    employees
  })

  return {
    rows: employees.map((e) => ({
      ...e,
      emptyDays: attention[e.id]?.empty ?? 0,
      incompleteDays: attention[e.id]?.incomplete ?? 0
    })),
    total: count ?? 0,
    page,
    limit
  }
}

export async function getEmployee(
  supabase: SupabaseClient,
  tenantId: string,
  id: string
): Promise<HrEmployeeRow | null> {
  const { data, error } = await supabase
    .from('hr_employees')
    .select(EMPLOYEE_SELECT)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  return mapEmployee(data as Record<string, unknown>)
}

function expectedWorkDays(
  year: number,
  month: number,
  worksOnSaturday: boolean,
  calendarRest: Set<string>,
  relocatedWork: Set<string>,
  todayYmd: string
): string[] {
  const days = daysInMonth(year, month)
  return days.filter((ymd) =>
    isExpectedAttendanceDay({
      ymd,
      worksOnSaturday,
      isCalendarRest: calendarRest.has(ymd),
      isRelocatedWork: relocatedWork.has(ymd),
      onlyPast: true,
      todayYmd
    })
  )
}

async function getMonthlyAttention(
  supabase: SupabaseClient,
  input: {
    tenantId: string
    employeeIds: string[]
    year: number
    month: number
    employees: HrEmployeeRow[]
  }
): Promise<Record<string, { empty: number; incomplete: number }>> {
  const out: Record<string, { empty: number; incomplete: number }> = {}
  for (const id of input.employeeIds) {
    out[id] = { empty: 0, incomplete: 0 }
  }
  if (input.employeeIds.length === 0) return out

  const start = `${input.year}-${String(input.month).padStart(2, '0')}-01`
  const endDay = new Date(input.year, input.month, 0).getDate()
  const end = `${input.year}-${String(input.month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`

  const [{ data: att }, { data: abs }, { data: cal }] = await Promise.all([
    supabase
      .from('hr_attendance_days')
      .select('employee_id, work_date, arrival_time, departure_time')
      .eq('tenant_id', input.tenantId)
      .in('employee_id', input.employeeIds)
      .gte('work_date', start)
      .lte('work_date', end),
    supabase
      .from('hr_absences')
      .select('employee_id, start_date, end_date')
      .eq('tenant_id', input.tenantId)
      .in('employee_id', input.employeeIds)
      .lte('start_date', end)
      .gte('end_date', start),
    supabase
      .from('hr_work_calendar')
      .select('work_date, day_type')
      .eq('tenant_id', input.tenantId)
      .gte('work_date', start)
      .lte('work_date', end)
  ])

  const rest = new Set<string>()
  const relocated = new Set<string>()
  for (const row of cal ?? []) {
    const t = row.day_type as WorkCalendarDayType
    if (t === 'relocated_work') relocated.add(row.work_date as string)
    else if (t === 'national' || t === 'company' || t === 'relocated_rest') {
      rest.add(row.work_date as string)
    }
  }

  const attByEmp = new Map<string, Map<string, { a: string | null; d: string | null }>>()
  for (const row of att ?? []) {
    const eid = row.employee_id as string
    if (!attByEmp.has(eid)) attByEmp.set(eid, new Map())
    attByEmp.get(eid)!.set(row.work_date as string, {
      a: normalizeTime(row.arrival_time as string | null),
      d: normalizeTime(row.departure_time as string | null)
    })
  }

  const absByEmp = new Map<string, Array<{ s: string; e: string }>>()
  for (const row of abs ?? []) {
    const eid = row.employee_id as string
    if (!absByEmp.has(eid)) absByEmp.set(eid, [])
    absByEmp.get(eid)!.push({
      s: row.start_date as string,
      e: row.end_date as string
    })
  }

  function onAbsence(eid: string, ymd: string): boolean {
    const ranges = absByEmp.get(eid) ?? []
    return ranges.some((r) => ymd >= r.s && ymd <= r.e)
  }

  const todayYmd = budapestTodayYmd()

  for (const emp of input.employees) {
    const expected = expectedWorkDays(
      input.year,
      input.month,
      emp.worksOnSaturday,
      rest,
      relocated,
      todayYmd
    )
    const map = attByEmp.get(emp.id) ?? new Map()
    let empty = 0
    let incomplete = 0
    for (const ymd of expected) {
      if (onAbsence(emp.id, ymd)) continue
      const day = map.get(ymd)
      if (!day || (!day.a && !day.d)) {
        empty += 1
        continue
      }
      if (!day.a || !day.d) incomplete += 1
    }
    out[emp.id] = { empty, incomplete }
  }

  return out
}

export type AbsenceRow = {
  id: string
  employeeId: string
  startDate: string
  endDate: string
  absenceType: AbsenceType
  note: string | null
}

export async function listAbsences(
  supabase: SupabaseClient,
  tenantId: string,
  employeeId: string
): Promise<AbsenceRow[]> {
  const { data, error } = await supabase
    .from('hr_absences')
    .select('id, employee_id, start_date, end_date, absence_type, note')
    .eq('tenant_id', tenantId)
    .eq('employee_id', employeeId)
    .order('start_date', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({
    id: r.id as string,
    employeeId: r.employee_id as string,
    startDate: r.start_date as string,
    endDate: r.end_date as string,
    absenceType: r.absence_type as AbsenceType,
    note: (r.note as string | null) ?? null
  }))
}

export type CalendarCellKind =
  | 'empty'
  | 'complete'
  | 'incomplete'
  | 'vacation'
  | 'sick'
  | 'other_absence'
  | 'rest'
  | 'relocated_work'

export type CalendarCell = {
  employeeId: string
  workDate: string
  kind: CalendarCellKind
  arrival: string | null
  departure: string | null
  lunchStart: string | null
  lunchEnd: string | null
  paidMinutes: number
  calendarName: string | null
}

export type CalendarMonthData = {
  year: number
  month: number
  dates: string[]
  employees: HrEmployeeRow[]
  cells: Record<string, CalendarCell> // `${employeeId}|${date}`
}

export async function getCalendarMonth(
  supabase: SupabaseClient,
  input: { tenantId: string; year: number; month: number }
): Promise<CalendarMonthData> {
  const dates = daysInMonth(input.year, input.month)
  const start = dates[0]!
  const end = dates[dates.length - 1]!

  const [{ data: empRows, error: empErr }, { data: att }, { data: abs }, { data: cal }] =
    await Promise.all([
      supabase
        .from('hr_employees')
        .select(EMPLOYEE_SELECT)
        .eq('tenant_id', input.tenantId)
        .eq('active', true)
        .order('name', { ascending: true }),
      supabase
        .from('hr_attendance_days')
        .select(
          'employee_id, work_date, arrival_time, departure_time, lunch_start, lunch_end'
        )
        .eq('tenant_id', input.tenantId)
        .gte('work_date', start)
        .lte('work_date', end),
      supabase
        .from('hr_absences')
        .select('employee_id, start_date, end_date, absence_type')
        .eq('tenant_id', input.tenantId)
        .lte('start_date', end)
        .gte('end_date', start),
      supabase
        .from('hr_work_calendar')
        .select('work_date, day_type, name')
        .eq('tenant_id', input.tenantId)
        .gte('work_date', start)
        .lte('work_date', end)
    ])

  if (empErr) throw new Error(empErr.message)

  const employees = (empRows ?? []).map((r) =>
    mapEmployee(r as Record<string, unknown>)
  )

  const calByDate = new Map<
    string,
    { type: WorkCalendarDayType; name: string }
  >()
  for (const row of cal ?? []) {
    calByDate.set(row.work_date as string, {
      type: row.day_type as WorkCalendarDayType,
      name: (row.name as string) || ''
    })
  }

  const attMap = new Map<
    string,
    {
      arrival: string | null
      departure: string | null
      lunchStart: string | null
      lunchEnd: string | null
    }
  >()
  for (const row of att ?? []) {
    const key = `${row.employee_id}|${row.work_date}`
    attMap.set(key, {
      arrival: normalizeTime(row.arrival_time as string | null),
      departure: normalizeTime(row.departure_time as string | null),
      lunchStart: normalizeTime(row.lunch_start as string | null),
      lunchEnd: normalizeTime(row.lunch_end as string | null)
    })
  }

  type AbsHit = { type: AbsenceType }
  const absHits = new Map<string, AbsHit>()
  for (const row of abs ?? []) {
    const eid = row.employee_id as string
    const s = row.start_date as string
    const e = row.end_date as string
    const t = row.absence_type as AbsenceType
    for (const ymd of dates) {
      if (ymd >= s && ymd <= e) {
        absHits.set(`${eid}|${ymd}`, { type: t })
      }
    }
  }

  const cells: Record<string, CalendarCell> = {}
  for (const emp of employees) {
    for (const ymd of dates) {
      const key = `${emp.id}|${ymd}`
      const calDay = calByDate.get(ymd)
      const absHit = absHits.get(key)
      const dayAtt = attMap.get(key)

      if (calDay && calDay.type !== 'relocated_work') {
        if (
          calDay.type === 'national' ||
          calDay.type === 'company' ||
          calDay.type === 'relocated_rest'
        ) {
          cells[key] = {
            employeeId: emp.id,
            workDate: ymd,
            kind: 'rest',
            arrival: null,
            departure: null,
            lunchStart: null,
            lunchEnd: null,
            paidMinutes: 0,
            calendarName: calDay.name || null
          }
          continue
        }
      }

      if (absHit) {
        const kind: CalendarCellKind =
          absHit.type === 'vacation'
            ? 'vacation'
            : absHit.type === 'sick'
              ? 'sick'
              : 'other_absence'
        cells[key] = {
          employeeId: emp.id,
          workDate: ymd,
          kind,
          arrival: null,
          departure: null,
          lunchStart: null,
          lunchEnd: null,
          paidMinutes: 0,
          calendarName: null
        }
        continue
      }

      if (!dayAtt || (!dayAtt.arrival && !dayAtt.departure)) {
        cells[key] = {
          employeeId: emp.id,
          workDate: ymd,
          kind: 'empty',
          arrival: null,
          departure: null,
          lunchStart: null,
          lunchEnd: null,
          paidMinutes: 0,
          calendarName: calDay?.type === 'relocated_work' ? calDay.name : null
        }
        continue
      }

      const complete = Boolean(dayAtt.arrival && dayAtt.departure)
      const paid = computePaidMinutes({
        arrival: dayAtt.arrival,
        departure: dayAtt.departure,
        lunchStart: dayAtt.lunchStart ?? emp.lunchStart,
        lunchEnd: dayAtt.lunchEnd ?? emp.lunchEnd,
        shiftStart: emp.shiftStart,
        shiftEnd: emp.shiftEnd
      })

      cells[key] = {
        employeeId: emp.id,
        workDate: ymd,
        kind: complete ? 'complete' : 'incomplete',
        arrival: dayAtt.arrival,
        departure: dayAtt.departure,
        lunchStart: dayAtt.lunchStart,
        lunchEnd: dayAtt.lunchEnd,
        paidMinutes: paid,
        calendarName: null
      }
    }
  }

  return { year: input.year, month: input.month, dates, employees, cells }
}
