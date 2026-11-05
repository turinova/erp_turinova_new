/**
 * Cég heti nyitvatartás — tárolás (`tenant_companies.opening_hours`),
 * „Most nyitva / Zárva” állapot és összevont heti táblázat.
 * Minden időpont Europe/Budapest.
 */

export const DAY_KEYS = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun'
] as const

export type DayKey = (typeof DAY_KEYS)[number]

export type TimeRange = { from: string; to: string }

export type OpeningHours = Record<DayKey, TimeRange[]>

export const DAY_LABEL: Record<DayKey, string> = {
  mon: 'Hétfő',
  tue: 'Kedd',
  wed: 'Szerda',
  thu: 'Csütörtök',
  fri: 'Péntek',
  sat: 'Szombat',
  sun: 'Vasárnap'
}

/** „hétfőn 7:00-kor nyit” */
const DAY_ON: Record<DayKey, string> = {
  mon: 'hétfőn',
  tue: 'kedden',
  wed: 'szerdán',
  thu: 'csütörtökön',
  fri: 'pénteken',
  sat: 'szombaton',
  sun: 'vasárnap'
}

const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h! * 60 + m!
}

/** „07:00” → „7:00” */
export function formatHhmm(hhmm: string): string {
  return hhmm.replace(/^0(\d)/, '$1')
}

function emptyWeek(): OpeningHours {
  return { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] }
}

/**
 * DB jsonb → tiszta struktúra. Érvénytelen sávok kiesnek.
 * null, ha nincs megadva, vagy egyetlen napon sincs nyitva.
 */
export function normalizeOpeningHours(raw: unknown): OpeningHours | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const src = raw as Record<string, unknown>
  const week = emptyWeek()
  let any = false
  for (const day of DAY_KEYS) {
    const list = Array.isArray(src[day]) ? (src[day] as unknown[]) : []
    const ranges: TimeRange[] = []
    for (const item of list) {
      if (!item || typeof item !== 'object') continue
      const { from, to } = item as Record<string, unknown>
      if (typeof from !== 'string' || typeof to !== 'string') continue
      if (!HHMM_RE.test(from) || !HHMM_RE.test(to)) continue
      if (toMinutes(from) >= toMinutes(to)) continue
      ranges.push({ from, to })
    }
    ranges.sort((a, b) => toMinutes(a.from) - toMinutes(b.from))
    week[day] = ranges
    if (ranges.length > 0) any = true
  }
  return any ? week : null
}

/** Budapest szerinti nap + perc. */
export function budapestNow(now: Date): { day: DayKey; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Budapest',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const weekday = get('weekday').toLowerCase().slice(0, 3) as DayKey
  const day = DAY_KEYS.includes(weekday) ? weekday : 'mon'
  return { day, minutes: Number(get('hour')) * 60 + Number(get('minute')) }
}

export type OpenStatus = {
  open: boolean
  /** „Most nyitva · 16:00-ig” · „Zárva · holnap 7:00-kor nyit” */
  label: string
  today: DayKey
}

export function openStatus(hours: OpeningHours, now: Date): OpenStatus {
  const { day, minutes } = budapestNow(now)
  const todayRanges = hours[day]

  const current = todayRanges.find(
    (r) => toMinutes(r.from) <= minutes && minutes < toMinutes(r.to)
  )
  if (current) {
    return {
      open: true,
      label: `Most nyitva · ${formatHhmm(current.to)}-ig`,
      today: day
    }
  }

  const laterToday = todayRanges.find((r) => toMinutes(r.from) > minutes)
  if (laterToday) {
    return {
      open: false,
      label: `Zárva · ma ${formatHhmm(laterToday.from)}-kor nyit`,
      today: day
    }
  }

  const idx = DAY_KEYS.indexOf(day)
  for (let offset = 1; offset <= 7; offset += 1) {
    const next = DAY_KEYS[(idx + offset) % 7]!
    const first = hours[next][0]
    if (!first) continue
    const when = offset === 1 ? 'holnap' : DAY_ON[next]
    return {
      open: false,
      label: `Zárva · ${when} ${formatHhmm(first.from)}-kor nyit`,
      today: day
    }
  }

  return { open: false, label: 'Zárva', today: day }
}

export function rangesText(ranges: TimeRange[]): string {
  if (ranges.length === 0) return 'Zárva'
  return ranges
    .map((r) => `${formatHhmm(r.from)}–${formatHhmm(r.to)}`)
    .join(', ')
}

export type WeekRow = { label: string; text: string; days: DayKey[] }

/** Egymást követő azonos napok összevonása: „Hétfő–Péntek  7:00–16:00”. */
export function groupWeek(hours: OpeningHours): WeekRow[] {
  const rows: WeekRow[] = []
  for (const day of DAY_KEYS) {
    const text = rangesText(hours[day])
    const last = rows[rows.length - 1]
    if (last && last.text === text) {
      last.days.push(day)
    } else {
      rows.push({ label: '', text, days: [day] })
    }
  }
  for (const row of rows) {
    const first = row.days[0]!
    const lastDay = row.days[row.days.length - 1]!
    row.label =
      row.days.length === 1
        ? DAY_LABEL[first]
        : row.days.length === 2
          ? `${DAY_LABEL[first]}, ${DAY_LABEL[lastDay]}`
          : `${DAY_LABEL[first]}–${DAY_LABEL[lastDay]}`
  }
  return rows
}

/** Szerkesztő állapot: naponta egy sáv. */
export type OpeningDayDraft = { closed: boolean; from: string; to: string }
export type OpeningHoursDraft = Record<DayKey, OpeningDayDraft>

const DEFAULT_DAY: OpeningDayDraft = { closed: true, from: '07:00', to: '16:00' }

export function openingHoursToDraft(
  hours: OpeningHours | null
): OpeningHoursDraft {
  const draft = {} as OpeningHoursDraft
  for (const day of DAY_KEYS) {
    const first = hours?.[day][0]
    draft[day] = first
      ? { closed: false, from: first.from, to: hours![day].at(-1)!.to }
      : { ...DEFAULT_DAY }
  }
  return draft
}

export type OpeningHoursParseResult =
  | { ok: true; value: OpeningHours | null }
  | { ok: false; errors: Partial<Record<DayKey, string>> }

/** Szerkesztő → tárolt forma. Minden nap zárva → null (nincs megadva). */
export function draftToOpeningHours(
  draft: OpeningHoursDraft
): OpeningHoursParseResult {
  const week = emptyWeek()
  const errors: Partial<Record<DayKey, string>> = {}
  let any = false
  for (const day of DAY_KEYS) {
    const d = draft[day]
    if (!d || d.closed) continue
    if (!HHMM_RE.test(d.from) || !HHMM_RE.test(d.to)) {
      errors[day] = 'Adj meg időt (óó:pp).'
      continue
    }
    if (toMinutes(d.from) >= toMinutes(d.to)) {
      errors[day] = 'A zárás legyen a nyitás után.'
      continue
    }
    week[day] = [{ from: d.from, to: d.to }]
    any = true
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return { ok: true, value: any ? week : null }
}
