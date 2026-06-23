const BUDAPEST_TZ = 'Europe/Budapest'

export function formatTvMeters(m: number): string {
  return `${Math.round(m).toLocaleString('hu-HU')} m`
}

export function formatTvCount(n: number): string {
  return n.toLocaleString('hu-HU')
}

export function formatTvFt(amount: number): string {
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toLocaleString('hu-HU', { maximumFractionDigits: 1 })} M Ft`
  }
  return `${Math.round(amount).toLocaleString('hu-HU')} Ft`
}

export function formatTvClock(now: Date): string {
  return now.toLocaleString('hu-HU', {
    timeZone: BUDAPEST_TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

export function formatTvDate(now: Date): string {
  return now.toLocaleString('hu-HU', {
    timeZone: BUDAPEST_TZ,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  })
}

export type TvTheme = 'dark' | 'light'

export function resolveTvTheme(raw: string | null | undefined): TvTheme {
  if (raw === 'dark') return 'dark'
  if (raw === 'light') return 'light'
  const env = process.env.TV_DASHBOARD_THEME?.trim().toLowerCase()
  if (env === 'dark') return 'dark'
  return 'light'
}
