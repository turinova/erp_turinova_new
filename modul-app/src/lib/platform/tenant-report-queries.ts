import type { SupabaseClient } from '@supabase/supabase-js'

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
  /** „előző hónaphoz” / „előző évhez” */
  compareLabel: string
  trendGranularity: 'week' | 'month'
  monthOptions: TenantReportPeriodOption[]
  yearOptions: TenantReportPeriodOption[]
  /** Hero ítélet — emberi mondat */
  verdictLine: string
  /** Megrendelések a kiválasztott időszakban (mezőnév legacy) */
  orders30d: number
  ordersPrev30d: number
  ordersDeltaPct: number | null
  gmv30d: number
  gmvPrev30d: number
  gmvDeltaPct: number | null
  portalSubmits30d: number
  portalSubmitsPrev30d: number
  /** Élő félkész portal ajánlat (még nem küldte be) */
  portalDraftsAlive: number
  /**
   * Beküldési arány: beküldött / (beküldött + élő félkész).
   * null ha mindkettő 0.
   */
  portalSubmitRatePct: number | null
  linkedPartners: number
  payments30d: number
  paymentsPrev30d: number
  activeSeats7d: number
  maxSeats: number | null
  gmvOpti30d: number
  gmvPortal30d: number
  daysSinceLastOrder: number | null
  lastOrderedAt: string | null
  /** Van-e lapszabászat entitlement ezen a tenanton */
  hasLapszabaszat: boolean
  partnerGmvSharePct: number | null
  weekly: TenantReportTrendPoint[]
  /** Partner beküldéskor választott mód */
  paymentPreferred: TenantReportMethodCount[]
  /** Tényleges befizetés módja */
  paymentCollected: TenantReportMethodMoney[]
  /** Addon szekciók */
  hasFootcounter: boolean
  hasJelenlet: boolean
  hasSmsAddon: boolean
  hasPdaPos: boolean
  smsSentThisMonth: number
  salesGmv30d: number
  salesOrders30d: number
  /** Belépőszámláló */
  footTodayIn: number
  footTodayOut: number
  footMonthIn: number
  footDeviceCount: number
  footDevicesLive: number
  footLiveStatus: 'live' | 'idle' | 'offline' | 'none'
  /** Jelenlét */
  jelenletEmployeeCount: number
  jelenletAttendanceDaysMonth: number
  jelenletDeviceCount: number
  jelenletDevicesLive: number
}

type QuoteRow = {
  id: string
  tenant_id: string
  source: string | null
  order_number: string | null
  ordered_at: string | null
  created_at: string
  portal_submitted_at: string | null
  preferred_payment_method_name: string | null
  final_total_gross: number | null
  total_gross: number | null
  status: string | null
}

type ResolvedPeriod = {
  view: TenantReportView
  periodKey: string
  periodLabel: string
  compareLabel: string
  startMs: number
  endMs: number
  prevStartMs: number
  prevEndMs: number
  startYmd: string
  endYmdInclusive: string
  monthOptions: TenantReportPeriodOption[]
  yearOptions: TenantReportPeriodOption[]
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

function quoteGmv(q: Pick<QuoteRow, 'final_total_gross' | 'total_gross'>): number {
  return roundMoney(Number(q.final_total_gross ?? q.total_gross) || 0)
}

function deltaPct(curr: number, prev: number): number | null {
  if (prev === 0) return curr === 0 ? 0 : null
  return Math.round(((curr - prev) / prev) * 1000) / 10
}

function orderedAtIso(q: QuoteRow): string | null {
  if (!q.order_number) return null
  return q.ordered_at ?? q.created_at
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

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
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

async function budapestBounds(
  startYmd: string,
  endExclusiveYmd: string
): Promise<{ startMs: number; endMs: number }> {
  const { budapestDayRangeIso } = await import('@/lib/home/date')
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
    const startYmd = `${clamped}-01-01`
    const endExclusiveYmd = `${clamped + 1}-01-01`
    const endYmdInclusive =
      clamped === cy
        ? nowYmd
        : `${clamped}-12-31`
    const { startMs, endMs } = await budapestBounds(startYmd, endExclusiveYmd)
    const prevStartYmd = `${clamped - 1}-01-01`
    const prevEndExclusive = `${clamped}-01-01`
    const prev = await budapestBounds(prevStartYmd, prevEndExclusive)
    return {
      view,
      periodKey,
      periodLabel: periodKey,
      compareLabel: 'előző évhez',
      startMs,
      endMs,
      prevStartMs: prev.startMs,
      prevEndMs: prev.endMs,
      startYmd,
      endYmdInclusive,
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

  const next = shiftMonth(y, m, 1)
  const startYmd = `${y}-${String(m).padStart(2, '0')}-01`
  const endExclusiveYmd = `${next.y}-${String(next.m).padStart(2, '0')}-01`
  const isCurrent = y === cy && m === cm
  const endYmdInclusive = isCurrent
    ? nowYmd
    : `${y}-${String(m).padStart(2, '0')}-${String(lastDayOfMonth(y, m)).padStart(2, '0')}`

  const { startMs, endMs } = await budapestBounds(startYmd, endExclusiveYmd)
  const prev = shiftMonth(y, m, -1)
  const prevStartYmd = `${prev.y}-${String(prev.m).padStart(2, '0')}-01`
  const prevEndExclusive = startYmd
  const prevBounds = await budapestBounds(prevStartYmd, prevEndExclusive)

  void cd
  return {
    view,
    periodKey,
    periodLabel: monthLabelHu(y, m),
    compareLabel: 'előző hónaphoz',
    startMs,
    endMs,
    prevStartMs: prevBounds.startMs,
    prevEndMs: prevBounds.endMs,
    startYmd,
    endYmdInclusive,
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

function mondayUtc(d: Date): Date {
  const x = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  )
  const day = x.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  x.setUTCDate(x.getUTCDate() + diff)
  x.setUTCHours(0, 0, 0, 0)
  return x
}

function buildTrend(
  view: TenantReportView,
  period: ResolvedPeriod,
  quoteRows: QuoteRow[]
): TenantReportTrendPoint[] {
  if (view === 'year') {
    const year = Number(period.periodKey)
    const points: TenantReportTrendPoint[] = []
    for (let m = 1; m <= 12; m++) {
      const start = new Date(Date.UTC(year, m - 1, 1))
      const end = new Date(Date.UTC(year, m, 1))
      const startMs = start.getTime()
      const endMs = end.getTime()
      // Prefer Budapest bounds for month edges when available via period window
      // Approximate with UTC month for chart buckets — OK for year overview.
      let orders = 0
      let gmv = 0
      for (const q of quoteRows) {
        if (q.status === 'cancelled') continue
        const oa = orderedAtIso(q)
        if (!inRange(oa, Math.max(startMs, period.startMs), Math.min(endMs, period.endMs))) {
          continue
        }
        orders += 1
        gmv = roundMoney(gmv + quoteGmv(q))
      }
      points.push({
        weekStart: ymd(start),
        label: `${m}.`,
        orders,
        gmv
      })
    }
    return points
  }

  // Month view: weeks intersecting the selected month
  const firstMonday = mondayUtc(new Date(period.startMs))
  // If monday is after period start (rare with UTC vs BP), still walk from week containing start
  let cursor = firstMonday
  if (cursor.getTime() > period.startMs) {
    cursor = new Date(cursor)
    cursor.setUTCDate(cursor.getUTCDate() - 7)
  }
  const points: TenantReportTrendPoint[] = []
  for (let i = 0; i < 6; i++) {
    const ws = new Date(cursor)
    ws.setUTCDate(ws.getUTCDate() + i * 7)
    const we = new Date(ws)
    we.setUTCDate(we.getUTCDate() + 7)
    const startMs = ws.getTime()
    const endMs = we.getTime()
    if (endMs <= period.startMs || startMs >= period.endMs) continue
    let orders = 0
    let gmv = 0
    for (const q of quoteRows) {
      if (q.status === 'cancelled') continue
      const oa = orderedAtIso(q)
      if (!inRange(oa, Math.max(startMs, period.startMs), Math.min(endMs, period.endMs))) {
        continue
      }
      orders += 1
      gmv = roundMoney(gmv + quoteGmv(q))
    }
    points.push({
      weekStart: ymd(ws),
      label: `${ws.getUTCMonth() + 1}.${String(ws.getUTCDate()).padStart(2, '0')}.`,
      orders,
      gmv
    })
  }
  return points
}

/**
 * Platform tenant Riport — raw számok, emberi fogalmazáshoz.
 * Nincs tenant-közi összehasonlítás.
 */
export async function getTenantReportMetrics(
  admin: SupabaseClient,
  tenantId: string,
  input: TenantReportPeriodInput = {}
): Promise<TenantReportMetrics> {
  const period = await resolveTenantReportPeriod(input)
  const now = Date.now()
  const start7 = now - 7 * MS_DAY
  const fetchStartMs = Math.min(period.prevStartMs, period.startMs)
  const fetchSinceIso = new Date(fetchStartMs).toISOString()
  const periodStartIso = new Date(period.startMs).toISOString()
  const periodEndIso = new Date(period.endMs).toISOString()

  const [
    { data: tenantRow },
    { data: selfEntitlements },
    { data: quotes },
    { data: memberships },
    { count: linkedPartners },
    { data: payments },
    { count: smsCount },
    { data: salesRows },
    { count: portalDraftsAlive },
    { data: preferredRows }
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
      .from('quotes')
      .select(
        'id, tenant_id, source, order_number, ordered_at, created_at, portal_submitted_at, preferred_payment_method_name, final_total_gross, total_gross, status'
      )
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .is('archived_at', null)
      .or(
        `created_at.gte.${fetchSinceIso},ordered_at.gte.${fetchSinceIso},portal_submitted_at.gte.${fetchSinceIso}`
      ),
    admin
      .from('tenant_memberships')
      .select('user_id, status')
      .eq('tenant_id', tenantId)
      .eq('status', 'active'),
    admin
      .from('partner_profiles')
      .select('user_id', { count: 'exact', head: true })
      .eq('selected_tenant_id', tenantId),
    admin
      .from('quote_payments')
      .select('amount, payment_date, payment_method_name')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .gte('payment_date', fetchSinceIso)
      .lt('payment_date', periodEndIso),
    admin
      .from('sms_send_events')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .in('status', ['sent', 'delivered'])
      .gte('created_at', periodStartIso)
      .lt('created_at', periodEndIso),
    admin
      .from('sales_orders')
      .select('total_gross, fulfilled_at, created_at, status')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .is('archived_at', null)
      .neq('status', 'cancelled')
      .gte('created_at', fetchSinceIso)
      .lt('created_at', periodEndIso),
    admin
      .from('quotes')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('source', 'portal')
      .is('portal_submitted_at', null)
      .eq('status', 'draft')
      .is('deleted_at', null)
      .is('archived_at', null),
    admin
      .from('quotes')
      .select('preferred_payment_method_name, portal_submitted_at')
      .eq('tenant_id', tenantId)
      .eq('source', 'portal')
      .not('portal_submitted_at', 'is', null)
      .is('deleted_at', null)
      .is('archived_at', null)
      .gte('portal_submitted_at', periodStartIso)
      .lt('portal_submitted_at', periodEndIso)
  ])

  const quoteRows = (quotes ?? []) as QuoteRow[]
  const entitled = new Set(
    (selfEntitlements ?? []).map((r) => r.feature_key as string)
  )
  const hasLapszabaszat = entitled.has(LAPSZABASZAT_FEATURE)
  const hasFootcounter = entitled.has(FOOTCOUNTER_FEATURE)
  const hasJelenlet = entitled.has(JELENLET_FEATURE)
  const hasSmsAddon = entitled.has(QUOTE_READY_SMS_FEATURE)
  const hasPdaPos = entitled.has(PDA_POS_FEATURE)

  let orders30d = 0
  let ordersPrev30d = 0
  let gmv30d = 0
  let gmvPrev30d = 0
  let gmvOpti30d = 0
  let gmvPortal30d = 0
  let portalSubmits30d = 0
  let portalSubmitsPrev30d = 0
  let lastOrderedAt: string | null = null

  for (const q of quoteRows) {
    if (q.status === 'cancelled') continue
    const oa = orderedAtIso(q)
    if (oa) {
      const g = quoteGmv(q)
      if (inRange(oa, period.startMs, period.endMs)) {
        orders30d += 1
        gmv30d = roundMoney(gmv30d + g)
        if (q.source === 'portal') gmvPortal30d = roundMoney(gmvPortal30d + g)
        else gmvOpti30d = roundMoney(gmvOpti30d + g)
      } else if (inRange(oa, period.prevStartMs, period.prevEndMs)) {
        ordersPrev30d += 1
        gmvPrev30d = roundMoney(gmvPrev30d + g)
      }
      if (
        !lastOrderedAt ||
        new Date(oa).getTime() > new Date(lastOrderedAt).getTime()
      ) {
        lastOrderedAt = oa
      }
    }
    if (q.source === 'portal' && q.portal_submitted_at) {
      if (inRange(q.portal_submitted_at, period.startMs, period.endMs)) {
        portalSubmits30d += 1
      } else if (
        inRange(q.portal_submitted_at, period.prevStartMs, period.prevEndMs)
      ) {
        portalSubmitsPrev30d += 1
      }
    }
  }

  if (!lastOrderedAt) {
    const { data: lastOrder } = await admin
      .from('quotes')
      .select('ordered_at, created_at, order_number')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .is('archived_at', null)
      .not('order_number', 'is', null)
      .neq('status', 'cancelled')
      .order('ordered_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()
    if (lastOrder) {
      lastOrderedAt =
        (lastOrder.ordered_at as string | null) ??
        (lastOrder.created_at as string)
    }
  }

  const daysSinceLastOrder =
    lastOrderedAt == null
      ? null
      : Math.max(
          0,
          Math.floor((now - new Date(lastOrderedAt).getTime()) / MS_DAY)
        )

  let payments30d = 0
  let paymentsPrev30d = 0
  const collectedMap = new Map<string, { amount: number; count: number }>()
  for (const p of payments ?? []) {
    const amount = Number(p.amount) || 0
    const d = p.payment_date as string
    if (inRange(d, period.startMs, period.endMs)) {
      payments30d = roundMoney(payments30d + amount)
      const name =
        (p.payment_method_name as string | null)?.trim() || 'Ismeretlen'
      const cur = collectedMap.get(name) ?? { amount: 0, count: 0 }
      cur.amount = roundMoney(cur.amount + amount)
      cur.count += 1
      collectedMap.set(name, cur)
    } else if (inRange(d, period.prevStartMs, period.prevEndMs)) {
      paymentsPrev30d = roundMoney(paymentsPrev30d + amount)
    }
  }

  const preferredMap = new Map<string, number>()
  for (const row of preferredRows ?? []) {
    const name =
      (row.preferred_payment_method_name as string | null)?.trim() ||
      'Nincs megadva'
    preferredMap.set(name, (preferredMap.get(name) ?? 0) + 1)
  }

  const { getAuthUsersByIds } = await import('@/lib/platform/auth-users')
  const memberIds = (memberships ?? []).map((m) => m.user_id as string)
  const authById = await getAuthUsersByIds(admin, memberIds)
  let activeSeats7d = 0
  for (const id of memberIds) {
    const last = authById.get(id)?.lastSignInAt
    if (last && new Date(last).getTime() >= start7) activeSeats7d += 1
  }

  const weekly = buildTrend(period.view, period, quoteRows)

  let salesGmv30d = 0
  let salesOrders30d = 0
  for (const s of salesRows ?? []) {
    const when =
      (s.fulfilled_at as string | null) ?? (s.created_at as string | null)
    if (!inRange(when, period.startMs, period.endMs)) continue
    salesOrders30d += 1
    salesGmv30d = roundMoney(salesGmv30d + (Number(s.total_gross) || 0))
  }

  const ordersDeltaPct = deltaPct(orders30d, ordersPrev30d)
  const gmvDeltaPct = deltaPct(gmv30d, gmvPrev30d)
  const partnerGmvSharePct =
    gmv30d > 0 ? Math.round((gmvPortal30d / gmv30d) * 1000) / 10 : null

  const draftsAlive = portalDraftsAlive ?? 0
  const submitDenom = portalSubmits30d + draftsAlive
  const portalSubmitRatePct =
    submitDenom > 0
      ? Math.round((portalSubmits30d / submitDenom) * 1000) / 10
      : null

  const maxSeats =
    tenantRow?.max_seats === null || tenantRow?.max_seats === undefined
      ? null
      : Number(tenantRow.max_seats)

  const paymentPreferred = topCountMethods(preferredMap, TOP_METHODS)
  const paymentCollected = topMoneyMethods(collectedMap, TOP_METHODS)

  const deltaPart = deltaHu(gmvDeltaPct || ordersDeltaPct, period.compareLabel)
  const verdictLine = !hasLapszabaszat
    ? 'Nincs lapszabászat — alább a közös és a bekapcsolt addonok.'
    : orders30d === 0 && gmv30d === 0
      ? `${period.periodLabel}: nem volt lapszabás megrendelés.`
      : `${period.periodLabel}: ${orders30d} lapszabás megrendelés, ${formatFt(gmv30d)} forgalom` +
        (deltaPart ? ` — ${deltaPart}.` : '.')

  let footTodayIn = 0
  let footTodayOut = 0
  let footMonthIn = 0
  let footDeviceCount = 0
  let footDevicesLive = 0
  let footLiveStatus: 'live' | 'idle' | 'offline' | 'none' = 'none'

  if (hasFootcounter) {
    const { budapestDayRangeIso } = await import('@/lib/home/date')
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
      const { data: crossings, error: crossErr } = await admin
        .from('footcounter_crossings')
        .select('direction, occurred_at')
        .in('device_id', deviceIds)
        .gte('occurred_at', monthStartIso)
        .lt('occurred_at', monthEndIso)
        .limit(100000)

      if (crossErr) {
        console.error('tenant-report footcounter crossings', crossErr.message)
      } else {
        const todayStart = new Date(todayRange.startIso).getTime()
        const todayEnd = new Date(todayRange.endIso).getTime()
        for (const row of crossings ?? []) {
          const t = new Date(row.occurred_at as string).getTime()
          const dir = row.direction as string
          if (dir === 'in') footMonthIn += 1
          if (t >= todayStart && t < todayEnd) {
            if (dir === 'in') footTodayIn += 1
            else if (dir === 'out') footTodayOut += 1
          }
        }
      }
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
    portalSubmitRatePct,
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
