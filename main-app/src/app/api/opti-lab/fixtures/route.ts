import { NextRequest, NextResponse } from 'next/server'
import {
  exportHardFixtures,
  listFixtures
} from '@/lib/optimization/optiLabStore'

/** GET /api/opti-lab/fixtures — list exported fixtures */
export async function GET() {
  try {
    const fixtures = await listFixtures()
    return NextResponse.json({ fixtures })
  } catch (error) {
    console.error('opti-lab/fixtures GET', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/** POST /api/opti-lab/fixtures  { run_id, max? } — export hard fixtures from a run */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const runId = String(body.run_id || '')
    if (!runId) {
      return NextResponse.json({ error: 'run_id kötelező' }, { status: 400 })
    }
    const max = body.max ? Number(body.max) : 50
    const result = await exportHardFixtures({ run_id: runId, max })
    return NextResponse.json({
      count: result.fixtures.length,
      fixtures: result.fixtures.map((f) => ({
        id: f.id,
        quote_number: f.quote_number,
        reason: f.reason,
        outcome: f.outcome,
        delta_boards: f.delta_boards
      })),
      dir: 'opti-lab-fixtures/'
    })
  } catch (error) {
    console.error('opti-lab/fixtures POST', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
