import type { SupabaseClient } from '@supabase/supabase-js'

import {
  DEFAULT_FOOTCOUNTER_OPEN_HOURS,
  type FootcounterOpenHours
} from '@/lib/footcounter/open-hours'

function clampHour(n: unknown, fallback: number): number {
  const v = Number(n)
  if (!Number.isInteger(v) || v < 0 || v > 23) return fallback
  return v
}

export async function getFootcounterOpenHours(
  supabase: SupabaseClient,
  tenantId: string
): Promise<FootcounterOpenHours> {
  const { data, error } = await supabase
    .from('footcounter_settings')
    .select(
      'weekday_open_hour, weekday_close_hour, saturday_open_hour, saturday_close_hour'
    )
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) {
    // Tábla még nincs / RLS — default
    console.error('getFootcounterOpenHours', error.message)
    return { ...DEFAULT_FOOTCOUNTER_OPEN_HOURS }
  }

  if (!data) return { ...DEFAULT_FOOTCOUNTER_OPEN_HOURS }

  const weekdayOpen = clampHour(
    data.weekday_open_hour,
    DEFAULT_FOOTCOUNTER_OPEN_HOURS.weekdayOpen
  )
  const weekdayClose = clampHour(
    data.weekday_close_hour,
    DEFAULT_FOOTCOUNTER_OPEN_HOURS.weekdayClose
  )

  const satOpenRaw = data.saturday_open_hour
  const satCloseRaw = data.saturday_close_hour
  let saturdayOpen: number | null = null
  let saturdayClose: number | null = null
  if (satOpenRaw != null && satCloseRaw != null) {
    saturdayOpen = clampHour(satOpenRaw, 8)
    saturdayClose = clampHour(satCloseRaw, 12)
    if (saturdayOpen > saturdayClose) {
      saturdayOpen = DEFAULT_FOOTCOUNTER_OPEN_HOURS.saturdayOpen
      saturdayClose = DEFAULT_FOOTCOUNTER_OPEN_HOURS.saturdayClose
    }
  }

  return {
    weekdayOpen: Math.min(weekdayOpen, weekdayClose),
    weekdayClose: Math.max(weekdayOpen, weekdayClose),
    saturdayOpen,
    saturdayClose
  }
}
