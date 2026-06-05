/** Shared recent-window for dispatch / pack "Legutóbb…" views. */

export const DEFAULT_RECENT_DAYS = 5

export const ALLOWED_RECENT_DAYS = [1, 3, 5, 7, 14] as const

export type RecentDaysOption = (typeof ALLOWED_RECENT_DAYS)[number]

/**
 * Parse `days` query param; invalid or missing → DEFAULT_RECENT_DAYS.
 */
export function parseRecentDays(raw: string | null | undefined): RecentDaysOption {
  const n = parseInt(String(raw ?? ''), 10)
  if (ALLOWED_RECENT_DAYS.includes(n as RecentDaysOption)) {
    return n as RecentDaysOption
  }
  return DEFAULT_RECENT_DAYS
}

/**
 * Start of calendar day (UTC) for (today - (days - 1)) — inclusive "last N days".
 */
export function sinceIsoForRecentDays(days: number): string {
  const d = Math.max(1, Math.floor(days))
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  start.setUTCDate(start.getUTCDate() - (d - 1))
  return start.toISOString()
}

export function recentDaysLabelHu(days: number): string {
  return days === 1 ? '1 nap' : `${days} nap`
}
