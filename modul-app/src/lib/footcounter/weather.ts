import type { SupabaseClient } from '@supabase/supabase-js'

import { formatSignedPct } from '@/lib/footcounter/chart-tokens'
import type { FootcounterMonthDayBar } from '@/lib/footcounter/chart-types'

export type FootcounterDayWeather = {
  dayKey: string
  tempMaxC: number | null
  tempMinC: number | null
  precipOpenMm: number | null
  precipDayMm: number | null
  rainHoursOpen: number | null
  rainSignificant: boolean
  windMaxKmh: number | null
  windSignificant: boolean
}

export type FootcounterWeatherKind = 'dry' | 'rain' | 'wind' | 'cold'

export type FootcounterWeatherBucket = {
  key: FootcounterWeatherKind
  label: string
  hint: string
  days: number
  avgIn: number
  /** Eltérés a havi nyitvatartási átlagtól (%). */
  deltaPct: number
}

export type FootcounterWeatherImpact = {
  buckets: FootcounterWeatherBucket[]
  /** Egy mondat a blokk tetejére — null ha nincs elég adat. */
  headline: string | null
  monthAvgIn: number
  hasAnyWeather: boolean
}

const BUCKET_META: Record<
  FootcounterWeatherKind,
  { label: string; hint: string }
> = {
  dry: {
    label: 'Száraz / normál',
    hint: 'Nincs jelentős eső vagy szél nyitvatartás alatt'
  },
  rain: {
    label: 'Esős nyitás',
    hint: 'Jelentős csapadék a nyitvatartási órákban'
  },
  wind: {
    label: 'Szeles nyitás',
    hint: 'Jelentős szél a nyitvatartási órákban'
  },
  cold: {
    label: 'Hideg nap',
    hint: 'Napi max ≤ 5 °C vagy min ≤ 0 °C'
  }
}

function dayNumFromKey(dayKey: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey)
  if (!m) return null
  const d = Number(m[3])
  return Number.isInteger(d) ? d : null
}

function classifyWeather(w: FootcounterDayWeather): FootcounterWeatherKind {
  if (w.rainSignificant) return 'rain'
  if (w.windSignificant) return 'wind'
  const max = w.tempMaxC
  const min = w.tempMinC
  if (
    (max != null && Number.isFinite(max) && max <= 5) ||
    (min != null && Number.isFinite(min) && min <= 0)
  ) {
    return 'cold'
  }
  return 'dry'
}

export function mergeWeatherOntoMonthDays(
  days: FootcounterMonthDayBar[],
  byDay: Map<number, FootcounterDayWeather>
): FootcounterMonthDayBar[] {
  return days.map((d) => {
    const w = byDay.get(d.day)
    if (!w) return d
    return {
      ...d,
      tempMinC: w.tempMinC,
      tempMaxC: w.tempMaxC,
      precipOpenMm: w.precipOpenMm ?? w.precipDayMm,
      rainSignificant: w.rainSignificant,
      windSignificant: w.windSignificant,
      windMaxKmh: w.windMaxKmh
    }
  })
}

export function buildWeatherImpact(
  days: FootcounterMonthDayBar[]
): FootcounterWeatherImpact {
  const open = days.filter((d) => !d.closed && d.inCount > 0)
  const withWeather = open.filter(
    (d) =>
      d.tempMaxC != null ||
      d.tempMinC != null ||
      d.precipOpenMm != null ||
      d.rainSignificant ||
      d.windSignificant
  )
  const monthAvgIn =
    open.length > 0
      ? Math.round(open.reduce((s, d) => s + d.inCount, 0) / open.length)
      : 0

  if (withWeather.length === 0 || monthAvgIn <= 0) {
    return {
      buckets: [],
      headline: null,
      monthAvgIn,
      hasAnyWeather: false
    }
  }

  const groups: Record<FootcounterWeatherKind, number[]> = {
    dry: [],
    rain: [],
    wind: [],
    cold: []
  }

  for (const d of withWeather) {
    const kind = classifyWeather({
      dayKey: '',
      tempMaxC: d.tempMaxC ?? null,
      tempMinC: d.tempMinC ?? null,
      precipOpenMm: d.precipOpenMm ?? null,
      precipDayMm: null,
      rainHoursOpen: null,
      rainSignificant: Boolean(d.rainSignificant),
      windMaxKmh: d.windMaxKmh ?? null,
      windSignificant: Boolean(d.windSignificant)
    })
    groups[kind].push(d.inCount)
  }

  const order: FootcounterWeatherKind[] = ['dry', 'rain', 'wind', 'cold']
  const buckets: FootcounterWeatherBucket[] = []
  for (const key of order) {
    const counts = groups[key]
    if (counts.length === 0) continue
    const avgIn = Math.round(counts.reduce((a, b) => a + b, 0) / counts.length)
    const deltaPct = Math.round(((avgIn - monthAvgIn) / monthAvgIn) * 100)
    buckets.push({
      key,
      label: BUCKET_META[key].label,
      hint: BUCKET_META[key].hint,
      days: counts.length,
      avgIn,
      deltaPct
    })
  }

  const impactful = buckets
    .filter((b) => b.key !== 'dry' && b.days >= 2)
    .sort((a, b) => a.deltaPct - b.deltaPct)
  const top = impactful[0]
  let headline: string | null = null
  if (top) {
    headline =
      top.deltaPct === 0
        ? `${top.label} napokon a belépő közel a havi átlaghoz (${top.days} nap).`
        : `${top.label} napokon átlag ${formatSignedPct(top.deltaPct)} a belépő a havi átlaghoz képest (${top.days} nap).`
  }

  return {
    buckets,
    headline,
    monthAvgIn,
    hasAnyWeather: true
  }
}

export function formatTodayWeatherLine(
  w: FootcounterDayWeather | null
): string | null {
  if (!w) return null
  const parts: string[] = []
  if (w.tempMinC != null && w.tempMaxC != null) {
    parts.push(
      `${Math.round(w.tempMinC)}–${Math.round(w.tempMaxC)} °C`
    )
  } else if (w.tempMaxC != null) {
    parts.push(`max ${Math.round(w.tempMaxC)} °C`)
  }
  const precip = w.precipOpenMm ?? w.precipDayMm
  if (precip != null && precip > 0) {
    parts.push(
      `${precip.toLocaleString('hu-HU', { maximumFractionDigits: 1 })} mm`
    )
  }
  if (w.windMaxKmh != null && w.windMaxKmh > 0) {
    parts.push(`szél ${Math.round(w.windMaxKmh)} km/h`)
  }
  if (parts.length === 0) return null
  return parts.join(' · ')
}

/** Hónap napjaira + ma — lean select. Hiányzó tábla / RLS → üres Map. */
export async function loadFootcounterWeatherByDay(
  supabase: SupabaseClient,
  dayKeys: string[]
): Promise<Map<string, FootcounterDayWeather>> {
  const unique = [...new Set(dayKeys.filter(Boolean))]
  const out = new Map<string, FootcounterDayWeather>()
  if (unique.length === 0) return out

  const { data, error } = await supabase
    .from('footcounter_daily_weather')
    .select(
      [
        'day',
        'temp_max_c',
        'temp_min_c',
        'precipitation_mm',
        'precip_open_hours_mm',
        'rain_hours_open',
        'is_significant_rain_open',
        'wind_speed_10m_max_kmh',
        'wind_speed_open_max_kmh',
        'is_significant_wind_open'
      ].join(', ')
    )
    .in('day', unique)

  if (error) {
    // Hiányzó tábla / séma cache — UI nélkül megy tovább; ne dobjon Next overlay-t.
    const missing =
      error.code === 'PGRST205' ||
      /schema cache|does not exist|not find the table/i.test(error.message)
    if (!missing) {
      console.error('loadFootcounterWeatherByDay', error.message)
    }
    return out
  }

  for (const row of data ?? []) {
    const dayKey = String(row.day ?? '').slice(0, 10)
    if (!dayKey) continue
    const precipOpen =
      row.precip_open_hours_mm != null
        ? Number(row.precip_open_hours_mm)
        : null
    const precipDay =
      row.precipitation_mm != null ? Number(row.precipitation_mm) : null
    const windOpen =
      row.wind_speed_open_max_kmh != null
        ? Number(row.wind_speed_open_max_kmh)
        : null
    const windDay =
      row.wind_speed_10m_max_kmh != null
        ? Number(row.wind_speed_10m_max_kmh)
        : null
    out.set(dayKey, {
      dayKey,
      tempMaxC:
        row.temp_max_c != null && Number.isFinite(Number(row.temp_max_c))
          ? Number(row.temp_max_c)
          : null,
      tempMinC:
        row.temp_min_c != null && Number.isFinite(Number(row.temp_min_c))
          ? Number(row.temp_min_c)
          : null,
      precipOpenMm:
        precipOpen != null && Number.isFinite(precipOpen) ? precipOpen : null,
      precipDayMm:
        precipDay != null && Number.isFinite(precipDay) ? precipDay : null,
      rainHoursOpen:
        row.rain_hours_open != null
          ? Number(row.rain_hours_open)
          : null,
      rainSignificant: Boolean(row.is_significant_rain_open),
      windMaxKmh:
        windOpen != null && Number.isFinite(windOpen)
          ? windOpen
          : windDay != null && Number.isFinite(windDay)
            ? windDay
            : null,
      windSignificant: Boolean(row.is_significant_wind_open)
    })
  }

  return out
}

export function weatherMapByDayNumber(
  byKey: Map<string, FootcounterDayWeather>
): Map<number, FootcounterDayWeather> {
  const byDay = new Map<number, FootcounterDayWeather>()
  for (const [key, w] of byKey) {
    const n = dayNumFromKey(key)
    if (n != null) byDay.set(n, w)
  }
  return byDay
}

export function monthDayKeys(year: number, month: number): string[] {
  const dim = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  return Array.from({ length: dim }, (_, i) => {
    const day = i + 1
    return `${prefix}-${String(day).padStart(2, '0')}`
  })
}
