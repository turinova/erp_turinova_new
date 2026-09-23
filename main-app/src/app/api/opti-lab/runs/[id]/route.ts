import { NextRequest, NextResponse } from 'next/server'
import { loadRun } from '@/lib/optimization/optiLabStore'

/** GET /api/opti-lab/runs/[id] */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const run = await loadRun(id)
    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }
    return NextResponse.json({ run })
  } catch (error) {
    console.error('opti-lab/runs/[id]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
