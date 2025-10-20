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

    // Get weekOffset from query params (0 = current week, -1 = previous, +1 = next)
    const { searchParams } = new URL(request.url)
    const weekOffset = parseInt(searchParams.get('weekOffset') || '0', 10)

    // Get start and end of target week (Monday to Saturday)
    const now = new Date()
    const currentDay = now.getDay() // 0 = Sunday, 1 = Monday, etc.
    
    // Calculate Monday of current week
    const monday = new Date(now)
    const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1 // If Sunday, go back 6 days
    monday.setDate(now.getDate() - daysFromMonday)
    
    // Apply week offset (multiply by 7 to get days)
    monday.setDate(monday.getDate() + (weekOffset * 7))
    monday.setHours(0, 0, 0, 0)
    
    // Calculate Saturday of target week (not Sunday)
    const saturday = new Date(monday)
    saturday.setDate(monday.getDate() + 5)
    saturday.setHours(23, 59, 59, 999)

    // Fetch quotes with production_date in current week and status = 'in_production'
    // Join with quote_materials_pricing to get cutting_length_m
    // Group by production_date and production_machine_id
    const { data: weeklyData, error } = await supabase
      .from('quotes')
      .select(`
        id,
        production_date,
        production_machine_id,
        quote_materials_pricing (
          cutting_length_m
        )
      `)
      .eq('status', 'in_production')
      .gte('production_date', monday.toISOString().split('T')[0])
      .lte('production_date', saturday.toISOString().split('T')[0])
      .not('production_machine_id', 'is', null)
      .order('production_date', { ascending: true })

    if (error) {
      console.error('Error fetching weekly cutting data:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get machine names and usage limits
    const machineIds = [...new Set(weeklyData.map(q => q.production_machine_id).filter(Boolean))]
    const { data: machines } = await supabase
      .from('production_machines')
      .select('id, machine_name, usage_limit_per_day')
      .in('id', machineIds)

    const machineMap = new Map(machines?.map(m => [m.id, { name: m.machine_name, limit: m.usage_limit_per_day }]) || [])

    // Process data: group by date and machine, sum cutting_length_m
    const dataByDateAndMachine = new Map<string, Map<string, number>>()

    weeklyData.forEach(quote => {
      const date = quote.production_date
      const machineId = quote.production_machine_id
      
      if (!date || !machineId) return

      // Sum cutting_length_m for this quote
      const totalCuttingLength = quote.quote_materials_pricing?.reduce(
        (sum: number, pricing: any) => sum + (pricing.cutting_length_m || 0), 
        0
      ) || 0

      if (!dataByDateAndMachine.has(date)) {
        dataByDateAndMachine.set(date, new Map())
      }

      const machineData = dataByDateAndMachine.get(date)!
      const currentSum = machineData.get(machineId) || 0
      machineData.set(machineId, currentSum + totalCuttingLength)
    })

    // Convert to array format for ApexCharts
    // Create array of weekdays with data (Monday to Saturday only)
    const weekDays = ['Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat']
    const categories = weekDays

    // Prepare series data (one series per machine)
    const seriesData: { [key: string]: number[] } = {}
    
    // Initialize all machines with zeros for all days (6 days: Monday to Saturday)
    machineIds.forEach(machineId => {
      seriesData[machineId] = [0, 0, 0, 0, 0, 0]
    })

    // Fill in actual data
    dataByDateAndMachine.forEach((machineData, dateStr) => {
      const date = new Date(dateStr)
      const dayOfWeek = date.getDay() // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      
      // Skip Sunday (dayOfWeek === 0)
      if (dayOfWeek === 0) return
      
      const dayIndex = dayOfWeek - 1 // Convert to Monday=0, Saturday=5

      machineData.forEach((cuttingLength, machineId) => {
        if (seriesData[machineId]) {
          seriesData[machineId][dayIndex] = cuttingLength
        }
      })
    })

    // Convert to ApexCharts series format
    const series = Array.from(machineIds).map(machineId => {
      const machineInfo = machineMap.get(machineId)
      return {
        name: machineInfo?.name || `Gép ${machineId.substring(0, 8)}`,
        data: seriesData[machineId]
      }
    })

    // Calculate daily totals (sum all machines for each day)
    const dailyTotals = [0, 0, 0, 0, 0, 0]
    Object.values(seriesData).forEach(machineData => {
      machineData.forEach((value, index) => {
        dailyTotals[index] += value
      })
    })

    // Create machine limits for annotations
    const machineLimits = Array.from(machineIds).map(machineId => {
      const machineInfo = machineMap.get(machineId)
      return {
        machineId,
        machineName: machineInfo?.name || 'Unknown',
        limit: machineInfo?.limit || 0
      }
    })

    return NextResponse.json({
      categories,
      series,
      machineLimits,
      dailyTotals,
      weekStart: monday.toISOString().split('T')[0],
      weekEnd: saturday.toISOString().split('T')[0]
    })
    
  } catch (error) {
    console.error('Error in weekly cutting API:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

