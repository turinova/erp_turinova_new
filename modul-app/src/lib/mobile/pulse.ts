import type { SupabaseClient } from '@supabase/supabase-js'

import {
  addDaysYmd,
  budapestDayRangeIso,
  budapestTodayYmd,
  mondayOfWeek
} from '@/lib/home/date'
import { priorMonthRangeLabel, priorMonthRangeYmd } from '@/lib/home/kpi-queries'
import { daysInMonth } from '@/lib/jelenlet/hours'
import { isWorkdayYmd, lateCutoffYmd, loadWorkCalendar } from '@/lib/orders/late-cutoff'
import { getSchedulerKpis } from '@/lib/orders/scheduler-kpi-queries'

/**
 * Vezetői mobil — Kezdőlap és részletezők. A definíciók a webes kezdőlappal egyeznek:
 * megrendelés = quotes + order_number, nem cancelled, ordered_at napja, archiváltak is;
 * elmaradás = lateCutoffYmd (munkanaptár), archiváltak nélkül.
 */

export type MobilePeriod = 'ma' | 'het' | 'honap'

export function parseMobilePeriod(raw: string | null): MobilePeriod {
  return raw === 'het' || raw === 'honap' ? raw : 'ma'
}

export type MoneyCount = { gross: number; count: number }

export type RendeltSummary = {
  gross: number
  count: number
  /** null = nincs összevetési alap (pl. 4 hétig nem volt nyitva ilyen napon). */
  compare: MoneyCount | null
  /** „a szokásos csütörtökhöz képest” / „a múlt hét ugyanezen szakaszához képest” / „okt. 1–26.-hoz képest” */
  compareLabel: string
  /** Részletező magyarázathoz: „az előző 4 csütörtök átlaga, ugyanennyi óráig”. */
  compareDetail: string
}

export type AjanlatokSummary = {
  total: number
  staff: MoneyCount
  partner: MoneyCount
}

export type SzabasSummary = { usedM: number; limitM: number; pct: number; orderCount: number }

export type ElmaradasSummary = { count: number; notStarted: number; meters: number; cutoffYmd: string }

export type MobilePulse = {
  generatedAt: string
  period: MobilePeriod
  lapszabaszat: {
    rendelt: RendeltSummary
    ajanlatok: AjanlatokSummary
    szabas: SzabasSummary | null
    elmaradas: ElmaradasSummary
  } | null
}

// --- idő ablakok --------------------------------------------------------

const WEEKDAY_ALLATIVE = ['vasárnaphoz', 'hétfőhöz', 'keddhez', 'szerdához', 'csütörtökhöz', 'péntekhez', 'szombathoz']
const WEEKDAY_PLURAL = ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat']
const WEEKDAY_SHORT = ['V', 'H', 'K', 'Sze', 'Cs', 'P', 'Szo']

function dayStartMs(ymd: string): number {
  return Date.parse(budapestDayRangeIso(ymd).startIso)
}

function weekdayOf(ymd: string): number {
  return new Date(`${ymd}T12:00:00Z`).getUTCDay()
}

const hourFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Budapest',
  hour: '2-digit',
  hourCycle: 'h23'
})

function budapestHourOf(ms: number): number {
  return Number(hourFmt.format(new Date(ms)))
}

type Window = { start: number; end: number }

type PeriodWindows = {
  current: Window
  /** Ma: 4 korábbi azonos hétnap; Hét / Hónap: egy ablak. */
  compare: { days: string[]; windows: Window[]; label: string; detail: string }
}

function periodWindows(period: MobilePeriod, today: string, now: number): PeriodWindows {
  const todayStart = dayStartMs(today)
  if (period === 'ma') {
    const elapsed = now - todayStart
    const days = [7, 14, 21, 28].map((n) => addDaysYmd(today, -n))
    const wd = weekdayOf(today)
    return {
      current: { start: todayStart, end: now },
      compare: {
        days,
        windows: days.map((d) => ({ start: dayStartMs(d), end: dayStartMs(d) + elapsed })),
        label: `a szokásos ${WEEKDAY_ALLATIVE[wd]} képest`,
        detail: `Az előző 4 ${WEEKDAY_PLURAL[wd]} átlaga, ugyanennyi óráig (zárva tartó napok nélkül).`
      }
    }
  }
  if (period === 'het') {
    const monday = mondayOfWeek(today)
    const lastMonday = addDaysYmd(monday, -7)
    const start = dayStartMs(monday)
    return {
      current: { start, end: now },
      compare: {
        days: [lastMonday],
        windows: [{ start: dayStartMs(lastMonday), end: dayStartMs(lastMonday) + (now - start) }],
        label: 'a múlt hét ugyanezen szakaszához képest',
        detail: 'Múlt hét hétfőtől ugyanennyi napig és óráig.'
      }
    }
  }
  const monthStart = `${today.slice(0, 8)}01`
  const prior = priorMonthRangeYmd(today)
  const label = priorMonthRangeLabel(prior)
  return {
    current: { start: dayStartMs(monthStart), end: now },
    compare: {
      days: [prior.start],
      windows: [{ start: dayStartMs(prior.start), end: dayStartMs(addDaysYmd(prior.end, 1)) }],
      label: `${label}-hoz képest`,
      detail: `Az előző hónap azonos napjai (${label}), ahogy a webes kezdőlapon.`
    }
  }
}

// --- megrendelések ------------------------------------------------------

type OrderRow = { id: string; gross: number; at: number; portal: boolean }

const PAGE = 1000
const MAX_PAGES = 10
const IN_CHUNK = 150

async function fetchOrders(
  supabase: SupabaseClient,
  tenantId: string,
  fromMs: number,
  toMs: number
): Promise<OrderRow[]> {
  const out: OrderRow[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await supabase
      .from('quotes')
      .select('id, final_total_gross, total_gross, ordered_at, source')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .not('order_number', 'is', null)
      .neq('status', 'cancelled')
      .gte('ordered_at', new Date(fromMs).toISOString())
      .lt('ordered_at', new Date(toMs).toISOString())
      .order('ordered_at', { ascending: true })
      .range(page * PAGE, page * PAGE + PAGE - 1)
    if (error) throw new Error(`mobile orders: ${error.message}`)
    for (const r of data ?? []) {
      if (!r.ordered_at) continue
      out.push({
        id: r.id as string,
        gross: Number(r.final_total_gross ?? r.total_gross) || 0,
        at: Date.parse(r.ordered_at as string),
        portal: r.source === 'portal'
      })
    }
    if ((data ?? []).length < PAGE) break
  }
  return out
}

function inWindow(rows: OrderRow[], w: Window): OrderRow[] {
  return rows.filter((r) => r.at >= w.start && r.at < w.end)
}

function sumOf(rows: OrderRow[]): MoneyCount {
  return { gross: Math.round(rows.reduce((s, r) => s + r.gross, 0)), count: rows.length }
}

type RendeltData = {
  summary: RendeltSummary
  windows: PeriodWindows
  current: OrderRow[]
  /** Minden lekért sor (az összevetési időszak teljes napjai is). */
  all: OrderRow[]
  /** Ma: a felhasznált (nyitva tartó) összevetési napok. */
  compareDays: string[]
}

async function loadRendelt(
  supabase: SupabaseClient,
  tenantId: string,
  period: MobilePeriod
): Promise<RendeltData> {
  const today = budapestTodayYmd()
  const now = Date.now()
  const windows = periodWindows(period, today, now)
  const fetchFrom = Math.min(windows.current.start, ...windows.compare.windows.map((w) => w.start))
  const [rows, calendar] = await Promise.all([
    fetchOrders(supabase, tenantId, fetchFrom, now),
    period === 'ma'
      ? loadWorkCalendar(supabase, tenantId, addDaysYmd(today, -28), today)
      : Promise.resolve(new Map<string, string>())
  ])

  const current = inWindow(rows, windows.current)
  let compare: MoneyCount | null
  const compareDays: string[] = []

  if (period === 'ma') {
    const samples: MoneyCount[] = []
    windows.compare.days.forEach((ymd, i) => {
      const fullDay = inWindow(rows, { start: dayStartMs(ymd), end: dayStartMs(addDaysYmd(ymd, 1)) })
      const holiday = !isWorkdayYmd(ymd, calendar) && weekdayOf(ymd) !== 6 && weekdayOf(ymd) !== 0
      // Zárva: hétköznapi munkaszüneti nap, vagy egész nap egy rendelés sem jött.
      if (holiday || fullDay.length === 0) return
      samples.push(sumOf(inWindow(rows, windows.compare.windows[i]!)))
      compareDays.push(ymd)
    })
    compare = samples.length
      ? {
          gross: Math.round(samples.reduce((s, x) => s + x.gross, 0) / samples.length),
          count: Math.round((samples.reduce((s, x) => s + x.count, 0) / samples.length) * 10) / 10
        }
      : null
  } else {
    compare = sumOf(inWindow(rows, windows.compare.windows[0]!))
  }

  const cur = sumOf(current)
  return {
    summary: {
      gross: cur.gross,
      count: cur.count,
      compare,
      compareLabel: windows.compare.label,
      compareDetail: windows.compare.detail
    },
    windows,
    current,
    all: rows,
    compareDays
  }
}

// --- ajánlatok -----------------------------------------------------------

type QuoteRow = { at: number; gross: number; partner: string | null }

async function fetchQuotes(
  supabase: SupabaseClient,
  tenantId: string,
  w: Window
): Promise<{ staff: QuoteRow[]; partner: QuoteRow[] }> {
  const from = new Date(w.start).toISOString()
  const to = new Date(w.end).toISOString()
  const [staffRes, partnerRes] = await Promise.all([
    supabase
      .from('quotes')
      .select('final_total_gross, total_gross, created_at')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .or('source.is.null,source.neq.portal')
      .gte('created_at', from)
      .lt('created_at', to)
      .limit(5000),
    supabase
      .from('quotes')
      .select('final_total_gross, total_gross, portal_submitted_at, partner_profiles ( name ), customers ( name )')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .eq('source', 'portal')
      .gte('portal_submitted_at', from)
      .lt('portal_submitted_at', to)
      .limit(5000)
  ])
  if (staffRes.error) throw new Error(`mobile quotes staff: ${staffRes.error.message}`)
  if (partnerRes.error) throw new Error(`mobile quotes partner: ${partnerRes.error.message}`)

  const one = (v: unknown): { name?: string } | null =>
    (Array.isArray(v) ? v[0] : v) as { name?: string } | null

  return {
    staff: (staffRes.data ?? []).map((r) => ({
      at: Date.parse(r.created_at as string),
      gross: Number(r.final_total_gross ?? r.total_gross) || 0,
      partner: null
    })),
    partner: (partnerRes.data ?? []).map((r) => ({
      at: Date.parse(r.portal_submitted_at as string),
      gross: Number(r.final_total_gross ?? r.total_gross) || 0,
      partner:
        one(r.partner_profiles)?.name?.trim() || one(r.customers)?.name?.trim() || 'Partner'
    }))
  }
}

function quoteBucket(rows: QuoteRow[]): MoneyCount {
  return { gross: Math.round(rows.reduce((s, r) => s + r.gross, 0)), count: rows.length }
}

// --- szabás / elmaradás ---------------------------------------------------

async function sumCuttingMeters(supabase: SupabaseClient, quoteIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  for (let i = 0; i < quoteIds.length; i += IN_CHUNK) {
    const { data, error } = await supabase
      .from('quote_material_lines')
      .select('quote_id, cutting_length_m')
      .in('quote_id', quoteIds.slice(i, i + IN_CHUNK))
    if (error) {
      console.error('mobile cutting meters', error.message)
      continue
    }
    for (const r of data ?? []) {
      const id = r.quote_id as string
      map.set(id, (map.get(id) ?? 0) + (Number(r.cutting_length_m) || 0))
    }
  }
  return map
}

type LateRow = {
  id: string
  order_number: string | null
  status: string
  production_date: string
  customers: { name: string } | { name: string }[] | null
}

async function loadLate(supabase: SupabaseClient, tenantId: string) {
  const today = budapestTodayYmd()
  const cutoffYmd = await lateCutoffYmd(supabase, tenantId, today)
  const { data, error } = await supabase
    .from('quotes')
    .select('id, order_number, status, production_date, customers ( name )')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .is('archived_at', null)
    .not('order_number', 'is', null)
    .in('status', ['ordered', 'in_production'])
    .lt('production_date', cutoffYmd)
    .order('production_date', { ascending: true })
    .limit(1000)
  if (error) throw new Error(`mobile late: ${error.message}`)
  const rows = (data ?? []) as unknown as LateRow[]
  const meters = await sumCuttingMeters(
    supabase,
    rows.map((r) => r.id)
  )
  const summary: ElmaradasSummary = {
    count: rows.length,
    notStarted: rows.filter((r) => r.status === 'ordered').length,
    meters: Math.round([...meters.values()].reduce((s, m) => s + m, 0)),
    cutoffYmd
  }
  return { summary, rows, meters, today }
}

async function loadSzabas(supabase: SupabaseClient, tenantId: string): Promise<SzabasSummary | null> {
  const kpis = await getSchedulerKpis(supabase, tenantId)
  if (kpis.today.limitM <= 0) return null
  return {
    usedM: Math.round(kpis.today.cuttingM),
    limitM: Math.round(kpis.today.limitM),
    pct: Math.round(kpis.today.pct),
    orderCount: kpis.today.orderCount
  }
}

// --- Kezdőlap -------------------------------------------------------------

export async function getMobilePulse(
  supabase: SupabaseClient,
  tenantId: string,
  period: MobilePeriod,
  hasLapszab: boolean
): Promise<MobilePulse> {
  const generatedAt = new Date().toISOString()
  if (!hasLapszab) return { generatedAt, period, lapszabaszat: null }

  const rendelt = await loadRendelt(supabase, tenantId, period)
  const [quotes, szabas, late] = await Promise.all([
    fetchQuotes(supabase, tenantId, rendelt.windows.current),
    loadSzabas(supabase, tenantId),
    loadLate(supabase, tenantId)
  ])
  const staff = quoteBucket(quotes.staff)
  const partner = quoteBucket(quotes.partner)

  return {
    generatedAt,
    period,
    lapszabaszat: {
      rendelt: rendelt.summary,
      ajanlatok: { total: staff.count + partner.count, staff, partner },
      szabas,
      elmaradas: late.summary
    }
  }
}

// --- Részletezők ------------------------------------------------------------

export type SeriesPoint = {
  key: string
  label: string
  value: number | null
  compare: number | null
  highlight: boolean
}

type Bucket = { key: string; label: string; start: number; end: number; highlight: boolean }

function buckets(period: MobilePeriod, today: string, now: number): Bucket[] {
  if (period === 'ma') {
    const nowHour = budapestHourOf(now)
    const startHour = 6
    const endHour = Math.max(19, nowHour)
    const day = dayStartMs(today)
    return Array.from({ length: endHour - startHour + 1 }, (_, i) => {
      const h = startHour + i
      // DST-napon 1 óra eltérés elfogadható.
      return {
        key: String(h),
        label: String(h),
        start: day + h * 3_600_000,
        end: day + (h + 1) * 3_600_000,
        highlight: h === nowHour
      }
    })
  }
  const days =
    period === 'het'
      ? Array.from({ length: 7 }, (_, i) => addDaysYmd(mondayOfWeek(today), i))
      : daysInMonth(Number(today.slice(0, 4)), Number(today.slice(5, 7)))
  return days.map((ymd) => ({
    key: ymd,
    label: period === 'het' ? WEEKDAY_SHORT[weekdayOf(ymd)]! : String(Number(ymd.slice(8, 10))),
    start: dayStartMs(ymd),
    end: dayStartMs(addDaysYmd(ymd, 1)),
    highlight: ymd === today
  }))
}

export type RendeltDetail = {
  generatedAt: string
  period: MobilePeriod
  summary: RendeltSummary
  /** Ma: halmozott Ft óránként; Hét / Hónap: napi Ft. */
  series: SeriesPoint[]
  seriesKind: 'cumulative_hourly' | 'daily'
  split: { portal: MoneyCount; staff: MoneyCount }
  topMaterials: { name: string; boards: number; gross: number }[]
}

async function topMaterials(supabase: SupabaseClient, quoteIds: string[]) {
  const byName = new Map<string, { name: string; boards: number; gross: number }>()
  for (let i = 0; i < quoteIds.length; i += IN_CHUNK) {
    const { data, error } = await supabase
      .from('quote_material_lines')
      .select('material_name, boards_charged, total_gross')
      .in('quote_id', quoteIds.slice(i, i + IN_CHUNK))
    if (error) {
      console.error('mobile topMaterials', error.message)
      return []
    }
    for (const r of data ?? []) {
      const name = String(r.material_name ?? '').trim() || 'Ismeretlen anyag'
      const cur = byName.get(name) ?? { name, boards: 0, gross: 0 }
      cur.boards += Number(r.boards_charged) || 0
      cur.gross += Number(r.total_gross) || 0
      byName.set(name, cur)
    }
  }
  return [...byName.values()]
    .filter((m) => m.boards > 0)
    .sort((a, b) => b.boards - a.boards || b.gross - a.gross)
    .slice(0, 5)
    .map((m) => ({ ...m, gross: Math.round(m.gross) }))
}

export async function getMobileRendeltDetail(
  supabase: SupabaseClient,
  tenantId: string,
  period: MobilePeriod
): Promise<RendeltDetail> {
  const today = budapestTodayYmd()
  const now = Date.now()
  const data = await loadRendelt(supabase, tenantId, period)
  const bs = buckets(period, today, now)
  const grossIn = (start: number, end: number) =>
    data.all.filter((r) => r.at >= start && r.at < end).reduce((s, r) => s + r.gross, 0)

  let series: SeriesPoint[]
  if (period === 'ma') {
    // Halmozott: a mai görbe mostanáig; összevetés = a nyitva tartó korábbi azonos napok átlaga, egész nap.
    const todayStart = dayStartMs(today)
    const dayStarts = data.compareDays.map(dayStartMs)
    let cum = 0
    let compareCum = 0
    series = bs.map((b) => {
      cum += grossIn(b.start, b.end)
      for (const ds of dayStarts) compareCum += grossIn(b.start - todayStart + ds, b.end - todayStart + ds)
      return {
        key: b.key,
        label: b.label,
        value: b.start <= now ? Math.round(cum) : null,
        compare: dayStarts.length ? Math.round(compareCum / dayStarts.length) : null,
        highlight: b.highlight
      }
    })
  } else {
    const prior = priorMonthRangeYmd(today)
    const priorDays = daysInMonth(Number(prior.start.slice(0, 4)), Number(prior.start.slice(5, 7)))
    series = bs.map((b, i) => {
      // Összevetés: múlt hét azonos napja / előző hónap azonos sorszámú napja, egész nap.
      const prevYmd = period === 'het' ? addDaysYmd(b.key, -7) : priorDays[i]
      return {
        key: b.key,
        label: b.label,
        value: b.start <= now ? Math.round(grossIn(b.start, b.end)) : null,
        compare: prevYmd ? Math.round(grossIn(dayStartMs(prevYmd), dayStartMs(addDaysYmd(prevYmd, 1)))) : null,
        highlight: b.highlight
      }
    })
  }

  const portal = sumOf(data.current.filter((r) => r.portal))
  const staff = sumOf(data.current.filter((r) => !r.portal))

  return {
    generatedAt: new Date().toISOString(),
    period,
    summary: data.summary,
    series,
    seriesKind: period === 'ma' ? 'cumulative_hourly' : 'daily',
    split: { portal, staff },
    topMaterials: await topMaterials(
      supabase,
      data.current.map((r) => r.id)
    )
  }
}

export type AjanlatokDetail = {
  generatedAt: string
  period: MobilePeriod
  summary: AjanlatokSummary
  /** Darabszám bucketenként (óra / nap): saját + partner. */
  series: { key: string; label: string; staff: number | null; partner: number | null; highlight: boolean }[]
  topPartners: { name: string; count: number; gross: number }[]
}

export async function getMobileAjanlatokDetail(
  supabase: SupabaseClient,
  tenantId: string,
  period: MobilePeriod
): Promise<AjanlatokDetail> {
  const today = budapestTodayYmd()
  const now = Date.now()
  const w = periodWindows(period, today, now).current
  const q = await fetchQuotes(supabase, tenantId, w)
  const staff = quoteBucket(q.staff)
  const partner = quoteBucket(q.partner)
  const count = (rows: QuoteRow[], b: Bucket) => rows.filter((r) => r.at >= b.start && r.at < b.end).length

  const byPartner = new Map<string, { name: string; count: number; gross: number }>()
  for (const r of q.partner) {
    const name = r.partner ?? 'Partner'
    const cur = byPartner.get(name) ?? { name, count: 0, gross: 0 }
    cur.count += 1
    cur.gross += r.gross
    byPartner.set(name, cur)
  }

  return {
    generatedAt: new Date().toISOString(),
    period,
    summary: { total: staff.count + partner.count, staff, partner },
    series: buckets(period, today, now).map((b) => ({
      key: b.key,
      label: b.label,
      staff: b.start <= now ? count(q.staff, b) : null,
      partner: b.start <= now ? count(q.partner, b) : null,
      highlight: b.highlight
    })),
    topPartners: [...byPartner.values()]
      .sort((a, b) => b.count - a.count || b.gross - a.gross)
      .slice(0, 5)
      .map((p) => ({ ...p, gross: Math.round(p.gross) }))
  }
}

export type SzabasDetail = {
  generatedAt: string
  today: SzabasSummary | null
  byMachine: { id: string; name: string; usedM: number; limitM: number; pct: number }[]
  /** Következő 5 munkanap beosztott szabása. */
  nextDays: { ymd: string; label: string; usedM: number; limitM: number; orderCount: number }[]
}

export async function getMobileSzabasDetail(
  supabase: SupabaseClient,
  tenantId: string
): Promise<SzabasDetail> {
  const today = budapestTodayYmd()
  const [kpis, calendar] = await Promise.all([
    getSchedulerKpis(supabase, tenantId),
    loadWorkCalendar(supabase, tenantId, addDaysYmd(today, 1), addDaysYmd(today, 30))
  ])

  const nextYmds: string[] = []
  for (let d = addDaysYmd(today, 1); nextYmds.length < 5 && d <= addDaysYmd(today, 30); d = addDaysYmd(d, 1)) {
    if (isWorkdayYmd(d, calendar)) nextYmds.push(d)
  }

  const { data, error } = nextYmds.length
    ? await supabase
        .from('quotes')
        .select('id, production_date')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .is('archived_at', null)
        .not('order_number', 'is', null)
        .in('status', ['ordered', 'in_production'])
        .in('production_date', nextYmds)
    : { data: [], error: null }
  if (error) console.error('mobile szabas next', error.message)
  const rows = (data ?? []) as { id: string; production_date: string }[]
  const meters = await sumCuttingMeters(
    supabase,
    rows.map((r) => r.id)
  )
  const limitM = Math.round(kpis.today.limitM)

  const fmt = new Intl.DateTimeFormat('hu-HU', { month: 'numeric', day: 'numeric', timeZone: 'UTC' })
  return {
    generatedAt: new Date().toISOString(),
    today:
      kpis.today.limitM > 0
        ? {
            usedM: Math.round(kpis.today.cuttingM),
            limitM,
            pct: Math.round(kpis.today.pct),
            orderCount: kpis.today.orderCount
          }
        : null,
    byMachine: kpis.today.byMachine.map((m) => ({
      id: m.id,
      name: m.name,
      usedM: Math.round(m.cuttingM),
      limitM: Math.round(m.limitM),
      pct: Math.round(m.pct)
    })),
    nextDays: nextYmds.map((ymd) => {
      const dayRows = rows.filter((r) => String(r.production_date).slice(0, 10) === ymd)
      return {
        ymd,
        label: `${WEEKDAY_SHORT[weekdayOf(ymd)]} ${fmt.format(new Date(`${ymd}T12:00:00Z`))}`,
        usedM: Math.round(dayRows.reduce((s, r) => s + (meters.get(r.id) ?? 0), 0)),
        limitM,
        orderCount: dayRows.length
      }
    })
  }
}

export type ElmaradasDetail = {
  generatedAt: string
  summary: ElmaradasSummary
  rows: {
    id: string
    orderNumber: string
    customerName: string
    productionDate: string
    daysLate: number
    notStarted: boolean
    meters: number
  }[]
  webPath: string
}

export async function getMobileElmaradasDetail(
  supabase: SupabaseClient,
  tenantId: string
): Promise<ElmaradasDetail> {
  const late = await loadLate(supabase, tenantId)
  const todayMs = Date.parse(`${late.today}T12:00:00Z`)
  return {
    generatedAt: new Date().toISOString(),
    summary: late.summary,
    rows: late.rows.slice(0, 10).map((r) => {
      const c = Array.isArray(r.customers) ? r.customers[0] : r.customers
      const ymd = String(r.production_date).slice(0, 10)
      return {
        id: r.id,
        orderNumber: r.order_number ?? '—',
        customerName: c?.name?.trim() || '—',
        productionDate: ymd,
        daysLate: Math.round((todayMs - Date.parse(`${ymd}T12:00:00Z`)) / 86_400_000),
        notStarted: r.status === 'ordered',
        meters: Math.round(late.meters.get(r.id) ?? 0)
      }
    }),
    webPath: '/megrendelesek?focus=late'
  }
}
