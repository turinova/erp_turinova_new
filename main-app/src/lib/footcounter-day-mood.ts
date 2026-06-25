import { alpha, type Theme } from '@mui/material/styles'

import type { FootcounterDashboardStats } from '@/types/footcounter'

export type DayMood = 'no_baseline' | 'typical' | 'busy' | 'quiet'

export interface MoodResult {
  mood: DayMood
  heroLabel: string
  heroColor: (theme: Theme) => string
  subtitle: string | null
}

export function dayMoodFromStats(stats: Pick<FootcounterDashboardStats, 'today_in' | 'same_weekday_avg'>): MoodResult {
  const sw = stats.same_weekday_avg
  if (!sw || sw.sample_days < 1 || sw.avg_in <= 0) {
    if (stats.today_in > 0) {
      return {
        mood: 'no_baseline',
        heroLabel: `${stats.today_in} belépő ma`,
        heroColor: t => t.palette.success.main,
        subtitle: null
      }
    }
    return {
      mood: 'no_baseline',
      heroLabel: 'Nincs mai adat',
      heroColor: t => t.palette.text.secondary,
      subtitle: null
    }
  }
  const pct = Math.round((stats.today_in / sw.avg_in - 1) * 100)
  if (Math.abs(pct) <= 10) {
    return {
      mood: 'typical',
      heroLabel: 'Szokásos nap',
      heroColor: t => t.palette.info.main,
      subtitle: 'az átlag körül'
    }
  }
  if (pct > 10) {
    return {
      mood: 'busy',
      heroLabel: 'Erős forgalom',
      heroColor: t => t.palette.success.main,
      subtitle: `+${pct}% az átlaghoz képest`
    }
  }
  return {
    mood: 'quiet',
    heroLabel: 'Enyhe forgalom',
    heroColor: t => t.palette.warning.main,
    subtitle: `${pct}% az átlaghoz képest`
  }
}

export function moodStripeColor(theme: Theme, mood: DayMood): string {
  const isDark = theme.palette.mode === 'dark'
  switch (mood) {
    case 'busy':
      return isDark ? alpha(theme.palette.success.main, 0.6) : alpha(theme.palette.success.main, 0.5)
    case 'quiet':
      return isDark ? alpha(theme.palette.warning.main, 0.55) : alpha(theme.palette.warning.main, 0.45)
    case 'typical':
      return isDark ? alpha(theme.palette.info.main, 0.55) : alpha(theme.palette.info.main, 0.45)
    default:
      return isDark ? alpha(theme.palette.info.main, 0.35) : alpha(theme.palette.info.main, 0.25)
  }
}
