import type { SupabaseClient } from '@supabase/supabase-js'

import {
  addDaysYmd,
  budapestDayRangeIso,
  mondayOfWeek
} from '@/lib/home/date'
import { FOOTCOUNTER_FEATURE } from '@/lib/footcounter/types'
import { JELENLET_FEATURE } from '@/lib/jelenlet/types'
import { LAPSZABASZAT_FEATURE } from '@/lib/lapszabaszat/types'
import { QUOTE_READY_SMS_FEATURE } from '@/lib/sms/types'

const MS_DAY = 24 * 60 * 60 * 1000
const TOP_METHODS = 5
const DEVICE_LIVE_MS = 30 * 60 * 1000
const PDA_POS_FEATURE = 'pda_pos'
const MONTH_OPTIONS = 24
const YEAR_OPTIONS = 5
const PAGE_SIZE = 1000

export type TenantReportView = 'month' | 'year'

export type TenantReportPeriodInput = {
  view?: string | null
  period?: string | null
}

export type TenantReportTrendPoint = {
  weekStart: string
  label: string
  orders: number
  gmv: number
}

/** @deprecated use TenantReportTrendPoint */
export type TenantReportWeekPoint = TenantReportTrendPoint

export type TenantReportMethodCount = {
  name: string
  count: number
  sharePct: number
}

export type TenantReportMethodMoney = {
  name: string
  amount: number
  count: number
  sharePct: number
}

export type TenantReportPeriodOption = {
  value: string
  label: string
}

export type TenantReportMetrics = {
  view: TenantReportView
  periodKey: string
  periodLabel: string
  /** pl. „előző hónap azonos napjáig” */
  compareLabel: string
  /** Aktuális hónap/év → részleges (MTD/YTD) */
  periodIsPartial: boolean
  trendGranularity: 'week' | 'month'
  monthOptions: TenantReportPeriodOption[]
  yearOptions: TenantReportPeriodOption[]
  verdictLine: string
  /** Megrendelés-felvétel a kiválasztott időszakban */
  orders30d: number
  ordersPrev30d: number
  ordersDeltaPct: number | null
  /** Bruttó felvett megrendelés (nem készpénz) */
  gmv30d: number
  gmvPrev30d: number
  gmvDeltaPct: number | null
  portalSubmits30d: number
  portalSubmitsPrev30d: number
  /** Élő félkész portal ajánlat (snapshot most) */
  portalDraftsAlive: number
  /**
   * Beküldés → megrendelés a periódusban:
   * period submits with order_number / period submits.
   */
  portalConversionPct: number | null
  portalConvertedInPeriod: number
  linkedPartners: number
  payments30d: number
  paymentsPrev30d: number
  activeSeats7d: number
  maxSeats: number | null
  gmvOpti30d: number
  gmvPortal30d: number
  daysSinceLastOrder: number | null
  lastOrderedAt: string | null
  hasLapszabaszat: boolean
  partnerGmvSharePct: number | null
  weekly: TenantReportTrendPoint[]
  paymentPreferred: TenantReportMethodCount[]
  paymentCollected: TenantReportMethodMoney[]
  hasFootcounter: boolean
  hasJelenlet: boolean
  hasSmsAddon: boolean
  hasPdaPos: boolean
  smsSentThisMonth: number
  salesGmv30d: number
  salesOrders30d: number
  footTodayIn: number
  footTodayOut: number
  footMonthIn: number
  footDeviceCount: number
  footDevicesLive: number
  footLiveStatus: 'live' | 'idle' | 'offline' | 'none'
  jelenletEmployeeCount: number
  jelenletAttendanceDaysMonth: number
  jelenletDeviceCount: number
  jelenletDevicesLive: number
}

type OrderRow = {
  source: string | null
  ordered_at: string
  final_total_gross: number | null
  total_gross: number | null
}

type PortalSubmitRow = {
  portal_submitted_at: string
  order_number: string | null
  status: string | null
  preferred_payment_method_name: string | null
}

type PaymentRow = {
  amount: number | null
  payment_date: string
  payment_method_name: string | null
  quotes:
    | { status: string | null; deleted_at: string | null }
    | { status: string | null; deleted_at: string | null }[]
    | null
}

type SalesRow = {
  total_gross: number | null
  fulfilled_at: string | null
  created_at: string
  status: string | null
}

type ResolvedPeriod = {
  view: TenantReportView
  periodKey: string
  periodLabel: string
  compareLabel: string
  periodIsPartial: boolean
  startMs: number
  endMs: number
  prevStartMs: number
  prevEndMs: number
  startYmd: string
  endYmdInclusive: string
  endExclusiveYmd: string
  monthOptions: TenantReportPeriodOption[]
  yearOptions: TenantReportPeriodOption[]
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

function quoteGmv(q: Pick<OrderRow, 'final_total_gross' | 'total_gross'>): number {
  return roundMoney(Number(q.final_total_gross ?? q.total_gross) || 0)
}

function deltaPct(curr: number, prev: number): number | null {
  if (prev === 0) return curr === 0 ? 0 : null
  return Math.round(((curr - prev) / prev) * 1000) / 10
}

function inRange(
  iso: string | null | undefined,
  startMs: number,
  endMs: number
): boolean {
  if (!iso) return false
  const t = new Date(iso).getTime()
  return t >= startMs && t < endMs
}

function budapestYmdNow(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Budapest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now)
}

function parseYmdParts(ymdStr: string): { y: number; m: number; d: number } {
  const [y, m, d] = ymdStr.split('-').map(Number)
  return { y: y!, m: m!, d: d! }
}

function monthLabelHu(y: number, m: number): string {
  return new Intl.DateTimeFormat('hu-HU', {
    year: 'numeric',
    month: 'long'
  }).format(new Date(Date.UTC(y, m - 1, 1)))
}

function shiftMonth(y: number, m: number, delta: number): { y: number; m: number } {
  const idx = y * 12 + (m - 1) + delta
  return { y: Math.floor(idx / 12), m: (idx % 12) + 1 }
}

function lastDayOfMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

function clampDay(y: number, m: number, d: number): number {
  return Math.min(d, lastDayOfMonth(y, m))
}

async function budapestBounds(
  startYmd: string,
  endExclusiveYmd: string
): Promise<{ startMs: number; endMs: number }> {
  const start = budapestDayRangeIso(startYmd)
  const end = budapestDayRangeIso(endExclusiveYmd)
  return {
    startMs: new Date(start.startIso).getTime(),
    endMs: new Date(end.startIso).getTime()
  }
}

function buildMonthOptions(nowYmd: string): TenantReportPeriodOption[] {
  const { y, m } = parseYmdParts(nowYmd)
  const opts: TenantReportPeriodOption[] = []
  for (let i = 0; i < MONTH_OPTIONS; i++) {
    const p = shiftMonth(y, m, -i)
    const value = `${p.y}-${String(p.m).padStart(2, '0')}`
    opts.push({ value, label: monthLabelHu(p.y, p.m) })
  }
  return opts
}

function buildYearOptions(nowYmd: string): TenantReportPeriodOption[] {
  const { y } = parseYmdParts(nowYmd)
  const opts: TenantReportPeriodOption[] = []
  for (let i = 0; i < YEAR_OPTIONS; i++) {
    const year = y - i
    opts.push({ value: String(year), label: String(year) })
  }
  return opts
}

export async function resolveTenantReportPeriod(
  input: TenantReportPeriodInput = {}
): Promise<ResolvedPeriod> {
  const nowYmd = budapestYmdNow()
  const { y: cy, m: cm, d: cd } = parseYmdParts(nowYmd)
  const monthOptions = buildMonthOptions(nowYmd)
  const yearOptions = buildYearOptions(nowYmd)
  const view: TenantReportView = input.view === 'year' ? 'year' : 'month'

  if (view === 'year') {
    const raw = (input.period ?? '').trim()
    const year = /^\d{4}$/.test(raw) ? Number(raw) : cy
    const clamped = Math.min(cy, Math.max(cy - (YEAR_OPTIONS - 1), year))
    const periodKey = String(clamped)
    const isPartial = clamped === cy
    const startYmd = `${clamped}-01-01`
    const endYmdInclusive = isPartial ? nowYmd : `${clamped}-12-31`
    const endExclusiveYmd = addDaysYmd(endYmdInclusive, 1)
    const { startMs, endMs } = await budapestBounds(startYmd, endExclusiveYmd)

    const prevStartYmd = `${clamped - 1}-01-01`
    let prevEndExclusiveYmd: string
    let compareLabel: string
    if (isPartial) {
      const { m, d } = parseYmdParts(nowYmd)
      const prevEndInclusive = `${clamped - 1}-${String(m).padStart(2, '0')}-${String(clampDay(clamped - 1, m, d)).padStart(2, '0')}`
      prevEndExclusiveYmd = addDaysYmd(prevEndInclusive, 1)
      compareLabel = 'előző év azonos napjáig'
    } else {
      prevEndExclusiveYmd = `${clamped}-01-01`
      compareLabel = 'előző évhez'
    }
    const prev = await budapestBounds(prevStartYmd, prevEndExclusiveYmd)

    return {
      view,
      periodKey,
      periodLabel: isPartial ? `${periodKey} · év napjáig` : periodKey,
      compareLabel,
      periodIsPartial: isPartial,
      startMs,
      endMs,
      prevStartMs: prev.startMs,
      prevEndMs: prev.endMs,
      startYmd,
      endYmdInclusive,
      endExclusiveYmd,
      monthOptions,
      yearOptions
    }
  }

  const raw = (input.period ?? '').trim()
  let y = cy
  let m = cm
  const match = /^(\d{4})-(\d{2})$/.exec(raw)
  if (match) {
    y = Number(match[1])
    m = Number(match[2])
  }
  const allowed = new Set(monthOptions.map((o) => o.value))
  let periodKey = `${y}-${String(m).padStart(2, '0')}`
  if (!allowed.has(periodKey)) {
    periodKey = `${cy}-${String(cm).padStart(2, '0')}`
    y = cy
    m = cm
  }

  const isPartial = y === cy && m === cm
  const startYmd = `${y}-${String(m).padStart(2, '0')}-01`
  const endYmdInclusive = isPartial
    ? nowYmd
    : `${y}-${String(m).padStart(2, '0')}-${String(lastDayOfMonth(y, m)).padStart(2, '0')}`
  const endExclusiveYmd = addDaysYmd(endYmdInclusive, 1)
  const { startMs, endMs } = await budapestBounds(startYmd, endExclusiveYmd)

  const prev = shiftMonth(y, m, -1)
  const prevStartYmd = `${prev.y}-${String(prev.m).padStart(2, '0')}-01`
  let prevEndExclusiveYmd: string
  let compareLabel: string
  if (isPartial) {
    const prevEndInclusive = `${prev.y}-${String(prev.m).padStart(2, '0')}-${String(clampDay(prev.y, prev.m, cd)).padStart(2, '0')}`
    prevEndExclusiveYmd = addDaysYmd(prevEndInclusive, 1)
    compareLabel = 'előző hónap azonos napjáig'
  } else {
    prevEndExclusiveYmd = startYmd
    compareLabel = 'előző hónaphoz'
  }
  const prevBounds = await budapestBounds(prevStartYmd, prevEndExclusiveYmd)

  return {
    view,
    periodKey,
    periodLabel: isPartial
      ? `${monthLabelHu(y, m)} · hó napjáig`
      : monthLabelHu(y, m),
    compareLabel,
    periodIsPartial: isPartial,
    startMs,
    endMs,
    prevStartMs: prevBounds.startMs,
    prevEndMs: prevBounds.endMs,
    startYmd,
    endYmdInclusive,
    endExclusiveYmd,
    monthOptions,
    yearOptions
  }
}

function formatFt(n: number): string {
  return `${Math.round(n).toLocaleString('hu-HU')} Ft`
}

function deltaHu(pct: number | null, compareLabel: string): string {
  if (pct == null) return ''
  if (pct === 0) return `ugyanannyi, mint az ${compareLabel}`
  if (pct > 0) return `${pct}%-kal több, mint az ${compareLabel}`
  return `${Math.abs(pct)}%-kal kevesebb, mint az ${compareLabel}`
}

function topCountMethods(
  counts: Map<string, number>,
  limit: number
): TenantReportMethodCount[] {
  const total = [...counts.values()].reduce((s, n) => s + n, 0)
  if (total <= 0) return []
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
  const top = sorted.slice(0, limit)
  const rest = sorted.slice(limit).reduce((s, [, n]) => s + n, 0)
  const rows: TenantReportMethodCount[] = top.map(([name, count]) => ({
    name,
    count,
    sharePct: Math.round((count / total) * 1000) / 10
  }))
  if (rest > 0) {
    rows.push({
      name: 'Egyéb',
      count: rest,
      sharePct: Math.round((rest / total) * 1000) / 10
    })
  }
  return rows
}

function topMoneyMethods(
  amounts: Map<string, { amount: number; count: number }>,
  limit: number
): TenantReportMethodMoney[] {
  const total = [...amounts.values()].reduce((s, v) => s + v.amount, 0)
  if (total <= 0) return []
  const sorted = [...amounts.entries()].sort(
    (a, b) => b[1].amount - a[1].amount
  )
  const top = sorted.slice(0, limit)
  const rest = sorted.slice(limit).reduce(
    (s, [, v]) => ({
      amount: s.amount + v.amount,
      count: s.count + v.count
    }),
    { amount: 0, count: 0 }
  )
  const rows: TenantReportMethodMoney[] = top.map(([name, v]) => ({
    name,
    amount: roundMoney(v.amount),
    count: v.count,
    sharePct: Math.round((v.amount / total) * 1000) / 10
  }))
  if (rest.amount > 0) {
    rows.push({
      name: 'Egyéb',
      amount: roundMoney(rest.amount),
      count: rest.count,
      sharePct: Math.round((rest.amount / total) * 1000) / 10
    })
  }
  return rows
}

type PageResult<T> = {
  data: T[] | null
  error: { message: string } | null
}

async function fetchAllPages<T>(
  label: string,
  page: (from: number, to: number) => PromiseLike<PageResult<T>>
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1
    const { data, error } = await page(from, to)
    if (error) {
      console.error(`tenant-report ${label}`, error.message)
      break
    }
    const rows = data ?? []
    out.push(...rows)
    if (rows.length < PAGE_SIZE) break
  }
  return out
}

function buildTrend(
  view: TenantReportView,
  period: ResolvedPeriod,
  orders: OrderRow[]
): TenantReportTrendPoint[] {
  if (view === 'year') {
    const year = Number(period.periodKey)
    const points: TenantReportTrendPoint[] = []
    for (let m = 1; m <= 12; m++) {
      const startYmd = `${year}-${String(m).padStart(2, '0')}-01`
      const next = shiftMonth(year, m, 1)
      const endExclusiveYmd = `${next.y}-${String(next.m).padStart(2, '0')}-01`
      const start = budapestDayRangeIso(startYmd)
      const end = budapestDayRangeIso(endExclusiveYmd)
      const startMs = Math.max(new Date(start.startIso).getTime(), period.startMs)
      const endMs = Math.min(new Date(end.startIso).getTime(), period.endMs)
      if (endMs <= startMs) {
        points.push({ weekStart: startYmd, label: `${m}.`, orders: 0, gmv: 0 })
        continue
      }
      let n = 0
      let gmv = 0
      for (const q of orders) {
        if (!inRange(q.ordered_at, startMs, endMs)) continue
        n += 1
        gmv = roundMoney(gmv + quoteGmv(q))
      }
      points.push({ weekStart: startYmd, label: `${m}.`, orders: n, gmv })
    }
    return points
  }

  // Month: BP hétfőktől, a hónapot metsző hetek
  const firstMonday = mondayOfWeek(period.startYmd)
  let cursor = firstMonday
  if (cursor > period.startYmd) {
    cursor = mondayOfWeek(period.startYmd, -1)
  }
  const points: TenantReportTrendPoint[] = []
  for (let i = 0; i < 6; i++) {
    const weekStart = addDaysYmd(cursor, i * 7)
    const weekEndExclusive = addDaysYmd(weekStart, 7)
    if (weekEndExclusive <= period.startYmd || weekStart > period.endYmdInclusive) {
      continue
    }
    const start = budapestDayRangeIso(weekStart)
    const end = budapestDayRangeIso(weekEndExclusive)
    const startMs = Math.max(new Date(start.startIso).getTime(), period.startMs)
    const endMs = Math.min(new Date(end.startIso).getTime(), period.endMs)
    let n = 0
    let gmv = 0
    for (const q of orders) {
      if (!inRange(q.ordered_at, startMs, endMs)) continue
      n += 1
      gmv = roundMoney(gmv + quoteGmv(q))
    }
    const [, mm, dd] = weekStart.split('-')
    points.push({
      weekStart,
      label: `${Number(mm)}.${dd}.`,
      orders: n,
      gmv
    })
  }
  return points
}

/**
 * Platform tenant Riport — megrendelés-felvétel + rögzített befizetés.
 * Nincs tenant-közi összehasonlítás. PostgREST page-elve (nincs 1000-es csonk).
 */
export async function getTenantReportMetrics(
  admin: SupabaseClient,
  tenantId: string,
  input: TenantReportPeriodInput = {}
): Promise<TenantReportMetrics> {
  const period = await resolveTenantReportPeriod(input)
  const now = Date.now()
  const start7 = now - 7 * MS_DAY
  const fetchStartIso = new Date(
    Math.min(period.prevStartMs, period.startMs)
  ).toISOString()
  const fetchEndIso = new Date(period.endMs).toISOString()
  const periodStartIso = new Date(period.startMs).toISOString()
  const periodEndIso = fetchEndIso

  const [
    { data: tenantRow },
    { data: selfEntitlements },
    { count: linkedPartners },
    { count: smsCount },
    { count: portalDraftsAlive }
  ] = await Promise.all([
    admin
      .from('tenants')
      .select('id, max_seats')
      .eq('id', tenantId)
      .maybeSingle(),
    admin
      .from('tenant_entitlements')
      .select('feature_key')
      .eq('tenant_id', tenantId)
      .in('feature_key', [
        LAPSZABASZAT_FEATURE,
        FOOTCOUNTER_FEATURE,
        JELENLET_FEATURE,
        QUOTE_READY_SMS_FEATURE,
        PDA_POS_FEATURE
      ]),
    admin
      .from('partner_profiles')
      .select('user_id', { count: 'exact', head: true })
      .eq('selected_tenant_id', tenantId),
    admin
      .from('sms_send_events')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .in('status', ['sent', 'delivered'])
      .gte('created_at', periodStartIso)
      .lt('created_at', periodEndIso),
    admin
      .from('quotes')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('source', 'portal')
      .is('portal_submitted_at', null)
      .eq('status', 'draft')
      .is('deleted_at', null)
      .is('archived_at', null)
  ])

  const entitled = new Set(
    (selfEntitlements ?? []).map((r) => r.feature_key as string)
  )
  const hasLapszabaszat = entitled.has(LAPSZABASZAT_FEATURE)
  const hasFootcounter = entitled.has(FOOTCOUNTER_FEATURE)
  const hasJelenlet = entitled.has(JELENLET_FEATURE)
  const hasSmsAddon = entitled.has(QUOTE_READY_SMS_FEATURE)
  const hasPdaPos = entitled.has(PDA_POS_FEATURE)

  // Intake: ordered_at kötelező; archived BENT (történelmi igazság); cancelled/deleted OUT
  const orderRows = await fetchAllPages<OrderRow>('orders', (from, to) =>
    admin
      .from('quotes')
      .select('source, ordered_at, final_total_gross, total_gross')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .not('order_number', 'is', null)
      .not('ordered_at', 'is', null)
      .neq('status', 'cancelled')
      .gte('ordered_at', fetchStartIso)
      .lt('ordered_at', fetchEndIso)
      .order('ordered_at', { ascending: true })
      .range(from, to)
  )

  const portalRows = await fetchAllPages<PortalSubmitRow>(
    'portal-submits',
    (from, to) =>
      admin
        .from('quotes')
        .select(
          'portal_submitted_at, order_number, status, preferred_payment_method_name'
        )
        .eq('tenant_id', tenantId)
        .eq('source', 'portal')
        .is('deleted_at', null)
        .not('portal_submitted_at', 'is', null)
        .gte('portal_submitted_at', fetchStartIso)
        .lt('portal_submitted_at', fetchEndIso)
        .order('portal_submitted_at', { ascending: true })
        .range(from, to)
  )

  const paymentRows = await fetchAllPages<PaymentRow>('payments', (from, to) =>
    admin
      .from('quote_payments')
      .select(
        'amount, payment_date, payment_method_name, quotes!inner(status, deleted_at)'
      )
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .neq('quotes.status', 'cancelled')
      .is('quotes.deleted_at', null)
      .gte('payment_date', fetchStartIso)
      .lt('payment_date', fetchEndIso)
      .order('payment_date', { ascending: true })
      .range(from, to)
  )

  const salesRows = await fetchAllPages<SalesRow>('sales', (from, to) =>
    admin
      .from('sales_orders')
      .select('total_gross, fulfilled_at, created_at, status')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .is('archived_at', null)
      .neq('status', 'cancelled')
      .or(
        `and(fulfilled_at.gte.${fetchStartIso},fulfilled_at.lt.${fetchEndIso}),and(fulfilled_at.is.null,created_at.gte.${fetchStartIso},created_at.lt.${fetchEndIso})`
      )
      .order('created_at', { ascending: true })
      .range(from, to)
  )

  let orders30d = 0
  let ordersPrev30d = 0
  let gmv30d = 0
  let gmvPrev30d = 0
  let gmvOpti30d = 0
  let gmvPortal30d = 0
  let lastOrderedAt: string | null = null

  for (const q of orderRows) {
    const g = quoteGmv(q)
    if (inRange(q.ordered_at, period.startMs, period.endMs)) {
      orders30d += 1
      gmv30d = roundMoney(gmv30d + g)
      if (q.source === 'portal') gmvPortal30d = roundMoney(gmvPortal30d + g)
      else gmvOpti30d = roundMoney(gmvOpti30d + g)
    } else if (inRange(q.ordered_at, period.prevStartMs, period.prevEndMs)) {
      ordersPrev30d += 1
      gmvPrev30d = roundMoney(gmvPrev30d + g)
    }
    if (
      !lastOrderedAt ||
      new Date(q.ordered_at).getTime() > new Date(lastOrderedAt).getTime()
    ) {
      lastOrderedAt = q.ordered_at
    }
  }

  if (!lastOrderedAt) {
    const { data: lastOrder } = await admin
      .from('quotes')
      .select('ordered_at')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .not('order_number', 'is', null)
      .not('ordered_at', 'is', null)
      .neq('status', 'cancelled')
      .order('ordered_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    lastOrderedAt = (lastOrder?.ordered_at as string | null) ?? null
  }

  const daysSinceLastOrder =
    lastOrderedAt == null
      ? null
      : Math.max(
          0,
          Math.floor((now - new Date(lastOrderedAt).getTime()) / MS_DAY)
        )

  let portalSubmits30d = 0
  let portalSubmitsPrev30d = 0
  let portalConvertedInPeriod = 0
  const preferredMap = new Map<string, number>()

  for (const row of portalRows) {
    const submitted = row.portal_submitted_at
    const inCurr = inRange(submitted, period.startMs, period.endMs)
    const inPrev = inRange(submitted, period.prevStartMs, period.prevEndMs)
    if (inCurr) {
      portalSubmits30d += 1
      const converted =
        Boolean(row.order_number) && row.status !== 'cancelled'
      if (converted) portalConvertedInPeriod += 1
      const name =
        row.preferred_payment_method_name?.trim() || 'Nincs megadva'
      preferredMap.set(name, (preferredMap.get(name) ?? 0) + 1)
    } else if (inPrev) {
      portalSubmitsPrev30d += 1
    }
  }

  const portalConversionPct =
    portalSubmits30d > 0
      ? Math.round((portalConvertedInPeriod / portalSubmits30d) * 1000) / 10
      : null

  let payments30d = 0
  let paymentsPrev30d = 0
  const collectedMap = new Map<string, { amount: number; count: number }>()
  for (const p of paymentRows) {
    const amount = Number(p.amount) || 0
    const d = p.payment_date
    if (inRange(d, period.startMs, period.endMs)) {
      payments30d = roundMoney(payments30d + amount)
      const name = p.payment_method_name?.trim() || 'Ismeretlen'
      const cur = collectedMap.get(name) ?? { amount: 0, count: 0 }
      cur.amount = roundMoney(cur.amount + amount)
      cur.count += 1
      collectedMap.set(name, cur)
    } else if (inRange(d, period.prevStartMs, period.prevEndMs)) {
      paymentsPrev30d = roundMoney(paymentsPrev30d + amount)
    }
  }

  const { getAuthUsersByIds } = await import('@/lib/platform/auth-users')
  const { data: memberships } = await admin
    .from('tenant_memberships')
    .select('user_id, status')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
  const memberIds = (memberships ?? []).map((m) => m.user_id as string)
  const authById = await getAuthUsersByIds(admin, memberIds)
  let activeSeats7d = 0
  for (const id of memberIds) {
    const last = authById.get(id)?.lastSignInAt
    if (last && new Date(last).getTime() >= start7) activeSeats7d += 1
  }

  const weekly = buildTrend(period.view, period, orderRows)

  let salesGmv30d = 0
  let salesOrders30d = 0
  for (const s of salesRows) {
    const when = s.fulfilled_at ?? s.created_at
    if (!inRange(when, period.startMs, period.endMs)) continue
    salesOrders30d += 1
    salesGmv30d = roundMoney(salesGmv30d + (Number(s.total_gross) || 0))
  }

  const ordersDeltaPct = deltaPct(orders30d, ordersPrev30d)
  const gmvDeltaPct = deltaPct(gmv30d, gmvPrev30d)
  const partnerGmvSharePct =
    gmv30d > 0 ? Math.round((gmvPortal30d / gmv30d) * 1000) / 10 : null

  const draftsAlive = portalDraftsAlive ?? 0
  const maxSeats =
    tenantRow?.max_seats === null || tenantRow?.max_seats === undefined
      ? null
      : Number(tenantRow.max_seats)

  const paymentPreferred = topCountMethods(preferredMap, TOP_METHODS)
  const paymentCollected = topMoneyMethods(collectedMap, TOP_METHODS)

  const primaryDelta =
    gmvDeltaPct != null ? gmvDeltaPct : ordersDeltaPct
  const deltaPart = deltaHu(primaryDelta, period.compareLabel)
  const verdictLine = !hasLapszabaszat
    ? 'Nincs lapszabászat — alább a közös és a bekapcsolt addonok.'
    : orders30d === 0 && gmv30d === 0
      ? `${period.periodLabel}: nem volt felvett lapszabás megrendelés.`
      : `${period.periodLabel}: ${orders30d} felvett megrendelés, ${formatFt(gmv30d)} felvett forgalom` +
        (deltaPart ? ` — ${deltaPart}.` : '.')

  let footTodayIn = 0
  let footTodayOut = 0
  let footMonthIn = 0
  let footDeviceCount = 0
  let footDevicesLive = 0
  let footLiveStatus: 'live' | 'idle' | 'offline' | 'none' = 'none'

  if (hasFootcounter) {
    const { getFootcounterLiveStatus } = await import(
      '@/lib/footcounter/queries'
    )
    const budapestYmd = budapestYmdNow()
    const todayRange = budapestDayRangeIso(budapestYmd)
    const periodRangeStart = budapestDayRangeIso(period.startYmd)
    const periodRangeEnd = budapestDayRangeIso(period.endYmdInclusive)
    const monthStartIso = periodRangeStart.startIso
    const monthEndIso = periodRangeEnd.endIso

    const [{ data: fcDevices, error: fcDevErr }, live] = await Promise.all([
      admin
        .from('footcounter_devices')
        .select('id, last_seen_at')
        .eq('tenant_id', tenantId),
      getFootcounterLiveStatus(admin, tenantId)
    ])
    if (fcDevErr) {
      console.error('tenant-report footcounter devices', fcDevErr.message)
    }
    footLiveStatus = live.status
    footDeviceCount = live.deviceCount
    const nowMs = Date.now()
    const deviceIds: string[] = []
    for (const d of fcDevices ?? []) {
      deviceIds.push(d.id as string)
      const at = d.last_seen_at as string | null
      if (at && nowMs - new Date(at).getTime() <= DEVICE_LIVE_MS) {
        footDevicesLive += 1
      }
    }

    if (deviceIds.length > 0) {
      const [
        { count: periodIn, error: periodInErr },
        { count: todayInCount, error: todayInErr },
        { count: todayOutCount, error: todayOutErr }
      ] = await Promise.all([
        admin
          .from('footcounter_crossings')
          .select('id', { count: 'exact', head: true })
          .in('device_id', deviceIds)
          .eq('direction', 'in')
          .gte('occurred_at', monthStartIso)
          .lt('occurred_at', monthEndIso),
        admin
          .from('footcounter_crossings')
          .select('id', { count: 'exact', head: true })
          .in('device_id', deviceIds)
          .eq('direction', 'in')
          .gte('occurred_at', todayRange.startIso)
          .lt('occurred_at', todayRange.endIso),
        admin
          .from('footcounter_crossings')
          .select('id', { count: 'exact', head: true })
          .in('device_id', deviceIds)
          .eq('direction', 'out')
          .gte('occurred_at', todayRange.startIso)
          .lt('occurred_at', todayRange.endIso)
      ])

      if (periodInErr) {
        console.error(
          'tenant-report footcounter period in',
          periodInErr.message
        )
      }
      if (todayInErr) {
        console.error('tenant-report footcounter today in', todayInErr.message)
      }
      if (todayOutErr) {
        console.error(
          'tenant-report footcounter today out',
          todayOutErr.message
        )
      }

      footMonthIn = periodIn ?? 0
      footTodayIn = todayInCount ?? 0
      footTodayOut = todayOutCount ?? 0
    }
  }

  let jelenletEmployeeCount = 0
  let jelenletAttendanceDaysMonth = 0
  let jelenletDeviceCount = 0
  let jelenletDevicesLive = 0

  if (hasJelenlet) {
    const [
      { count: empCount },
      { count: attCount },
      { data: jlDevices }
    ] = await Promise.all([
      admin
        .from('hr_employees')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('active', true)
        .is('archived_at', null),
      admin
        .from('hr_attendance_days')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gte('work_date', period.startYmd)
        .lte('work_date', period.endYmdInclusive),
      admin
        .from('jelenlet_devices')
        .select('last_seen_at')
        .eq('tenant_id', tenantId)
    ])
    jelenletEmployeeCount = empCount ?? 0
    jelenletAttendanceDaysMonth = attCount ?? 0
    jelenletDeviceCount = (jlDevices ?? []).length
    const nowMs = Date.now()
    for (const d of jlDevices ?? []) {
      const at = d.last_seen_at as string | null
      if (at && nowMs - new Date(at).getTime() <= DEVICE_LIVE_MS) {
        jelenletDevicesLive += 1
      }
    }
  }

  return {
    view: period.view,
    periodKey: period.periodKey,
    periodLabel: period.periodLabel,
    compareLabel: period.compareLabel,
    periodIsPartial: period.periodIsPartial,
    trendGranularity: period.view === 'year' ? 'month' : 'week',
    monthOptions: period.monthOptions,
    yearOptions: period.yearOptions,
    verdictLine,
    orders30d,
    ordersPrev30d,
    ordersDeltaPct,
    gmv30d,
    gmvPrev30d,
    gmvDeltaPct,
    portalSubmits30d,
    portalSubmitsPrev30d,
    portalDraftsAlive: draftsAlive,
    portalConversionPct,
    portalConvertedInPeriod,
    linkedPartners: linkedPartners ?? 0,
    payments30d,
    paymentsPrev30d,
    activeSeats7d,
    maxSeats,
    gmvOpti30d,
    gmvPortal30d,
    daysSinceLastOrder,
    lastOrderedAt,
    hasLapszabaszat,
    partnerGmvSharePct,
    weekly,
    paymentPreferred,
    paymentCollected,
    hasFootcounter,
    hasJelenlet,
    hasSmsAddon,
    hasPdaPos,
    smsSentThisMonth: smsCount ?? 0,
    salesGmv30d,
    salesOrders30d,
    footTodayIn,
    footTodayOut,
    footMonthIn,
    footDeviceCount,
    footDevicesLive,
    footLiveStatus,
    jelenletEmployeeCount,
    jelenletAttendanceDaysMonth,
    jelenletDeviceCount,
    jelenletDevicesLive
  }
}
