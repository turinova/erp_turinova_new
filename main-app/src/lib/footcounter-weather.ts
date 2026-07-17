import type { SupabaseClient } from '@supabase/supabase-js'

/** Kecskemét — magyar nyári/időszámítás (Europe/Budapest). */
export const FOOTCOUNTER_LOCAL_TZ = 'Europe/Budapest'
export const FOOTCOUNTER_WEATHER_PLACE = 'Kecskemét'

/** Meleg nap küszöb (max °C). */
export const WEATHER_HEAT_THRESHOLD_C = 30
/** Fagy nap küszöb (min °C). */
export const WEATHER_FROST_THRESHOLD_C = 0

/** Nyitvatartási ablak (8:00–17:00, mindkettő inclusive). */
export const WEATHER_OPEN_HOURS_START = 8
export const WEATHER_OPEN_HOURS_END = 17
/** Esős óra: legalább ennyi mm/óra a nyitvatartási ablakban. */
export const WEATHER_RAIN_HOURLY_MM_THRESHOLD = 0.5
/** Legalább ennyi egymást követő esős óra kell egy esős naphoz. */
export const WEATHER_RAIN_CONSECUTIVE_HOURS = 2
/** Minimum összcsapadék a nyitvatartási ablakban (mm) — 2×0,5 mm egymást követő óra. */
export const WEATHER_RAIN_OPEN_HOURS_MIN_TOTAL_MM = 1

/** Szeles nap: 8–17 max szél ≥ ennyi km/h. */
export const WEATHER_WIND_OPEN_MAX_KMH = 25
/** Szeles nap: 8–17 átlag szél ≥ ennyi km/h. */
export const WEATHER_WIND_OPEN_AVG_KMH = 18

export const WEATHER_RAIN_DAY_CRITERIA_HU =
  'Esős nap: 8:00–17:00 között legalább 2 egymást követő óra ≥0,5 mm/óra csapadékkal és összesen ≥1 mm.'

export const WEATHER_WIND_DAY_CRITERIA_HU =
  'Szeles nap: 8:00–17:00 között max szél ≥25 km/h vagy átlag ≥18 km/h.'

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

export type OpenHoursWindAnalysis = {
  wind_speed_open_max_kmh: number
  wind_speed_open_avg_kmh: number
  is_significant_wind_open: boolean
}

export type WeatherImpactFlags = {
  rain: boolean
  snow: boolean
  frost: boolean
  heat: boolean
  wind: boolean
}

export type WeatherImpactSummary = {
  rain_days: number
  snow_days: number
  frost_days: number
  heat_days: number
  wind_days: number
  known_days: number
  avg_temp_max_c: number | null
  avg_wind_max_kmh: number | null
}

export type WeatherDayLike = {
  condition: string
  temp_max_c: number | null
  temp_min_c?: number | null
  precipitation_mm: number | null
  precip_open_hours_mm?: number | null
  rain_hours_open?: number | null
  is_significant_rain_open?: boolean | null
  wind_speed_10m_max_kmh?: number | null
  wind_gusts_10m_max_kmh?: number | null
  wind_speed_open_max_kmh?: number | null
  wind_speed_open_avg_kmh?: number | null
  is_significant_wind_open?: boolean | null
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

/** Óránkénti szél 8–17 között → szeles nap jelölés. */
export function analyzeOpenHoursWind(hourlyKmhInWindow: number[]): OpenHoursWindAnalysis {
  const values = hourlyKmhInWindow.map(v => Number(v) || 0)
  const wind_speed_open_max_kmh =
    values.length > 0 ? Math.round(Math.max(...values) * 10) / 10 : 0
  const wind_speed_open_avg_kmh =
    values.length > 0
      ? Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10
      : 0

  const is_significant_wind_open =
    wind_speed_open_max_kmh >= WEATHER_WIND_OPEN_MAX_KMH ||
    wind_speed_open_avg_kmh >= WEATHER_WIND_OPEN_AVG_KMH

  return {
    wind_speed_open_max_kmh,
    wind_speed_open_avg_kmh,
    is_significant_wind_open
  }
}

function emptyOpenHoursRainAnalysis(): OpenHoursRainAnalysis {
  return { precip_open_hours_mm: 0, rain_hours_open: 0, is_significant_rain_open: false }
}

function emptyOpenHoursWindAnalysis(): OpenHoursWindAnalysis {
  return {
    wind_speed_open_max_kmh: 0,
    wind_speed_open_avg_kmh: 0,
    is_significant_wind_open: false
  }
}

/** Befolyásoló tényezők naponta (eső, hó, fagy, meleg, szél). */
export function weatherImpactForDay(w: WeatherDayLike): WeatherImpactFlags {
  const tMax = w.temp_max_c != null ? Number(w.temp_max_c) : null
  const tMin = w.temp_min_c != null ? Number(w.temp_min_c) : null
  const precip = Number(w.precipitation_mm) || 0
  const snowByCode = w.condition === 'snow'
  return {
    rain: w.is_significant_rain_open === true,
    snow: snowByCode || (precip >= 0.1 && tMax != null && tMax <= 2),
    frost: tMin != null && tMin <= WEATHER_FROST_THRESHOLD_C,
    heat: tMax != null && tMax >= WEATHER_HEAT_THRESHOLD_C,
    wind: w.is_significant_wind_open === true
  }
}

export function summarizeMonthWeatherImpacts(weather: WeatherDayLike[]): WeatherImpactSummary {
  let rain_days = 0
  let snow_days = 0
  let frost_days = 0
  let heat_days = 0
  let wind_days = 0
  let known_days = 0
  let tempMaxSum = 0
  let tempMaxCount = 0
  let windMaxSum = 0
  let windMaxCount = 0

  for (const w of weather) {
    if (w.condition === 'unknown') continue
    known_days += 1
    const impact = weatherImpactForDay(w)
    if (impact.rain) rain_days += 1
    if (impact.snow) snow_days += 1
    if (impact.frost) frost_days += 1
    if (impact.heat) heat_days += 1
    if (impact.wind) wind_days += 1
    if (w.temp_max_c != null) {
      tempMaxSum += Number(w.temp_max_c)
      tempMaxCount += 1
    }
    const windMax = w.wind_speed_open_max_kmh ?? w.wind_speed_10m_max_kmh
    if (windMax != null) {
      windMaxSum += Number(windMax)
      windMaxCount += 1
    }
  }

  return {
    rain_days,
    snow_days,
    frost_days,
    heat_days,
    wind_days,
    known_days,
    avg_temp_max_c: tempMaxCount > 0 ? Math.round((tempMaxSum / tempMaxCount) * 10) / 10 : null,
    avg_wind_max_kmh: windMaxCount > 0 ? Math.round((windMaxSum / windMaxCount) * 10) / 10 : null
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
  if (w.wind_speed_10m_max_kmh != null) {
    parts.push(`szél max ${Number(w.wind_speed_10m_max_kmh).toFixed(0)} km/h`)
  }
  if (w.wind_gusts_10m_max_kmh != null && Number(w.wind_gusts_10m_max_kmh) > 0) {
    parts.push(`lökés ${Number(w.wind_gusts_10m_max_kmh).toFixed(0)} km/h`)
  }
  if (w.wind_speed_open_avg_kmh != null || w.wind_speed_open_max_kmh != null) {
    const avg = w.wind_speed_open_avg_kmh != null ? Number(w.wind_speed_open_avg_kmh).toFixed(0) : '—'
    const max = w.wind_speed_open_max_kmh != null ? Number(w.wind_speed_open_max_kmh).toFixed(0) : '—'
    parts.push(`8–17 szél átl. ${avg} / max ${max} km/h`)
  }
  const impact = weatherImpactForDay(w)
  const tags: string[] = []
  if (impact.heat) tags.push('meleg')
  if (impact.frost) tags.push('fagy')
  if (impact.snow) tags.push('hó')
  if (impact.rain) tags.push('eső (nyitvatartás)')
  if (impact.wind) tags.push('szél (nyitvatartás)')
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
  wind_speed_10m_max?: (number | null)[]
  wind_gusts_10m_max?: (number | null)[]
}

type OpenMeteoHourly = {
  time: string[]
  precipitation: (number | null)[]
  wind_speed_10m?: (number | null)[]
}

type OpenHoursSeries = {
  precip: Map<string, number[]>
  wind: Map<string, number[]>
}

function buildOpenHoursSeriesByDay(hourly: OpenMeteoHourly): OpenHoursSeries {
  const slotCount = WEATHER_OPEN_HOURS_END - WEATHER_OPEN_HOURS_START + 1
  const precip = new Map<string, number[]>()
  const wind = new Map<string, number[]>()

  for (let i = 0; i < hourly.time.length; i++) {
    const ts = hourly.time[i]
    if (!ts || ts.length < 13) continue
    const day = ts.slice(0, 10)
    const hour = Number(ts.slice(11, 13))
    if (!Number.isFinite(hour) || hour < WEATHER_OPEN_HOURS_START || hour > WEATHER_OPEN_HOURS_END) {
      continue
    }

    let precipSlots = precip.get(day)
    if (!precipSlots) {
      precipSlots = Array.from({ length: slotCount }, () => 0)
      precip.set(day, precipSlots)
    }
    precipSlots[hour - WEATHER_OPEN_HOURS_START] = Number(hourly.precipitation[i]) || 0

    if (hourly.wind_speed_10m) {
      let windSlots = wind.get(day)
      if (!windSlots) {
        windSlots = Array.from({ length: slotCount }, () => 0)
        wind.set(day, windSlots)
      }
      windSlots[hour - WEATHER_OPEN_HOURS_START] = Number(hourly.wind_speed_10m[i]) || 0
    }
  }

  return { precip, wind }
}

function isMissingWindColumnError(message?: string): boolean {
  if (!message) return false
  return (
    message.includes('wind_speed_10m_max_kmh') ||
    message.includes('wind_gusts_10m_max_kmh') ||
    message.includes('wind_speed_open_max_kmh') ||
    message.includes('wind_speed_open_avg_kmh') ||
    message.includes('is_significant_wind_open')
  )
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
  url.searchParams.set(
    'daily',
    'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max'
  )
  url.searchParams.set('hourly', 'precipitation,wind_speed_10m')
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

  const openHours = hourly?.time?.length
    ? buildOpenHoursSeriesByDay(hourly)
    : { precip: new Map<string, number[]>(), wind: new Map<string, number[]>() }

  const rows = daily.time.map((day, i) => {
    const code = daily.weather_code[i] ?? 0
    const precipSlots = openHours.precip.get(day)
    const windSlots = openHours.wind.get(day)
    const rainAnalysis = precipSlots ? analyzeOpenHoursRain(precipSlots) : emptyOpenHoursRainAnalysis()
    const windAnalysis = windSlots ? analyzeOpenHoursWind(windSlots) : emptyOpenHoursWindAnalysis()

    return {
      day,
      condition: wmoToCondition(code),
      temp_max_c: daily.temperature_2m_max[i] ?? null,
      temp_min_c: daily.temperature_2m_min[i] ?? null,
      precipitation_mm: daily.precipitation_sum[i] ?? null,
      precip_open_hours_mm: rainAnalysis.precip_open_hours_mm,
      rain_hours_open: rainAnalysis.rain_hours_open,
      is_significant_rain_open: rainAnalysis.is_significant_rain_open,
      wind_speed_10m_max_kmh: daily.wind_speed_10m_max?.[i] ?? null,
      wind_gusts_10m_max_kmh: daily.wind_gusts_10m_max?.[i] ?? null,
      wind_speed_open_max_kmh: windAnalysis.wind_speed_open_max_kmh,
      wind_speed_open_avg_kmh: windAnalysis.wind_speed_open_avg_kmh,
      is_significant_wind_open: windAnalysis.is_significant_wind_open,
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
    if (isMissingWindColumnError(error.message)) {
      throw new Error(
        'Hiányzó szél oszlopok — futtasd a 20260717_footcounter_weather_wind.sql migrációt a Supabase SQL Editorban.'
      )
    }
    throw new Error(error.message)
  }

  return { upserted: rows.length, start, end }
}
