import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

function budapestTodayYmd(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Budapest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date())
}

function budapestYesterdayYmd(): string {
  const todayKey = budapestTodayYmd()
  const y = Number(todayKey.slice(0, 4))
  const m = Number(todayKey.slice(5, 7))
  const d = Number(todayKey.slice(8, 10))
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() - 1)
  return dt.toISOString().slice(0, 10)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const before = searchParams.get('before') || budapestYesterdayYmd()

    const pageSize = 1000
    let offset = 0
    let total = 0

    while (true) {
      const { data, error } = await supabaseServer
        .from('quotes')
        .select(
          `
          id,
          quote_materials_pricing (
            cutting_length_m
          )
        `
        )
        .lt('production_date', before)
        .not('production_date', 'is', null)
        .is('deleted_at', null)
        .is('cancelled_at', null)
        .is('ready_at', null)
        .is('finished_at', null)
        .order('production_date', { ascending: true })
        .range(offset, offset + pageSize - 1)

      if (error) {
        console.error('Error fetching past remaining cutting data:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      const rows = (data || []) as any[]
      for (const q of rows) {
        const pricingRows = (q?.quote_materials_pricing || []) as any[]
        for (const pr of pricingRows) {
          const len = Number(pr?.cutting_length_m) || 0
          if (len > 0) total += len
        }
      }

      if (rows.length < pageSize) break
      offset += pageSize
    }

    return NextResponse.json({
      before,
      remainingTotalM: Math.round(total * 100) / 100
    })
  } catch (e) {
    console.error('Error in cutting remaining past API:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

