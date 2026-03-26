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

export type PublicHolidayRow = {
  name: string
  start_date: string
  end_date: string
  type: 'national' | 'company'
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

function parseTimeToMinutes(t: string | null): number | null {
  if (!t) return null
  const parts = t.split(':').map(Number)
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return null

  return parts[0] * 60 + parts[1]
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
  shiftEnd: string | null
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

  const paidStart = Math.max(a, s0)
  const paidEnd = Math.min(d, s1)

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
