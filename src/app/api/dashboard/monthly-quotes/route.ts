import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get monthOffset from query params (0 = current month, -1 = previous, +1 = next)
    const { searchParams } = new URL(request.url)
    const monthOffset = parseInt(searchParams.get('monthOffset') || '0', 10)

    // Calculate target month
    const now = new Date()
    const targetDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
    const year = targetDate.getFullYear()
    const month = targetDate.getMonth()

    // Get first and last day of target month
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0, 23, 59, 59, 999)

    // Fetch quotes for the target month (filter by created_at)
    const { data: quotes, error } = await supabase
      .from('quotes')
      .select('id, status')
      .gte('created_at', firstDay.toISOString())
      .lte('created_at', lastDay.toISOString())
      .is('deleted_at', null) // Exclude soft-deleted quotes

    if (error) {
      console.error('Error fetching monthly quotes:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Count quotes by status
    const statusCounts = {
      draft: 0,
      ordered: 0,
      in_production: 0,
      ready: 0,
      finished: 0,
      cancelled: 0
    }

    quotes?.forEach(quote => {
      const status = quote.status as keyof typeof statusCounts
      if (status in statusCounts) {
        statusCounts[status]++
      }
    })

    const total = quotes?.length || 0

    // Calculate percentages and prepare response
    const statusData = [
      {
        status: 'draft',
        label: 'Ajánlat',
        count: statusCounts.draft,
        percentage: total > 0 ? (statusCounts.draft / total) * 100 : 0,
        color: '#9E9E9E' // Grey
      },
      {
        status: 'ordered',
        label: 'Megrendelve',
        count: statusCounts.ordered,
        percentage: total > 0 ? (statusCounts.ordered / total) * 100 : 0,
        color: '#2196F3' // Blue
      },
      {
        status: 'in_production',
        label: 'Gyártásban',
        count: statusCounts.in_production,
        percentage: total > 0 ? (statusCounts.in_production / total) * 100 : 0,
        color: '#FF9800' // Orange
      },
      {
        status: 'ready',
        label: 'Kész',
        count: statusCounts.ready,
        percentage: total > 0 ? (statusCounts.ready / total) * 100 : 0,
        color: '#4CAF50' // Green
      },
      {
        status: 'finished',
        label: 'Átadva',
        count: statusCounts.finished,
        percentage: total > 0 ? (statusCounts.finished / total) * 100 : 0,
        color: '#00BCD4' // Cyan
      },
      {
        status: 'cancelled',
        label: 'Törölve',
        count: statusCounts.cancelled,
        percentage: total > 0 ? (statusCounts.cancelled / total) * 100 : 0,
        color: '#F44336' // Red
      }
    ]

    // Get month name in Hungarian
    const monthNames = [
      'január', 'február', 'március', 'április', 'május', 'június',
      'július', 'augusztus', 'szeptember', 'október', 'november', 'december'
    ]

    return NextResponse.json({
      statusData,
      total,
      month: monthNames[month],
      year,
      monthOffset
    })
    
  } catch (error) {
    console.error('Error in monthly quotes API:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

