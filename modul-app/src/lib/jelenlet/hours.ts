/** HH:mm helpers + paid hours (shift window, lunch deduct). */

export function normalizeTime(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const s = String(raw).trim()
  if (!s) return null
  // Postgres time may come as HH:MM:SS
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(s)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

export function timeToMinutes(t: string | null): number | null {
  const n = normalizeTime(t)
  if (!n) return null
  const [h, m] = n.split(':').map(Number)
  return h * 60 + m
}

export function minutesToHoursLabel(mins: number): string {
  if (!Number.isFinite(mins) || mins <= 0) return '0'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (m === 0) return String(h)
  return `${h}:${String(m).padStart(2, '0')}`
}

export type DayHoursInput = {
  arrival: string | null
  departure: string | null
  lunchStart: string | null
  lunchEnd: string | null
  shiftStart: string | null
  shiftEnd: string | null
}

/** Fizetett perc: műszakablakon belül, ebéd levonva a fizetett szakaszból. */
export function computePaidMinutes(input: DayHoursInput): number {
  const arr = timeToMinutes(input.arrival)
  const dep = timeToMinutes(input.departure)
  if (arr == null || dep == null || dep <= arr) return 0

  let start = arr
  let end = dep
  const shiftS = timeToMinutes(input.shiftStart)
  const shiftE = timeToMinutes(input.shiftEnd)
  if (shiftS != null && shiftE != null && shiftE > shiftS) {
    start = Math.max(start, shiftS)
    end = Math.min(end, shiftE)
  }
  if (end <= start) return 0

  let paid = end - start
  const ls = timeToMinutes(input.lunchStart)
  const le = timeToMinutes(input.lunchEnd)
  if (ls != null && le != null && le > ls) {
    const overlap = Math.max(0, Math.min(end, le) - Math.max(start, ls))
    paid -= overlap
  }
  return Math.max(0, paid)
}

export function formatDateYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function daysInMonth(year: number, month: number): string[] {
  const out: string[] = []
  const last = new Date(year, month, 0).getDate()
  for (let d = 1; d <= last; d++) {
    out.push(
      `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    )
  }
  return out
}

export function budapestYearMonth(now = new Date()): {
  year: number
  month: number
} {
  const year = Number(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Budapest',
      year: 'numeric'
    }).format(now)
  )
  const month = Number(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Budapest',
      month: 'numeric'
    }).format(now)
  )
  return { year, month }
}

/** YYYY-MM-DD Europe/Budapest mai nap. */
export function budapestTodayYmd(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Budapest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now)
}

/**
 * Elvárt munkanap-e (hiányzó nap számoláshoz / jelöléshez).
 * - vasárnap soha
 * - szombat csak ha worksOnSaturday
 * - ünnep/pihenő (calendarRest) soha, kivéve áthelyezett munkanap
 * - csak eltelt napok (ymd < ma), ha onlyPast === true
 */
export function isExpectedAttendanceDay(input: {
  ymd: string
  worksOnSaturday: boolean
  isCalendarRest?: boolean
  isRelocatedWork?: boolean
  onlyPast?: boolean
  todayYmd?: string
}): boolean {
  const today = input.todayYmd ?? budapestTodayYmd()
  if (input.onlyPast !== false && input.ymd >= today) return false
  if (input.isRelocatedWork) return true
  if (input.isCalendarRest) return false
  const d = parseYmd(input.ymd)
  const dow = d.getDay()
  if (dow === 0) return false
  if (dow === 6) return input.worksOnSaturday
  return true
}

export const WEEKDAY_SHORT_HU = ['V', 'H', 'K', 'Sze', 'Cs', 'P', 'Szo'] as const
