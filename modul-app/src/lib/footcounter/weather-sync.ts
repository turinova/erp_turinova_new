import type { SupabaseClient } from '@supabase/supabase-js'

import { createServiceClient } from '@/lib/supabase/service'

/** Kecskemét — Europe/Budapest. Override: FOOTCOUNTER_WEATHER_LAT / _LON. */
export const FOOTCOUNTER_LOCAL_TZ = 'Europe/Budapest'

const WEATHER_OPEN_HOURS_START = 8
const WEATHER_OPEN_HOURS_END = 17
const WEATHER_RAIN_HOURLY_MM_THRESHOLD = 0.5
const WEATHER_RAIN_CONSECUTIVE_HOURS = 2
const WEATHER_RAIN_OPEN_HOURS_MIN_TOTAL_MM = 1
const WEATHER_WIND_OPEN_MAX_KMH = 25
const WEATHER_WIND_OPEN_AVG_KMH = 18

/** Ma frissnek számít, ha a sync ennyi ms-en belüli. */
const WEATHER_STALE_MS = 6 * 60 * 60 * 1000
/** Sikertelen sync után ennyi ideig ne próbálja újra (dev process / meleg instance). */
const FAIL_BACKOFF_MS = 15 * 60 * 1000
const DEFAULT_LOOKBACK_DAYS = 120
/** Forecast API past_days max — archive nélkül is elég a közeli hónapokra. */
const FORECAST_PAST_DAYS_MAX = 92

let lastFailAt = 0

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

function wmoToCondition(code: number): string {
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

function analyzeOpenHoursRain(hourlyMmInWindow: number[]) {
  const precip_open_hours_mm = hourlyMmInWindow.reduce(
    (s, v) => s + (Number(v) || 0),
    0
  )
  const rainyHour = hourlyMmInWindow.map(
    (v) => (Number(v) || 0) >= WEATHER_RAIN_HOURLY_MM_THRESHOLD
  )
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
  return {
    precip_open_hours_mm: Math.round(precip_open_hours_mm * 10) / 10,
    rain_hours_open,
    is_significant_rain_open:
      maxConsecutive >= WEATHER_RAIN_CONSECUTIVE_HOURS &&
      precip_open_hours_mm >= WEATHER_RAIN_OPEN_HOURS_MIN_TOTAL_MM
  }
}

function analyzeOpenHoursWind(hourlyKmhInWindow: number[]) {
  const values = hourlyKmhInWindow.map((v) => Number(v) || 0)
  const wind_speed_open_max_kmh =
    values.length > 0 ? Math.round(Math.max(...values) * 10) / 10 : 0
  const wind_speed_open_avg_kmh =
    values.length > 0
      ? Math.round(
          (values.reduce((s, v) => s + v, 0) / values.length) * 10
        ) / 10
      : 0
  return {
    wind_speed_open_max_kmh,
    wind_speed_open_avg_kmh,
    is_significant_wind_open:
      wind_speed_open_max_kmh >= WEATHER_WIND_OPEN_MAX_KMH ||
      wind_speed_open_avg_kmh >= WEATHER_WIND_OPEN_AVG_KMH
  }
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

type OpenMeteoPayload = {
  daily: OpenMeteoDaily
  hourly?: OpenMeteoHourly
  start: string
  end: string
}

const DAILY_VARS =
  'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max'
const HOURLY_VARS = 'precipitation,wind_speed_10m'

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchJson(
  url: string,
  retries = 2
): Promise<{ daily?: OpenMeteoDaily; hourly?: OpenMeteoHourly }> {
  let lastStatus = 0
  let lastBody = ''
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, { cache: 'no-store' })
    if (res.ok) {
      return (await res.json()) as {
        daily?: OpenMeteoDaily
        hourly?: OpenMeteoHourly
      }
    }
    lastStatus = res.status
    lastBody = await res.text().catch(() => '')
    const retryable = res.status === 503 || res.status === 429
    if (!retryable || attempt === retries) break
    await sleep(800 * (attempt + 1))
  }
  throw new Error(
    `Open-Meteo failed: ${lastStatus}${lastBody ? ` — ${lastBody.slice(0, 160)}` : ''}`
  )
}

async function fetchForecastPayload(
  lat: number,
  lon: number,
  pastDays: number
): Promise<OpenMeteoPayload> {
  const days = Math.min(FORECAST_PAST_DAYS_MAX, Math.max(1, pastDays))
  const end = localTodayKey()
  const start = localDayKeyDaysAgo(days - 1)
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(lat))
  url.searchParams.set('longitude', String(lon))
  url.searchParams.set('past_days', String(days))
  url.searchParams.set('forecast_days', '1')
  url.searchParams.set('daily', DAILY_VARS)
  url.searchParams.set('hourly', HOURLY_VARS)
  url.searchParams.set('timezone', FOOTCOUNTER_LOCAL_TZ)

  const json = await fetchJson(url.toString(), 2)
  if (!json.daily?.time?.length) {
    throw new Error('Open-Meteo forecast returned no daily data')
  }
  return { daily: json.daily, hourly: json.hourly, start, end }
}

async function fetchArchivePayload(
  lat: number,
  lon: number,
  start: string,
  end: string
): Promise<OpenMeteoPayload> {
  const url = new URL('https://archive-api.open-meteo.com/v1/archive')
  url.searchParams.set('latitude', String(lat))
  url.searchParams.set('longitude', String(lon))
  url.searchParams.set('start_date', start)
  url.searchParams.set('end_date', end)
  url.searchParams.set('daily', DAILY_VARS)
  url.searchParams.set('hourly', HOURLY_VARS)
  url.searchParams.set('timezone', FOOTCOUNTER_LOCAL_TZ)

  const json = await fetchJson(url.toString(), 2)
  if (!json.daily?.time?.length) {
    throw new Error('Open-Meteo archive returned no daily data')
  }
  return { daily: json.daily, hourly: json.hourly, start, end }
}

/**
 * ≤92 nap: forecast API (stabilabb).
 * Hosszabb: archive, 503 esetén forecast 92 napra esik vissza.
 */
async function fetchOpenMeteoPayload(lookback: number): Promise<OpenMeteoPayload> {
  const { lat, lon } = weatherCoords()
  const end = localTodayKey()
  const start = localDayKeyDaysAgo(lookback - 1)

  if (lookback <= FORECAST_PAST_DAYS_MAX) {
    return fetchForecastPayload(lat, lon, lookback)
  }

  try {
    return await fetchArchivePayload(lat, lon, start, end)
  } catch {
    return fetchForecastPayload(lat, lon, FORECAST_PAST_DAYS_MAX)
  }
}

function buildOpenHoursSeriesByDay(hourly: OpenMeteoHourly) {
  const slotCount = WEATHER_OPEN_HOURS_END - WEATHER_OPEN_HOURS_START + 1
  const precip = new Map<string, number[]>()
  const wind = new Map<string, number[]>()

  for (let i = 0; i < hourly.time.length; i++) {
    const ts = hourly.time[i]
    if (!ts || ts.length < 13) continue
    const day = ts.slice(0, 10)
    const hour = Number(ts.slice(11, 13))
    if (
      !Number.isFinite(hour) ||
      hour < WEATHER_OPEN_HOURS_START ||
      hour > WEATHER_OPEN_HOURS_END
    ) {
      continue
    }

    let precipSlots = precip.get(day)
    if (!precipSlots) {
      precipSlots = Array.from({ length: slotCount }, () => 0)
      precip.set(day, precipSlots)
    }
    precipSlots[hour - WEATHER_OPEN_HOURS_START] =
      Number(hourly.precipitation[i]) || 0

    if (hourly.wind_speed_10m) {
      let windSlots = wind.get(day)
      if (!windSlots) {
        windSlots = Array.from({ length: slotCount }, () => 0)
        wind.set(day, windSlots)
      }
      windSlots[hour - WEATHER_OPEN_HOURS_START] =
        Number(hourly.wind_speed_10m[i]) || 0
    }
  }

  return { precip, wind }
}

/**
 * Open-Meteo → `footcounter_daily_weather` upsert (service role).
 * day-keyed, nem tenant adat.
 */
export async function fetchAndUpsertWeatherRange(
  supabase: SupabaseClient,
  days: number
): Promise<{ upserted: number; start: string; end: string }> {
  const lookback = Math.min(365, Math.max(7, Math.floor(days)))
  const payload = await fetchOpenMeteoPayload(lookback)
  const { daily, hourly, start, end } = payload

  const openHours = hourly?.time?.length
    ? buildOpenHoursSeriesByDay(hourly)
    : { precip: new Map<string, number[]>(), wind: new Map<string, number[]>() }

  const emptyRain = {
    precip_open_hours_mm: 0,
    rain_hours_open: 0,
    is_significant_rain_open: false
  }
  const emptyWind = {
    wind_speed_open_max_kmh: 0,
    wind_speed_open_avg_kmh: 0,
    is_significant_wind_open: false
  }

  const rows = daily.time.map((day, i) => {
    const code = daily.weather_code[i] ?? 0
    const precipSlots = openHours.precip.get(day)
    const windSlots = openHours.wind.get(day)
    const rainAnalysis = precipSlots
      ? analyzeOpenHoursRain(precipSlots)
      : emptyRain
    const windAnalysis = windSlots
      ? analyzeOpenHoursWind(windSlots)
      : emptyWind

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

  const { error } = await supabase
    .from('footcounter_daily_weather')
    .upsert(rows, { onConflict: 'day' })

  if (error) {
    if (error.code === 'PGRST205') {
      throw new Error(
        'A footcounter_daily_weather tábla még nem létezik — futtasd a 20260630_footcounter_daily_weather.sql migrációt.'
      )
    }
    throw new Error(error.message)
  }

  return { upserted: rows.length, start, end }
}

/**
 * Lazy sync: ha ma hiányzik / stale, vagy kevés a történet → Open-Meteo feltöltés.
 * Service role kell; hiba esetén csendben return (dashboard weather nélkül megy).
 */
export async function ensureFootcounterWeatherCoverage(
  lookbackDays = DEFAULT_LOOKBACK_DAYS
): Promise<{ synced: boolean; upserted?: number }> {
  const admin = createServiceClient()
  if (!admin) return { synced: false }

  if (lastFailAt > 0 && Date.now() - lastFailAt < FAIL_BACKOFF_MS) {
    return { synced: false }
  }

  try {
    // Forecast API max 92 nap — elég a havi nézethez, archive 503 elkerülhető.
    const days = Math.min(
      FORECAST_PAST_DAYS_MAX,
      Math.max(7, Math.floor(lookbackDays))
    )
    const today = localTodayKey()
    const rangeStart = localDayKeyDaysAgo(days - 1)

    const [{ data: todayRow }, { data: startRow }] = await Promise.all([
      admin
        .from('footcounter_daily_weather')
        .select('fetched_at')
        .eq('day', today)
        .maybeSingle(),
      admin
        .from('footcounter_daily_weather')
        .select('day')
        .eq('day', rangeStart)
        .maybeSingle()
    ])

    const fetchedAt = todayRow?.fetched_at
      ? new Date(String(todayRow.fetched_at)).getTime()
      : 0
    const todayFresh =
      Number.isFinite(fetchedAt) &&
      fetchedAt > 0 &&
      Date.now() - fetchedAt < WEATHER_STALE_MS

    if (todayFresh && startRow?.day) return { synced: false }

    const result = await fetchAndUpsertWeatherRange(admin, days)
    lastFailAt = 0
    return { synced: true, upserted: result.upserted }
  } catch {
    // Open-Meteo 503 / hálózat — ne dobjon Next overlay-t; 15 perc backoff.
    lastFailAt = Date.now()
    return { synced: false }
  }
}
