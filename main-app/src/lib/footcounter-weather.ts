import type { SupabaseClient } from '@supabase/supabase-js'

/** Kecskemét — magyar nyári/időszámítás (Europe/Budapest). */
export const FOOTCOUNTER_LOCAL_TZ = 'Europe/Budapest'
export const FOOTCOUNTER_WEATHER_PLACE = 'Kecskemét'

/** Meleg nap küszöb (max °C). */
export const WEATHER_HEAT_THRESHOLD_C = 30
/** Fagy nap küszöb (min °C). */
export const WEATHER_FROST_THRESHOLD_C = 0

/** Nyitvatartási ablak esős-nap detektáláshoz (8:00–17:00, mindkettő inclusive). */
export const WEATHER_OPEN_HOURS_START = 8
export const WEATHER_OPEN_HOURS_END = 17
/** Esős óra: legalább ennyi mm/óra a nyitvatartási ablakban. */
export const WEATHER_RAIN_HOURLY_MM_THRESHOLD = 0.5
/** Legalább ennyi egymást követő esős óra kell egy esős naphoz. */
export const WEATHER_RAIN_CONSECUTIVE_HOURS = 2
/** Minimum összcsapadék a nyitvatartási ablakban (mm) — 2×0,5 mm egymást követő óra. */
export const WEATHER_RAIN_OPEN_HOURS_MIN_TOTAL_MM = 1

export const WEATHER_RAIN_DAY_CRITERIA_HU =
  'Esős nap: 8:00–17:00 között legalább 2 egymást követő óra ≥0,5 mm/óra csapadékkal és összesen ≥1 mm.'

/** Default: Kecskemét. Override via env. */
function weatherCoords(): { lat: number; lon: number } {
  const lat = parseFloat(process.env.FOOTCOUNTER_WEATHER_LAT || '46.896')
  const lon = parseFloat(process.env.FOOTCOUNTER_WEATHER_LON || '19.689')
  return { lat, lon }
}

function localTodayKey(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FOOTCOUNTER_LOCAL_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date())
}

function localDayKeyDaysAgo(daysAgo: number): string {
  const t = Date.now() - daysAgo * 24 * 60 * 60 * 1000
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FOOTCOUNTER_LOCAL_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(t))
}

export type OpenHoursRainAnalysis = {
  precip_open_hours_mm: number
  rain_hours_open: number
  is_significant_rain_open: boolean
}

export type WeatherImpactFlags = {
  rain: boolean
  snow: boolean
  frost: boolean
  heat: boolean
}

export type WeatherImpactSummary = {
  rain_days: number
  snow_days: number
  frost_days: number
  heat_days: number
  known_days: number
  avg_temp_max_c: number | null
}

export type WeatherDayLike = {
  condition: string
  temp_max_c: number | null
  temp_min_c?: number | null
  precipitation_mm: number | null
  precip_open_hours_mm?: number | null
  rain_hours_open?: number | null
  is_significant_rain_open?: boolean | null
}

/** Óránkénti csapadék 8–17 között → esős nap jelölés. */
export function analyzeOpenHoursRain(hourlyMmInWindow: number[]): OpenHoursRainAnalysis {
  const precip_open_hours_mm = hourlyMmInWindow.reduce((s, v) => s + (Number(v) || 0), 0)
  const rainyHour = hourlyMmInWindow.map(v => (Number(v) || 0) >= WEATHER_RAIN_HOURLY_MM_THRESHOLD)
  const rain_hours_open = rainyHour.filter(Boolean).length

  let consecutive = 0
  let maxConsecutive = 0
  for (const isRainy of rainyHour) {
    if (isRainy) {
      consecutive += 1
      maxConsecutive = Math.max(maxConsecutive, consecutive)
    } else {
      consecutive = 0
    }
  }

  const is_significant_rain_open =
    maxConsecutive >= WEATHER_RAIN_CONSECUTIVE_HOURS &&
    precip_open_hours_mm >= WEATHER_RAIN_OPEN_HOURS_MIN_TOTAL_MM

  return {
    precip_open_hours_mm: Math.round(precip_open_hours_mm * 10) / 10,
    rain_hours_open,
    is_significant_rain_open
  }
}

function emptyOpenHoursAnalysis(): OpenHoursRainAnalysis {
  return { precip_open_hours_mm: 0, rain_hours_open: 0, is_significant_rain_open: false }
}

/** Befolyásoló tényezők naponta (eső, hó, fagy, meleg). */
export function weatherImpactForDay(w: WeatherDayLike): WeatherImpactFlags {
  const tMax = w.temp_max_c != null ? Number(w.temp_max_c) : null
  const tMin = w.temp_min_c != null ? Number(w.temp_min_c) : null
  const precip = Number(w.precipitation_mm) || 0
  const snowByCode = w.condition === 'snow'
  return {
    rain: w.is_significant_rain_open === true,
    snow: snowByCode || (precip >= 0.1 && tMax != null && tMax <= 2),
    frost: tMin != null && tMin <= WEATHER_FROST_THRESHOLD_C,
    heat: tMax != null && tMax >= WEATHER_HEAT_THRESHOLD_C
  }
}

export function summarizeMonthWeatherImpacts(weather: WeatherDayLike[]): WeatherImpactSummary {
  let rain_days = 0
  let snow_days = 0
  let frost_days = 0
  let heat_days = 0
  let known_days = 0
  let tempMaxSum = 0
  let tempMaxCount = 0

  for (const w of weather) {
    if (w.condition === 'unknown') continue
    known_days += 1
    const impact = weatherImpactForDay(w)
    if (impact.rain) rain_days += 1
    if (impact.snow) snow_days += 1
    if (impact.frost) frost_days += 1
    if (impact.heat) heat_days += 1
    if (w.temp_max_c != null) {
      tempMaxSum += Number(w.temp_max_c)
      tempMaxCount += 1
    }
  }

  return {
    rain_days,
    snow_days,
    frost_days,
    heat_days,
    known_days,
    avg_temp_max_c: tempMaxCount > 0 ? Math.round((tempMaxSum / tempMaxCount) * 10) / 10 : null
  }
}

export function formatWeatherDetailHu(w: WeatherDayLike): string {
  const parts: string[] = [conditionLabelHu(w.condition)]
  if (w.temp_max_c != null) parts.push(`max ${Number(w.temp_max_c).toFixed(1)} °C`)
  if (w.temp_min_c != null) parts.push(`min ${Number(w.temp_min_c).toFixed(1)} °C`)
  if (w.precipitation_mm != null && Number(w.precipitation_mm) > 0) {
    parts.push(`napi csapadék ${Number(w.precipitation_mm).toFixed(1)} mm`)
  }
  if (w.precip_open_hours_mm != null) {
    parts.push(`8–17: ${Number(w.precip_open_hours_mm).toFixed(1)} mm`)
  }
  const impact = weatherImpactForDay(w)
  const tags: string[] = []
  if (impact.heat) tags.push('meleg')
  if (impact.frost) tags.push('fagy')
  if (impact.snow) tags.push('hó')
  if (impact.rain) tags.push('eső (nyitvatartás)')
  if (tags.length) parts.push(`(${tags.join(', ')})`)
  return parts.join(' · ')
}

/** WMO weather code → simple condition bucket for charts. */
export function wmoToCondition(code: number): string {
  if (code === 0) return 'clear'
  if (code >= 1 && code <= 3) return 'clouds'
  if (code >= 45 && code <= 48) return 'fog'
  if (code >= 51 && code <= 67) return 'rain'
  if (code >= 71 && code <= 77) return 'snow'
  if (code >= 80 && code <= 82) return 'rain'
  if (code >= 85 && code <= 86) return 'snow'
  if (code >= 95) return 'storm'
  return 'unknown'
}

export function conditionLabelHu(condition: string): string {
  const map: Record<string, string> = {
    clear: 'Tiszta',
    clouds: 'Felhős',
    fog: 'Köd',
    rain: 'Eső',
    snow: 'Hó',
    storm: 'Vihar',
    unknown: '—'
  }
  return map[condition] ?? condition
}

type OpenMeteoDaily = {
  time: string[]
  weather_code: number[]
  temperature_2m_max: (number | null)[]
  temperature_2m_min: (number | null)[]
  precipitation_sum: (number | null)[]
}

type OpenMeteoHourly = {
  time: string[]
  precipitation: (number | null)[]
}

function buildOpenHoursPrecipByDay(hourly: OpenMeteoHourly): Map<string, number[]> {
  const slotCount = WEATHER_OPEN_HOURS_END - WEATHER_OPEN_HOURS_START + 1
  const byDay = new Map<string, number[]>()

  for (let i = 0; i < hourly.time.length; i++) {
    const ts = hourly.time[i]
    if (!ts || ts.length < 13) continue
    const day = ts.slice(0, 10)
    const hour = Number(ts.slice(11, 13))
    if (!Number.isFinite(hour) || hour < WEATHER_OPEN_HOURS_START || hour > WEATHER_OPEN_HOURS_END) continue

    let slots = byDay.get(day)
    if (!slots) {
      slots = Array.from({ length: slotCount }, () => 0)
      byDay.set(day, slots)
    }
    slots[hour - WEATHER_OPEN_HOURS_START] = Number(hourly.precipitation[i]) || 0
  }

  return byDay
}

export async function fetchAndUpsertWeatherRange(
  supabase: SupabaseClient,
  days: number
): Promise<{ upserted: number; start: string; end: string }> {
  const end = localTodayKey()
  const start = localDayKeyDaysAgo(days - 1)
  const { lat, lon } = weatherCoords()

  const url = new URL('https://archive-api.open-meteo.com/v1/archive')
  url.searchParams.set('latitude', String(lat))
  url.searchParams.set('longitude', String(lon))
  url.searchParams.set('start_date', start)
  url.searchParams.set('end_date', end)
  url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum')
  url.searchParams.set('hourly', 'precipitation')
  url.searchParams.set('timezone', FOOTCOUNTER_LOCAL_TZ)

  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Open-Meteo archive failed: ${res.status}${body ? ` — ${body.slice(0, 200)}` : ''}`)
  }

  const json = (await res.json()) as { daily?: OpenMeteoDaily; hourly?: OpenMeteoHourly }
  const daily = json.daily
  const hourly = json.hourly
  if (!daily?.time?.length) {
    throw new Error('Open-Meteo returned no daily data')
  }

  const openHoursByDay = hourly?.time?.length ? buildOpenHoursPrecipByDay(hourly) : new Map<string, number[]>()

  const rows = daily.time.map((day, i) => {
    const code = daily.weather_code[i] ?? 0
    const openSlots = openHoursByDay.get(day)
    const openAnalysis = openSlots ? analyzeOpenHoursRain(openSlots) : emptyOpenHoursAnalysis()

    return {
      day,
      condition: wmoToCondition(code),
      temp_max_c: daily.temperature_2m_max[i] ?? null,
      temp_min_c: daily.temperature_2m_min[i] ?? null,
      precipitation_mm: daily.precipitation_sum[i] ?? null,
      precip_open_hours_mm: openAnalysis.precip_open_hours_mm,
      rain_hours_open: openAnalysis.rain_hours_open,
      is_significant_rain_open: openAnalysis.is_significant_rain_open,
      weather_code: code,
      fetched_at: new Date().toISOString()
    }
  })

  const { error } = await supabase.from('footcounter_daily_weather').upsert(rows, { onConflict: 'day' })
  if (error) {
    if (error.code === 'PGRST205') {
      throw new Error(
        'A footcounter_daily_weather tábla még nem létezik — futtasd a 20260624_footcounter_insights_v3.sql migrációt a Supabase SQL Editorban.'
      )
    }
    if (
      error.message?.includes('precip_open_hours_mm') ||
      error.message?.includes('is_significant_rain_open')
    ) {
      throw new Error(
        'Hiányzó időjárás oszlopok — futtasd a 20260627_footcounter_weather_open_hours_rain.sql migrációt a Supabase SQL Editorban.'
      )
    }
    throw new Error(error.message)
  }

  return { upserted: rows.length, start, end }
}
