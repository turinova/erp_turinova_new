import type { SupabaseClient } from '@supabase/supabase-js'

import type {
  HrWorkCalendarRow,
  WorkCalendarDayType
} from '@/lib/jelenlet/types'

function mapRow(row: Record<string, unknown>): HrWorkCalendarRow {
  return {
    id: row.id as string,
    workDate: row.work_date as string,
    dayType: row.day_type as WorkCalendarDayType,
    name: (row.name as string) ?? ''
  }
}

export async function listWorkCalendarDays(
  supabase: SupabaseClient,
  tenantId: string,
  opts: { year: number; dayType?: WorkCalendarDayType | 'all' }
): Promise<HrWorkCalendarRow[]> {
  const start = `${opts.year}-01-01`
  const end = `${opts.year}-12-31`

  let query = supabase
    .from('hr_work_calendar')
    .select('id, work_date, day_type, name')
    .eq('tenant_id', tenantId)
    .gte('work_date', start)
    .lte('work_date', end)
    .order('work_date', { ascending: true })

  if (opts.dayType && opts.dayType !== 'all') {
    query = query.eq('day_type', opts.dayType)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>))
}

export async function getWorkCalendarDaysInRange(
  supabase: SupabaseClient,
  tenantId: string,
  startYmd: string,
  endYmd: string
): Promise<HrWorkCalendarRow[]> {
  const { data, error } = await supabase
    .from('hr_work_calendar')
    .select('id, work_date, day_type, name')
    .eq('tenant_id', tenantId)
    .gte('work_date', startYmd)
    .lte('work_date', endYmd)

  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>))
}

export async function countAttendanceOnDate(
  supabase: SupabaseClient,
  tenantId: string,
  ymd: string
): Promise<number> {
  const { count, error } = await supabase
    .from('hr_attendance_days')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('work_date', ymd)

  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function countAbsencesCoveringDate(
  supabase: SupabaseClient,
  tenantId: string,
  ymd: string
): Promise<number> {
  const { count, error } = await supabase
    .from('hr_absences')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .lte('start_date', ymd)
    .gte('end_date', ymd)

  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function previewWorkCalendarImpact(
  supabase: SupabaseClient,
  tenantId: string,
  dates: string[]
): Promise<{ attendanceCount: number; absenceCount: number }> {
  let attendanceCount = 0
  let absenceCount = 0
  for (const ymd of dates) {
    attendanceCount += await countAttendanceOnDate(supabase, tenantId, ymd)
    absenceCount += await countAbsencesCoveringDate(supabase, tenantId, ymd)
  }
  return { attendanceCount, absenceCount }
}
