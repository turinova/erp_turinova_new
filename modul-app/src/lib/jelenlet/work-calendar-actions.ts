'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import {
  getWorkCalendarDaysInRange,
  previewWorkCalendarImpact
} from '@/lib/jelenlet/work-calendar-queries'
import {
  WORK_CALENDAR_DAY_TYPES,
  type WorkCalendarDayType
} from '@/lib/jelenlet/types'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'

export type WorkCalendarActionResult =
  | {
      ok: true
      replaced?: number
      inserted?: number
      attendanceCount?: number
      absenceCount?: number
      conflicts?: Array<{
        workDate: string
        dayType: WorkCalendarDayType
        name: string
      }>
    }
  | {
      ok: false
      message: string
      fieldErrors?: Record<string, string>
      conflicts?: Array<{
        workDate: string
        dayType: WorkCalendarDayType
        name: string
      }>
      attendanceCount?: number
      absenceCount?: number
    }

const PATHS = [
  '/jelenlet/naptar',
  '/jelenlet',
  '/dolgozok'
] as const

const ymdSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Érvénytelen dátum.')

const dayTypeSchema = z.enum(WORK_CALENDAR_DAY_TYPES)

const upsertSchema = z
  .object({
    startDate: ymdSchema,
    endDate: ymdSchema.optional(),
    dayType: dayTypeSchema,
    name: z.string().trim().min(1, 'Add meg a nevet.').max(120),
    replaceExisting: z.boolean().default(false)
  })
  .superRefine((val, ctx) => {
    const end = val.endDate || val.startDate
    if (end < val.startDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'A záró dátum nem lehet korábbi a kezdőnél.'
      })
    }
  })

function revalidate() {
  for (const p of PATHS) revalidatePath(p)
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

function expandYmdRange(start: string, end: string): string[] {
  const out: string[] = []
  const [sy, sm, sd] = start.split('-').map(Number)
  const [ey, em, ed] = end.split('-').map(Number)
  const cur = new Date(sy!, sm! - 1, sd!)
  const last = new Date(ey!, em! - 1, ed!)
  while (cur <= last) {
    const y = cur.getFullYear()
    const m = String(cur.getMonth() + 1).padStart(2, '0')
    const d = String(cur.getDate()).padStart(2, '0')
    out.push(`${y}-${m}-${d}`)
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

export async function checkWorkCalendarUpsert(input: {
  startDate: string
  endDate?: string
  dayType: WorkCalendarDayType
  name: string
}): Promise<WorkCalendarActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = upsertSchema.safeParse({
    ...input,
    replaceExisting: false
  })
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Ellenőrizd a mezőket.',
      fieldErrors: fieldErrorsFromZod(parsed.error.issues)
    }
  }

  const d = parsed.data
  const end = d.endDate || d.startDate
  const dates = expandYmdRange(d.startDate, end)
  if (dates.length > 31) {
    return {
      ok: false,
      message: 'Maximum 31 napos tartomány adható meg egyszerre.',
      fieldErrors: { endDate: 'Maximum 31 nap.' }
    }
  }

  const existing = await getWorkCalendarDaysInRange(
    ctx.supabase,
    ctx.user.tenantId!,
    d.startDate,
    end
  )
  const impact = await previewWorkCalendarImpact(
    ctx.supabase,
    ctx.user.tenantId!,
    dates
  )

  return {
    ok: true,
    conflicts: existing.map((r) => ({
      workDate: r.workDate,
      dayType: r.dayType,
      name: r.name
    })),
    attendanceCount: impact.attendanceCount,
    absenceCount: impact.absenceCount
  }
}

export async function upsertWorkCalendarRange(input: {
  startDate: string
  endDate?: string
  dayType: WorkCalendarDayType
  name: string
  replaceExisting: boolean
}): Promise<WorkCalendarActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = upsertSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Ellenőrizd a mezőket.',
      fieldErrors: fieldErrorsFromZod(parsed.error.issues)
    }
  }

  const d = parsed.data
  const end = d.endDate || d.startDate
  const dates = expandYmdRange(d.startDate, end)
  if (dates.length > 31) {
    return {
      ok: false,
      message: 'Maximum 31 napos tartomány adható meg egyszerre.',
      fieldErrors: { endDate: 'Maximum 31 nap.' }
    }
  }

  const tenantId = ctx.user.tenantId!
  const existing = await getWorkCalendarDaysInRange(
    ctx.supabase,
    tenantId,
    d.startDate,
    end
  )

  if (existing.length > 0 && !d.replaceExisting) {
    return {
      ok: false,
      message: 'Ezen a tartományon már van naptári nap — erősítsd meg a cserét.',
      conflicts: existing.map((r) => ({
        workDate: r.workDate,
        dayType: r.dayType,
        name: r.name
      }))
    }
  }

  let replaced = 0
  let inserted = 0

  for (const ymd of dates) {
    const hit = existing.find((e) => e.workDate === ymd)
    if (hit) {
      const { error } = await ctx.supabase
        .from('hr_work_calendar')
        .update({
          day_type: d.dayType,
          name: d.name
        })
        .eq('id', hit.id)
        .eq('tenant_id', tenantId)
      if (error) return { ok: false, message: error.message }
      replaced += 1
    } else {
      const { error } = await ctx.supabase.from('hr_work_calendar').insert({
        tenant_id: tenantId,
        work_date: ymd,
        day_type: d.dayType,
        name: d.name
      })
      if (error) {
        if (error.message.includes('hr_work_calendar') && error.message.includes('unique')) {
          return {
            ok: false,
            message: 'Konfliktus: a nap már foglalt. Próbáld újra cserével.'
          }
        }
        return { ok: false, message: error.message }
      }
      inserted += 1
    }
  }

  revalidate()
  return { ok: true, replaced, inserted }
}

export async function updateWorkCalendarDay(input: {
  id: string
  dayType: WorkCalendarDayType
  name: string
}): Promise<WorkCalendarActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = z
    .object({
      id: z.string().uuid(),
      dayType: dayTypeSchema,
      name: z.string().trim().min(1, 'Add meg a nevet.').max(120)
    })
    .safeParse(input)

  if (!parsed.success) {
    return {
      ok: false,
      message: 'Ellenőrizd a mezőket.',
      fieldErrors: fieldErrorsFromZod(parsed.error.issues)
    }
  }

  const { data, error } = await ctx.supabase
    .from('hr_work_calendar')
    .update({
      day_type: parsed.data.dayType,
      name: parsed.data.name
    })
    .eq('id', parsed.data.id)
    .eq('tenant_id', ctx.user.tenantId!)
    .select('id')
    .maybeSingle()

  if (error) return { ok: false, message: error.message }
  if (!data) return { ok: false, message: 'Nap nem található.' }
  revalidate()
  return { ok: true }
}

export async function deleteWorkCalendarDay(input: {
  id: string
}): Promise<WorkCalendarActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const { error } = await ctx.supabase
    .from('hr_work_calendar')
    .delete()
    .eq('id', input.id)
    .eq('tenant_id', ctx.user.tenantId!)

  if (error) return { ok: false, message: error.message }
  revalidate()
  return { ok: true }
}

export async function seedHuHolidaysForYear(input: {
  year: number
}): Promise<WorkCalendarActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const year = Number(input.year)
  if (!Number.isInteger(year) || year < 2026 || year > 2027) {
    return {
      ok: false,
      message:
        'Ehhez az évhez még nincs beépített ünneplista — add hozzá kézzel, vagy válassz 2026 / 2027-et.'
    }
  }

  const { data, error } = await ctx.supabase.rpc(
    'seed_hr_hu_holidays_for_year',
    {
      p_tenant_id: ctx.user.tenantId!,
      p_year: year
    }
  )

  if (error) return { ok: false, message: error.message }
  revalidate()
  return { ok: true, inserted: Number(data) || 0 }
}
