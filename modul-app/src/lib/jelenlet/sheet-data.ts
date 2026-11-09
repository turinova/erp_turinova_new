import type { SupabaseClient } from '@supabase/supabase-js'

import { normalizeTime } from '@/lib/jelenlet/hours'
import {
  computeRotation,
  computeSheet,
  dowOfYmd,
  monthDates,
  rotationForEmployee,
  sheetDataWindow,
  type RoundingMode,
  type SheetAttendance,
  type SheetCalendarDay,
  type SheetEmployee,
  type SheetResult
} from '@/lib/jelenlet/sheet-engine'
import type { SheetRules } from '@/lib/jelenlet/sheet-rules'
import type { AbsenceType, WorkCalendarDayType } from '@/lib/jelenlet/types'

const EMPLOYEE_SELECT =
  'id, name, code, employee_type_id, shift_start, shift_end, lunch_start, lunch_end, overtime_enabled, overtime_grace_minutes, overtime_daily_cap_minutes, overtime_rounding_minutes, overtime_rounding_mode, early_overtime_enabled, early_overtime_trigger_time, early_overtime_pay_until_time, early_overtime_max_minutes, early_overtime_grace_minutes, early_overtime_rounding_minutes, early_overtime_rounding_mode, early_overtime_daily_cap_minutes, hr_employee_types ( name )'

function num(v: unknown, fallback: number): number {
  const n = Number(v)
  return v == null || !Number.isFinite(n) ? fallback : n
}

function rounding(v: unknown): RoundingMode {
  return v === 'ceil' || v === 'nearest' ? v : 'floor'
}

function mapSheetEmployee(row: Record<string, unknown>): SheetEmployee {
  const typeJoin = row.hr_employee_types as { name?: string } | { name?: string }[] | null
  const typeName = Array.isArray(typeJoin) ? typeJoin[0]?.name : typeJoin?.name
  return {
    id: row.id as string,
    name: row.name as string,
    code: (row.code as string) ?? '',
    typeId: (row.employee_type_id as string) ?? '',
    typeName: typeName ?? '—',
    shiftStart: normalizeTime(row.shift_start as string | null),
    shiftEnd: normalizeTime(row.shift_end as string | null),
    lunchStart: normalizeTime(row.lunch_start as string | null),
    lunchEnd: normalizeTime(row.lunch_end as string | null),
    overtime: {
      enabled: Boolean(row.overtime_enabled),
      graceMinutes: num(row.overtime_grace_minutes, 15),
      roundingMinutes: num(row.overtime_rounding_minutes, 15),
      roundingMode: rounding(row.overtime_rounding_mode),
      dailyCapMinutes: num(row.overtime_daily_cap_minutes, 180)
    },
    earlyOvertime: {
      enabled: Boolean(row.early_overtime_enabled),
      triggerTime: normalizeTime(row.early_overtime_trigger_time as string | null),
      payUntilTime: normalizeTime(row.early_overtime_pay_until_time as string | null),
      maxMinutes: num(row.early_overtime_max_minutes, 30),
      graceMinutes: num(row.early_overtime_grace_minutes, 0),
      roundingMinutes: num(row.early_overtime_rounding_minutes, 15),
      roundingMode: rounding(row.early_overtime_rounding_mode),
      dailyCapMinutes: num(row.early_overtime_daily_cap_minutes, 120)
    }
  }
}

export type SheetEmployeeResult = {
  employee: SheetEmployee
  result: SheetResult
}

/**
 * Egy lekérés táblánként (nem dolgozónként): dolgozók, jelenlét, távollét, munkarend,
 * rotáció pool. Ablak: hónap − 7 nap (szombati levonás áthozatal).
 */
export async function computeSheetsForEmployees(
  supabase: SupabaseClient,
  input: {
    tenantId: string
    employeeIds: string[]
    year: number
    month: number
    rules: SheetRules
  }
): Promise<{ results: SheetEmployeeResult[]; missingIds: string[] }> {
  const { start, end } = sheetDataWindow(input.year, input.month)
  const ids = Array.from(new Set(input.employeeIds))

  const poolQuery =
    input.rules.times === 'generated' && input.rules.rotationTypeIds.length > 0
      ? supabase
          .from('hr_employees')
          .select('id, code, name')
          .eq('tenant_id', input.tenantId)
          .eq('active', true)
          .is('deleted_at', null)
          .in('employee_type_id', input.rules.rotationTypeIds)
      : null

  const [empRes, attRes, absRes, calRes, poolRes] = await Promise.all([
    supabase
      .from('hr_employees')
      .select(EMPLOYEE_SELECT)
      .eq('tenant_id', input.tenantId)
      .in('id', ids)
      .is('deleted_at', null),
    supabase
      .from('hr_attendance_days')
      .select('employee_id, work_date, arrival_time, departure_time, lunch_start, lunch_end')
      .eq('tenant_id', input.tenantId)
      .in('employee_id', ids)
      .gte('work_date', start)
      .lte('work_date', end),
    supabase
      .from('hr_absences')
      .select('employee_id, start_date, end_date, absence_type')
      .eq('tenant_id', input.tenantId)
      .in('employee_id', ids)
      .lte('start_date', end)
      .gte('end_date', start),
    supabase
      .from('hr_work_calendar')
      .select('work_date, day_type, name')
      .eq('tenant_id', input.tenantId)
      .gte('work_date', start)
      .lte('work_date', end),
    poolQuery ?? Promise.resolve({ data: [], error: null })
  ])

  for (const r of [empRes, attRes, absRes, calRes, poolRes]) {
    if (r.error) throw new Error(r.error.message)
  }

  const calendar = new Map<string, SheetCalendarDay>()
  for (const row of calRes.data ?? []) {
    calendar.set(row.work_date as string, {
      type: row.day_type as WorkCalendarDayType,
      name: (row.name as string) || ''
    })
  }

  const attByEmp = new Map<string, Map<string, SheetAttendance>>()
  for (const row of attRes.data ?? []) {
    const eid = row.employee_id as string
    if (!attByEmp.has(eid)) attByEmp.set(eid, new Map())
    attByEmp.get(eid)!.set(row.work_date as string, {
      arrival: normalizeTime(row.arrival_time as string | null),
      departure: normalizeTime(row.departure_time as string | null),
      lunchStart: normalizeTime(row.lunch_start as string | null),
      lunchEnd: normalizeTime(row.lunch_end as string | null)
    })
  }

  const windowDates: string[] = []
  for (let d = start; d <= end; ) {
    windowDates.push(d)
    const next = new Date(`${d}T12:00:00Z`)
    next.setUTCDate(next.getUTCDate() + 1)
    d = next.toISOString().slice(0, 10)
  }

  const absByEmp = new Map<string, Map<string, AbsenceType>>()
  for (const row of absRes.data ?? []) {
    const eid = row.employee_id as string
    if (!absByEmp.has(eid)) absByEmp.set(eid, new Map())
    const s = row.start_date as string
    const e = row.end_date as string
    for (const ymd of windowDates) {
      if (ymd >= s && ymd <= e) absByEmp.get(eid)!.set(ymd, row.absence_type as AbsenceType)
    }
  }

  const pool = ((poolRes.data ?? []) as { id: string; code: string; name: string }[])
    .slice()
    .sort(
      (a, b) =>
        (a.code || '').localeCompare(b.code || '', 'hu') || a.name.localeCompare(b.name, 'hu')
    )
    .map((p) => p.id)
  const dates = monthDates(input.year, input.month)
  const rotation = computeRotation(dates, pool, (ymd) => {
    const cal = calendar.get(ymd)
    if (cal?.type === 'national' || cal?.type === 'company' || cal?.type === 'relocated_rest') {
      return false
    }
    if (cal?.type === 'relocated_work') return true
    const dow = dowOfYmd(ymd)
    return dow >= 1 && dow <= 5
  })

  const employees = (empRes.data ?? []).map((r) =>
    mapSheetEmployee(r as Record<string, unknown>)
  )
  const byId = new Map(employees.map((e) => [e.id, e]))

  const results: SheetEmployeeResult[] = []
  const missingIds: string[] = []
  for (const id of ids) {
    const employee = byId.get(id)
    if (!employee) {
      missingIds.push(id)
      continue
    }
    results.push({
      employee,
      result: computeSheet({
        employee,
        year: input.year,
        month: input.month,
        attendance: attByEmp.get(id) ?? new Map(),
        absences: absByEmp.get(id) ?? new Map(),
        calendar,
        rotation: rotationForEmployee(rotation, id),
        rules: input.rules
      })
    })
  }

  results.sort((a, b) => a.employee.name.localeCompare(b.employee.name, 'hu'))
  return { results, missingIds }
}
