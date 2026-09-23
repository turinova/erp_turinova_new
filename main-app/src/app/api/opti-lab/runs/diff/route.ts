import { NextRequest, NextResponse } from 'next/server'
import { diffRuns } from '@/lib/optimization/optiLabStore'

/** POST /api/opti-lab/runs/diff  { run_a, run_b } */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const runA = String(body.run_a || '')
    const runB = String(body.run_b || '')
    if (!runA || !runB) {
      return NextResponse.json(
        { error: 'run_a és run_b kötelező' },
        { status: 400 }
      )
    }
    const diff = await diffRuns(runA, runB)
    if (!diff) {
      return NextResponse.json(
        { error: 'Az egyik run nem található' },
        { status: 404 }
      )
    }
    return NextResponse.json({ diff })
  } catch (error) {
    console.error('opti-lab/runs/diff', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
