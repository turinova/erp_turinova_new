import { NextRequest, NextResponse } from 'next/server'

import { buildEmptyCustomerFacingHtml } from '../build-html'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const built = await buildEmptyCustomerFacingHtml(body, { preview: true })
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
  } catch (error) {
    console.error('[Ügyfélajánlat empty PDF preview]', error)
    return NextResponse.json({ error: 'Előnézet hiba' }, { status: 500 })
  }
}
