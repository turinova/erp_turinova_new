import { NextResponse } from 'next/server'

import { getYearlyMachineCuttingAvgLineData } from '@/lib/dashboard-server'

export async function GET() {
  try {
    const data = await getYearlyMachineCuttingAvgLineData()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in yearly machine cutting avg line API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
