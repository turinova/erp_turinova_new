import type { SupabaseClient } from '@supabase/supabase-js'

import { addDaysYmd, budapestTodayYmd } from '@/lib/date'

/** Max nap vissza a steppelben (BP nap). */
export const JELENLET_MAX_PAST_DAYS = 90

export type JelenletRowKind = 'times' | 'vacation' | 'sick' | 'none'

export type JelenletDayRow = {
  id: string
  name: string
  kind: JelenletRowKind
  arrival: string | null
  departure: string | null
}

export type JelenletHolidayBanner = {
  title: string
  name: string | null
}

export type JelenletDayModel = {
  ymd: string
  label: string
  isToday: boolean
  canGoNext: boolean
  canGoPrev: boolean
  holiday: JelenletHolidayBanner | null
  bentCount: number
  vacationCount: number
  sickCount: number
  summaryLine: string | null
  rows: JelenletDayRow[]
  loadError: string | null
}

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

function sortRank(kind: JelenletRowKind, hasArrival: boolean): number {
  if (kind === 'times' && hasArrival) return 0
  if (kind === 'vacation' || kind === 'sick') return 1
  return 2
}

function buildSummary(input: {
  bentCount: number
  vacationCount: number
  sickCount: number
}): string | null {
  const parts: string[] = []
  if (input.bentCount > 0) parts.push(`${input.bentCount} bent`)
  if (input.vacationCount > 0) parts.push(`${input.vacationCount} szabadság`)
  if (input.sickCount > 0) parts.push(`${input.sickCount} beteg`)
  return parts.length > 0 ? parts.join(' · ') : null
}

export async function getJelenletDay(
  supabase: SupabaseClient,
  tenantId: string,
  ymd: string
): Promise<JelenletDayModel> {
  const today = budapestTodayYmd()
  const earliest = addDaysYmd(today, -JELENLET_MAX_PAST_DAYS)
  const clamped =
    ymd > today ? today : ymd < earliest ? earliest : ymd

  const base: Omit<JelenletDayModel, 'rows' | 'loadError' | 'holiday' | 'summaryLine' | 'bentCount' | 'vacationCount' | 'sickCount'> & {
    bentCount: number
    vacationCount: number
    sickCount: number
    holiday: JelenletHolidayBanner | null
    summaryLine: string | null
  } = {
    ymd: clamped,
    label: jelenletDayLabel(clamped, today),
    isToday: clamped === today,
    canGoNext: clamped < today,
    canGoPrev: clamped > earliest,
    bentCount: 0,
    vacationCount: 0,
    sickCount: 0,
    holiday: null,
    summaryLine: null
  }

  const [
    { data: employees, error: empErr },
    { data: attendance, error: attErr },
    { data: absences, error: absErr },
    { data: calRows, error: calErr }
  ] = await Promise.all([
    supabase
      .from('hr_employees')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .is('deleted_at', null)
      .is('archived_at', null)
      .order('name', { ascending: true })
      .limit(100),
    supabase
      .from('hr_attendance_days')
      .select('employee_id, arrival_time, departure_time')
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
    return {
      ...base,
      rows: [],
      loadError: msg
    }
  }

  const attByEmp = new Map<
    string,
    { arrival: string | null; departure: string | null }
  >()
  for (const row of attendance ?? []) {
    attByEmp.set(row.employee_id as string, {
      arrival: normalizeTime(row.arrival_time as string | null),
      departure: normalizeTime(row.departure_time as string | null)
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

  const holiday = holidayBanner(
    calRows?.day_type as string | null | undefined,
    calRows?.name as string | null | undefined
  )

  let bentCount = 0
  let vacationCount = 0
  let sickCount = 0

  const rows: JelenletDayRow[] = (employees ?? []).map((emp) => {
    const id = emp.id as string
    const name = String(emp.name ?? '').trim() || '—'
    const abs = absByEmp.get(id)
    if (abs === 'vacation') {
      vacationCount += 1
      return {
        id,
        name,
        kind: 'vacation' as const,
        arrival: null,
        departure: null
      }
    }
    if (abs === 'sick') {
      sickCount += 1
      return {
        id,
        name,
        kind: 'sick' as const,
        arrival: null,
        departure: null
      }
    }
    const att = attByEmp.get(id)
    const arrival = att?.arrival ?? null
    const departure = att?.departure ?? null
    if (arrival || departure) {
      if (arrival && !departure) bentCount += 1
      return {
        id,
        name,
        kind: 'times' as const,
        arrival,
        departure
      }
    }
    return {
      id,
      name,
      kind: 'none' as const,
      arrival: null,
      departure: null
    }
  })

  rows.sort((a, b) => {
    const ra = sortRank(a.kind, Boolean(a.arrival))
    const rb = sortRank(b.kind, Boolean(b.arrival))
    if (ra !== rb) return ra - rb
    return a.name.localeCompare(b.name, 'hu')
  })

  return {
    ...base,
    holiday,
    bentCount,
    vacationCount,
    sickCount,
    summaryLine: buildSummary({ bentCount, vacationCount, sickCount }),
    rows,
    loadError: null
  }
}
