import type { SupabaseClient } from '@supabase/supabase-js'

import {
  getBelepokGlance,
  type BelepokGlance
} from '@/lib/belepok'
import {
  addDaysYmd,
  budapestDayRangeIso,
  budapestTodayYmd,
  budapestYearMonth,
  toBudapestYmdFromIso
} from '@/lib/date'
import { getJelenletDay } from '@/lib/jelenlet'

export type CompareDelta = {
  /** vs tegnap % */
  vsYesterdayPct: number | null
  /** vs múlt hét ugyanaz a nap % */
  vsLastWeekPct: number | null
}

export type KezdolapLapszab = {
  todayGross: number
  todayCount: number
  compare: CompareDelta
}

export type KezdolapCapacity = {
  usedM: number
  limitM: number
  pct: number
  compare: CompareDelta
}

export type KezdolapQuotes = {
  partnerCount: number
  staffCount: number
  comparePartner: CompareDelta
  compareStaff: CompareDelta
}

export type KezdolapGoogle = {
  todayClicks: number
  last30Clicks: number
  compare: CompareDelta
}

export type KezdolapBelepok = BelepokGlance & {
  compare: CompareDelta
}

export type KezdolapJelenlet = {
  bentCount: number
  activeCount: number
}

export type KezdolapPulse = {
  belepok: KezdolapBelepok | null
  lapszab: KezdolapLapszab | null
  capacity: KezdolapCapacity | null
  quotes: KezdolapQuotes
  google: KezdolapGoogle | null
  jelenlet: KezdolapJelenlet | null
  loadError: string | null
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export function pctDelta(current: number, baseline: number): number | null {
  if (baseline > 0) return ((current - baseline) / baseline) * 100
  if (current > 0) return 100
  return null
}

function compareOf(current: number, yesterday: number, lastWeek: number): CompareDelta {
  return {
    vsYesterdayPct: pctDelta(current, yesterday),
    vsLastWeekPct: pctDelta(current, lastWeek)
  }
}

function dayKeys() {
  const today = budapestTodayYmd()
  return {
    today,
    yesterday: addDaysYmd(today, -1),
    lastWeek: addDaysYmd(today, -7)
  }
}

async function getLapszabPulse(
  supabase: SupabaseClient,
  tenantId: string
): Promise<KezdolapLapszab> {
  const { today, yesterday, lastWeek } = dayKeys()
  const { startIso } = budapestDayRangeIso(lastWeek)
  const { endIso } = budapestDayRangeIso(today)

  const { data, error } = await supabase
    .from('quotes')
    .select('final_total_gross, total_gross, ordered_at')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .is('archived_at', null)
    .not('order_number', 'is', null)
    .neq('status', 'cancelled')
    .gte('ordered_at', startIso)
    .lt('ordered_at', endIso)

  const byDay = new Map<string, { gross: number; count: number }>()
  for (const ymd of [today, yesterday, lastWeek]) {
    byDay.set(ymd, { gross: 0, count: 0 })
  }

  if (error) {
    console.error('getLapszabPulse', error.message)
  } else {
    for (const row of data ?? []) {
      const iso = row.ordered_at as string | null
      if (!iso) continue
      const ymd = toBudapestYmdFromIso(iso)
      const bucket = byDay.get(ymd)
      if (!bucket) continue
      bucket.gross += Number(row.final_total_gross ?? row.total_gross) || 0
      bucket.count += 1
    }
  }

  const t = byDay.get(today)!
  const y = byDay.get(yesterday)!
  const w = byDay.get(lastWeek)!
  return {
    todayGross: Math.round(t.gross),
    todayCount: t.count,
    compare: compareOf(t.gross, y.gross, w.gross)
  }
}

async function cuttingUsedForDate(
  supabase: SupabaseClient,
  tenantId: string,
  ymd: string
): Promise<number> {
  const { data: quotes, error } = await supabase
    .from('quotes')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('production_date', ymd)
    .is('deleted_at', null)
    .is('archived_at', null)
    .neq('status', 'cancelled')

  if (error) {
    console.error('cuttingUsedForDate', error.message)
    return 0
  }
  const ids = (quotes ?? []).map((q) => q.id as string)
  if (ids.length === 0) return 0

  const { data: lines, error: lineErr } = await supabase
    .from('quote_material_lines')
    .select('cutting_length_m')
    .in('quote_id', ids)

  if (lineErr) {
    console.error('cuttingUsedForDate lines', lineErr.message)
    return 0
  }
  let used = 0
  for (const row of lines ?? []) {
    used += Number(row.cutting_length_m) || 0
  }
  return round1(used)
}

async function getCuttingCapacityPulse(
  supabase: SupabaseClient,
  tenantId: string
): Promise<KezdolapCapacity | null> {
  const { today, yesterday, lastWeek } = dayKeys()

  const { data: machines, error: machErr } = await supabase
    .from('production_machines')
    .select('usage_limit_per_day')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .is('deleted_at', null)

  if (machErr) {
    console.error('getCuttingCapacityPulse machines', machErr.message)
    return null
  }

  const limitM = (machines ?? []).reduce(
    (sum, m) => sum + (Number(m.usage_limit_per_day) || 0),
    0
  )
  if (limitM <= 0) return null

  const [usedToday, usedY, usedW] = await Promise.all([
    cuttingUsedForDate(supabase, tenantId, today),
    cuttingUsedForDate(supabase, tenantId, yesterday),
    cuttingUsedForDate(supabase, tenantId, lastWeek)
  ])

  const pct = Math.round((usedToday / limitM) * 100)
  const pctY = Math.round((usedY / limitM) * 100)
  const pctW = Math.round((usedW / limitM) * 100)

  return {
    usedM: usedToday,
    limitM,
    pct,
    compare: compareOf(pct, pctY, pctW)
  }
}

async function countQuotesDay(
  supabase: SupabaseClient,
  tenantId: string,
  ymd: string
): Promise<{ partner: number; staff: number }> {
  const { startIso, endIso } = budapestDayRangeIso(ymd)
  const [partnerRes, staffRes] = await Promise.all([
    supabase
      .from('quotes')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('source', 'portal')
      .not('portal_submitted_at', 'is', null)
      .is('deleted_at', null)
      .is('archived_at', null)
      .gte('portal_submitted_at', startIso)
      .lt('portal_submitted_at', endIso),
    supabase
      .from('quotes')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .neq('source', 'portal')
      .is('deleted_at', null)
      .is('archived_at', null)
      .gte('created_at', startIso)
      .lt('created_at', endIso)
  ])
  return {
    partner: partnerRes.error ? 0 : (partnerRes.count ?? 0),
    staff: staffRes.error ? 0 : (staffRes.count ?? 0)
  }
}

async function getQuotesPulse(
  supabase: SupabaseClient,
  tenantId: string
): Promise<KezdolapQuotes> {
  const { today, yesterday, lastWeek } = dayKeys()
  const [t, y, w] = await Promise.all([
    countQuotesDay(supabase, tenantId, today),
    countQuotesDay(supabase, tenantId, yesterday),
    countQuotesDay(supabase, tenantId, lastWeek)
  ])
  return {
    partnerCount: t.partner,
    staffCount: t.staff,
    comparePartner: compareOf(t.partner, y.partner, w.partner),
    compareStaff: compareOf(t.staff, y.staff, w.staff)
  }
}

async function getGooglePulse(
  supabase: SupabaseClient,
  tenantId: string
): Promise<KezdolapGoogle | null> {
  const { data: company, error: companyErr } = await supabase
    .from('tenant_companies')
    .select('google_review_url, google_review_code')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (companyErr) {
    console.error('getGooglePulse company', companyErr.message)
    return null
  }
  if (!company?.google_review_url || !company?.google_review_code) {
    return null
  }

  const { today, yesterday, lastWeek } = dayKeys()
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const ranges = [today, yesterday, lastWeek].map((ymd) =>
    budapestDayRangeIso(ymd)
  )

  const [todayRes, yRes, wRes, monthRes] = await Promise.all([
    supabase
      .from('google_review_link_clicks')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('clicked_at', ranges[0].startIso)
      .lt('clicked_at', ranges[0].endIso),
    supabase
      .from('google_review_link_clicks')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('clicked_at', ranges[1].startIso)
      .lt('clicked_at', ranges[1].endIso),
    supabase
      .from('google_review_link_clicks')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('clicked_at', ranges[2].startIso)
      .lt('clicked_at', ranges[2].endIso),
    supabase
      .from('google_review_link_clicks')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('clicked_at', since30)
  ])

  const n = (r: { count: number | null; error: unknown }) =>
    r.error ? 0 : (r.count ?? 0)

  const todayClicks = n(todayRes)
  return {
    todayClicks,
    last30Clicks: n(monthRes),
    compare: compareOf(todayClicks, n(yRes), n(wRes))
  }
}

async function getBelepokPulse(
  supabase: SupabaseClient,
  tenantId: string
): Promise<KezdolapBelepok> {
  const glance = await getBelepokGlance(supabase, tenantId)
  const { today, yesterday, lastWeek } = dayKeys()
  const { year, month } = budapestYearMonth()

  const { data, error } = await supabase.rpc('footcounter_dashboard_agg', {
    p_tenant_id: tenantId,
    p_year: year,
    p_month: month
  })

  let yVal = 0
  let wVal = 0
  if (error) {
    console.error('getBelepokPulse agg', error.message)
  } else {
    const agg = (data ?? {}) as {
      lookback_days?: Array<{ day_key?: string; c?: number }>
    }
    const map = new Map<string, number>()
    for (const row of agg.lookback_days ?? []) {
      const key = String(row.day_key ?? '')
      if (key) map.set(key, Number(row.c) || 0)
    }
    yVal = map.get(yesterday) ?? 0
    wVal = map.get(lastWeek) ?? 0
    // today from glance is open-hours filtered; for compare use glance.todayIn
    void today
  }

  return {
    ...glance,
    compare: compareOf(glance.todayIn, yVal, wVal)
  }
}

async function getJelenletPulse(
  supabase: SupabaseClient,
  tenantId: string
): Promise<KezdolapJelenlet | null> {
  try {
    const day = await getJelenletDay(supabase, tenantId, budapestTodayYmd())
    if (day.loadError) return null
    return {
      bentCount: day.bentCount,
      activeCount: day.rows.length
    }
  } catch (e) {
    console.error('getJelenletPulse', e)
    return null
  }
}

export async function getKezdolapPulse(
  supabase: SupabaseClient,
  tenantId: string,
  flags: {
    lapszabaszat: boolean
    footcounter: boolean
    jelenlet: boolean
  }
): Promise<KezdolapPulse> {
  const emptyQuotes: KezdolapQuotes = {
    partnerCount: 0,
    staffCount: 0,
    comparePartner: { vsYesterdayPct: null, vsLastWeekPct: null },
    compareStaff: { vsYesterdayPct: null, vsLastWeekPct: null }
  }

  try {
    const [belepok, lapszab, capacity, quotes, google, jelenlet] =
      await Promise.all([
        flags.footcounter
          ? getBelepokPulse(supabase, tenantId)
          : Promise.resolve(null),
        flags.lapszabaszat
          ? getLapszabPulse(supabase, tenantId)
          : Promise.resolve(null),
        flags.lapszabaszat
          ? getCuttingCapacityPulse(supabase, tenantId)
          : Promise.resolve(null),
        getQuotesPulse(supabase, tenantId),
        getGooglePulse(supabase, tenantId),
        flags.jelenlet
          ? getJelenletPulse(supabase, tenantId)
          : Promise.resolve(null)
      ])

    return {
      belepok,
      lapszab,
      capacity,
      quotes,
      google,
      jelenlet,
      loadError: null
    }
  } catch (e) {
    return {
      belepok: null,
      lapszab: null,
      capacity: null,
      quotes: emptyQuotes,
      google: null,
      jelenlet: null,
      loadError:
        e instanceof Error
          ? e.message
          : 'Nem sikerült betölteni a kezdőlapot.'
    }
  }
}
