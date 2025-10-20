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

    // Fetch shop_order_items for the target month (filter by created_at)
    const { data: items, error } = await supabase
      .from('shop_order_items')
      .select('id, status')
      .gte('created_at', firstDay.toISOString())
      .lte('created_at', lastDay.toISOString())
      .is('deleted_at', null) // Exclude soft-deleted items

    if (error) {
      console.error('Error fetching monthly supplier orders:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Count items by status
    const statusCounts = {
      open: 0,
      ordered: 0,
      arrived: 0,
      deleted: 0
    }

    items?.forEach(item => {
      const status = item.status as keyof typeof statusCounts
      if (status in statusCounts) {
        statusCounts[status]++
      }
    })

    const total = items?.length || 0

    // Calculate percentages and prepare response
    const statusData = [
      {
        status: 'open',
        label: 'Nyitott',
        count: statusCounts.open,
        percentage: total > 0 ? (statusCounts.open / total) * 100 : 0,
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
        status: 'arrived',
        label: 'Megérkezett',
        count: statusCounts.arrived,
        percentage: total > 0 ? (statusCounts.arrived / total) * 100 : 0,
        color: '#4CAF50' // Green
      },
      {
        status: 'deleted',
        label: 'Törölve',
        count: statusCounts.deleted,
        percentage: total > 0 ? (statusCounts.deleted / total) * 100 : 0,
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
    console.error('Error in monthly supplier orders API:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

