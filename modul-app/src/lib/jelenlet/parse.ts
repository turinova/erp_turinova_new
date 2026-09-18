import { z } from 'zod'

import { ABSENCE_TYPES } from '@/lib/jelenlet/types'
import { normalizeTime } from '@/lib/jelenlet/hours'

const timeField = z
  .string()
  .optional()
  .nullable()
  .transform((v) => normalizeTime(v ?? null))

export const employeeFormSchema = z.object({
  name: z.string().trim().min(1, 'Add meg a nevet.').max(120),
  code: z.string().trim().max(40).optional().default(''),
  employeeTypeId: z.string().uuid('Válassz dolgozó típust.'),
  active: z.boolean(),
  shiftStart: timeField,
  shiftEnd: timeField,
  lunchStart: timeField,
  lunchEnd: timeField,
  worksOnSaturday: z.boolean(),
  overtimeEnabled: z.boolean(),
  overtimeGraceMinutes: z.coerce.number().int().min(0).max(240),
  overtimeDailyCapMinutes: z.coerce.number().int().min(0).max(720),
  notes: z.string().trim().max(2000).optional().nullable()
})

export type EmployeeFormInput = z.input<typeof employeeFormSchema>
export type EmployeeFormValues = z.output<typeof employeeFormSchema>

export const absenceFormSchema = z
  .object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Érvénytelen dátum.'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Érvénytelen dátum.'),
    absenceType: z.enum(ABSENCE_TYPES),
    note: z.string().trim().max(500).optional().nullable()
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: 'A vége nem lehet korábbi, mint a kezdet.',
    path: ['endDate']
  })

export type AbsenceFormInput = z.input<typeof absenceFormSchema>
export type AbsenceFormValues = z.output<typeof absenceFormSchema>

export const dayModeSchema = z.enum([
  'work',
  'vacation',
  'sick',
  'clear'
])

export const attendanceDayFormSchema = z
  .object({
    employeeId: z.string().uuid(),
    workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    mode: dayModeSchema,
    arrivalTime: timeField,
    departureTime: timeField,
    lunchStart: timeField,
    lunchEnd: timeField,
    note: z.string().trim().max(500).optional().nullable()
  })
  .superRefine((d, ctx) => {
    if (d.mode !== 'work') return
    if (!d.arrivalTime && !d.departureTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Add meg legalább az érkezést vagy a távozást.',
        path: ['arrivalTime']
      })
    }
    if (
      d.arrivalTime &&
      d.departureTime &&
      d.departureTime <= d.arrivalTime
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A távozás legyen későbbi, mint az érkezés.',
        path: ['departureTime']
      })
    }
  })

export type AttendanceDayFormInput = z.input<typeof attendanceDayFormSchema>
export type AttendanceDayFormValues = z.output<typeof attendanceDayFormSchema>
