export type FootcounterDashboardStats = {
  device_slug: string

  /** Budapest calendar day (from synced crossings). */
  today_in: number
  today_out: number

  /** All synced crossings for this device (Supabase); not reset when Pi restarts. */
  total_in: number
  total_out: number
  last_event_at: string | null
  device_last_seen: string | null
  series_7d: Array<{ day: string; in_count: number; out_count: number }>

  /** Selected month daily series (Budapest-local dates, `YYYY-MM-DD`). */
  series_month: Array<{ day: string; in_count: number; out_count: number }>

  /** Today in Europe/Budapest: hour 0–23 → Be / Ki counts. */
  series_today_hourly: Array<{ hour: number; in_count: number; out_count: number }>

  /**
   * Average total Be / Ki on the same weekday (Mon–Sun) over recent past days, excluding today.
   * `sample_days` is how many calendar days contributed (e.g. last 4 Tuesdays).
   */
  same_weekday_avg: {
    sample_days: number
    avg_in: number
    avg_out: number
    lookback_days: number
  } | null

  /**
   * Visitor heatmap: rows = Mon..Sun, cols = hour 0–23, values = Be (in) count in window.
   */
  heatmap_in: { days: number; matrix: number[][] }
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
