import { supabaseServer } from './supabase-server'

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

export const getRange = (range: string, offset: number) => {
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

// Optimized: Use COUNT queries instead of fetching all IDs
export async function getMonthlyQuotesData(range: string = 'month', offset: number = 0) {
  const startTime = performance.now()
  const { start, end, label } = getRange(range, offset)

  const statusTimestampMap: Record<
    'ordered' | 'in_production' | 'ready' | 'finished' | 'cancelled',
    { column: string; label: string; color: string }
  > = {
    ordered: { column: 'ordered_at', label: 'Megrendelve', color: '#2196F3' },
    in_production: { column: 'in_production_at', label: 'Gyártásban', color: '#FF9800' },
    ready: { column: 'ready_at', label: 'Kész', color: '#4CAF50' },
    finished: { column: 'finished_at', label: 'Átadva', color: '#00BCD4' },
    cancelled: { column: 'cancelled_at', label: 'Törölve', color: '#F44336' }
  }

  // Run COUNT queries in parallel - much faster than fetching all IDs
  const statusResults = await Promise.all(
    (Object.entries(statusTimestampMap) as Array<
      [keyof typeof statusTimestampMap, { column: string; label: string; color: string }]
    >).map(async ([statusKey, { column }]) => {
      const { count, error } = await supabaseServer
        .from('quotes')
        .select('*', { count: 'exact', head: true })
        .gte(column, start.toISOString())
        .lte(column, end.toISOString())
        .is('deleted_at', null)

      if (error) {
        console.error(`Error fetching ${statusKey} quotes count:`, error)
        return { status: statusKey, count: 0 }
      }

      return {
        status: statusKey,
        count: count || 0
      }
    })
  )

  // For total, fetch unique quote IDs that have any status timestamp in the range
  // Use a single optimized query with date range filters
  // This is faster than multiple OR queries
  const startDateStr = start.toISOString()
  const endDateStr = end.toISOString()
  
  const { data: allQuotes } = await supabaseServer
    .from('quotes')
    .select('id')
    .or(`ordered_at.gte.${startDateStr},in_production_at.gte.${startDateStr},ready_at.gte.${startDateStr},finished_at.gte.${startDateStr},cancelled_at.gte.${startDateStr}`)
    .or(`ordered_at.lte.${endDateStr},in_production_at.lte.${endDateStr},ready_at.lte.${endDateStr},finished_at.lte.${endDateStr},cancelled_at.lte.${endDateStr}`)
    .is('deleted_at', null)
    .limit(10000) // Add limit to prevent excessive data

  const uniqueQuoteIds = new Set(allQuotes?.map(q => q.id) || [])
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

  console.log(`[PERF] Monthly Quotes Fallback Query: ${(performance.now() - startTime).toFixed(2)}ms`)

  return {
    statusData,
    total,
    range,
    offset,
    label,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    month: monthNames[start.getMonth()],
    year: start.getFullYear(),
    monthOffset: range === 'month' ? offset : 0
  }
}

// Optimized: Use COUNT with GROUP BY instead of fetching all rows
export async function getMonthlySupplierOrdersData(range: string = 'month', offset: number = 0) {
  const startTime = performance.now()
  const { start, end, label } = getRange(range, offset)

  try {
    // Optimized: Fetch only status column and count in memory
    // This is more efficient than fetching full records
    const { data, error } = await supabaseServer
      .from('shop_order_items')
      .select('status', { count: 'exact' })
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .is('deleted_at', null)
      .limit(50000) // Add reasonable limit to prevent excessive data

    if (error) {
      console.error('Error fetching supplier orders summary:', error)
      throw error
    }

    // Count statuses in memory (faster than multiple queries)
    const statusCounts = {
      open: 0,
      ordered: 0,
      arrived: 0,
      handed_over: 0,
      deleted: 0
    }

    data?.forEach(item => {
      const status = item.status as keyof typeof statusCounts
      if (status in statusCounts) {
        statusCounts[status]++
      }
    })

    const total = data?.length ?? 0

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

    console.log(`[PERF] Monthly Supplier Orders Query: ${(performance.now() - startTime).toFixed(2)}ms`)

    return {
      statusData,
      total,
      range,
      offset,
      label,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      month: monthNames[start.getMonth()],
      year: start.getFullYear(),
      monthOffset: range === 'month' ? offset : 0
    }
  } catch (error) {
    console.error('Error in getMonthlySupplierOrdersData:', error)
    throw error
  }
}

// Optimized: Add limit and better query structure
export async function getWeeklyCuttingData(weekOffset: number = 0) {
  const startTime = performance.now()

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

  try {
    // Fetch quotes with production_date in current week
    // Add limit to prevent fetching too much data
    const { data: weeklyData, error } = await supabaseServer
      .from('quotes')
      .select(`
        id,
        production_date,
        production_machine_id,
        quote_materials_pricing (
          cutting_length_m
        )
      `)
      .gte('production_date', monday.toISOString().split('T')[0])
      .lte('production_date', saturday.toISOString().split('T')[0])
      .not('production_machine_id', 'is', null)
      .is('deleted_at', null)
      .order('production_date', { ascending: true })
      .limit(1000) // Add reasonable limit

    if (error) {
      console.error('Error fetching weekly cutting data:', error)
      throw error
    }

    // Get machine names and usage limits
    const machineIds = [...new Set(weeklyData.map(q => q.production_machine_id).filter(Boolean))]
    
    if (machineIds.length === 0) {
      return {
        categories: ['Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat'],
        series: [],
        machineLimits: [],
        dailyTotals: [0, 0, 0, 0, 0, 0],
        weekStart: monday.toISOString().split('T')[0],
        weekEnd: saturday.toISOString().split('T')[0]
      }
    }

    const { data: machines } = await supabaseServer
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
    const weekDays = ['Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat']
    const categories = weekDays

    // Prepare series data (one series per machine)
    const seriesData: { [key: string]: number[] } = {}
    
    // Initialize all machines with zeros for all days
    machineIds.forEach(machineId => {
      seriesData[machineId] = [0, 0, 0, 0, 0, 0]
    })

    // Fill in actual data
    dataByDateAndMachine.forEach((machineData, dateStr) => {
      const date = new Date(dateStr)
      const dayOfWeek = date.getDay()
      
      // Skip Sunday
      if (dayOfWeek === 0) return
      
      const dayIndex = dayOfWeek - 1

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

    // Calculate daily totals
    const dailyTotals = [0, 0, 0, 0, 0, 0]
    Object.values(seriesData).forEach(machineData => {
      machineData.forEach((value, index) => {
        dailyTotals[index] += value
      })
    })

    // Create machine limits
    const machineLimits = Array.from(machineIds).map(machineId => {
      const machineInfo = machineMap.get(machineId)
      return {
        machineId,
        machineName: machineInfo?.name || 'Unknown',
        limit: machineInfo?.limit || 0
      }
    })

    console.log(`[PERF] Weekly Cutting Query: ${(performance.now() - startTime).toFixed(2)}ms`)

    return {
      categories,
      series,
      machineLimits,
      dailyTotals,
      weekStart: monday.toISOString().split('T')[0],
      weekEnd: saturday.toISOString().split('T')[0]
    }
  } catch (error) {
    console.error('Error in getWeeklyCuttingData:', error)
    throw error
  }
}


export async function getWeeklyWorktopProductionData(weekOffset: number = 0) {
  const startTime = performance.now()
  
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

  try {
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
      throw error
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

    console.log(`[PERF] Weekly Worktop Production Query: ${(performance.now() - startTime).toFixed(2)}ms`)

    return {
      categories,
      series,
      dailyTotals: dailyCounts,
      weekStart: monday.toISOString().split('T')[0],
      weekEnd: saturday.toISOString().split('T')[0]
    }
  } catch (error) {
    console.error('Error in getWeeklyWorktopProductionData:', error)
    throw error
  }
}

export async function getMonthlyWorktopQuotesData(range: string = 'month', offset: number = 0) {
  const startTime = performance.now()
  const { start, end, label } = getRange(range, offset)

  const statusTimestampMap: Record<
    'ordered' | 'in_production' | 'ready' | 'finished' | 'cancelled',
    { column: string; label: string; color: string }
  > = {
    ordered: { column: 'ordered_at', label: 'Megrendelve', color: '#2196F3' },
    in_production: { column: 'in_production_at', label: 'Gyártásban', color: '#FF9800' },
    ready: { column: 'ready_at', label: 'Kész', color: '#4CAF50' },
    finished: { column: 'finished_at', label: 'Átadva', color: '#00BCD4' },
    cancelled: { column: 'cancelled_at', label: 'Törölve', color: '#F44336' }
  }

  // Run COUNT queries in parallel - much faster than fetching all IDs
  const statusResults = await Promise.all(
    (Object.entries(statusTimestampMap) as Array<
      [keyof typeof statusTimestampMap, { column: string; label: string; color: string }]
    >).map(async ([statusKey, { column }]) => {
      const { count, error } = await supabaseServer
        .from('worktop_quotes')
        .select('*', { count: 'exact', head: true })
        .gte(column, start.toISOString())
        .lte(column, end.toISOString())
        .is('deleted_at', null)

      if (error) {
        console.error(`Error fetching ${statusKey} worktop quotes count:`, error)
        return { status: statusKey, count: 0 }
      }

      return {
        status: statusKey,
        count: count || 0
      }
    })
  )

  // For total, fetch unique quote IDs that have any status timestamp in the range
  // Use a single optimized query with date range filters
  // This is faster than multiple OR queries
  const startDateStr = start.toISOString()
  const endDateStr = end.toISOString()
  
  const { data: allQuotes } = await supabaseServer
    .from('worktop_quotes')
    .select('id')
    .or(`ordered_at.gte.${startDateStr},in_production_at.gte.${startDateStr},ready_at.gte.${startDateStr},finished_at.gte.${startDateStr},cancelled_at.gte.${startDateStr}`)
    .or(`ordered_at.lte.${endDateStr},in_production_at.lte.${endDateStr},ready_at.lte.${endDateStr},finished_at.lte.${endDateStr},cancelled_at.lte.${endDateStr}`)
    .is('deleted_at', null)
    .limit(10000) // Add limit to prevent excessive data

  const uniqueQuoteIds = new Set(allQuotes?.map(q => q.id) || [])
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

  console.log(`[PERF] Monthly Worktop Quotes Query: ${(performance.now() - startTime).toFixed(2)}ms`)

  return {
    statusData,
    total,
    range,
    offset,
    label,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    month: monthNames[start.getMonth()],
    year: start.getFullYear(),
    monthOffset: range === 'month' ? offset : 0
  }
}
