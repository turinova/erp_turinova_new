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
}
