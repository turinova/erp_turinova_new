import { NextRequest, NextResponse } from 'next/server'

import { buildEmptyCustomerFacingHtml } from '@/app/api/ugyfel-ajanlat/pdf/build-html'
import { persistBuiltCustomerQuote } from '@/lib/persist-customer-quote'

/** Mentés PDF / Puppeteer nélkül. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const built = await buildEmptyCustomerFacingHtml(body, { preview: false })
    if (!built.ok) {
      return NextResponse.json({ error: built.error }, { status: built.status })
    }
    if (built.fromSnapshot) {
      return NextResponse.json(
        { error: 'Mentéshez szerkeszd az ajánlatot (ne snapshot módot használj).' },
        { status: 400 }
      )
    }

    const saved = await persistBuiltCustomerQuote(body, built)
    if (!saved.ok) {
      return NextResponse.json({ error: saved.error }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      id: saved.id,
      quoteNumber: built.quoteNumber,
      payableGross: built.payableGross
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Mentés sikertelen'
    console.error('[Ügyfélajánlat save]', error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
