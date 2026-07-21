import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { getPortalAuthContext } from '@/lib/nettfront-portal-auth'

/**
 * DELETE /api/nettfront-quotes/bulk-delete
 * Body: { quoteIds: string[] } — only own drafts preferred; any own quotes ok.
 */
export async function DELETE(request: NextRequest) {
  try {
    const ctx = await getPortalAuthContext()
    if ('error' in ctx) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status })
    }

    const { supabase, portalCustomer } = ctx
    const body = await request.json()
    const { quoteIds } = body

    if (!quoteIds || !Array.isArray(quoteIds) || quoteIds.length === 0) {
      return NextResponse.json({ error: 'No quotes selected for deletion' }, { status: 400 })
    }

    const { error } = await supabase
      .from('portal_nettfront_quotes')
      .delete()
      .in('id', quoteIds)
      .eq('portal_customer_id', portalCustomer.id)
      .eq('status', 'draft')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
