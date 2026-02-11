import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

const monthNames = [
  'január', 'február', 'március', 'április', 'május', 'június',
  'július', 'augusztus', 'szeptember', 'október', 'november', 'december'
]

const formatDateLabel = (date: Date) => {
  return `${date.getFullYear()}. ${monthNames[date.getMonth()]} ${date.getDate()}.`
}

const startOfToday = () => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
}

const getRange = (range: string, offset: number) => {
  const today = startOfToday()

  if (range === 'day') {
    const start = new Date(today)
    start.setDate(start.getDate() + offset)
    const end = new Date(start)
    end.setHours(23, 59, 59, 999)

    return {
      start,
      end,
      label: formatDateLabel(start)
    }
  }

  if (range === 'week') {
    const start = new Date(today)
    const currentDay = start.getDay() === 0 ? 6 : start.getDay() - 1
    start.setDate(start.getDate() - currentDay + offset * 7)
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    end.setHours(23, 59, 59, 999)

    return {
      start,
      end,
      label: `${formatDateLabel(start)} – ${formatDateLabel(end)}`
    }
  }

  const monthStart = new Date(today.getFullYear(), today.getMonth() + offset, 1)
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)
  monthEnd.setHours(23, 59, 59, 999)

  return {
    start: monthStart,
    end: monthEnd,
    label: `${monthStart.getFullYear()}. ${monthNames[monthStart.getMonth()]}`
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rangeParam = searchParams.get('range') as 'day' | 'week' | 'month' | null
    const range = rangeParam ?? 'month'
    const offsetParam = searchParams.get('offset')
    const legacyMonthOffset = searchParams.get('monthOffset')
    const offset = parseInt(
      (offsetParam !== null
        ? offsetParam
        : range === 'month'
          ? legacyMonthOffset ?? '0'
          : '0'),
      10
    )

    const { start, end, label } = getRange(range, isNaN(offset) ? 0 : offset)

    const statusTimestampMap: Record<
      'ordered' | 'in_production' | 'ready' | 'finished' | 'cancelled',
      { column: string; label: string; color: string }
    > = {
      ordered: {
        column: 'ordered_at',
        label: 'Megrendelve',
        color: '#2196F3'
      },
      in_production: {
        column: 'in_production_at',
        label: 'Gyártásban',
        color: '#FF9800'
      },
      ready: {
        column: 'ready_at',
        label: 'Kész',
        color: '#4CAF50'
      },
      finished: {
        column: 'finished_at',
        label: 'Átadva',
        color: '#00BCD4'
      },
      cancelled: {
        column: 'cancelled_at',
        label: 'Törölve',
        color: '#F44336'
      }
    }

    const statusResults = await Promise.all(
      (Object.entries(statusTimestampMap) as Array<
        [keyof typeof statusTimestampMap, { column: string; label: string; color: string }]
      >).map(async ([statusKey, { column }]) => {
        const { data, error } = await supabaseServer
          .from('worktop_quotes')
          .select('id')
          .gte(column, start.toISOString())
          .lte(column, end.toISOString())
          .is('deleted_at', null)

        if (error) {
          throw new Error(`Error fetching ${statusKey} worktop quotes: ${error.message}`)
        }

        const quoteIds = data?.map(record => record.id as string) ?? []

        return {
          status: statusKey,
          count: quoteIds.length,
          ids: quoteIds
        }
      })
    )

    const uniqueQuoteIds = new Set<string>()
    statusResults.forEach(result => {
      result.ids.forEach(id => uniqueQuoteIds.add(id))
    })

    const total = uniqueQuoteIds.size

    const statusData = statusResults.map(result => {
      const { label, color } = statusTimestampMap[result.status]
      return {
        status: result.status,
        label,
        count: result.count,
        percentage: total > 0 ? (result.count / total) * 100 : 0,
        color
      }
    })

    return NextResponse.json({
      statusData,
      total,
      range,
      offset: isNaN(offset) ? 0 : offset,
      label,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      month: monthNames[start.getMonth()],
      year: start.getFullYear(),
      monthOffset: range === 'month' ? (isNaN(offset) ? 0 : offset) : 0
    })
    
  } catch (error) {
    console.error('Error in worktop quotes summary API:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}
