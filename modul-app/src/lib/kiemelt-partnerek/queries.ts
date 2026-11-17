import type { SupabaseClient } from '@supabase/supabase-js'

import {
  addDaysYmd,
  budapestTodayYmd,
  budapestYear,
  MONTH_LABELS_HU,
  toBudapestYmdFromIso
} from '@/lib/home/date'
import { TREND_DOWN_THRESHOLD } from '@/lib/kiemelt-partnerek/copy'

const OPEN_STATUSES = new Set(['ordered', 'in_production', 'ready'])
const SILENT_DAYS = 30
const CUTTING_WINDOW_DAYS = 90
const SPARK_MONTHS = 12

export type KiemeltSort =
  | 'avg_monthly'
  | 'last_order'
  | 'cutting_90d'
  | 'name'

export type KiemeltActivity = 'all' | 'active' | 'silent' | 'down'

export type KiemeltSparkPoint = {
  key: string
  label: string
  gross: number
}

export type KiemeltPartnerCard = {
  id: string
  name: string
  avgMonthlyRevenue: number
  totalRevenue: number
  /** Előző teljes hónap vs azelőtti; null = nincs elég adat. */
  trendPct: number | null
  lastOrderYmd: string | null
  daysSinceLast: number | null
  openCount: number
  /** Csak rendezéshez — kártyán nem jelenik meg. */
  cutting90dM: number
  isSilent: boolean
  spark: KiemeltSparkPoint[]
}

export type KiemeltYearMonth = {
  month: number
  label: string
  gross: number
}

export type KiemeltPartnerekPageData = {
  partners: KiemeltPartnerCard[]
  portfolio: {
    favoriteCount: number
    sumAvgMonthly: number
    silentCount: number
    openCount: number
  }
  yearChart: {
    year: number
    months: KiemeltYearMonth[]
    ytdGross: number
    priorYtdGross: number | null
  }
  availableYears: number[]
}

function monthKeyFromYmd(ymd: string): string {
  return ymd.slice(0, 7)
}

function monthsBetweenInclusive(firstYmd: string, todayYmd: string): number {
  const [fy, fm] = firstYmd.split('-').map(Number)
  const [ty, tm] = todayYmd.split('-').map(Number)
  return Math.max(1, (ty - fy) * 12 + (tm - fm) + 1)
}

function shiftMonthKey(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function buildSparkKeys(todayYmd: string): string[] {
  const end = monthKeyFromYmd(todayYmd)
  const keys: string[] = []
  for (let i = SPARK_MONTHS - 1; i >= 0; i--) {
    keys.push(shiftMonthKey(end, -i))
  }
  return keys
}

function sparkLabel(key: string): string {
  const m = Number(key.slice(5, 7))
  return MONTH_LABELS_HU[m - 1] ?? key
}

export function formatCompactFt(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0 Ft'
  if (value >= 1_000_000_000) {
    const v = value / 1_000_000_000
    return `${new Intl.NumberFormat('hu-HU', {
      maximumFractionDigits: 1,
      minimumFractionDigits: 0
    }).format(v)} Mrd Ft`
  }
  if (value >= 1_000_000) {
    const v = value / 1_000_000
    return `${new Intl.NumberFormat('hu-HU', {
      maximumFractionDigits: 1,
      minimumFractionDigits: 0
    }).format(v)} M Ft`
  }
  if (value >= 1000) {
    const v = value / 1000
    return `${new Intl.NumberFormat('hu-HU', {
      maximumFractionDigits: 1,
      minimumFractionDigits: 0
    }).format(v)} E Ft`
  }
  return `${new Intl.NumberFormat('hu-HU', {
    maximumFractionDigits: 0
  }).format(value)} Ft`
}

function daysBetweenYmd(fromYmd: string, toYmd: string): number {
  const [fy, fm, fd] = fromYmd.split('-').map(Number)
  const [ty, tm, td] = toYmd.split('-').map(Number)
  const a = Date.UTC(fy, fm - 1, fd)
  const b = Date.UTC(ty, tm - 1, td)
  return Math.round((b - a) / 86_400_000)
}

type QuoteRow = {
  id: string
  customer_id: string
  final_total_gross: number | null
  total_gross: number | null
  ordered_at: string | null
  status: string
}

export async function getKiemeltPartnerekPageData(
  supabase: SupabaseClient,
  tenantId: string,
  opts: { year: number }
): Promise<KiemeltPartnerekPageData> {
  const today = budapestTodayYmd()
  const year = opts.year
  const sparkKeys = buildSparkKeys(today)
  const cuttingSince = addDaysYmd(today, -CUTTING_WINDOW_DAYS)

  const { data: customersRaw, error: custErr } = await supabase
    .from('customers')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .eq('is_favorite', true)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (custErr) {
    console.error('getKiemeltPartnerek customers', custErr.message)
    throw new Error('Nem sikerült betölteni a kiemelt partnereket.')
  }

  const customers = (customersRaw ?? []) as Array<{ id: string; name: string }>
  if (customers.length === 0) {
    return {
      partners: [],
      portfolio: {
        favoriteCount: 0,
        sumAvgMonthly: 0,
        silentCount: 0,
        openCount: 0
      },
      yearChart: {
        year,
        months: Array.from({ length: 12 }, (_, i) => ({
          month: i + 1,
          label: MONTH_LABELS_HU[i]!,
          gross: 0
        })),
        ytdGross: 0,
        priorYtdGross: null
      },
      availableYears: [budapestYear()]
    }
  }

  const customerIds = customers.map((c) => c.id)

  const { data: quotesRaw, error: quoteErr } = await supabase
    .from('quotes')
    .select(
      'id, customer_id, final_total_gross, total_gross, ordered_at, status'
    )
    .eq('tenant_id', tenantId)
    .in('customer_id', customerIds)
    .is('deleted_at', null)
    .is('archived_at', null)
    .not('order_number', 'is', null)
    .neq('status', 'cancelled')

  if (quoteErr) {
    console.error('getKiemeltPartnerek quotes', quoteErr.message)
    throw new Error('Nem sikerült betölteni a megrendeléseket.')
  }

  const quotes = (quotesRaw ?? []) as QuoteRow[]
  const quoteIds = quotes.map((q) => q.id)

  const cuttingByQuote = new Map<string, number>()
  if (quoteIds.length > 0) {
    // Lapozás nélkül: kedvenc set tipikusan kicsi; IN limit biztonság kedvéért chunk.
    const chunk = 200
    for (let i = 0; i < quoteIds.length; i += chunk) {
      const slice = quoteIds.slice(i, i + chunk)
      const { data: lines, error: lineErr } = await supabase
        .from('quote_material_lines')
        .select('quote_id, cutting_length_m')
        .in('quote_id', slice)
      if (lineErr) {
        console.error('getKiemeltPartnerek cutting', lineErr.message)
        continue
      }
      for (const row of lines ?? []) {
        const qid = row.quote_id as string
        cuttingByQuote.set(
          qid,
          (cuttingByQuote.get(qid) ?? 0) + (Number(row.cutting_length_m) || 0)
        )
      }
    }
  }

  type Agg = {
    total: number
    firstYmd: string | null
    lastYmd: string | null
    openCount: number
    cutting90: number
    byMonth: Map<string, number>
  }

  const byCustomer = new Map<string, Agg>()
  for (const c of customers) {
    byCustomer.set(c.id, {
      total: 0,
      firstYmd: null,
      lastYmd: null,
      openCount: 0,
      cutting90: 0,
      byMonth: new Map()
    })
  }

  const yearGross = Array.from({ length: 12 }, () => 0)
  const priorYearGross = Array.from({ length: 12 }, () => 0)
  const yearsSeen = new Set<number>([budapestYear()])

  for (const q of quotes) {
    const agg = byCustomer.get(q.customer_id)
    if (!agg) continue
    const iso = q.ordered_at
    if (!iso) continue
    const ymd = toBudapestYmdFromIso(iso)
    const gross = Math.round(Number(q.final_total_gross ?? q.total_gross) || 0)
    const mk = monthKeyFromYmd(ymd)
    const y = Number(ymd.slice(0, 4))
    const m = Number(ymd.slice(5, 7))
    yearsSeen.add(y)

    agg.total += gross
    agg.byMonth.set(mk, (agg.byMonth.get(mk) ?? 0) + gross)
    if (!agg.firstYmd || ymd < agg.firstYmd) agg.firstYmd = ymd
    if (!agg.lastYmd || ymd > agg.lastYmd) agg.lastYmd = ymd
    if (OPEN_STATUSES.has(q.status)) agg.openCount += 1
    if (ymd >= cuttingSince) {
      agg.cutting90 += cuttingByQuote.get(q.id) ?? 0
    }

    if (y === year && m >= 1 && m <= 12) yearGross[m - 1]! += gross
    if (y === year - 1 && m >= 1 && m <= 12) priorYearGross[m - 1]! += gross
  }

  const currentMonth = Number(today.slice(5, 7))
  const prevMonthKey = shiftMonthKey(monthKeyFromYmd(today), -1)
  const prev2MonthKey = shiftMonthKey(monthKeyFromYmd(today), -2)

  const partners: KiemeltPartnerCard[] = customers.map((c) => {
    const agg = byCustomer.get(c.id)!
    const months = agg.firstYmd
      ? monthsBetweenInclusive(agg.firstYmd, today)
      : 1
    const avgMonthly = agg.total > 0 ? agg.total / months : 0
    const daysSince =
      agg.lastYmd != null ? daysBetweenYmd(agg.lastYmd, today) : null
    const isSilent = daysSince == null || daysSince > SILENT_DAYS

    const prev = agg.byMonth.get(prevMonthKey) ?? 0
    const prev2 = agg.byMonth.get(prev2MonthKey) ?? 0
    let trendPct: number | null = null
    if (prev2 > 0) {
      trendPct = Math.round(((prev - prev2) / prev2) * 100)
    } else if (prev > 0) {
      trendPct = 100
    } else if (prev === 0 && prev2 === 0) {
      trendPct = null
    }

    const spark: KiemeltSparkPoint[] = sparkKeys.map((key) => ({
      key,
      label: sparkLabel(key),
      gross: agg.byMonth.get(key) ?? 0
    }))

    return {
      id: c.id,
      name: c.name,
      avgMonthlyRevenue: Math.round(avgMonthly),
      totalRevenue: Math.round(agg.total),
      trendPct,
      lastOrderYmd: agg.lastYmd,
      daysSinceLast: daysSince,
      openCount: agg.openCount,
      cutting90dM: Math.round(agg.cutting90 * 10) / 10,
      isSilent,
      spark
    }
  })

  const ytdGross = yearGross
    .slice(0, year === budapestYear() ? currentMonth : 12)
    .reduce((a, b) => a + b, 0)
  const priorYtdGross = priorYearGross
    .slice(0, year === budapestYear() ? currentMonth : 12)
    .reduce((a, b) => a + b, 0)

  const availableYears = [...yearsSeen].sort((a, b) => b - a)

  return {
    partners,
    portfolio: {
      favoriteCount: partners.length,
      sumAvgMonthly: partners.reduce((s, p) => s + p.avgMonthlyRevenue, 0),
      silentCount: partners.filter((p) => p.isSilent).length,
      openCount: partners.reduce((s, p) => s + p.openCount, 0)
    },
    yearChart: {
      year,
      months: yearGross.map((gross, i) => ({
        month: i + 1,
        label: MONTH_LABELS_HU[i]!,
        gross: Math.round(gross)
      })),
      ytdGross: Math.round(ytdGross),
      priorYtdGross:
        priorYtdGross > 0 || year > budapestYear() - 10
          ? Math.round(priorYtdGross)
          : null
    },
    availableYears:
      availableYears.length > 0 ? availableYears : [budapestYear()]
  }
}

export function filterAndSortPartners(
  partners: KiemeltPartnerCard[],
  opts: {
    q?: string
    sort: KiemeltSort
    activity: KiemeltActivity
  }
): KiemeltPartnerCard[] {
  let rows = partners
  const q = opts.q?.trim().toLowerCase()
  if (q) {
    rows = rows.filter((p) => p.name.toLowerCase().includes(q))
  }
  if (opts.activity === 'active') {
    rows = rows.filter((p) => !p.isSilent)
  } else if (opts.activity === 'silent') {
    rows = rows.filter((p) => p.isSilent)
  } else if (opts.activity === 'down') {
    rows = rows.filter(
      (p) => p.trendPct != null && p.trendPct <= TREND_DOWN_THRESHOLD
    )
  }

  const sorted = [...rows]
  switch (opts.sort) {
    case 'name':
      sorted.sort((a, b) => a.name.localeCompare(b.name, 'hu'))
      break
    case 'last_order':
      sorted.sort((a, b) => {
        const ad = a.daysSinceLast
        const bd = b.daysSinceLast
        if (ad == null && bd == null) return a.name.localeCompare(b.name, 'hu')
        if (ad == null) return 1
        if (bd == null) return -1
        return ad - bd
      })
      break
    case 'cutting_90d':
      sorted.sort((a, b) => {
        if (b.cutting90dM !== a.cutting90dM) return b.cutting90dM - a.cutting90dM
        return a.name.localeCompare(b.name, 'hu')
      })
      break
    case 'avg_monthly':
    default:
      sorted.sort((a, b) => {
        if (b.avgMonthlyRevenue !== a.avgMonthlyRevenue) {
          return b.avgMonthlyRevenue - a.avgMonthlyRevenue
        }
        return a.name.localeCompare(b.name, 'hu')
      })
  }
  return sorted
}
