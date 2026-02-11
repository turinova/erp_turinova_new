import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    // Get weekOffset from query params (0 = current week, -1 = previous, +1 = next)
    const { searchParams } = new URL(request.url)
    const weekOffset = parseInt(searchParams.get('weekOffset') || '0', 10)

    // Get start and end of target week (Monday to Saturday)
    const now = new Date()
    const currentDay = now.getDay() // 0 = Sunday, 1 = Monday, etc.
    
    // Calculate Monday of current week
    const monday = new Date(now)
    const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1
    monday.setDate(now.getDate() - daysFromMonday)
    
    // Apply week offset
    monday.setDate(monday.getDate() + (weekOffset * 7))
    monday.setHours(0, 0, 0, 0)
    
    // Calculate Saturday of target week
    const saturday = new Date(monday)
    saturday.setDate(monday.getDate() + 5)
    saturday.setHours(23, 59, 59, 999)

    // Fetch worktop orders with status = 'in_production' and production_date in current week
    const { data: weeklyData, error } = await supabaseServer
      .from('worktop_quotes')
      .select(`
        id,
        production_date,
        order_number
      `)
      .eq('status', 'in_production')
      .gte('production_date', monday.toISOString().split('T')[0])
      .lte('production_date', saturday.toISOString().split('T')[0])
      .not('production_date', 'is', null)
      .is('deleted_at', null)
      .order('production_date', { ascending: true })

    if (error) {
      console.error('Error fetching weekly worktop production data:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Process data: count orders per day
    const dataByDate = new Map<string, number>()

    weeklyData?.forEach(order => {
      const date = order.production_date
      if (!date) return

      const currentCount = dataByDate.get(date) || 0
      dataByDate.set(date, currentCount + 1)
    })

    // Convert to array format for ApexCharts
    const weekDays = ['Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat']
    const categories = weekDays

    // Initialize array with zeros for all days
    const dailyCounts = [0, 0, 0, 0, 0, 0]

    // Fill in actual data
    dataByDate.forEach((count, dateStr) => {
      const date = new Date(dateStr)
      const dayOfWeek = date.getDay()
      
      // Skip Sunday
      if (dayOfWeek === 0) return
      
      const dayIndex = dayOfWeek - 1
      dailyCounts[dayIndex] = count
    })

    // Create single series for total count
    const series = [{
      name: 'Gyártásban lévő megrendelések',
      data: dailyCounts
    }]

    return NextResponse.json({
      categories,
      series,
      dailyTotals: dailyCounts,
      weekStart: monday.toISOString().split('T')[0],
      weekEnd: saturday.toISOString().split('T')[0]
    })
    
  } catch (error) {
    console.error('Error in weekly worktop production API:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}
