import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

type RangeType = 'day' | 'week' | 'month'

function getRangeParam(request: NextRequest): RangeType {
  const url = new URL(request.url)
  const param = url.searchParams.get('range')
  if (param === 'week' || param === 'month') return param
  return 'day'
}

function getMonthSelector(request: NextRequest) {
  const url = new URL(request.url)
  const param = url.searchParams.get('month') || undefined
  if (!param) return undefined
  const [yearStr, monthStr] = param.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    month < 1 ||
    month > 12 ||
    year < 2000 ||
    year > 2100
  ) {
    return undefined
  }
  return { year, month }
}

function getSelectedMonthRange(selected?: { year: number; month: number }) {
  const now = new Date()
  const monthDate = selected
    ? new Date(Date.UTC(selected.year, selected.month - 1, 1))
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  monthDate.setUTCHours(0, 0, 0, 0)

  const start = new Date(monthDate)
  const end = new Date(monthDate)
  end.setUTCMonth(start.getUTCMonth() + 1)
  end.setUTCDate(0)
  end.setUTCHours(23, 59, 59, 999)

  return {
    monthStart: start,
    monthEnd: end,
    year: monthDate.getUTCFullYear(),
    month: monthDate.getUTCMonth() + 1
  }
}

async function fetchAvailableMonths() {
  const { data, error } = await supabaseServer
    .from('quotes')
    .select('ready_at')
    .not('ready_at', 'is', null)
    .order('ready_at', { ascending: false })
    .limit(1000)

  if (error) {
    console.error('Error fetching available months:', error)
    return []
  }

  const monthSet = new Set<string>()
  data?.forEach(row => {
    if (!row.ready_at) return
    const date = new Date(row.ready_at)
    if (Number.isNaN(date.getTime())) return
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
    monthSet.add(key)
  })

  return Array.from(monthSet)
    .sort()
    .reverse()
    .slice(0, 24)
}

function getUTCWeekStart(date: Date) {
  const d = new Date(date)
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

function createBuckets(range: RangeType, monthStart: Date, monthEnd: Date) {
  const buckets = new Map<string, { date: Date; total: number }>()

  if (range === 'day') {
    const cursor = new Date(monthStart)
    while (cursor <= monthEnd) {
      const key = cursor.toISOString().split('T')[0]
      buckets.set(key, { date: new Date(cursor), total: 0 })
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
    return buckets
  }

  if (range === 'week') {
    const seen = new Set<string>()
    const cursor = new Date(monthStart)
    while (cursor <= monthEnd) {
      const weekStart = getUTCWeekStart(cursor)
      const key = weekStart.toISOString().split('T')[0]
      if (!seen.has(key)) {
        seen.add(key)
        buckets.set(key, { date: weekStart, total: 0 })
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
    return new Map(Array.from(buckets.entries()).sort((a, b) => a[1].date.getTime() - b[1].date.getTime()))
  }

  const key = `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, '0')}-01`
  buckets.set(key, { date: new Date(monthStart), total: 0 })
  return buckets
}

function resolveBucketKey(range: RangeType, date: Date): string | null {
  if (Number.isNaN(date.getTime())) return null

  if (range === 'day') {
    date.setUTCHours(0, 0, 0, 0)
    return date.toISOString().split('T')[0]
  }

  if (range === 'week') {
    const weekStart = getUTCWeekStart(date)
    return weekStart.toISOString().split('T')[0]
}

  const monthKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`
  return monthKey
}

export async function GET(request: NextRequest) {
  try {
    const range = getRangeParam(request)
    const selectedMonth = getMonthSelector(request)
    const { monthStart, monthEnd, year: selectedYear, month: selectedMonthNumber } = getSelectedMonthRange(selectedMonth)

    const buckets = createBuckets(range, monthStart, monthEnd)

    const [{ data: pricingData, error: pricingError }, { data: quotesData, error: quotesError }] = await Promise.all([
      supabaseServer
        .from('quote_materials_pricing')
        .select(`
          quote_id,
          material_net,
          edge_materials_net,
          cutting_net,
          quotes:quote_id (
            ready_at
          )
        `)
        .not('quotes.ready_at', 'is', null)
        .gte('quotes.ready_at', monthStart.toISOString())
        .lte('quotes.ready_at', monthEnd.toISOString()),
      supabaseServer
        .from('quotes')
        .select('ready_at, final_total_after_discount, customer_id, customers ( name )')
        .not('ready_at', 'is', null)
        .gte('ready_at', monthStart.toISOString())
        .lte('ready_at', monthEnd.toISOString())
        .order('ready_at', { ascending: true })
    ])

    if (pricingError) {
      console.error('Error fetching pricing data for revenue chart:', pricingError)
      return NextResponse.json({ error: 'Failed to fetch revenue data' }, { status: 500 })
    }

    if (quotesError) {
      console.error('Error fetching quote data for revenue chart:', quotesError)
      return NextResponse.json({ error: 'Failed to fetch revenue data' }, { status: 500 })
    }

    pricingData?.forEach(row => {
      const readyAt = row.quotes?.ready_at
      if (!readyAt) return

      const readyDate = new Date(readyAt)
      if (readyDate < monthStart || readyDate > monthEnd) return

      const bucketKey = resolveBucketKey(range, readyDate)
      if (!bucketKey) return

      const bucket = buckets.get(bucketKey)
      if (!bucket) return

      const materialNet = Number(row.material_net ?? 0)
      const edgeNet = Number(row.edge_materials_net ?? 0)
      const cuttingNet = Number(row.cutting_net ?? 0)
      const combined = materialNet + edgeNet + cuttingNet

      bucket.total += combined
    })

    const customerTotals = new Map<string, { customerId: string; customerName: string; total: number }>()
    quotesData?.forEach(row => {
      if (!row.ready_at) return
      const total = Number(row.final_total_after_discount) || 0
      const customerId = row.customer_id as string
      const customerName = (row.customers as { name?: string } | null)?.name || 'Ismeretlen ügyfél'
      const existing = customerTotals.get(customerId)
      if (existing) {
        existing.total += total
      } else {
        customerTotals.set(customerId, { customerId, customerName, total })
      }
    })

    const data = Array.from(buckets.values())
      .map(bucket => ({
        date: bucket.date.toISOString(),
        total: Math.round(bucket.total)
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    return NextResponse.json({
      range,
      data,
      month: {
        year: selectedYear,
        month: selectedMonthNumber
      },
      availableMonths: await fetchAvailableMonths(),
      toplist: Array.from(customerTotals.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, 10)
        .map(item => ({
          customer_id: item.customerId,
          customer_name: item.customerName,
          total: Math.round(item.total)
        }))
    })
  } catch (error) {
    console.error('Error in reports revenue API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

