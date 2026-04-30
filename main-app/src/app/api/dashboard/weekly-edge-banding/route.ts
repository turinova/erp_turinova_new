import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

const WEEK_DAYS = ['Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat']
const CAPACITY_PER_DAY_M = 500

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const weekOffset = parseInt(searchParams.get('weekOffset') || '0', 10)

    const now = new Date()
    const currentDay = now.getDay()

    const monday = new Date(now)
    const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1
    monday.setDate(now.getDate() - daysFromMonday)
    monday.setDate(monday.getDate() + weekOffset * 7)
    monday.setHours(0, 0, 0, 0)

    const saturday = new Date(monday)
    saturday.setDate(monday.getDate() + 5)
    saturday.setHours(23, 59, 59, 999)

    const startYmd = monday.toISOString().split('T')[0]
    const endYmd = saturday.toISOString().split('T')[0]

    // Fetch quotes for the week (in_production) + nested pricing + edge breakdown.
    const { data: weeklyQuotes, error } = await supabaseServer
      .from('quotes')
      .select(
        `
        id,
        production_date,
        status,
        quote_materials_pricing (
          id,
          quote_edge_materials_breakdown (
            edge_material_id,
            edge_material_name,
            total_length_m
          )
        )
      `
      )
      .eq('status', 'in_production')
      .gte('production_date', startYmd)
      .lte('production_date', endYmd)
      .not('production_date', 'is', null)
      .is('deleted_at', null)
      .order('production_date', { ascending: true })

    if (error) {
      console.error('Error fetching weekly edge banding data:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Map: edge_material_id -> { name, data[6] }
    const byMaterial = new Map<string, { name: string; data: number[] }>()
    const dailyTotals = [0, 0, 0, 0, 0, 0]

    for (const q of weeklyQuotes || []) {
      const dateStr = (q as any).production_date as string | null
      if (!dateStr) continue
      const date = new Date(dateStr)
      const dow = date.getDay()
      if (dow === 0) continue
      const dayIndex = dow - 1
      if (dayIndex < 0 || dayIndex > 5) continue

      const pricingRows = ((q as any).quote_materials_pricing || []) as any[]
      for (const pr of pricingRows) {
        const edges = (pr?.quote_edge_materials_breakdown || []) as any[]
        for (const e of edges) {
          const edgeId = String(e.edge_material_id || '')
          if (!edgeId) continue
          const name = String(e.edge_material_name || 'Ismeretlen élzáró')
          const len = Number(e.total_length_m) || 0
          if (len <= 0) continue

          if (!byMaterial.has(edgeId)) {
            byMaterial.set(edgeId, { name, data: [0, 0, 0, 0, 0, 0] })
          }
          const row = byMaterial.get(edgeId)!
          row.data[dayIndex] += len
          dailyTotals[dayIndex] += len
        }
      }
    }

    // Stable ordering: by total desc, then name asc
    const series = Array.from(byMaterial.entries())
      .map(([id, v]) => ({
        id,
        name: v.name,
        data: v.data.map(x => Math.round(x * 100) / 100)
      }))
      .sort((a, b) => {
        const ta = a.data.reduce((s, x) => s + x, 0)
        const tb = b.data.reduce((s, x) => s + x, 0)
        if (tb !== ta) return tb - ta
        return a.name.localeCompare(b.name, 'hu')
      })
      .map(({ name, data }) => ({ name, data }))

    const capacityPerDay = [
      CAPACITY_PER_DAY_M,
      CAPACITY_PER_DAY_M,
      CAPACITY_PER_DAY_M,
      CAPACITY_PER_DAY_M,
      CAPACITY_PER_DAY_M,
      CAPACITY_PER_DAY_M
    ]

    return NextResponse.json({
      categories: WEEK_DAYS,
      series,
      dailyTotals: dailyTotals.map(x => Math.round(x * 100) / 100),
      capacityPerDay,
      weekStart: startYmd,
      weekEnd: endYmd
    })
  } catch (error) {
    console.error('Error in weekly edge banding API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

