import { NextRequest, NextResponse } from 'next/server'

import { deletePortalCustomerQuote } from '@/lib/supabase-server'

type Ctx = { params: Promise<{ id: string }> }

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const quoteId = String(id || '').trim()
    if (!quoteId) {
      return NextResponse.json({ error: 'Hiányzó azonosító' }, { status: 400 })
    }

    const result = await deletePortalCustomerQuote(quoteId)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Törlés sikertelen'
    console.error('[Ügyfélajánlat delete]', error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
