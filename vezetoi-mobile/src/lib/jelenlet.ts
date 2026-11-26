import type { SupabaseClient } from '@supabase/supabase-js'

import { addDaysYmd, budapestTodayYmd } from '@/lib/date'

/** Max nap vissza a steppelben (BP nap). */
export const JELENLET_MAX_PAST_DAYS = 90

/**
 * bent = érkezett, ma még nem ment el · elment = érkezés + távozás ·
 * nyitott = múltbeli nap, távozás nincs rögzítve · nincs = dolgozna, de nincs jelölés ·
 * szabadnap = vasárnap / nem szombatos / munkaszüneti nap.
 */
export type JelenletRowKind =
  | 'bent'
  | 'elment'
  | 'nyitott'
  | 'szabadsag'
  | 'beteg'
  | 'nincs'
  | 'szabadnap'

export type JelenletDayRow = {
  id: string
  name: string
  initials: string
  typeLabel: string | null
  kind: JelenletRowKind
  arrival: string | null
  departure: string | null
  /** Bent töltött perc (ebéd nélkül); bent esetén mostanáig. */
  workedMinutes: number | null
}

export type JelenletHolidayBanner = {
  title: string
  name: string | null
}

export type JelenletCounts = Record<JelenletRowKind, number>

export type JelenletDayModel = {
  ymd: string
  label: string
  isToday: boolean
  canGoNext: boolean
  canGoPrev: boolean
  holiday: JelenletHolidayBanner | null
  counts: JelenletCounts
  /** Akik ezen a napon dolgoznának (szabadnaposok nélkül). */
  workingCount: number
  /** Megjelentek: bent + elment + nyitott. */
  presentCount: number
  /** 100-as lekérdezési plafon elérve. */
  truncated: boolean
  rows: JelenletDayRow[]
  loadError: string | null
}

export const EMPLOYEE_LIMIT = 100

const WEEKDAY_HU = [
  'Vasárnap',
  'Hétfő',
  'Kedd',
  'Szerda',
  'Csütörtök',
  'Péntek',
  'Szombat'
] as const

const MONTH_SHORT_HU = [
  'jan.',
  'feb.',
  'már.',
  'ápr.',
  'máj.',
  'jún.',
  'júl.',
  'aug.',
  'szep.',
  'okt.',
  'nov.',
  'dec.'
] as const

function normalizeTime(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const s = String(raw).trim()
  if (!s) return null
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(s)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

function parseYmdParts(ymd: string): { y: number; m: number; d: number } {
  const [y, m, d] = ymd.split('-').map(Number)
  return { y, m, d }
}

/** Címke a nap-stepperhez — Ma / Csütörtök, nov. 20. */
export function jelenletDayLabel(ymd: string, todayYmd: string): string {
  if (ymd === todayYmd) return 'Ma'
  const { y, m, d } = parseYmdParts(ymd)
  const utc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  const weekday = WEEKDAY_HU[utc.getUTCDay()]
  return `${weekday}, ${MONTH_SHORT_HU[m - 1]} ${d}.`
}

export function jelenletRangeBounds(todayYmd = budapestTodayYmd()): {
  earliest: string
  latest: string
} {
  return {
    earliest: addDaysYmd(todayYmd, -JELENLET_MAX_PAST_DAYS),
    latest: todayYmd
  }
}

/** Kiválasztott nap a megengedett tartományba. */
export function jelenletClampYmd(ymd: string): string {
  const { earliest, latest } = jelenletRangeBounds()
  if (ymd > latest) return latest
  if (ymd < earliest) return earliest
  return ymd
}

export function jelenletShiftDay(
  ymd: string,
  delta: number
): { ymd: string; canGo: boolean } {
  const next = addDaysYmd(ymd, delta)
  const clamped = jelenletClampYmd(next)
  if (clamped === ymd && next !== ymd) return { ymd, canGo: false }
  return { ymd: clamped, canGo: clamped === next }
}

/** Pickerhez: YMD → helyi dél. */
export function ymdToLocalDate(ymd: string): Date {
  const { y, m, d } = parseYmdParts(ymd)
  return new Date(y, m - 1, d, 12, 0, 0)
}

export function localDateToYmd(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function holidayBanner(
  dayType: string | null | undefined,
  name: string | null | undefined
): JelenletHolidayBanner | null {
  if (!dayType) return null
  const trimmed = (name ?? '').trim() || null
  if (dayType === 'national') {
    return { title: 'Nemzeti ünnep', name: trimmed }
  }
  if (dayType === 'company') {
    return { title: 'Céges munkaszünet', name: trimmed }
  }
  if (dayType === 'relocated_rest') {
    return { title: 'Áthelyezett pihenőnap', name: trimmed }
  }
  return null
}

const SORT_RANK: Record<JelenletRowKind, number> = {
  bent: 0,
  elment: 1,
  nyitott: 2,
  szabadsag: 3,
  beteg: 4,
  nincs: 5,
  szabadnap: 6
}

export function emptyJelenletCounts(): JelenletCounts {
  return {
    bent: 0,
    elment: 0,
    nyitott: 0,
    szabadsag: 0,
    beteg: 0,
    nincs: 0,
    szabadnap: 0
  }
}

function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0][0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : ''
  return (first + last).toUpperCase()
}

function toMinutes(hhmm: string | null): number | null {
  if (!hhmm) return null
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function budapestNowHhmm(): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Budapest',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).format(new Date())
}

function workedMinutes(
  arrival: string | null,
  departure: string | null,
  lunchStart: string | null,
  lunchEnd: string | null
): number | null {
  const a = toMinutes(arrival)
  const d = toMinutes(departure)
  if (a == null || d == null || d <= a) return null
  let total = d - a
  const ls = toMinutes(lunchStart)
  const le = toMinutes(lunchEnd)
  if (ls != null && le != null && le > ls) total -= le - ls
  return Math.max(0, total)
}

/** „8 óra 28 perc” / „45 perc” */
export function formatWorked(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} perc`
  if (m === 0) return `${h} óra`
  return `${h} óra ${m} perc`
}

function isRestDay(
  ymd: string,
  dayType: string | null | undefined,
  worksOnSaturday: boolean
): boolean {
  if (dayType === 'national' || dayType === 'company' || dayType === 'relocated_rest') {
    return true
  }
  if (dayType === 'relocated_work') return false
  const { y, m, d } = parseYmdParts(ymd)
  const wd = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()
  if (wd === 0) return true
  if (wd === 6) return !worksOnSaturday
  return false
}

export async function getJelenletDay(
  supabase: SupabaseClient,
  tenantId: string,
  ymd: string
): Promise<JelenletDayModel> {
  const today = budapestTodayYmd()
  const earliest = addDaysYmd(today, -JELENLET_MAX_PAST_DAYS)
  const clamped = ymd > today ? today : ymd < earliest ? earliest : ymd
  const isToday = clamped === today

  const base = {
    ymd: clamped,
    label: jelenletDayLabel(clamped, today),
    isToday,
    canGoNext: clamped < today,
    canGoPrev: clamped > earliest,
    holiday: null,
    counts: emptyJelenletCounts(),
    workingCount: 0,
    presentCount: 0,
    truncated: false
  }

  const [
    { data: employees, error: empErr },
    { data: types },
    { data: attendance, error: attErr },
    { data: absences, error: absErr },
    { data: calRows, error: calErr }
  ] = await Promise.all([
    supabase
      .from('hr_employees')
      .select('id, name, employee_type_id, works_on_saturday')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .is('deleted_at', null)
      .is('archived_at', null)
      .order('name', { ascending: true })
      .limit(EMPLOYEE_LIMIT),
    supabase
      .from('hr_employee_types')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null),
    supabase
      .from('hr_attendance_days')
      .select('employee_id, arrival_time, departure_time, lunch_start, lunch_end')
      .eq('tenant_id', tenantId)
      .eq('work_date', clamped),
    supabase
      .from('hr_absences')
      .select('employee_id, absence_type')
      .eq('tenant_id', tenantId)
      .lte('start_date', clamped)
      .gte('end_date', clamped)
      .in('absence_type', ['vacation', 'sick']),
    supabase
      .from('hr_work_calendar')
      .select('day_type, name')
      .eq('tenant_id', tenantId)
      .eq('work_date', clamped)
      .maybeSingle()
  ])

  if (empErr || attErr || absErr || calErr) {
    const msg =
      empErr?.message ||
      attErr?.message ||
      absErr?.message ||
      calErr?.message ||
      'Nem sikerült betölteni a jelenlétet.'
    return { ...base, rows: [], loadError: msg }
  }

  const typeName = new Map(
    (types ?? []).map((t) => [t.id as string, String(t.name ?? '').trim()])
  )

  const attByEmp = new Map<
    string,
    {
      arrival: string | null
      departure: string | null
      lunchStart: string | null
      lunchEnd: string | null
    }
  >()
  for (const row of attendance ?? []) {
    attByEmp.set(row.employee_id as string, {
      arrival: normalizeTime(row.arrival_time as string | null),
      departure: normalizeTime(row.departure_time as string | null),
      lunchStart: normalizeTime(row.lunch_start as string | null),
      lunchEnd: normalizeTime(row.lunch_end as string | null)
    })
  }

  const absByEmp = new Map<string, 'vacation' | 'sick'>()
  for (const row of absences ?? []) {
    const eid = row.employee_id as string
    const t = row.absence_type as string
    if (t !== 'vacation' && t !== 'sick') continue
    // Ha több távollét fedné: beteg elsőbbség (szigorúbb)
    const prev = absByEmp.get(eid)
    if (prev === 'sick') continue
    if (t === 'sick' || !prev) absByEmp.set(eid, t)
  }

  const dayType = calRows?.day_type as string | null | undefined
  const holiday = holidayBanner(dayType, calRows?.name as string | null | undefined)
  const nowHhmm = isToday ? budapestNowHhmm() : null
  const counts = emptyJelenletCounts()

  const rows: JelenletDayRow[] = (employees ?? []).map((emp) => {
    const id = emp.id as string
    const name = String(emp.name ?? '').trim() || 'Névtelen'
    const typeLabel = typeName.get(emp.employee_type_id as string) || null
    const baseRow = {
      id,
      name,
      initials: initialsOf(name),
      typeLabel,
      arrival: null,
      departure: null,
      workedMinutes: null
    }

    const abs = absByEmp.get(id)
    const att = attByEmp.get(id)
    const arrival = att?.arrival ?? null
    const departure = att?.departure ?? null

    let kind: JelenletRowKind
    let worked: number | null = null
    if (abs === 'vacation') kind = 'szabadsag'
    else if (abs === 'sick') kind = 'beteg'
    else if (arrival && departure) {
      kind = 'elment'
      worked = workedMinutes(arrival, departure, att?.lunchStart ?? null, att?.lunchEnd ?? null)
    } else if (arrival) {
      kind = isToday ? 'bent' : 'nyitott'
      if (isToday && nowHhmm) worked = workedMinutes(arrival, nowHhmm, null, null)
    } else if (isRestDay(clamped, dayType, Boolean(emp.works_on_saturday))) {
      kind = 'szabadnap'
    } else kind = 'nincs'

    counts[kind] += 1
    if (kind === 'szabadsag' || kind === 'beteg') return { ...baseRow, kind }
    return { ...baseRow, kind, arrival, departure, workedMinutes: worked }
  })

  rows.sort((a, b) => {
    const r = SORT_RANK[a.kind] - SORT_RANK[b.kind]
    if (r !== 0) return r
    return a.name.localeCompare(b.name, 'hu')
  })

  return {
    ...base,
    holiday,
    counts,
    workingCount: rows.length - counts.szabadnap,
    presentCount: counts.bent + counts.elment + counts.nyitott,
    truncated: rows.length >= EMPLOYEE_LIMIT,
    rows,
    loadError: null
  }
}

/** Hétsávhoz: napónként hányan jelentek meg (érkezés rögzítve). */
export async function getJelenletPresentByDay(
  supabase: SupabaseClient,
  tenantId: string,
  fromYmd: string,
  toYmd: string
): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from('hr_attendance_days')
    .select('work_date')
    .eq('tenant_id', tenantId)
    .gte('work_date', fromYmd)
    .lte('work_date', toYmd)
    .not('arrival_time', 'is', null)
    .limit(1000)

  const map = new Map<string, number>()
  if (error) {
    console.error('getJelenletPresentByDay', error.message)
    return map
  }
  for (const r of data ?? []) {
    const key = String(r.work_date)
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return map
}
