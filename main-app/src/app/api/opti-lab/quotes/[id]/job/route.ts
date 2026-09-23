import { NextRequest, NextResponse } from 'next/server'
import { buildJobFromQuoteId } from '@/lib/optimization/buildJobFromQuote'

/**
 * GET /api/opti-lab/quotes/[id]/job
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ error: 'Missing quote id' }, { status: 400 })
    }

    const job = await buildJobFromQuoteId(id)
    if (!job) {
      return NextResponse.json(
        { error: 'Ajánlat nem található, vagy nincs panelje.' },
        { status: 404 }
      )
    }

    return NextResponse.json(job)
  } catch (error) {
    console.error('opti-lab/job', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
