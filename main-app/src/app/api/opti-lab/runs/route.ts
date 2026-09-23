import { NextRequest, NextResponse } from 'next/server'
import { listRuns, saveRun } from '@/lib/optimization/optiLabStore'
import type {
  BatchSummary,
  QuoteCompareResult
} from '@/lib/optimization/compareScores'

/** GET /api/opti-lab/runs — list saved run metas */
export async function GET() {
  try {
    const runs = await listRuns()
    return NextResponse.json({ runs })
  } catch (error) {
    console.error('opti-lab/runs GET', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/** POST /api/opti-lab/runs — persist compare result */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const label = String(body.label || '').trim()
    if (!label) {
      return NextResponse.json({ error: 'label kötelező' }, { status: 400 })
    }
    if (!body.summary || !Array.isArray(body.quotes)) {
      return NextResponse.json(
        { error: 'summary + quotes kötelező' },
        { status: 400 }
      )
    }

    const meta = await saveRun({
      label,
      notes: body.notes ? String(body.notes) : '',
      baseline: body.baseline || {
        algorithm: 'multipanel',
        sortStrategy: 'height'
      },
      candidate: body.candidate || {
        algorithm: 'ensemble',
        sortStrategy: 'height'
      },
      summary: body.summary as BatchSummary,
      quotes: body.quotes as QuoteCompareResult[]
    })

    return NextResponse.json({ run: meta })
  } catch (error) {
    console.error('opti-lab/runs POST', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
