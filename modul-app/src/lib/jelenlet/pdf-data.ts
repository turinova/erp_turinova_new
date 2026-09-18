import type { SupabaseClient } from '@supabase/supabase-js'

import type { TenantCompanyRow } from '@/lib/company/queries'
import {
  computePaidMinutes,
  daysInMonth,
  normalizeTime
} from '@/lib/jelenlet/hours'
import type {
  OfficialAttendancePdfInput,
  OfficialPdfDay,
  OfficialPdfSummary
} from '@/lib/jelenlet/pdf-template'
import type { AbsenceType, WorkCalendarDayType } from '@/lib/jelenlet/types'

const EMPLOYEE_SELECT =
  'id, name, code, employee_type_id, active, shift_start, shift_end, lunch_start, lunch_end, works_on_saturday, hr_employee_types ( name )'

type EmpRow = {
  id: string
  name: string
  code: string
  shiftStart: string | null
  shiftEnd: string | null
  lunchStart: string | null
  lunchEnd: string | null
  worksOnSaturday: boolean
  typeName: string
}

function mapEmp(row: Record<string, unknown>): EmpRow {
  const typeJoin = row.hr_employee_types as
    | { name: string }
    | { name: string }[]
    | null
  const typeName = Array.isArray(typeJoin)
    ? typeJoin[0]?.name
    : typeJoin?.name
  return {
    id: row.id as string,
    name: row.name as string,
    code: (row.code as string) ?? '',
    shiftStart: normalizeTime(row.shift_start as string | null),
    shiftEnd: normalizeTime(row.shift_end as string | null),
    lunchStart: normalizeTime(row.lunch_start as string | null),
    lunchEnd: normalizeTime(row.lunch_end as string | null),
    worksOnSaturday: Boolean(row.works_on_saturday),
    typeName: typeName ?? '—'
  }
}

function hoursLabel(hours: number): string {
  if (hours <= 0) return '-'
  return `${hours.toFixed(2)} óra`
}

function leaveHoursHtml(label: string): string {
  return `<strong>${label}</strong>`
}

function officialLeaveLabel(type: AbsenceType | null): string {
  if (!type) return 'SZABADSÁG'
  if (type === 'sick') return 'BETEGSZABADSÁG'
  if (type === 'vacation') return 'SZABADSÁG'
  if (type === 'unpaid') return 'FIZETÉS NÉLKÜLI'
  return 'TÁVOLLÉT'
}

export function companyToOfficialPdf(company: TenantCompanyRow | null): {
  name: string
  country: string | null
  city: string | null
  postal_code: string | null
  address: string | null
  tax_number: string | null
} {
  if (!company) {
    return {
      name: '',
      country: null,
      city: null,
      postal_code: null,
      address: null,
      tax_number: null
    }
  }
  return {
    name: company.name,
    country: company.country,
    city: company.city,
    postal_code: company.postal_code,
    address: company.address,
    tax_number: company.tax_number
  }
}

export async function buildOfficialAttendancePdfInput(
  supabase: SupabaseClient,
  input: {
    tenantId: string
    employeeId: string
    year: number
    month: number
    company: TenantCompanyRow | null
    tenantCompanyLogoBase64?: string
    turinovaLogoBase64?: string
  }
): Promise<OfficialAttendancePdfInput | null> {
  const dates = daysInMonth(input.year, input.month)
  const start = dates[0]!
  const end = dates[dates.length - 1]!

  const [{ data: empRaw, error: empErr }, { data: att }, { data: abs }, { data: cal }] =
    await Promise.all([
      supabase
        .from('hr_employees')
        .select(EMPLOYEE_SELECT)
        .eq('tenant_id', input.tenantId)
        .eq('id', input.employeeId)
        .maybeSingle(),
      supabase
        .from('hr_attendance_days')
        .select(
          'work_date, arrival_time, departure_time, lunch_start, lunch_end'
        )
        .eq('tenant_id', input.tenantId)
        .eq('employee_id', input.employeeId)
        .gte('work_date', start)
        .lte('work_date', end),
      supabase
        .from('hr_absences')
        .select('start_date, end_date, absence_type')
        .eq('tenant_id', input.tenantId)
        .eq('employee_id', input.employeeId)
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
  if (!empRaw) return null

  const emp = mapEmp(empRaw as Record<string, unknown>)

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

  const attByDate = new Map<
    string,
    {
      arrival: string | null
      departure: string | null
      lunchStart: string | null
      lunchEnd: string | null
    }
  >()
  for (const row of att ?? []) {
    attByDate.set(row.work_date as string, {
      arrival: normalizeTime(row.arrival_time as string | null),
      departure: normalizeTime(row.departure_time as string | null),
      lunchStart: normalizeTime(row.lunch_start as string | null),
      lunchEnd: normalizeTime(row.lunch_end as string | null)
    })
  }

  const absByDate = new Map<string, AbsenceType>()
  for (const row of abs ?? []) {
    const s = row.start_date as string
    const e = row.end_date as string
    const t = row.absence_type as AbsenceType
    for (const ymd of dates) {
      if (ymd >= s && ymd <= e) absByDate.set(ymd, t)
    }
  }

  const days: OfficialPdfDay[] = []

  for (const ymd of dates) {
    const d = new Date(
      Number(ymd.slice(0, 4)),
      Number(ymd.slice(5, 7)) - 1,
      Number(ymd.slice(8, 10))
    )
    const dow = d.getDay()
    const calDay = calByDate.get(ymd)
    const isRest =
      calDay &&
      (calDay.type === 'national' ||
        calDay.type === 'company' ||
        calDay.type === 'relocated_rest')
    const isRelocatedWork = calDay?.type === 'relocated_work'
    const absType = absByDate.get(ymd) ?? null
    const dayAtt = attByDate.get(ymd)

    // Hivatalos: ünnep / távollét mindig felülír (0 óra, nincs idő)
    if (isRest || absType) {
      const isHoliday = Boolean(isRest)
      const isLeave = Boolean(absType)
      let status = '-'
      let hoursHtml = '-'
      if (isRest) {
        status = 'MUNKASZÜNET'
        hoursHtml = leaveHoursHtml('MUNKASZÜNET')
      } else if (absType) {
        const label = officialLeaveLabel(absType)
        status = label
        hoursHtml = leaveHoursHtml(
          absType === 'sick' ? 'BETEG SZABADSÁG' : label
        )
      }
      days.push({
        date: ymd,
        dayOfWeek: dow,
        arrival: null,
        departure: null,
        lunchStart: null,
        lunchEnd: null,
        hoursWorked: 0,
        status,
        hoursHtml,
        isLeave,
        isHoliday
      })
      continue
    }

    // Vasárnap: mindig üres
    if (dow === 0) {
      days.push({
        date: ymd,
        dayOfWeek: dow,
        arrival: null,
        departure: null,
        lunchStart: null,
        lunchEnd: null,
        hoursWorked: 0,
        status: '-',
        hoursHtml: '-',
        isLeave: false,
        isHoliday: false
      })
      continue
    }

    const arrival = dayAtt?.arrival ?? null
    const departure = dayAtt?.departure ?? null
    const lunchStart = dayAtt?.lunchStart ?? emp.lunchStart
    const lunchEnd = dayAtt?.lunchEnd ?? emp.lunchEnd
    const complete = Boolean(arrival && departure)

    // Szombat (nem áthelyezett): csak ha van komplett jelenlét; max 4 óra
    if (dow === 6 && !isRelocatedWork) {
      if (!complete) {
        days.push({
          date: ymd,
          dayOfWeek: dow,
          arrival: null,
          departure: null,
          lunchStart: null,
          lunchEnd: null,
          hoursWorked: 0,
          status: '-',
          hoursHtml: '-',
          isLeave: false,
          isHoliday: false
        })
        continue
      }
      const paidMin = computePaidMinutes({
        arrival,
        departure,
        lunchStart,
        lunchEnd,
        shiftStart: null,
        shiftEnd: null
      })
      const cappedMin = Math.min(240, paidMin)
      const hours = Math.round((cappedMin / 60) * 100) / 100
      days.push({
        date: ymd,
        dayOfWeek: dow,
        arrival,
        departure,
        lunchStart,
        lunchEnd,
        hoursWorked: hours,
        status: 'SZOMBATI MUNKA',
        hoursHtml: hoursLabel(hours),
        isLeave: false,
        isHoliday: false
      })
      continue
    }

    // Hétköznap / áthelyezett munkanap
    if (!complete) {
      const partial = Boolean(arrival || departure)
      days.push({
        date: ymd,
        dayOfWeek: dow,
        arrival: partial ? arrival : null,
        departure: partial ? departure : null,
        lunchStart: partial ? lunchStart : null,
        lunchEnd: partial ? lunchEnd : null,
        hoursWorked: 0,
        status: partial ? 'HIÁNYOS' : '-',
        hoursHtml: '-',
        isLeave: false,
        isHoliday: false
      })
      continue
    }

    const paidMin = computePaidMinutes({
      arrival,
      departure,
      lunchStart,
      lunchEnd,
      shiftStart: emp.shiftStart,
      shiftEnd: emp.shiftEnd
    })
    const cappedMin = Math.min(480, paidMin)
    const hours = Math.round((cappedMin / 60) * 100) / 100
    days.push({
      date: ymd,
      dayOfWeek: dow,
      arrival,
      departure,
      lunchStart,
      lunchEnd,
      hoursWorked: hours,
      status: isRelocatedWork ? 'ÁTHELYEZETT MUNKANAP' : 'MUNKA',
      hoursHtml: hoursLabel(hours),
      isLeave: false,
      isHoliday: false
    })
  }

  const isOptionalSaturday = (day: OfficialPdfDay) =>
    day.dayOfWeek === 6 && day.status === 'SZOMBATI MUNKA'

  const totalHours = days.reduce((sum, day) => {
    if (isOptionalSaturday(day)) return sum
    if (day.isLeave || day.isHoliday) return sum
    return sum + day.hoursWorked
  }, 0)

  const daysWorked = days.filter(
    (day) =>
      day.hoursWorked > 0 &&
      !day.isLeave &&
      !day.isHoliday &&
      !isOptionalSaturday(day)
  ).length

  const absentDays = days.filter((day) => day.isLeave).length
  const saturdayDays = days.filter((day) => isOptionalSaturday(day)).length

  const summary: OfficialPdfSummary = {
    totalHours: Math.round(totalHours * 100) / 100,
    daysWorked,
    absentDays,
    saturdayDays
  }

  return {
    company: companyToOfficialPdf(input.company),
    employee: {
      name: emp.name,
      code: emp.code,
      typeName: emp.typeName
    },
    year: input.year,
    month: input.month,
    days,
    summary,
    tenantCompanyLogoBase64: input.tenantCompanyLogoBase64,
    turinovaLogoBase64: input.turinovaLogoBase64
  }
}
