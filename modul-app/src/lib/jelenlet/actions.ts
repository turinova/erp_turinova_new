'use server'

import { revalidatePath } from 'next/cache'

import {
  absenceFormSchema,
  attendanceDayFormSchema,
  employeeFormSchema,
  type AbsenceFormInput,
  type AttendanceDayFormInput,
  type EmployeeFormInput
} from '@/lib/jelenlet/parse'
import { normalizeTime } from '@/lib/jelenlet/hours'
import { toTimeSource, type AttendanceTimeSource } from '@/lib/jelenlet/queries'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'

export type JelenletActionResult =
  | { ok: true; id?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

function revalidateHr(employeeId?: string) {
  revalidatePath('/dolgozok')
  revalidatePath('/jelenlet')
  if (employeeId) revalidatePath(`/dolgozok/${employeeId}`)
  revalidatePath('/dolgozok/uj')
}

function fieldErrorsFromZod(
  issues: { path: (string | number)[]; message: string }[]
) {
  const fieldErrors: Record<string, string> = {}
  for (const issue of issues) {
    const key = issue.path.map(String).join('.')
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message
  }
  return fieldErrors
}

export async function upsertEmployeeAction(input: {
  id?: string
  values: EmployeeFormInput
}): Promise<JelenletActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = employeeFormSchema.safeParse(input.values)
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Ellenőrizd a mezőket.',
      fieldErrors: fieldErrorsFromZod(parsed.error.issues)
    }
  }
  const d = parsed.data

  const { data: typeRow } = await ctx.supabase
    .from('hr_employee_types')
    .select('id')
    .eq('id', d.employeeTypeId)
    .eq('tenant_id', ctx.user.tenantId!)
    .is('deleted_at', null)
    .maybeSingle()
  if (!typeRow) {
    return {
      ok: false,
      message: 'Érvénytelen dolgozó típus.',
      fieldErrors: { employeeTypeId: 'Válassz érvényes típust.' }
    }
  }

  const row = {
    tenant_id: ctx.user.tenantId!,
    name: d.name,
    code: d.code ?? '',
    employee_type_id: d.employeeTypeId,
    active: d.active,
    shift_start: d.shiftStart,
    shift_end: d.shiftEnd,
    lunch_start: d.lunchStart,
    lunch_end: d.lunchEnd,
    works_on_saturday: d.worksOnSaturday,
    overtime_enabled: d.overtimeEnabled,
    overtime_grace_minutes: d.overtimeGraceMinutes,
    overtime_daily_cap_minutes: d.overtimeDailyCapMinutes,
    overtime_rounding_minutes: d.overtimeRoundingMinutes,
    overtime_rounding_mode: d.overtimeRoundingMode,
    early_overtime_enabled: d.earlyOvertimeEnabled,
    early_overtime_trigger_time: d.earlyOvertimeEnabled ? d.earlyOvertimeTriggerTime : null,
    early_overtime_pay_until_time: d.earlyOvertimeEnabled
      ? d.earlyOvertimePayUntilTime
      : null,
    early_overtime_max_minutes: d.earlyOvertimeMaxMinutes,
    early_overtime_grace_minutes: d.earlyOvertimeGraceMinutes,
    pin_code: d.pinCode,
    rfid_card_id: d.rfidCardId,
    notes: d.notes || null,
    updated_at: new Date().toISOString()
  }

  if (input.id) {
    const { error } = await ctx.supabase
      .from('hr_employees')
      .update(row)
      .eq('id', input.id)
      .eq('tenant_id', ctx.user.tenantId!)
      .is('deleted_at', null)
      .is('archived_at', null)
    if (error) {
      if (error.message.includes('hr_employees_tenant_code')) {
        return { ok: false, message: 'Ez a dolgozói kód már foglalt.' }
      }
      if (error.message.includes('hr_employees_tenant_pin')) {
        return {
          ok: false,
          message: 'Ez a PIN már foglalt.',
          fieldErrors: { pinCode: 'Ez a PIN már foglalt.' }
        }
      }
      if (error.message.includes('hr_employees_tenant_rfid')) {
        return {
          ok: false,
          message: 'Ez az RFID kártya már foglalt.',
          fieldErrors: { rfidCardId: 'Ez az RFID kártya már foglalt.' }
        }
      }
      return { ok: false, message: error.message }
    }
    revalidateHr(input.id)
    return { ok: true, id: input.id }
  }

  const { data, error } = await ctx.supabase
    .from('hr_employees')
    .insert(row)
    .select('id')
    .single()

  if (error || !data) {
    if (error?.message.includes('hr_employees_tenant_code')) {
      return { ok: false, message: 'Ez a dolgozói kód már foglalt.' }
    }
    if (error?.message.includes('hr_employees_tenant_pin')) {
      return {
        ok: false,
        message: 'Ez a PIN már foglalt.',
        fieldErrors: { pinCode: 'Ez a PIN már foglalt.' }
      }
    }
    if (error?.message.includes('hr_employees_tenant_rfid')) {
      return {
        ok: false,
        message: 'Ez az RFID kártya már foglalt.',
        fieldErrors: { rfidCardId: 'Ez az RFID kártya már foglalt.' }
      }
    }
    return { ok: false, message: error?.message ?? 'Mentés sikertelen.' }
  }
  revalidateHr(data.id as string)
  return { ok: true, id: data.id as string }
}

/** Soft delete — lista/naptár nem mutatja; RFID/PIN felszabadul (unique index). */
export async function softDeleteEmployeeAction(input: {
  id: string
}): Promise<JelenletActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const tenantId = ctx.user.tenantId!
  const { data: row } = await ctx.supabase
    .from('hr_employees')
    .select('id, name')
    .eq('id', input.id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!row) return { ok: false, message: 'Dolgozó nem található.' }

  const now = new Date().toISOString()
  const { error } = await ctx.supabase
    .from('hr_employees')
    .update({
      deleted_at: now,
      active: false,
      pin_code: null,
      rfid_card_id: null,
      updated_at: now
    })
    .eq('id', input.id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)

  if (error) return { ok: false, message: error.message }
  revalidateHr(input.id)
  return { ok: true, id: input.id }
}

/** Kilépett dolgozó: kikerül a listából, adatai és íve megmarad; PIN/RFID felszabadul. */
export async function archiveEmployeeAction(input: {
  id: string
}): Promise<JelenletActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const now = new Date().toISOString()
  const { data, error } = await ctx.supabase
    .from('hr_employees')
    .update({
      archived_at: now,
      active: false,
      pin_code: null,
      rfid_card_id: null,
      updated_at: now
    })
    .eq('id', input.id)
    .eq('tenant_id', ctx.user.tenantId!)
    .is('deleted_at', null)
    .is('archived_at', null)
    .select('id')
    .maybeSingle()

  if (error) return { ok: false, message: error.message }
  if (!data) return { ok: false, message: 'Dolgozó nem található vagy már archivált.' }
  revalidateHr(input.id)
  return { ok: true, id: input.id }
}

/** Visszaállítás inaktívként — PIN/RFID újra megadandó. */
export async function restoreEmployeeAction(input: {
  id: string
}): Promise<JelenletActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const { data, error } = await ctx.supabase
    .from('hr_employees')
    .update({ archived_at: null, updated_at: new Date().toISOString() })
    .eq('id', input.id)
    .eq('tenant_id', ctx.user.tenantId!)
    .is('deleted_at', null)
    .not('archived_at', 'is', null)
    .select('id')
    .maybeSingle()

  if (error) return { ok: false, message: error.message }
  if (!data) return { ok: false, message: 'Dolgozó nem található.' }
  revalidateHr(input.id)
  return { ok: true, id: input.id }
}

export async function createAbsenceAction(input: {
  employeeId: string
  values: AbsenceFormInput
}): Promise<JelenletActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = absenceFormSchema.safeParse(input.values)
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Ellenőrizd a mezőket.',
      fieldErrors: fieldErrorsFromZod(parsed.error.issues)
    }
  }

  const { data: emp } = await ctx.supabase
    .from('hr_employees')
    .select('id')
    .eq('id', input.employeeId)
    .eq('tenant_id', ctx.user.tenantId!)
    .maybeSingle()
  if (!emp) return { ok: false, message: 'Dolgozó nem található.' }

  const d = parsed.data
  const { data, error } = await ctx.supabase
    .from('hr_absences')
    .insert({
      tenant_id: ctx.user.tenantId!,
      employee_id: input.employeeId,
      start_date: d.startDate,
      end_date: d.endDate,
      absence_type: d.absenceType,
      note: d.note || null
    })
    .select('id')
    .single()

  if (error || !data) {
    return { ok: false, message: error?.message ?? 'Mentés sikertelen.' }
  }
  revalidateHr(input.employeeId)
  return { ok: true, id: data.id as string }
}

export async function deleteAbsenceAction(input: {
  employeeId: string
  absenceId: string
}): Promise<JelenletActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const { error } = await ctx.supabase
    .from('hr_absences')
    .delete()
    .eq('id', input.absenceId)
    .eq('tenant_id', ctx.user.tenantId!)
    .eq('employee_id', input.employeeId)

  if (error) return { ok: false, message: error.message }
  revalidateHr(input.employeeId)
  return { ok: true }
}

export async function saveAttendanceDayAction(
  values: AttendanceDayFormInput
): Promise<JelenletActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = attendanceDayFormSchema.safeParse(values)
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Ellenőrizd a mezőket.',
      fieldErrors: fieldErrorsFromZod(parsed.error.issues)
    }
  }
  const d = parsed.data
  const tenantId = ctx.user.tenantId!

  const { data: emp } = await ctx.supabase
    .from('hr_employees')
    .select('id, lunch_start, lunch_end')
    .eq('id', d.employeeId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!emp) return { ok: false, message: 'Dolgozó nem található.' }

  if (d.mode === 'clear') {
    await ctx.supabase
      .from('hr_attendance_days')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('employee_id', d.employeeId)
      .eq('work_date', d.workDate)

    await ctx.supabase
      .from('hr_absences')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('employee_id', d.employeeId)
      .eq('start_date', d.workDate)
      .eq('end_date', d.workDate)

    revalidateHr(d.employeeId)
    return { ok: true }
  }

  if (d.mode === 'vacation' || d.mode === 'sick') {
    await ctx.supabase
      .from('hr_attendance_days')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('employee_id', d.employeeId)
      .eq('work_date', d.workDate)

    await ctx.supabase
      .from('hr_absences')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('employee_id', d.employeeId)
      .eq('start_date', d.workDate)
      .eq('end_date', d.workDate)

    const { error } = await ctx.supabase.from('hr_absences').insert({
      tenant_id: tenantId,
      employee_id: d.employeeId,
      start_date: d.workDate,
      end_date: d.workDate,
      absence_type: d.mode === 'vacation' ? 'vacation' : 'sick',
      note: d.note || null
    })
    if (error) return { ok: false, message: error.message }
    revalidateHr(d.employeeId)
    return { ok: true }
  }

  // work mode — remove single-day absences covering this day
  await ctx.supabase
    .from('hr_absences')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('employee_id', d.employeeId)
    .eq('start_date', d.workDate)
    .eq('end_date', d.workDate)

  const lunchStart =
    d.lunchStart ??
    (emp.lunch_start
      ? String(emp.lunch_start).slice(0, 5)
      : null)
  const lunchEnd =
    d.lunchEnd ??
    (emp.lunch_end ? String(emp.lunch_end).slice(0, 5) : null)

  const { data: existing } = await ctx.supabase
    .from('hr_attendance_days')
    .select('arrival_time, departure_time, arrival_source, departure_source, source')
    .eq('tenant_id', tenantId)
    .eq('employee_id', d.employeeId)
    .eq('work_date', d.workDate)
    .maybeSingle()

  const fieldSource = (
    next: string | null,
    prevTime: unknown,
    prevSource: unknown
  ): AttendanceTimeSource | null => {
    if (!next) return null
    if (normalizeTime(prevTime as string | null) === next) {
      return toTimeSource(prevSource) ?? 'manual'
    }
    return 'manual'
  }
  const arrivalSource = fieldSource(
    d.arrivalTime,
    existing?.arrival_time,
    existing?.arrival_source
  )
  const departureSource = fieldSource(
    d.departureTime,
    existing?.departure_time,
    existing?.departure_source
  )
  const anyManual = arrivalSource === 'manual' || departureSource === 'manual'

  const { error } = await ctx.supabase.from('hr_attendance_days').upsert(
    {
      tenant_id: tenantId,
      employee_id: d.employeeId,
      work_date: d.workDate,
      arrival_time: d.arrivalTime,
      departure_time: d.departureTime,
      lunch_start: lunchStart,
      lunch_end: lunchEnd,
      source: (existing?.source as string | null) ?? 'manual',
      manually_edited: anyManual,
      arrival_source: arrivalSource,
      departure_source: departureSource,
      note: d.note || null,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'employee_id,work_date' }
  )

  if (error) return { ok: false, message: error.message }
  revalidateHr(d.employeeId)
  return { ok: true }
}
