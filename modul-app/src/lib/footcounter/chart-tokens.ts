import type { CSSProperties } from 'react'

/** Charcoal chart skála — marketing `/beleposzamlalo` + termék `/belepok`. */
export const FOOTCOUNTER_CHART = {
  strong: '#18181b',
  mid: '#52525b',
  soft: '#a1a1aa',
  track: '#eeeff2',
  closed: '#d4d4d8',
  rain: '#93a4c4',
  wind: '#b6bcc6',
  emptyCell: '#f4f4f5'
} as const

/** Nyitvatartási órák a chartokon (hétköznap). */
export const FOOTCOUNTER_OPEN_HOURS = { start: 8, end: 17 } as const
export const FOOTCOUNTER_SATURDAY_CLOSE_HOUR = 12

export const FOOTCOUNTER_HOUR_LABELS: string[] = Array.from(
  { length: FOOTCOUNTER_OPEN_HOURS.end - FOOTCOUNTER_OPEN_HOURS.start + 1 },
  (_, i) => String(FOOTCOUNTER_OPEN_HOURS.start + i)
)

export const FOOTCOUNTER_WEEKDAY_LABELS = [
  'Hétfő',
  'Kedd',
  'Szerda',
  'Csütörtök',
  'Péntek',
  'Szombat',
  'Vasárnap'
] as const

export const MONTH_SHORT_HU = [
  'jan.',
  'febr.',
  'márc.',
  'ápr.',
  'máj.',
  'jún.',
  'júl.',
  'aug.',
  'szept.',
  'okt.',
  'nov.',
  'dec.'
] as const

export function formatChartCount(n: number): string {
  return n.toLocaleString('hu-HU', { maximumFractionDigits: 0 })
}

export function formatSignedPct(n: number): string {
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toLocaleString('hu-HU', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0
  })}%`
}

export function heatCellStyle(
  value: number,
  max: number,
  closed: boolean
): CSSProperties | undefined {
  if (closed) return undefined
  if (value <= 0) return { backgroundColor: FOOTCOUNTER_CHART.emptyCell }
  const ratio = max > 0 ? value / max : 0
  return {
    backgroundColor: `rgba(24, 24, 27, ${0.08 + ratio * 0.84})`
  }
}
