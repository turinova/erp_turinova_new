/** Budapest dátum segédek a home chartokhoz. */

export function budapestTodayYmd(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Budapest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date())
}

export function budapestYesterdayYmd(): string {
  return addDaysYmd(budapestTodayYmd(), -1)
}

export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const utc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  utc.setUTCDate(utc.getUTCDate() + days)
  return utc.toISOString().slice(0, 10)
}

/** Hétfő YYYY-MM-DD a megadott nap hetében (Budapest). */
export function mondayOfWeek(ymd: string, weekOffset = 0): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const utc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Budapest',
    weekday: 'short'
  }).format(utc)
  const map: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6
  }
  const offset = map[weekday] ?? 0
  utc.setUTCDate(utc.getUTCDate() - offset + weekOffset * 7)
  return utc.toISOString().slice(0, 10)
}

export function saturdayOfWeek(mondayYmd: string): string {
  return addDaysYmd(mondayYmd, 5)
}

/** 0=Hétfő … 5=Szombat; vasárnap → null. YMD mint UTC dél. */
export function mondayIndexFromYmd(ymd: string): number | null {
  const [y, m, d] = ymd.split('-').map(Number)
  const utc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  const dow = utc.getUTCDay()
  if (dow === 0) return null
  return dow - 1
}

export function isMondayToFridayYmd(ymd: string): boolean {
  const idx = mondayIndexFromYmd(ymd)
  return idx !== null && idx <= 4
}

export function toBudapestYmdFromIso(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Budapest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(iso))
}

export function budapestYear(): number {
  return Number(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Budapest',
      year: 'numeric'
    }).format(new Date())
  )
}

export const WEEKDAY_LABELS_HU = [
  'Hétfő',
  'Kedd',
  'Szerda',
  'Csütörtök',
  'Péntek',
  'Szombat'
] as const

export const MONTH_LABELS_HU = [
  'Jan',
  'Feb',
  'Már',
  'Ápr',
  'Máj',
  'Jún',
  'Júl',
  'Aug',
  'Szep',
  'Okt',
  'Nov',
  'Dec'
] as const
