/** Shared date/time helpers for attendance UI (no API side effects). */

export function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = []
  const date = new Date(year, month - 1, 1)

  while (date.getMonth() === month - 1) {
    days.push(new Date(date))
    date.setDate(date.getDate() + 1)
  }

  return days
}

export function formatDateLocal(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')

  return `${y}-${m}-${d}`
}

/** Display: "MM.DD WeekdayName" */
export function formatDateHu(date: Date): string {
  const dayNames = ['Vasárnap', 'Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat']
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${month}.${day} ${dayNames[date.getDay()]}`
}

export function isSunday(date: Date): boolean {
  return date.getDay() === 0
}

export function isSaturday(date: Date): boolean {
  return date.getDay() === 6
}

export function isToday(date: Date): boolean {
  const today = new Date()

  return date.toDateString() === today.toDateString()
}

export type PublicHolidayType =
  | 'national'
  | 'company'
  | 'relocated_workday'
  | 'relocated_rest'

export type PublicHolidayRow = {
  name: string
  start_date: string
  end_date: string
  type: PublicHolidayType
}

const HOLIDAY_TYPES = new Set<PublicHolidayType>([
  'national',
  'company',
  'relocated_workday',
  'relocated_rest'
])

export function parsePublicHolidayType(raw: unknown): PublicHolidayType {
  const s = typeof raw === 'string' ? raw.trim() : ''
  if (HOLIDAY_TYPES.has(s as PublicHolidayType)) return s as PublicHolidayType

  return 'national'
}

export function isCalendarRestType(type: PublicHolidayType): boolean {
  return type === 'national' || type === 'company' || type === 'relocated_rest'
}

export function isRelocatedWorkdayType(type: PublicHolidayType): boolean {
  return type === 'relocated_workday'
}

/** First matching public holiday row for a calendar day (YYYY-MM-DD string compare). */
export function findPublicHolidayForDate(date: Date, holidays: PublicHolidayRow[]): PublicHolidayRow | null {
  if (!holidays?.length) return null
  const ds = formatDateLocal(date)

  for (const h of holidays) {
    if (ds >= h.start_date && ds <= h.end_date) return h
  }

  return null
}

/** Ünnep / áthelyezett pihenő — a nap pihenő. */
export function findCalendarRestForDate(date: Date, holidays: PublicHolidayRow[]): PublicHolidayRow | null {
  const h = findPublicHolidayForDate(date, holidays)
  if (!h || !isCalendarRestType(h.type)) return null

  return h
}

/** Áthelyezett munkanap (tipikusan szombat). */
export function findRelocatedWorkdayForDate(date: Date, holidays: PublicHolidayRow[]): PublicHolidayRow | null {
  const h = findPublicHolidayForDate(date, holidays)
  if (!h || !isRelocatedWorkdayType(h.type)) return null

  return h
}

/**
 * Kötelező munkanap HR / papír összesítőhöz:
 * - vasárnap soha
 * - ünnep / áthelyezett pihenő: nem
 * - áthelyezett munkanap: igen (akár szombat)
 * - szombat: csak ha worksOnSaturday
 * - hétköznap: igen
 */
export function isRequiredWorkday(
  date: Date,
  worksOnSaturday: boolean,
  publicHolidays: PublicHolidayRow[]
): boolean {
  if (isSunday(date)) return false
  if (findCalendarRestForDate(date, publicHolidays)) return false
  if (findRelocatedWorkdayForDate(date, publicHolidays)) return true
  if (isSaturday(date)) return worksOnSaturday

  return true
}

/** YMD helper for monthly attention (Budapest calendar strings). */
export function isRequiredWorkdayYmd(
  dateStr: string,
  worksOnSaturday: boolean,
  publicHolidays: PublicHolidayRow[]
): boolean {
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return false

  return isRequiredWorkday(new Date(y, m - 1, d), worksOnSaturday, publicHolidays)
}

export function isHoliday(date: Date, holidays: Array<{ start_date: string; end_date: string }>): boolean {
  if (!holidays || holidays.length === 0) return false
  const dateStr = date.toISOString().split('T')[0]

  return holidays.some(holiday => {
    const startDate = new Date(holiday.start_date)
    const endDate = new Date(holiday.end_date)
    const checkDate = new Date(dateStr)

    return checkDate >= startDate && checkDate <= endDate
  })
}

export function calculateHours(
  startTime: string | null,
  endTime: string | null,
  lunchStart: string | null,
  lunchEnd: string | null
): number {
  if (!startTime || !endTime) return 0
  const start = new Date(`2000-01-01T${startTime}`)
  const end = new Date(`2000-01-01T${endTime}`)
  let totalMinutes = (end.getTime() - start.getTime()) / (1000 * 60)

  if (lunchStart && lunchEnd) {
    const lunchStartTime = new Date(`2000-01-01T${lunchStart}`)
    const lunchEndTime = new Date(`2000-01-01T${lunchEnd}`)
    const lunchMinutes = (lunchEndTime.getTime() - lunchStartTime.getTime()) / (1000 * 60)

    if (lunchMinutes > 0) totalMinutes -= lunchMinutes
  }

  const hours = Math.max(0, totalMinutes / 60)

  return Math.round(hours * 100) / 100
}

export type AttendanceMetrics = {
  /** Full physical span minus lunch (always shown as audit) */
  actualHours: number
  /** Time inside paid shift window minus lunch overlap on that segment */
  paidHours: number
  /** Minutes before shift start (audit; not added to paid) */
  earlyMinutes: number
  /** Minutes after shift end (audit; not added to paid) */
  lateMinutes: number
}

export type OvertimePolicy = {
  enabled: boolean
  graceMinutes: number
  roundingMinutes: number
  roundingMode: 'floor' | 'nearest' | 'ceil'
  dailyCapMinutes: number
  requiresCompleteDay: boolean
}

export const DEFAULT_OVERTIME_POLICY: OvertimePolicy = {
  enabled: false,
  graceMinutes: 10,
  roundingMinutes: 15,
  roundingMode: 'floor',
  dailyCapMinutes: 120,
  requiresCompleteDay: true
}

export const DEFAULT_ARRIVAL_GRACE_MINUTES = 10
export const DEFAULT_DEPARTURE_GRACE_MINUTES = 10

function parseTimeToMinutes(t: string | null): number | null {
  if (!t) return null
  const parts = t.split(':').map(Number)
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return null

  return parts[0] * 60 + parts[1]
}

function minutesToTimeString(totalMinutes: number): string {
  const h = String(Math.floor(totalMinutes / 60)).padStart(2, '0')
  const m = String(totalMinutes % 60).padStart(2, '0')
  return `${h}:${m}`
}

/**
 * Paid-window range (shift + grace clipping). Used in tooltips; the calendar shows raw scan times.
 */
export function getPolicyDisplayRange(
  arrival: string | null,
  departure: string | null,
  shiftStart: string | null,
  shiftEnd: string | null,
  arrivalGraceMinutes: number = DEFAULT_ARRIVAL_GRACE_MINUTES,
  departureGraceMinutes: number = DEFAULT_DEPARTURE_GRACE_MINUTES
): { start: string; end: string; usesPolicy: boolean } | null {
  if (!arrival || !departure) return null

  const a = parseTimeToMinutes(arrival)
  const d = parseTimeToMinutes(departure)
  if (a === null || d === null || d <= a) return null

  const s0 = parseTimeToMinutes(shiftStart)
  const s1 = parseTimeToMinutes(shiftEnd)
  if (s0 === null || s1 === null || s1 <= s0) {
    return { start: arrival, end: departure, usesPolicy: false }
  }

  const safeArrivalGrace = Math.max(0, Math.floor(arrivalGraceMinutes))
  const safeDepartureGrace = Math.max(0, Math.floor(departureGraceMinutes))
  const adjustedArrival = Math.abs(a - s0) <= safeArrivalGrace ? s0 : a
  const adjustedDeparture = Math.abs(d - s1) <= safeDepartureGrace ? s1 : d
  const paidStart = Math.max(adjustedArrival, s0)
  const paidEnd = Math.min(adjustedDeparture, s1)

  if (paidStart >= paidEnd) {
    return { start: arrival, end: departure, usesPolicy: false }
  }

  return { start: minutesToTimeString(paidStart), end: minutesToTimeString(paidEnd), usesPolicy: true }
}

/**
 * Paid hours are clipped to [shiftStart, shiftEnd]; lunch is deducted only where it overlaps the paid segment.
 * If shift start/end are null, paidHours === actualHours (no policy window).
 */
export function computeAttendanceMetrics(
  arrival: string | null,
  departure: string | null,
  lunchStart: string | null,
  lunchEnd: string | null,
  shiftStart: string | null,
  shiftEnd: string | null,
  arrivalGraceMinutes: number = DEFAULT_ARRIVAL_GRACE_MINUTES,
  departureGraceMinutes: number = DEFAULT_DEPARTURE_GRACE_MINUTES
): AttendanceMetrics {
  const actualHours = calculateHours(arrival, departure, lunchStart, lunchEnd)

  if (!arrival || !departure) {
    return { actualHours: 0, paidHours: 0, earlyMinutes: 0, lateMinutes: 0 }
  }

  const a = parseTimeToMinutes(arrival)
  const d = parseTimeToMinutes(departure)
  if (a === null || d === null || d <= a) {
    return { actualHours, paidHours: 0, earlyMinutes: 0, lateMinutes: 0 }
  }

  const s0 = parseTimeToMinutes(shiftStart)
  const s1 = parseTimeToMinutes(shiftEnd)

  if (s0 === null || s1 === null || s1 <= s0) {
    return { actualHours, paidHours: actualHours, earlyMinutes: 0, lateMinutes: 0 }
  }

  const earlyMinutes = Math.max(0, s0 - a)
  const lateMinutes = Math.max(0, d - s1)

  // Apply grace only to paid-time clipping, while audit (early/late) remains raw.
  const safeArrivalGrace = Math.max(0, Math.floor(arrivalGraceMinutes))
  const safeDepartureGrace = Math.max(0, Math.floor(departureGraceMinutes))
  const adjustedArrival = Math.abs(a - s0) <= safeArrivalGrace ? s0 : a
  const adjustedDeparture = Math.abs(d - s1) <= safeDepartureGrace ? s1 : d

  const paidStart = Math.max(adjustedArrival, s0)
  const paidEnd = Math.min(adjustedDeparture, s1)

  if (paidStart >= paidEnd) {
    return { actualHours, paidHours: 0, earlyMinutes, lateMinutes }
  }

  let paidGross = paidEnd - paidStart

  const l0 = parseTimeToMinutes(lunchStart)
  const l1 = parseTimeToMinutes(lunchEnd)

  if (l0 !== null && l1 !== null && l1 > l0) {
    const overlapStart = Math.max(paidStart, l0)
    const overlapEnd = Math.min(paidEnd, l1)

    if (overlapEnd > overlapStart) {
      paidGross -= overlapEnd - overlapStart
    }
  }

  const paidHours = Math.max(0, Math.round((paidGross / 60) * 100) / 100)

  return { actualHours, paidHours, earlyMinutes, lateMinutes }
}

export function roundMinutesToStep(value: number, step: number, mode: OvertimePolicy['roundingMode']): number {
  if (value <= 0) return 0
  const safeStep = Math.max(1, Math.floor(step))
  const ratio = value / safeStep
  if (mode === 'ceil') return Math.ceil(ratio) * safeStep
  if (mode === 'nearest') return Math.round(ratio) * safeStep
  return Math.floor(ratio) * safeStep
}

export type EarlyOvertimeMode = 'capped_actual' | 'fixed_grant'

export interface EarlyOvertimePolicy {
  enabled: boolean
  /** HH:mm — early OT applies only if arrival is strictly before this time; null = feature off */
  triggerTime: string | null
  /** HH:mm — end of credited early span; null = use shift_start */
  payUntilTime: string | null
  mode: EarlyOvertimeMode
  fixedMinutes: number
  maxMinutes: number
  graceMinutes: number
  roundingMinutes: number
  roundingMode: 'floor' | 'nearest' | 'ceil'
  dailyCapMinutes: number
  requiresCompleteDay: boolean
}

export const DEFAULT_EARLY_OVERTIME_POLICY: EarlyOvertimePolicy = {
  enabled: false,
  triggerTime: null,
  payUntilTime: null,
  mode: 'capped_actual',
  fixedMinutes: 30,
  maxMinutes: 30,
  graceMinutes: 0,
  roundingMinutes: 15,
  roundingMode: 'floor',
  dailyCapMinutes: 120,
  requiresCompleteDay: true
}

/**
 * Pre-shift overtime: credited time when the employee arrives before `triggerTime`
 * (same calendar day), from `arrival` up to min(shift_start, pay_until), then grace / rounding / caps.
 * `fixed_grant`: if arrival < trigger, credit `fixedMinutes` (after rounding/caps).
 */
export function computeEarlyOvertimeMinutes(
  arrival: string | null,
  departure: string | null,
  shiftStart: string | null,
  policy?: Partial<EarlyOvertimePolicy>
): number {
  const p: EarlyOvertimePolicy = {
    ...DEFAULT_EARLY_OVERTIME_POLICY,
    ...policy
  }
  if (!p.enabled) return 0
  if (p.requiresCompleteDay && (!arrival || !departure)) return 0
  if (!arrival) return 0

  const a = parseTimeToMinutes(arrival)
  const s0 = parseTimeToMinutes(shiftStart)
  const t = parseTimeToMinutes(p.triggerTime)
  if (a === null || s0 === null || t === null) return 0

  if (a >= s0) return 0
  if (a >= t) return 0

  const payUntilParsed = parseTimeToMinutes(p.payUntilTime)
  const payEnd = payUntilParsed === null ? s0 : Math.min(s0, payUntilParsed)
  if (payEnd <= a) return 0

  const rawSpan = payEnd - a
  if (rawSpan <= 0) return 0

  if (p.mode === 'fixed_grant') {
    const base = Math.max(0, Math.floor(p.fixedMinutes))
    const rounded = roundMinutesToStep(base, p.roundingMinutes, p.roundingMode)
    const maxCapped = Math.min(Math.max(0, Math.floor(p.maxMinutes)), rounded)
    return Math.min(Math.max(0, Math.floor(p.dailyCapMinutes)), maxCapped)
  }

  const minusGrace = Math.max(0, rawSpan - Math.max(0, Math.floor(p.graceMinutes)))
  const rounded = roundMinutesToStep(minusGrace, p.roundingMinutes, p.roundingMode)
  const maxCapped = Math.min(Math.max(0, Math.floor(p.maxMinutes)), rounded)
  return Math.min(Math.max(0, Math.floor(p.dailyCapMinutes)), maxCapped)
}

export function computeOvertimeMinutes(
  arrival: string | null,
  departure: string | null,
  shiftStart: string | null,
  shiftEnd: string | null,
  policy?: Partial<OvertimePolicy>
): number {
  const p: OvertimePolicy = {
    ...DEFAULT_OVERTIME_POLICY,
    ...policy
  }
  if (!p.enabled) return 0
  if (p.requiresCompleteDay && (!arrival || !departure)) return 0

  const d = parseTimeToMinutes(departure)
  const s1 = parseTimeToMinutes(shiftEnd)
  const s0 = parseTimeToMinutes(shiftStart)
  if (d === null || s1 === null || s0 === null || s1 <= s0) return 0

  const rawAfterShift = Math.max(0, d - s1)
  const minusGrace = Math.max(0, rawAfterShift - Math.max(0, Math.floor(p.graceMinutes)))
  const rounded = roundMinutesToStep(minusGrace, p.roundingMinutes, p.roundingMode)
  const capped = Math.min(Math.max(0, Math.floor(p.dailyCapMinutes)), rounded)
  return capped
}

export function timeStringToDate(timeStr: string | null): Date | null {
  if (!timeStr) return null
  const [hours, minutes] = timeStr.split(':').map(Number)

  if (isNaN(hours) || isNaN(minutes)) return null
  const date = new Date()

  date.setHours(hours, minutes, 0, 0)

  return date
}

export function dateToTimeString(date: Date | null): string {
  if (!date) return ''
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${hours}:${minutes}`
}

/** Monday-first calendar row indices (0 = Mon … 6 = Sun) for each day in month */
export function getCalendarCells(dayCount: number, year: number, month: number): (number | null)[] {
  const first = new Date(year, month - 1, 1)
  const offset = (first.getDay() + 6) % 7
  const cells: (number | null)[] = []

  for (let i = 0; i < offset; i++) cells.push(null)
  for (let d = 0; d < dayCount; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  return cells
}

export const WEEKDAY_LABELS_HU = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V']

/** Map Supabase `employees` row to `Partial<EarlyOvertimePolicy>` for `computeEarlyOvertimeMinutes`. */
export function earlyOvertimePolicyFromEmployeeRow(row: Record<string, unknown>): Partial<EarlyOvertimePolicy> {
  const rm = row.early_overtime_rounding_mode
  const roundingMode =
    rm === 'nearest' || rm === 'ceil' ? (rm as EarlyOvertimePolicy['roundingMode']) : 'floor'

  return {
    enabled: row.early_overtime_enabled === true,
    triggerTime: row.early_overtime_trigger_time ? String(row.early_overtime_trigger_time).slice(0, 5) : null,
    payUntilTime: row.early_overtime_pay_until_time ? String(row.early_overtime_pay_until_time).slice(0, 5) : null,
    mode: row.early_overtime_mode === 'fixed_grant' ? 'fixed_grant' : 'capped_actual',
    fixedMinutes: Number.isFinite(Number(row.early_overtime_fixed_minutes)) ? Number(row.early_overtime_fixed_minutes) : 30,
    maxMinutes: Number.isFinite(Number(row.early_overtime_max_minutes)) ? Number(row.early_overtime_max_minutes) : 30,
    graceMinutes: Number.isFinite(Number(row.early_overtime_grace_minutes)) ? Number(row.early_overtime_grace_minutes) : 0,
    roundingMinutes: Number.isFinite(Number(row.early_overtime_rounding_minutes))
      ? Number(row.early_overtime_rounding_minutes)
      : 15,
    roundingMode,
    dailyCapMinutes: Number.isFinite(Number(row.early_overtime_daily_cap_minutes))
      ? Number(row.early_overtime_daily_cap_minutes)
      : 120,
    requiresCompleteDay: row.early_overtime_requires_complete_day !== false
  }
}

/** Budapest calendar date YYYY-MM-DD. */
export function getBudapestTodayYmd(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Budapest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date())
}

/** Normalize DB/API date values to YYYY-MM-DD for map lookups. */
export function normalizeAttendanceYmd(value: string | null | undefined): string | null {
  if (!value) return null
  const s = String(value).slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

export function formatCalendarYmd(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** All calendar days in a month as YYYY-MM-DD (no local timezone drift). */
export function getCalendarDaysInMonthYmd(year: number, month: number): string[] {
  const dayCount = new Date(year, month, 0).getDate()
  const days: string[] = []
  for (let d = 1; d <= dayCount; d++) {
    days.push(formatCalendarYmd(year, month, d))
  }
  return days
}

/** Weekday 0=Sun … 6=Sat for a calendar day (UTC noon avoids DST edge cases). */
export function getWeekdayFromYmd(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay()
}

/** True when HR should review this day (strictly before Budapest today). */
export function isClosedAttendanceReviewDay(dateStr: string, todayYmd: string): boolean {
  return dateStr < todayYmd
}

export function getBudapestYearMonth(): { year: number; month: number } {
  const ymd = getBudapestTodayYmd()
  const [year, month] = ymd.split('-').map(Number)

  return { year, month }
}

/** @deprecated Prefer isRequiredWorkdayYmd. */
export function isEmployeeWorkdayYmd(
  dateStr: string,
  publicHolidays: PublicHolidayRow[],
  worksOnSaturday = false
): boolean {
  return isRequiredWorkdayYmd(dateStr, worksOnSaturday, publicHolidays)
}

/** Workday for attendance review (relocated Saturday counts; calendar rest does not). */
export function isEmployeeWorkday(
  date: Date,
  worksOnSaturday: boolean,
  publicHolidays: PublicHolidayRow[]
): boolean {
  return isRequiredWorkday(date, worksOnSaturday, publicHolidays)
}

export type MonthlyAttentionCounts = {
  empty: number
  incomplete: number
}

/**
 * Count workdays needing HR review in a month.
 * Only closed required workdays strictly before Budapest today count.
 * Relocated workdays (even Saturdays) are required; calendar rest days are not.
 * - empty: no scan and no employee holiday
 * - incomplete: exactly one of arrival / departure
 */
export function countEmployeeMonthlyAttention(params: {
  year: number
  month: number
  todayYmd: string
  publicHolidays: PublicHolidayRow[]
  worksOnSaturday?: boolean
  employeeHolidayDates: Set<string>
  attendanceByDate: Map<string, { hasArrival: boolean; hasDeparture: boolean }>
}): MonthlyAttentionCounts {
  const worksOnSaturday = params.worksOnSaturday === true
  let empty = 0
  let incomplete = 0

  for (const dateStr of getCalendarDaysInMonthYmd(params.year, params.month)) {
    if (!isClosedAttendanceReviewDay(dateStr, params.todayYmd)) continue
    if (!isRequiredWorkdayYmd(dateStr, worksOnSaturday, params.publicHolidays)) continue

    const att = params.attendanceByDate.get(dateStr)
    const hasArrival = att?.hasArrival ?? false
    const hasDeparture = att?.hasDeparture ?? false
    const hasHoliday = params.employeeHolidayDates.has(dateStr)

    if (!hasArrival && !hasDeparture && !hasHoliday) {
      empty++
    } else if (hasArrival !== hasDeparture) {
      incomplete++
    }
  }

  return { empty, incomplete }
}

/** One calendar day row used by attendance PDF builders. */
export type PaperAttendanceDayRow = {
  dayOfWeek: number
  hoursWorked: number
  hasCompleteAttendance: boolean
  hasAttendance?: boolean
  isEmployeeHoliday: boolean
  isConflictHolidayWork?: boolean
  /** Calendar rest (national/company/relocated_rest) — not relocated workday. */
  isGlobalHoliday: boolean
  /** Áthelyezett munkanap (kötelező, beleszámol). */
  isRelocatedWorkday?: boolean
  overtimeMinutes?: number
  earlyOvertimeMinutes?: number
}

/**
 * Papír összesítő:
 * - sima szombat: nem ledolgozott nap, órák kizárva (külön saturdayDays)
 * - áthelyezett munkanap (szombat is): ledolgozott nap + órák beleszámítanak
 * - naptári pihenő: nem ledolgozott
 */
export function computePaperMonthSummary(daysData: PaperAttendanceDayRow[]): {
  totalHours: number
  daysWorked: number
  absentDays: number
  saturdayDays: number
  conflictDays: number
  totalOvertimeMinutes: number
} {
  const isOptionalSaturday = (day: PaperAttendanceDayRow) =>
    day.dayOfWeek === 6 && !day.isRelocatedWorkday

  const totalHours = daysData.reduce((sum, day) => {
    if (isOptionalSaturday(day)) return sum
    if (day.isGlobalHoliday) return sum
    if (day.isEmployeeHoliday && !day.hasAttendance && !day.isConflictHolidayWork) return sum
    return sum + day.hoursWorked
  }, 0)

  const totalOvertimeMinutes = daysData.reduce(
    (sum, day) => sum + (day.overtimeMinutes ?? 0) + (day.earlyOvertimeMinutes ?? 0),
    0
  )

  const daysWorked = daysData.filter(day => {
    if (!day.hasCompleteAttendance) return false
    if (isOptionalSaturday(day)) return false
    if (day.isGlobalHoliday) return false
    if (day.isEmployeeHoliday && !day.isConflictHolidayWork) return false
    return true
  }).length

  const saturdayDays = daysData.filter(
    day => isOptionalSaturday(day) && day.hasCompleteAttendance
  ).length

  const conflictDays = daysData.filter(day => day.isConflictHolidayWork).length
  const absentDays = daysData.filter(
    day => day.isEmployeeHoliday && !day.hasAttendance
  ).length

  return {
    totalHours,
    daysWorked,
    absentDays,
    saturdayDays,
    conflictDays,
    totalOvertimeMinutes
  }
}

/**
 * Papír 8 órás keret (egyedi + tömeges PDF):
 * - naponként max 8 óra a „Összes dolgozott óra”-ba
 * - túlóra = policy (előtti+utótti) + 8 óra feletti ledolgozott
 * - sima szombat / naptári pihenő / egyéni távollét: ki a keretből
 */
export function computePaperEightHourMonthSummary(daysData: PaperAttendanceDayRow[]): {
  totalHours: number
  daysWorked: number
  absentDays: number
  saturdayDays: number
  conflictDays: number
  totalOvertimeMinutes: number
  policyOvertimeMinutes: number
  excessOver8Minutes: number
} {
  const base = computePaperMonthSummary(daysData)
  const isOptionalSaturday = (day: PaperAttendanceDayRow) =>
    day.dayOfWeek === 6 && !day.isRelocatedWorkday

  const countsTowardEightHourFrame = (day: PaperAttendanceDayRow) => {
    if (isOptionalSaturday(day)) return false
    if (day.isGlobalHoliday) return false
    if (day.isEmployeeHoliday) return false
    return true
  }

  const totalHours = daysData.reduce((sum, day) => {
    if (!countsTowardEightHourFrame(day)) return sum
    return sum + Math.min(day.hoursWorked, 8)
  }, 0)

  const excessOver8Minutes = daysData.reduce((sum, day) => {
    if (!countsTowardEightHourFrame(day)) return sum
    const excessH = Math.max(0, day.hoursWorked - 8)
    return sum + Math.round(excessH * 60)
  }, 0)

  const policyOvertimeMinutes = base.totalOvertimeMinutes

  return {
    totalHours,
    daysWorked: base.daysWorked,
    absentDays: base.absentDays,
    saturdayDays: base.saturdayDays,
    conflictDays: base.conflictDays,
    policyOvertimeMinutes,
    excessOver8Minutes,
    totalOvertimeMinutes: policyOvertimeMinutes + excessOver8Minutes
  }
}
