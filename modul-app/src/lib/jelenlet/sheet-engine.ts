/**
 * Jelenléti ív számítómotor — tiszta függvények (előnézet + PDF közös forrása).
 * Szabályok: `sheet-rules.ts`. Dokumentáció: docs/34-jelenlet-addon.md.
 */

import { timeToMinutes } from '@/lib/jelenlet/hours'
import type { SheetRules } from '@/lib/jelenlet/sheet-rules'
import type { AbsenceType, WorkCalendarDayType } from '@/lib/jelenlet/types'

export type RoundingMode = 'floor' | 'nearest' | 'ceil'

export type SheetEmployee = {
  id: string
  name: string
  code: string
  typeId: string
  typeName: string
  shiftStart: string | null
  shiftEnd: string | null
  lunchStart: string | null
  lunchEnd: string | null
  overtime: {
    enabled: boolean
    graceMinutes: number
    roundingMinutes: number
    roundingMode: RoundingMode
    dailyCapMinutes: number
  }
  earlyOvertime: {
    enabled: boolean
    triggerTime: string | null
    payUntilTime: string | null
    maxMinutes: number
    graceMinutes: number
    roundingMinutes: number
    roundingMode: RoundingMode
    dailyCapMinutes: number
  }
}

export type SheetAttendance = {
  arrival: string | null
  departure: string | null
  lunchStart: string | null
  lunchEnd: string | null
}

export type SheetCalendarDay = { type: WorkCalendarDayType; name: string }

export type SheetInput = {
  employee: SheetEmployee
  year: number
  month: number
  /** A hónap + az előtte lévő 7 nap (szombati levonás áthozatal). */
  attendance: Map<string, SheetAttendance>
  absences: Map<string, AbsenceType>
  calendar: Map<string, SheetCalendarDay>
  /** Generált időkhöz: ezen a napon nyit / zár a dolgozó. */
  rotation: Map<string, 'open' | 'close'>
  rules: SheetRules
}

export type SheetRowKind =
  | 'work'
  | 'saturday'
  | 'sunday'
  | 'leave'
  | 'holiday'
  | 'incomplete'
  | 'empty'

export type SheetRow = {
  date: string
  dayOfWeek: number
  kind: SheetRowKind
  arrival: string | null
  departure: string | null
  lunchStart: string | null
  lunchEnd: string | null
  status: string
  hoursText: string
  /** Félkövér óra cella (pl. SZABADSÁG) */
  hoursEmphasis: boolean
  /** Kis dőlt megjegyzés az óra cellában */
  note: string | null
  normalMinutes: number
  plusMinutes: number
}

export type SheetSummary = {
  totalMinutes: number
  overtimeMinutes: number
  daysWorked: number
  absentDays: number
  saturdayDays: number
  saturdayMinutes: number
  leaveWorkDays: number
  holidayWorkDays: number
  incompleteDays: number
}

export type SheetWarning = { date: string | null; message: string }

export type SheetResult = {
  rows: SheetRow[]
  summary: SheetSummary
  warnings: SheetWarning[]
}

const DAY_MIN = 480
const DEFAULT_LUNCH = { start: 12 * 60, end: 12 * 60 + 30 }
const CARRY_IN_DAYS = 7
const TARGET_SEARCH_DAYS = 14

// ---------------------------------------------------------------------------
// Dátum segédek (UTC dél — nincs DST csúszás)
// ---------------------------------------------------------------------------

function ymdToUtc(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d!, 12))
}

function utcToYmd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function addDaysYmd(ymd: string, days: number): string {
  const d = ymdToUtc(ymd)
  d.setUTCDate(d.getUTCDate() + days)
  return utcToYmd(d)
}

export function dowOfYmd(ymd: string): number {
  return ymdToUtc(ymd).getUTCDay()
}

export function monthDates(year: number, month: number): string[] {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const out: string[] = []
  for (let d = 1; d <= last; d++) {
    out.push(
      `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    )
  }
  return out
}

/** Az adatlekérés ablaka: hónap első napja − 7 nap … hónap vége. */
export function sheetDataWindow(year: number, month: number): {
  start: string
  end: string
} {
  const dates = monthDates(year, month)
  return { start: addDaysYmd(dates[0]!, -CARRY_IN_DAYS), end: dates[dates.length - 1]! }
}

function fmtMin(total: number): string {
  const t = Math.max(0, Math.min(24 * 60 - 1, Math.round(total)))
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

export function formatHours(minutes: number): string {
  return (Math.max(0, minutes) / 60).toFixed(2)
}

// ---------------------------------------------------------------------------
// Perc számítások
// ---------------------------------------------------------------------------

export function roundToStep(value: number, step: number, mode: RoundingMode): number {
  if (value <= 0) return 0
  const s = Math.max(1, Math.floor(step))
  const ratio = value / s
  if (mode === 'ceil') return Math.ceil(ratio) * s
  if (mode === 'nearest') return Math.round(ratio) * s
  return Math.floor(ratio) * s
}

function lunchOverlap(
  start: number,
  end: number,
  lunchStart: number | null,
  lunchEnd: number | null
): number {
  if (lunchStart == null || lunchEnd == null || lunchEnd <= lunchStart) return 0
  return Math.max(0, Math.min(end, lunchEnd) - Math.max(start, lunchStart))
}

/** Teljes ott töltött idő − az ebéd átfedő része (műszak nélkül). */
export function workedMinutes(
  arrival: string | null,
  departure: string | null,
  lunchStart: string | null,
  lunchEnd: string | null
): number {
  const a = timeToMinutes(arrival)
  const d = timeToMinutes(departure)
  if (a == null || d == null || d <= a) return 0
  return Math.max(
    0,
    d - a - lunchOverlap(a, d, timeToMinutes(lunchStart), timeToMinutes(lunchEnd))
  )
}

/**
 * Fizetett perc: ± grace a műszak széleihez igazít, a műszakablakon kívüli rész
 * nem számít, az ebéd csak az átfedő részen vonódik le. Műszak nélkül = workedMinutes.
 */
export function paidMinutesWithGrace(input: {
  arrival: string | null
  departure: string | null
  lunchStart: string | null
  lunchEnd: string | null
  shiftStart: string | null
  shiftEnd: string | null
  graceMinutes: number
}): number {
  const a = timeToMinutes(input.arrival)
  const d = timeToMinutes(input.departure)
  if (a == null || d == null || d <= a) return 0
  const s0 = timeToMinutes(input.shiftStart)
  const s1 = timeToMinutes(input.shiftEnd)
  if (s0 == null || s1 == null || s1 <= s0) {
    return workedMinutes(input.arrival, input.departure, input.lunchStart, input.lunchEnd)
  }
  const g = Math.max(0, Math.floor(input.graceMinutes))
  const adjA = Math.abs(a - s0) <= g ? s0 : a
  const adjD = Math.abs(d - s1) <= g ? s1 : d
  const start = Math.max(adjA, s0)
  const end = Math.min(adjD, s1)
  if (end <= start) return 0
  return Math.max(
    0,
    end -
      start -
      lunchOverlap(start, end, timeToMinutes(input.lunchStart), timeToMinutes(input.lunchEnd))
  )
}

export function afterShiftOvertimeMinutes(
  departure: string | null,
  shiftStart: string | null,
  shiftEnd: string | null,
  p: SheetEmployee['overtime']
): number {
  if (!p.enabled) return 0
  const d = timeToMinutes(departure)
  const s0 = timeToMinutes(shiftStart)
  const s1 = timeToMinutes(shiftEnd)
  if (d == null || s0 == null || s1 == null || s1 <= s0) return 0
  const raw = Math.max(0, d - s1)
  const minusGrace = Math.max(0, raw - Math.max(0, p.graceMinutes))
  const rounded = roundToStep(minusGrace, p.roundingMinutes, p.roundingMode)
  return Math.min(Math.max(0, p.dailyCapMinutes), rounded)
}

export function earlyOvertimeMinutes(
  arrival: string | null,
  shiftStart: string | null,
  p: SheetEmployee['earlyOvertime']
): number {
  if (!p.enabled) return 0
  const a = timeToMinutes(arrival)
  const s0 = timeToMinutes(shiftStart)
  const t = timeToMinutes(p.triggerTime)
  if (a == null || s0 == null || t == null) return 0
  if (a >= s0 || a >= t) return 0
  const payUntil = timeToMinutes(p.payUntilTime)
  const payEnd = payUntil == null ? s0 : Math.min(s0, payUntil)
  if (payEnd <= a) return 0
  const minusGrace = Math.max(0, payEnd - a - Math.max(0, p.graceMinutes))
  const rounded = roundToStep(minusGrace, p.roundingMinutes, p.roundingMode)
  return Math.min(Math.max(0, p.dailyCapMinutes), Math.min(Math.max(0, p.maxMinutes), rounded))
}

// ---------------------------------------------------------------------------
// Nyitó / záró rotáció
// ---------------------------------------------------------------------------

/**
 * Hónap i-edik napján (0-tól, minden naptári nap számít) pool[i % n] nyit,
 * pool[(i+1) % n] zár. Csak lefedendő napokon (nem pihenő; hétköznap vagy áthelyezett munkanap).
 */
export function computeRotation(
  dates: string[],
  poolIds: string[],
  isCoverageDay: (ymd: string) => boolean
): Map<string, { openId: string; closeId: string | null }> {
  const out = new Map<string, { openId: string; closeId: string | null }>()
  const n = poolIds.length
  if (n === 0) return out
  dates.forEach((ymd, i) => {
    if (!isCoverageDay(ymd)) return
    const openId = poolIds[i % n]!
    const closeId = n > 1 ? poolIds[(i + 1) % n]! : null
    out.set(ymd, { openId, closeId })
  })
  return out
}

export function rotationForEmployee(
  rotation: Map<string, { openId: string; closeId: string | null }>,
  employeeId: string
): Map<string, 'open' | 'close'> {
  const out = new Map<string, 'open' | 'close'>()
  for (const [ymd, r] of rotation) {
    if (r.openId === employeeId) out.set(ymd, 'open')
    else if (r.closeId === employeeId) out.set(ymd, 'close')
  }
  return out
}

// ---------------------------------------------------------------------------
// Nap besorolás
// ---------------------------------------------------------------------------

type DayCtx = {
  ymd: string
  dow: number
  cal: SheetCalendarDay | undefined
  isRest: boolean
  isRelocatedWork: boolean
  absence: AbsenceType | null
  att: SheetAttendance | undefined
  lunchStart: string | null
  lunchEnd: string | null
  hasAny: boolean
  valid: boolean
  invalidOrder: boolean
}

function absenceLabel(t: AbsenceType): string {
  if (t === 'sick') return 'BETEGSZABADSÁG'
  if (t === 'vacation') return 'SZABADSÁG'
  if (t === 'unpaid') return 'FIZETÉS NÉLKÜLI'
  return 'TÁVOLLÉT'
}

function buildDayCtx(input: SheetInput, ymd: string): DayCtx {
  const cal = input.calendar.get(ymd)
  const att = input.attendance.get(ymd)
  const a = timeToMinutes(att?.arrival ?? null)
  const d = timeToMinutes(att?.departure ?? null)
  const hasAny = a != null || d != null
  const both = a != null && d != null
  return {
    ymd,
    dow: dowOfYmd(ymd),
    cal,
    isRest:
      cal?.type === 'national' || cal?.type === 'company' || cal?.type === 'relocated_rest',
    isRelocatedWork: cal?.type === 'relocated_work',
    absence: input.absences.get(ymd) ?? null,
    att,
    lunchStart: att?.lunchStart ?? input.employee.lunchStart,
    lunchEnd: att?.lunchEnd ?? input.employee.lunchEnd,
    hasAny,
    valid: both && d! > a!,
    invalidOrder: both && d! <= a!
  }
}

function isRequiredWorkday(c: DayCtx): boolean {
  if (c.isRest) return false
  if (c.isRelocatedWork) return true
  return c.dow >= 1 && c.dow <= 5
}

function isOptionalSaturday(c: DayCtx): boolean {
  return c.dow === 6 && !c.isRelocatedWork && !c.isRest
}

// ---------------------------------------------------------------------------
// Szombat → következő munkanap levonás
// ---------------------------------------------------------------------------

function computeSaturdayReductions(
  input: SheetInput,
  monthStart: string,
  monthEnd: string,
  warnings: SheetWarning[]
): Map<string, number> {
  const reduce = new Map<string, number>()
  if (input.rules.saturday !== 'shift_next_workday') return reduce

  let ymd = addDaysYmd(monthStart, -CARRY_IN_DAYS)
  while (ymd <= monthEnd) {
    const c = buildDayCtx(input, ymd)
    if (isOptionalSaturday(c) && !c.absence && c.valid) {
      const satMin = Math.min(
        input.rules.saturdayMaxMinutes,
        workedMinutes(c.att!.arrival, c.att!.departure, c.lunchStart, c.lunchEnd)
      )
      if (satMin > 0) {
        let placed = false
        for (let i = 1; i <= TARGET_SEARCH_DAYS; i++) {
          const t = addDaysYmd(ymd, i)
          if (t > monthEnd) {
            if (ymd >= monthStart) {
              warnings.push({
                date: ymd,
                message: `Szombati ${formatHours(satMin)} óra levonása a következő havi íven jelenik meg.`
              })
            }
            placed = true
            break
          }
          const tc = buildDayCtx(input, t)
          if (isRequiredWorkday(tc) && !tc.absence && tc.valid) {
            reduce.set(t, Math.min(DAY_MIN, (reduce.get(t) ?? 0) + satMin))
            placed = true
            break
          }
        }
        if (!placed && ymd >= monthStart) {
          warnings.push({
            date: ymd,
            message: 'Szombati munka: nem találtunk munkanapot a levonáshoz (2 héten belül).'
          })
        }
      }
    }
    ymd = addDaysYmd(ymd, 1)
  }
  return reduce
}

// ---------------------------------------------------------------------------
// Fő számítás
// ---------------------------------------------------------------------------

function emptyRow(c: DayCtx, kind: SheetRowKind, status = '-'): SheetRow {
  return {
    date: c.ymd,
    dayOfWeek: c.dow,
    kind,
    arrival: null,
    departure: null,
    lunchStart: null,
    lunchEnd: null,
    status,
    hoursText: '-',
    hoursEmphasis: false,
    note: null,
    normalMinutes: 0,
    plusMinutes: 0
  }
}

function hoursCell(normal: number, plus: number): string {
  if (plus > 0) return `${formatHours(normal)} óra + ${formatHours(plus)} óra`
  if (normal > 0) return `${formatHours(normal)} óra`
  return '-'
}

export function computeSheet(input: SheetInput): SheetResult {
  const { employee: emp, rules } = input
  const dates = monthDates(input.year, input.month)
  const monthStart = dates[0]!
  const monthEnd = dates[dates.length - 1]!
  const warnings: SheetWarning[] = []
  const reductions = computeSaturdayReductions(input, monthStart, monthEnd, warnings)
  const real = rules.times === 'real'

  const summary: SheetSummary = {
    totalMinutes: 0,
    overtimeMinutes: 0,
    daysWorked: 0,
    absentDays: 0,
    saturdayDays: 0,
    saturdayMinutes: 0,
    leaveWorkDays: 0,
    holidayWorkDays: 0,
    incompleteDays: 0
  }

  if (real && (!emp.shiftStart || !emp.shiftEnd)) {
    warnings.push({
      date: null,
      message: 'Nincs műszak megadva — a teljes bent töltött idő számít.'
    })
  }

  const empLunch = {
    start: timeToMinutes(emp.lunchStart),
    end: timeToMinutes(emp.lunchEnd)
  }
  const lunchValid = empLunch.start != null && empLunch.end != null && empLunch.end > empLunch.start
  if (!real && !lunchValid) {
    warnings.push({ date: null, message: 'Nincs ebédidő megadva — 12:00–12:30 került az ívre.' })
  }
  const genLunch = lunchValid
    ? { start: empLunch.start!, end: empLunch.end! }
    : DEFAULT_LUNCH

  function workRow(c: DayCtx, status: string, idx: number): SheetRow {
    const r = reductions.get(c.ymd) ?? 0
    if (!real) {
      const worked = Math.max(0, DAY_MIN - r)
      if (worked === 0) {
        return { ...emptyRow(c, 'work', 'SZOMBATTAL KIVÁLTVA') }
      }
      const role = input.rotation.get(c.ymd)
      const startOpen = timeToMinutes(rules.generatedStartOpen) ?? 480
      const startClose = timeToMinutes(rules.generatedStartClose) ?? 510
      const start0 =
        role === 'open' ? startOpen : role === 'close' ? startClose : idx % 2 === 0 ? startOpen : startClose
      const lunchDur = genLunch.end - genLunch.start
      const end = start0 + DAY_MIN + lunchDur
      const startWithLunch = end - worked - lunchDur
      const keepLunch =
        worked > 360 && genLunch.start >= startWithLunch && genLunch.end <= end
      const start = keepLunch ? startWithLunch : end - worked
      summary.totalMinutes += worked
      summary.daysWorked += 1
      return {
        date: c.ymd,
        dayOfWeek: c.dow,
        kind: 'work',
        arrival: fmtMin(start),
        departure: fmtMin(end),
        lunchStart: keepLunch ? fmtMin(genLunch.start) : null,
        lunchEnd: keepLunch ? fmtMin(genLunch.end) : null,
        status,
        hoursText: hoursCell(worked, 0),
        hoursEmphasis: false,
        note: null,
        normalMinutes: worked,
        plusMinutes: 0
      }
    }

    const att = c.att!
    let paid = paidMinutesWithGrace({
      arrival: att.arrival,
      departure: att.departure,
      lunchStart: c.lunchStart,
      lunchEnd: c.lunchEnd,
      shiftStart: emp.shiftStart,
      shiftEnd: emp.shiftEnd,
      graceMinutes: rules.graceMinutes
    })
    paid = Math.max(0, paid - r)
    const normal = rules.capDailyAt8 ? Math.min(paid, DAY_MIN) : paid
    const excess = rules.capDailyAt8 ? paid - normal : 0
    const policy = rules.includePolicyOvertime
      ? afterShiftOvertimeMinutes(att.departure, emp.shiftStart, emp.shiftEnd, emp.overtime) +
        earlyOvertimeMinutes(att.arrival, emp.shiftStart, emp.earlyOvertime)
      : 0
    const plus = excess + policy
    summary.totalMinutes += normal
    summary.overtimeMinutes += plus
    if (normal > 0 || plus > 0) summary.daysWorked += 1
    return {
      date: c.ymd,
      dayOfWeek: c.dow,
      kind: 'work',
      arrival: att.arrival,
      departure: att.departure,
      lunchStart: c.lunchStart,
      lunchEnd: c.lunchEnd,
      status,
      hoursText: hoursCell(normal, plus),
      hoursEmphasis: false,
      note: r > 0 ? `szombat miatt −${formatHours(r)} óra` : null,
      normalMinutes: normal,
      plusMinutes: plus
    }
  }

  function infoTimes(c: DayCtx, row: SheetRow): SheetRow {
    if (!real || !c.hasAny) return row
    const bent = c.valid
      ? workedMinutes(c.att!.arrival, c.att!.departure, c.lunchStart, c.lunchEnd)
      : 0
    return {
      ...row,
      arrival: c.att?.arrival ?? null,
      departure: c.att?.departure ?? null,
      lunchStart: c.valid ? c.lunchStart : null,
      lunchEnd: c.valid ? c.lunchEnd : null,
      note: bent > 0 ? `bent volt: ${formatHours(bent)} óra` : 'bent volt (hiányos)'
    }
  }

  const rows: SheetRow[] = dates.map((ymd, idx) => {
    const c = buildDayCtx(input, ymd)

    if (c.invalidOrder) {
      warnings.push({ date: ymd, message: 'A távozás nem későbbi, mint az érkezés.' })
    }

    // 1) Munkaszüneti nap
    if (c.isRest) {
      if (c.valid && rules.holidayPlusWork === 'work') {
        summary.holidayWorkDays += 1
        return workRow(c, 'MUNKASZÜNET + MUNKA', idx)
      }
      if (c.hasAny) summary.holidayWorkDays += 1
      return infoTimes(c, {
        ...emptyRow(c, 'holiday', 'MUNKASZÜNET'),
        hoursText: 'MUNKASZÜNET',
        hoursEmphasis: true
      })
    }

    // 2) Távollét (szabadság / beteg / …)
    if (c.absence) {
      const label = absenceLabel(c.absence)
      if (c.valid && rules.leavePlusWork === 'work') {
        summary.leaveWorkDays += 1
        return workRow(c, `${label} + MUNKA`, idx)
      }
      summary.absentDays += 1
      if (c.hasAny) summary.leaveWorkDays += 1
      return infoTimes(c, {
        ...emptyRow(c, 'leave', label),
        hoursText: label,
        hoursEmphasis: true
      })
    }

    // 3) Vasárnap
    if (c.dow === 0 && !c.isRelocatedWork) {
      if (!real || !c.valid || rules.saturday === 'hidden') return emptyRow(c, 'sunday')
      const min = workedMinutes(c.att!.arrival, c.att!.departure, c.lunchStart, c.lunchEnd)
      return {
        ...emptyRow(c, 'sunday', 'VASÁRNAPI MUNKA'),
        arrival: c.att!.arrival,
        departure: c.att!.departure,
        lunchStart: c.lunchStart,
        lunchEnd: c.lunchEnd,
        hoursText: hoursCell(min, 0),
        note: 'az összesbe nem számít'
      }
    }

    // 4) Szombat (nem áthelyezett)
    if (isOptionalSaturday(c)) {
      if (rules.saturday === 'hidden') return emptyRow(c, 'saturday')
      if (!c.valid) {
        if (c.hasAny) summary.incompleteDays += 1
        if (c.hasAny && real && rules.incomplete === 'label') {
          return {
            ...emptyRow(c, 'incomplete', 'HIÁNYOS'),
            arrival: c.att?.arrival ?? null,
            departure: c.att?.departure ?? null
          }
        }
        return emptyRow(c, 'saturday')
      }
      const worked = workedMinutes(c.att!.arrival, c.att!.departure, c.lunchStart, c.lunchEnd)
      const minutes =
        rules.saturday === 'shift_next_workday'
          ? Math.min(rules.saturdayMaxMinutes, worked)
          : paidMinutesWithGrace({
              arrival: c.att!.arrival,
              departure: c.att!.departure,
              lunchStart: c.lunchStart,
              lunchEnd: c.lunchEnd,
              shiftStart: emp.shiftStart,
              shiftEnd: emp.shiftEnd,
              graceMinutes: rules.graceMinutes
            })
      if (minutes <= 0) return emptyRow(c, 'saturday')
      summary.saturdayDays += 1
      summary.saturdayMinutes += minutes
      const startGen = timeToMinutes(rules.generatedStartOpen) ?? 480
      return {
        ...emptyRow(c, 'saturday', 'SZOMBATI MUNKA'),
        arrival: real ? c.att!.arrival : fmtMin(startGen),
        departure: real ? c.att!.departure : fmtMin(startGen + minutes),
        lunchStart: real ? c.lunchStart : null,
        lunchEnd: real ? c.lunchEnd : null,
        hoursText: hoursCell(minutes, 0),
        note: real ? 'az összesbe nem számít' : null,
        normalMinutes: 0
      }
    }

    // 5) Munkanap (hétköznap / áthelyezett munkanap)
    if (!c.hasAny) return emptyRow(c, 'empty')
    if (!c.valid) {
      summary.incompleteDays += 1
      if (real && rules.incomplete === 'label') {
        return {
          ...emptyRow(c, 'incomplete', 'HIÁNYOS'),
          arrival: c.att?.arrival ?? null,
          departure: c.att?.departure ?? null
        }
      }
      return emptyRow(c, 'incomplete')
    }
    return workRow(c, c.isRelocatedWork ? 'ÁTHELYEZETT MUNKANAP' : 'MUNKA', idx)
  })

  if (summary.incompleteDays > 0) {
    warnings.push({
      date: null,
      message: `${summary.incompleteDays} hiányos nap (csak érkezés vagy csak távozás) — az ívre nem kerül óra.`
    })
  }
  if (summary.leaveWorkDays > 0) {
    warnings.push({
      date: null,
      message:
        rules.leavePlusWork === 'leave'
          ? `${summary.leaveWorkDays} napon távollét mellett jelenlét is van — távollétként számolva.`
          : `${summary.leaveWorkDays} napon távollét mellett jelenlét is van — munkaként számolva.`
    })
  }
  if (summary.holidayWorkDays > 0) {
    warnings.push({
      date: null,
      message:
        rules.holidayPlusWork === 'holiday'
          ? `${summary.holidayWorkDays} munkaszüneti napon jelenlét is van — munkaszünetként számolva.`
          : `${summary.holidayWorkDays} munkaszüneti napon jelenlét is van — munkaként számolva.`
    })
  }

  return { rows, summary, warnings }
}
