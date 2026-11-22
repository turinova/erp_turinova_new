/** Budapest dátum — modul-app home mintára (lean). */

export function budapestTodayYmd(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Budapest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date())
}

export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const utc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  utc.setUTCDate(utc.getUTCDate() + days)
  return utc.toISOString().slice(0, 10)
}

export function budapestYesterdayYmd(): string {
  return addDaysYmd(budapestTodayYmd(), -1)
}

export function toBudapestYmdFromIso(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Budapest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(iso))
}

export function budapestDayRangeIso(ymd: string): {
  startIso: string
  endIso: string
} {
  const next = addDaysYmd(ymd, 1)
  const pickMidnight = (day: string): Date => {
    for (const offset of ['+01:00', '+02:00'] as const) {
      const d = new Date(`${day}T00:00:00${offset}`)
      if (toBudapestYmdFromIso(d.toISOString()) === day) return d
    }
    return new Date(`${day}T00:00:00Z`)
  }
  return {
    startIso: pickMidnight(ymd).toISOString(),
    endIso: pickMidnight(next).toISOString()
  }
}

export function budapestYearMonth(): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Budapest',
    year: 'numeric',
    month: '2-digit'
  }).formatToParts(new Date())
  const year = Number(parts.find((p) => p.type === 'year')?.value)
  const month = Number(parts.find((p) => p.type === 'month')?.value)
  return { year, month }
}

export const MONTH_NAMES_HU = [
  'Január',
  'Február',
  'Március',
  'Április',
  'Május',
  'Június',
  'Július',
  'Augusztus',
  'Szeptember',
  'Október',
  'November',
  'December'
] as const
