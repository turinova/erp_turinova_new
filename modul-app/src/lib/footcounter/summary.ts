import type { FootcounterMonthDay } from '@/lib/footcounter/types'

export type DayMood = 'busy' | 'typical' | 'quiet' | 'none'

export type FootcounterTodayGlance = {
  todayIn: number
  mood: DayMood
  moodLabel: string
  moodHint: string | null
  peakHour: number | null
  peakHourIn: number
}

export type FootcounterMonthGlance = {
  totalIn: number
  activeDays: number
  avgPerActiveDay: number
  best: { day: number; count: number } | null
  worst: { day: number; count: number } | null
  peakHour: number | null
  peakHourIn: number
  momChangePct: number | null
  monthMood: 'strong' | 'soft' | 'steady'
  monthMoodLabel: string
}

export function buildMonthGlance(
  days: FootcounterMonthDay[],
  prevTotalIn: number | null,
  peakHour: number | null,
  peakHourIn: number
): FootcounterMonthGlance {
  const open = days.filter((d) => d.count > 0)
  const totalIn = days.reduce((s, d) => s + d.count, 0)
  const activeDays = open.length
  const avgPerActiveDay = activeDays > 0 ? totalIn / activeDays : 0

  let best: FootcounterMonthGlance['best'] = null
  let worst: FootcounterMonthGlance['worst'] = null
  for (const d of open) {
    if (!best || d.count > best.count) best = { day: d.day, count: d.count }
    if (!worst || d.count < worst.count) worst = { day: d.day, count: d.count }
  }

  let momChangePct: number | null = null
  if (prevTotalIn != null && prevTotalIn > 0) {
    momChangePct = Math.round((totalIn / prevTotalIn - 1) * 100)
  }

  let monthMood: FootcounterMonthGlance['monthMood'] = 'steady'
  let monthMoodLabel = 'Átlagos hónap'
  if (momChangePct != null) {
    if (momChangePct >= 10) {
      monthMood = 'strong'
      monthMoodLabel = 'Erős hónap'
    } else if (momChangePct <= -10) {
      monthMood = 'soft'
      monthMoodLabel = 'Gyengébb hónap'
    } else {
      monthMoodLabel = 'Stabil hónap'
    }
  } else if (avgPerActiveDay >= 180) {
    monthMood = 'strong'
    monthMoodLabel = 'Forgalmas hónap'
  }

  return {
    totalIn,
    activeDays,
    avgPerActiveDay,
    best,
    worst,
    peakHour,
    peakHourIn,
    momChangePct,
    monthMood,
    monthMoodLabel
  }
}

export function buildTodayMood(
  todayIn: number,
  sameWeekdayAvg: number | null,
  sampleDays: number
): Pick<FootcounterTodayGlance, 'mood' | 'moodLabel' | 'moodHint'> {
  if (sampleDays < 1 || sameWeekdayAvg == null || sameWeekdayAvg <= 0) {
    if (todayIn > 0) {
      return { mood: 'none', moodLabel: 'Ma', moodHint: null }
    }
    return { mood: 'none', moodLabel: 'Nincs mai adat', moodHint: null }
  }

  const pct = Math.round((todayIn / sameWeekdayAvg - 1) * 100)
  if (Math.abs(pct) <= 10) {
    return {
      mood: 'typical',
      moodLabel: 'Szokásos nap',
      moodHint: 'az átlag körül'
    }
  }
  if (pct > 10) {
    return {
      mood: 'busy',
      moodLabel: 'Erős forgalom',
      moodHint: `+${pct}% a tipikus ${weekdayHint()} átlagához`
    }
  }
  return {
    mood: 'quiet',
    moodLabel: 'Enyhe forgalom',
    moodHint: `${pct}% a tipikus ${weekdayHint()} átlagához`
  }
}

function weekdayHint(): string {
  const key = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Budapest',
    weekday: 'short'
  }).format(new Date())
  const map: Record<string, string> = {
    Mon: 'hétfő',
    Tue: 'kedd',
    Wed: 'szerda',
    Thu: 'csütörtök',
    Fri: 'péntek',
    Sat: 'szombat',
    Sun: 'vasárnap'
  }
  return map[key] ?? 'nap'
}
