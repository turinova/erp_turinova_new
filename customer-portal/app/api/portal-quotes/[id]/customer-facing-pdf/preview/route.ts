import { NextRequest, NextResponse } from 'next/server'
import { buildOptiCustomerFacingHtml } from '../build-html'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: quote_id } = await params
    if (!quote_id || quote_id === 'new') {
      return NextResponse.json({ error: 'Érvénytelen árajánlat azonosító' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const built = await buildOptiCustomerFacingHtml(quote_id, body, { preview: true })
    if (!built.ok) {
      return NextResponse.json({ error: built.error }, { status: built.status })
    }

    return new NextResponse(built.html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store'
      }
    })
  } catch (error: any) {
    console.error('[Customer-facing PDF preview]', error)
    return NextResponse.json(
      { error: error?.message || 'Előnézet sikertelen' },
      { status: 500 }
    )
  }
}
