import { NextRequest, NextResponse } from 'next/server'
import { buildNettfrontCustomerFacingHtml } from '../build-html'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id || id === 'new') {
      return NextResponse.json({ error: 'Érvénytelen árajánlat azonosító' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const built = await buildNettfrontCustomerFacingHtml(id, body, { preview: true })
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
    console.error('[Nettfront customer-facing PDF preview]', error)
    return NextResponse.json(
      { error: error?.message || 'Előnézet sikertelen' },
      { status: 500 }
    )
  }
}
