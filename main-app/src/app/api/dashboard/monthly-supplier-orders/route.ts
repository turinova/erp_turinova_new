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

    const { data: items, error } = await supabaseServer
      .from('shop_order_items')
      .select('id, status')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .is('deleted_at', null)

    if (error) {
      console.error('Error fetching supplier orders summary:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const statusCounts = {
      open: 0,
      ordered: 0,
      arrived: 0,
      handed_over: 0,
      deleted: 0
    }

    items?.forEach(item => {
      const status = item.status as keyof typeof statusCounts
      if (status in statusCounts) {
        statusCounts[status]++
      }
    })

    const total = items?.length ?? 0

    const statusData = [
      {
        status: 'open',
        label: 'Nyitott',
        count: statusCounts.open,
        percentage: total > 0 ? (statusCounts.open / total) * 100 : 0,
        color: '#9E9E9E'
      },
      {
        status: 'ordered',
        label: 'Megrendelve',
        count: statusCounts.ordered,
        percentage: total > 0 ? (statusCounts.ordered / total) * 100 : 0,
        color: '#2196F3'
      },
      {
        status: 'arrived',
        label: 'Megérkezett',
        count: statusCounts.arrived,
        percentage: total > 0 ? (statusCounts.arrived / total) * 100 : 0,
        color: '#4CAF50'
      },
      {
        status: 'handed_over',
        label: 'Átadva',
        count: statusCounts.handed_over,
        percentage: total > 0 ? (statusCounts.handed_over / total) * 100 : 0,
        color: '#673AB7'
      },
      {
        status: 'deleted',
        label: 'Törölve',
        count: statusCounts.deleted,
        percentage: total > 0 ? (statusCounts.deleted / total) * 100 : 0,
        color: '#F44336'
      }
    ]

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
    console.error('Error in supplier orders summary API:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

