import type { SupabaseClient } from '@supabase/supabase-js'

import {
  buildTodayMood,
  type FootcounterTodayGlance
} from '@/lib/footcounter/summary'
import type {
  FootcounterDeviceRow,
  FootcounterHomeSlim,
  FootcounterMonthDay
} from '@/lib/footcounter/types'

export async function listFootcounterDevicesForTenant(
  admin: SupabaseClient,
  tenantId: string
): Promise<FootcounterDeviceRow[]> {
  const { data, error } = await admin
    .from('footcounter_devices')
    .select(
      'id, tenant_id, slug, name, sync_token_hash, stream_url, last_seen_at, created_at, updated_at'
    )
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('listFootcounterDevicesForTenant', error.message)
    return []
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    tenant_id: row.tenant_id as string,
    slug: row.slug as string,
    name: (row.name as string) || (row.slug as string),
    stream_url: (row.stream_url as string | null) ?? null,
    last_seen_at: (row.last_seen_at as string | null) ?? null,
    has_token: Boolean(row.sync_token_hash),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string
  }))
}

function budapestDayKey(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Budapest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d)
}

function budapestHour(d: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Budapest',
    hour: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(d)
  const h = parts.find((p) => p.type === 'hour')?.value
  return Number(h ?? 0)
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

async function tenantDeviceIds(
  supabase: SupabaseClient,
  tenantId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('footcounter_devices')
    .select('id')
    .eq('tenant_id', tenantId)
  if (error) {
    console.error('tenantDeviceIds', error.message)
    return []
  }
  return (data ?? []).map((d) => d.id as string)
}

async function fetchInsInRange(
  supabase: SupabaseClient,
  deviceIds: string[],
  rangeStart: Date,
  rangeEnd: Date
): Promise<Date[]> {
  if (deviceIds.length === 0) return []
  const out: Date[] = []
  const pageSize = 1000
  let from = 0
  for (;;) {
    const { data: rows, error } = await supabase
      .from('footcounter_crossings')
      .select('occurred_at')
      .in('device_id', deviceIds)
      .eq('direction', 'in')
      .gte('occurred_at', rangeStart.toISOString())
      .lt('occurred_at', rangeEnd.toISOString())
      .order('occurred_at', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) {
      console.error('fetchInsInRange', error.message)
      break
    }
    const batch = rows ?? []
    for (const r of batch) {
      out.push(new Date(r.occurred_at as string))
    }
    if (batch.length < pageSize) break
    from += pageSize
  }
  return out
}

export type FootcounterMonthInsResult = {
  days: FootcounterMonthDay[]
  peakHour: number | null
  peakHourIn: number
  totalIn: number
}

/**
 * Belépők (IN) naponta + havi csúcsóra — tenant összes eszköz.
 */
export async function getFootcounterMonthIns(
  supabase: SupabaseClient,
  tenantId: string,
  year: number,
  month: number
): Promise<FootcounterMonthInsResult> {
  const dim = daysInMonth(year, month)
  const empty: FootcounterMonthDay[] = Array.from({ length: dim }, (_, i) => ({
    day: i + 1,
    count: 0
  }))

  const deviceIds = await tenantDeviceIds(supabase, tenantId)
  if (!deviceIds.length) {
    return { days: empty, peakHour: null, peakHourIn: 0, totalIn: 0 }
  }

  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`
  const rangeStart = new Date(Date.UTC(year, month - 1, 1, -3, 0, 0))
  const rangeEnd = new Date(Date.UTC(year, month, 1, 3, 0, 0))
  const stamps = await fetchInsInRange(
    supabase,
    deviceIds,
    rangeStart,
    rangeEnd
  )

  const counts = new Map<number, number>()
  const hourCounts = new Map<number, number>()

  for (const at of stamps) {
    const key = budapestDayKey(at)
    if (!key.startsWith(monthPrefix)) continue
    const day = Number(key.slice(8, 10))
    if (day < 1 || day > dim) continue
    counts.set(day, (counts.get(day) ?? 0) + 1)
    const hour = budapestHour(at)
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1)
  }

  const days = empty.map((row) => ({
    day: row.day,
    count: counts.get(row.day) ?? 0
  }))
  const totalIn = days.reduce((s, d) => s + d.count, 0)

  let peakHour: number | null = null
  let peakHourIn = 0
  for (const [h, c] of hourCounts) {
    if (c > peakHourIn) {
      peakHourIn = c
      peakHour = h
    }
  }

  return { days, peakHour, peakHourIn, totalIn }
}

/** Mai belépők + hangulat + mai csúcsóra. */
export async function getFootcounterTodayGlance(
  supabase: SupabaseClient,
  tenantId: string
): Promise<FootcounterTodayGlance> {
  const empty: FootcounterTodayGlance = {
    todayIn: 0,
    mood: 'none',
    moodLabel: 'Nincs mai adat',
    moodHint: null,
    peakHour: null,
    peakHourIn: 0
  }

  const deviceIds = await tenantDeviceIds(supabase, tenantId)
  if (!deviceIds.length) return empty

  const todayKey = budapestDayKey(new Date())
  const lookbackStart = new Date(Date.now() - 70 * 86400000)
  const stamps = await fetchInsInRange(
    supabase,
    deviceIds,
    lookbackStart,
    new Date(Date.now() + 3600000)
  )

  const byDay = new Map<string, number>()
  const todayHours = new Map<number, number>()
  let todayIn = 0

  for (const at of stamps) {
    const key = budapestDayKey(at)
    byDay.set(key, (byDay.get(key) ?? 0) + 1)
    if (key === todayKey) {
      todayIn += 1
      const h = budapestHour(at)
      todayHours.set(h, (todayHours.get(h) ?? 0) + 1)
    }
  }

  let peakHour: number | null = null
  let peakHourIn = 0
  for (const [h, c] of todayHours) {
    if (c > peakHourIn) {
      peakHourIn = c
      peakHour = h
    }
  }

  const todayDow = new Date(`${todayKey}T12:00:00Z`).getUTCDay()
  const samples: number[] = []
  for (const [key, count] of byDay) {
    if (key === todayKey) continue
    const dow = new Date(`${key}T12:00:00Z`).getUTCDay()
    if (dow !== todayDow) continue
    if (count <= 0) continue
    samples.push(count)
  }
  const sameWeekdayAvg =
    samples.length > 0
      ? samples.reduce((a, b) => a + b, 0) / samples.length
      : null

  const mood = buildTodayMood(todayIn, sameWeekdayAvg, samples.length)

  return {
    todayIn,
    ...mood,
    peakHour,
    peakHourIn
  }
}

export async function getFootcounterLiveStatus(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{
  status: 'live' | 'idle' | 'offline' | 'none'
  lastSeenAt: string | null
  deviceCount: number
}> {
  const { data, error } = await supabase
    .from('footcounter_devices')
    .select('last_seen_at')
    .eq('tenant_id', tenantId)

  if (error) {
    console.error('getFootcounterLiveStatus', error.message)
    return { status: 'none', lastSeenAt: null, deviceCount: 0 }
  }

  const rows = data ?? []
  if (rows.length === 0) {
    return { status: 'none', lastSeenAt: null, deviceCount: 0 }
  }

  let latest: string | null = null
  for (const r of rows) {
    const at = r.last_seen_at as string | null
    if (!at) continue
    if (!latest || new Date(at).getTime() > new Date(latest).getTime()) {
      latest = at
    }
  }

  if (!latest) {
    return { status: 'offline', lastSeenAt: null, deviceCount: rows.length }
  }

  const ageMs = Date.now() - new Date(latest).getTime()
  const LIVE_MS = 30 * 60 * 1000
  const IDLE_MS = 24 * 60 * 60 * 1000

  let status: 'live' | 'idle' | 'offline' = 'offline'
  if (ageMs <= LIVE_MS) status = 'live'
  else if (ageMs <= IDLE_MS) status = 'idle'

  return { status, lastSeenAt: latest, deviceCount: rows.length }
}

/**
 * Home widget adat: mai IN/OUT + órás IN (0–23) + élő státusz.
 * Csak akkor hívd, ha a tenantnak be van kapcsolva a Belépők add-on.
 */
export async function getFootcounterHomeSlim(
  supabase: SupabaseClient,
  tenantId: string
): Promise<FootcounterHomeSlim> {
  const empty: FootcounterHomeSlim = {
    todayIn: 0,
    todayOut: 0,
    hourlyIn: Array.from({ length: 24 }, () => 0),
    lastEventAt: null,
    deviceLastSeen: null,
    liveStatus: 'none'
  }

  const live = await getFootcounterLiveStatus(supabase, tenantId)
  const deviceIds = await tenantDeviceIds(supabase, tenantId)
  if (!deviceIds.length) {
    return { ...empty, liveStatus: live.status, deviceLastSeen: live.lastSeenAt }
  }

  const todayKey = budapestDayKey(new Date())
  const rangeStart = new Date(Date.now() - 36 * 3600 * 1000)
  const rangeEnd = new Date(Date.now() + 3600 * 1000)

  const hourlyIn = Array.from({ length: 24 }, () => 0)
  let todayIn = 0
  let todayOut = 0
  let lastEventAt: string | null = null

  const pageSize = 1000
  let from = 0
  for (;;) {
    const { data: rows, error } = await supabase
      .from('footcounter_crossings')
      .select('occurred_at, direction')
      .in('device_id', deviceIds)
      .gte('occurred_at', rangeStart.toISOString())
      .lt('occurred_at', rangeEnd.toISOString())
      .order('occurred_at', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) {
      console.error('getFootcounterHomeSlim', error.message)
      break
    }

    const batch = rows ?? []
    for (const r of batch) {
      const at = new Date(r.occurred_at as string)
      if (budapestDayKey(at) !== todayKey) continue
      const dir = r.direction as string
      const iso = at.toISOString()
      if (!lastEventAt || iso > lastEventAt) lastEventAt = iso
      if (dir === 'in') {
        todayIn += 1
        const h = budapestHour(at)
        if (h >= 0 && h < 24) hourlyIn[h] += 1
      } else if (dir === 'out') {
        todayOut += 1
      }
    }

    if (batch.length < pageSize) break
    from += pageSize
  }

  return {
    todayIn,
    todayOut,
    hourlyIn,
    lastEventAt,
    deviceLastSeen: live.lastSeenAt,
    liveStatus: live.status
  }
}

export async function getFootcounterTodayStats(
  supabase: SupabaseClient,
  tenantId: string
): Promise<
  Array<{
    deviceId: string
    slug: string
    name: string
    lastSeenAt: string | null
    todayIn: number
    todayOut: number
  }>
> {
  const { data: devices, error: devErr } = await supabase
    .from('footcounter_devices')
    .select('id, slug, name, last_seen_at')
    .eq('tenant_id', tenantId)

  if (devErr || !devices?.length) {
    if (devErr) console.error('getFootcounterTodayStats devices', devErr.message)
    return []
  }

  const todayKey = budapestDayKey(new Date())
  const lookback = new Date(Date.now() - 48 * 3600 * 1000).toISOString()

  const results = await Promise.all(
    devices.map(async (d) => {
      const deviceId = d.id as string
      const { data: rows, error } = await supabase
        .from('footcounter_crossings')
        .select('direction, occurred_at')
        .eq('device_id', deviceId)
        .gte('occurred_at', lookback)

      if (error) {
        console.error('getFootcounterTodayStats crossings', error.message)
      }

      let todayIn = 0
      let todayOut = 0
      for (const r of rows ?? []) {
        const at = r.occurred_at as string
        if (budapestDayKey(new Date(at)) !== todayKey) continue
        if (r.direction === 'in') todayIn += 1
        else if (r.direction === 'out') todayOut += 1
      }

      return {
        deviceId,
        slug: d.slug as string,
        name: ((d.name as string) || d.slug) as string,
        lastSeenAt: (d.last_seen_at as string | null) ?? null,
        todayIn,
        todayOut
      }
    })
  )

  return results
}
