import type { FootcounterDashboardStats } from '@/types/footcounter'
import { formatAvg } from '@/lib/footcounter-format'
import {
  formatVsBaselinePct,
  type WeatherTrafficImpact
} from '@/lib/footcounter-weather-impact'

export function computeMonthInsightBullets(
  stats: FootcounterDashboardStats,
  weatherImpact: WeatherTrafficImpact
): string[] {
  const bullets: string[] = []
  const summary = stats.month_summary
  const inSum = stats.series_month.reduce((s, d) => s + d.in_count, 0)

  if (stats.mom_change_pct != null) {
    const dir = stats.mom_change_pct > 0 ? 'erősebb' : stats.mom_change_pct < 0 ? 'gyengébb' : 'megegyező'
    bullets.push(
      `A hónap ${Math.abs(stats.mom_change_pct)}%-kal ${dir} az előző hónaphoz képest (${inSum.toLocaleString('hu-HU')} belépő összesen).`
    )
  } else if (inSum > 0) {
    bullets.push(`Összesen ${inSum.toLocaleString('hu-HU')} belépő ebben a hónapban.`)
  }

  if (summary?.busiest_day && summary.busiest_in > 0) {
    const dayPart = summary.busiest_day.slice(8)
    bullets.push(`Legforgalmasabb nap: ${dayPart}. (${summary.busiest_in} belépő).`)
  }

  if (weatherImpact.has_weather) {
    const rain = weatherImpact.buckets.find(b => b.key === 'rain')
    const dry = weatherImpact.buckets.find(b => b.key === 'dry')
    if (rain && dry && rain.days > 0 && dry.days > 0) {
      const diff = formatVsBaselinePct(rain.vs_baseline_pct)
      bullets.push(
        `Esős napokon átlag ${formatAvg(rain.avg_in)} belépő (${diff} az átlaghoz), száraz napokon ${formatAvg(dry.avg_in)}.`
      )
    }

    const heat = weatherImpact.buckets.find(b => b.key === 'heat')
    if (heat && heat.days >= 2) {
      bullets.push(
        `Meleg napokon (${heat.days} db) átlag ${formatAvg(heat.avg_in)} belépő (${formatVsBaselinePct(heat.vs_baseline_pct)} az átlaghoz).`
      )
    }

    const wind = weatherImpact.buckets.find(b => b.key === 'wind')
    if (wind && wind.days >= 2) {
      bullets.push(
        `Szeles napokon (${wind.days} db) átlag ${formatAvg(wind.avg_in)} belépő (${formatVsBaselinePct(wind.vs_baseline_pct)} az átlaghoz).`
      )
    }
  }

  return bullets.slice(0, 4)
}
