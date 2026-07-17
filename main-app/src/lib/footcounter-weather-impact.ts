import type { FootcounterDaySeries, FootcounterDayWeather } from '@/types/footcounter'
import { formatAvg } from '@/lib/footcounter-format'
import { weatherImpactForDay } from '@/lib/footcounter-weather'

export type WeatherTrafficBucketKey = 'rain' | 'dry' | 'heat' | 'frost' | 'snow' | 'wind'

export type WeatherTrafficBucket = {
  key: WeatherTrafficBucketKey
  label: string
  days: number
  avg_in: number
  vs_baseline_pct: number | null
}

export type WeatherTrafficImpact = {
  baseline_avg_in: number
  baseline_days: number
  buckets: WeatherTrafficBucket[]
  has_weather: boolean
}

function pctVsBaseline(avg: number, baseline: number): number | null {
  if (baseline <= 0 || !Number.isFinite(baseline)) return null
  return Math.round((avg / baseline - 1) * 100)
}

function avgIn(days: Array<{ in_count: number }>): number {
  if (days.length === 0) return 0
  const sum = days.reduce((s, d) => s + d.in_count, 0)
  return sum / days.length
}

/** Domináns időjárás ikon a napi chart x-tengelyéhez (egy nap). */
export function weatherDayIcon(w: FootcounterDayWeather | undefined): string {
  if (!w || w.condition === 'unknown') return ''
  const impact = weatherImpactForDay(w)
  if (impact.snow) return '❄️'
  if (impact.rain) return '☔'
  if (impact.wind) return '💨'
  if (impact.heat) return '🌡️'
  if (impact.frost) return '🧊'
  return ''
}

export function computeTrafficByWeatherBucket(
  series: FootcounterDaySeries[],
  weather: FootcounterDayWeather[]
): WeatherTrafficImpact {
  const weatherByDay = new Map(weather.map(w => [w.day, w]))

  type DayRow = { day: string; in_count: number; flags: ReturnType<typeof weatherImpactForDay> }
  const known: DayRow[] = []

  for (const s of series) {
    const w = weatherByDay.get(s.day)
    if (!w || w.condition === 'unknown') continue
    known.push({
      day: s.day,
      in_count: Number(s.in_count) || 0,
      flags: weatherImpactForDay(w)
    })
  }

  const active = known.filter(d => d.in_count > 0)
  const baselineDays = active.length > 0 ? active : known
  const baseline_avg_in = avgIn(baselineDays)
  const baseline_days = baselineDays.length

  const pick = (pred: (d: DayRow) => boolean) => {
    const days = known.filter(pred)
    const avg_in = avgIn(days)
    return {
      days: days.length,
      avg_in,
      vs_baseline_pct: days.length > 0 ? pctVsBaseline(avg_in, baseline_avg_in) : null
    }
  }

  const rain = pick(d => d.flags.rain)
  const snow = pick(d => d.flags.snow)
  const heat = pick(d => d.flags.heat)
  const frost = pick(d => d.flags.frost)
  const wind = pick(d => d.flags.wind)
  const dry = pick(d => !d.flags.rain && !d.flags.snow)

  const buckets: WeatherTrafficBucket[] = [
    { key: 'rain', label: 'Esős napok (8–17)', ...rain },
    { key: 'dry', label: 'Száraz napok', ...dry },
    { key: 'wind', label: 'Szeles napok (8–17)', ...wind },
    { key: 'heat', label: 'Meleg napok (≥30°C)', ...heat },
    { key: 'frost', label: 'Fagyos napok', ...frost }
  ]

  if (snow.days > 0) {
    buckets.splice(1, 0, { key: 'snow', label: 'Havas napok', ...snow })
  }

  return {
    baseline_avg_in,
    baseline_days,
    buckets: buckets.filter(
      b => b.days > 0 || b.key === 'rain' || b.key === 'dry' || b.key === 'wind'
    ),
    has_weather: known.length > 0
  }
}

export function formatVsBaselinePct(pct: number | null): string {
  if (pct == null) return '—'
  if (pct === 0) return '≈ átlag'
  return pct > 0 ? `+${pct}%` : `${pct}%`
}

export function formatBucketSubline(bucket: WeatherTrafficBucket, baseline_avg_in: number): string {
  if (bucket.days === 0) return 'Nincs ilyen nap'
  const avg = `${formatAvg(bucket.avg_in)} be/nap`
  const vs = formatVsBaselinePct(bucket.vs_baseline_pct)
  if (bucket.key === 'dry' || bucket.vs_baseline_pct == null) return avg
  return `${avg} · ${vs} az átlaghoz`
}
