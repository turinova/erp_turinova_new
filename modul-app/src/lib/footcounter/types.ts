export const FOOTCOUNTER_FEATURE = 'footcounter' as const
export const FOOTCOUNTER_ADDON_KEY = 'footcounter' as const
export const FOOTCOUNTER_PAGE = '/belepok' as const

export type FootcounterDirection = 'in' | 'out'

export type FootcounterSyncEvent = {
  client_event_id: string
  occurred_at: string
  direction: FootcounterDirection
  confidence?: number | null
}

export type FootcounterDeviceRow = {
  id: string
  tenant_id: string
  slug: string
  name: string
  stream_url: string | null
  last_seen_at: string | null
  has_token: boolean
  created_at: string
  updated_at: string
}

export type FootcounterTodayStats = {
  deviceId: string
  slug: string
  name: string
  lastSeenAt: string | null
  todayIn: number
  todayOut: number
}

/** One calendar day in a month chart (Europe/Budapest). */
export type FootcounterMonthDay = {
  day: number
  count: number
}

/** Home widget — mai forgalom óránként. */
export type FootcounterHomeSlim = {
  todayIn: number
  todayOut: number
  /** length 24, index = Europe/Budapest hour */
  hourlyIn: number[]
  lastEventAt: string | null
  deviceLastSeen: string | null
  liveStatus: 'live' | 'idle' | 'offline' | 'none'
}

