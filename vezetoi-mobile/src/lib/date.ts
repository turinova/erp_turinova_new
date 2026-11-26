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

/** 0–23, Budapest idő szerint. */
export function budapestHourFromIso(iso: string): number {
  const h = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Budapest',
    hour: '2-digit',
    hourCycle: 'h23'
  }).format(new Date(iso))
  return Number(h) % 24
}

export function budapestNowHour(): number {
  return budapestHourFromIso(new Date().toISOString())
}

const WEEKDAY_SHORT_HU = ['V', 'H', 'K', 'Sze', 'Cs', 'P', 'Szo'] as const
const WEEKDAY_LONG_HU = [
  'vasárnap',
  'hétfő',
  'kedd',
  'szerda',
  'csütörtök',
  'péntek',
  'szombat'
] as const

function weekdayIndex(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()
}

export function weekdayShortHu(ymd: string): string {
  return WEEKDAY_SHORT_HU[weekdayIndex(ymd)]
}

export function weekdayLongHu(ymd: string): string {
  return WEEKDAY_LONG_HU[weekdayIndex(ymd)]
}

/** „11.24.” */
export function shortDateHu(ymd: string): string {
  const [, m, d] = ymd.split('-')
  return `${m}.${d}.`
}

/** „Kedd, november 24.” */
export function todayLabelHu(): string {
  const ymd = budapestTodayYmd()
  const [, m, d] = ymd.split('-').map(Number)
  const wd = weekdayLongHu(ymd)
  return `${wd.charAt(0).toUpperCase()}${wd.slice(1)}, ${MONTH_NAMES_HU[m - 1].toLowerCase()} ${d}.`
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
