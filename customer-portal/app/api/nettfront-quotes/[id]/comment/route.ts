import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { getPortalAuthContext } from '@/lib/nettfront-portal-auth'

/**
 * PATCH /api/nettfront-quotes/[id]/comment
 * Update comment on draft Nettfront portal quote (max 250 chars).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const comment = typeof body.comment === 'string' ? body.comment : ''

    if (comment.length > 250) {
      return NextResponse.json({ error: 'A megjegyzés maximum 250 karakter lehet.' }, { status: 400 })
    }

    const ctx = await getPortalAuthContext()
    if ('error' in ctx) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status })
    }

    const { supabase, portalCustomer } = ctx

    const { data: existing, error: fetchErr } = await supabase
      .from('portal_nettfront_quotes')
      .select('id, status')
      .eq('id', id)
      .eq('portal_customer_id', portalCustomer.id)
      .maybeSingle()

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Ajánlat nem található' }, { status: 404 })
    }

    if (existing.status !== 'draft') {
      return NextResponse.json(
        { error: 'A megjegyzés csak piszkozat státuszban szerkeszthető.' },
        { status: 400 }
      )
    }

    const { error: updErr } = await supabase
      .from('portal_nettfront_quotes')
      .update({
        comment: comment.trim() || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, comment: comment.trim() || null })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
