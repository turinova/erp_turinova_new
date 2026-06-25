export type FootcounterDaySeries = {
  day: string
  in_count: number
  out_count: number
}

export type FootcounterMonthSummary = {
  days_in_month: number
  active_days: number
  avg_in_per_active_day: number
  avg_total_per_active_day: number
  busiest_day: string | null
  busiest_in: number
  slowest_day: string | null
  slowest_in: number
}

export type FootcounterWeekdayProfile = {
  weekday_mon0: number
  label: string
  avg_in: number
  sample_days: number
}

export type FootcounterMonthTrend = {
  month_key: string
  total_in: number
  total_out: number
  total: number
}

export type FootcounterDayWeather = {
  day: string
  condition: string
  temp_max_c: number | null
  temp_min_c: number | null
  precipitation_mm: number | null
  precip_open_hours_mm?: number | null
  rain_hours_open?: number | null
  is_significant_rain_open?: boolean | null
}

export type FootcounterDashboardStats = {
  device_slug: string

  /** Kecskemét helyi naptári nap (szinkronizált átkelések). */
  today_in: number
  today_out: number

  /** All synced crossings for this device (Supabase); not reset when Pi restarts. */
  total_in: number
  total_out: number
  last_event_at: string | null
  device_last_seen: string | null
  series_7d: FootcounterDaySeries[]

  /** Kiválasztott hónap napi sorozata (helyi dátum, `YYYY-MM-DD`). */
  series_month: FootcounterDaySeries[]

  /** Ma Kecskemét idő szerint: óra 0–23 → Be / Ki darabszám. */
  series_today_hourly: Array<{ hour: number; in_count: number; out_count: number }>

  /**
   * Average total Be / Ki on the same weekday (Mon–Sun) over recent past days, excluding today.
   */
  same_weekday_avg: {
    sample_days: number
    avg_in: number
    avg_out: number
    lookback_days: number
  } | null

  /** Visitor heatmap: rows = Mon..Sun, cols = hour 0–23, values = Be (in) count in window. */
  heatmap_in: { days: number; matrix: number[][] }

  /** Estimated visitors currently inside (today in − today out, floor 0). */
  live_occupancy?: number

  /** Mai csúcsóra (Be), Kecskemét helyi idő. */
  today_peak_hour?: number | null
  today_peak_in?: number

  month_summary?: FootcounterMonthSummary
  /** Selected month vs previous month Be % change. */
  mom_change_pct?: number | null
  weekday_profile?: FootcounterWeekdayProfile[]
  /** Rolling 12 calendar months (YYYY-MM) for seasonality. */
  series_months_12?: FootcounterMonthTrend[]
  /** @deprecated use series_months_12 */
  series_months_6?: FootcounterMonthTrend[]
  month_weather?: FootcounterDayWeather[]
}

/** SSR payload for home compact card (no heatmap / 7d series). */
export type FootcounterHomeSlim = {
  today_in: number
  today_out: number
  same_weekday_avg: FootcounterDashboardStats['same_weekday_avg']
  last_event_at: string | null
  device_last_seen: string | null
  /** Hour 0–23 → today's "Be" count per hour for mini area chart */
  hourly_in: number[]
}
