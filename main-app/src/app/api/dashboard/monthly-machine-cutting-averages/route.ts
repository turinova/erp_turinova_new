import { NextRequest, NextResponse } from 'next/server'

import { getMonthlyMachineCuttingAverages } from '@/lib/dashboard-server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const monthOffset = parseInt(searchParams.get('monthOffset') || '0', 10)

    if (Number.isNaN(monthOffset)) {
      return NextResponse.json({ error: 'Érvénytelen monthOffset' }, { status: 400 })
    }

    const data = await getMonthlyMachineCuttingAverages(monthOffset)
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in monthly machine cutting averages API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
