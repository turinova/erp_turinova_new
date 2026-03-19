import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { sanitizeSignatureHtml } from '@/lib/email-signature-sanitize'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: row, error: fErr } = await supabase
      .from('email_sending_identities')
      .select('id, connection_id')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()

    if (fErr || !row) {
      return NextResponse.json({ error: 'Nem található' }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))
    const from_name = String(body.from_name || '').trim()
    const from_email = String(body.from_email || '').trim().toLowerCase()
    const is_default = Boolean(body.is_default)
    let signature_html: string | null | undefined
    if (body.signature_html !== undefined) {
      try {
        signature_html = sanitizeSignatureHtml(String(body.signature_html))
      } catch (sigErr: unknown) {
        const msg = sigErr instanceof Error ? sigErr.message : 'Érvénytelen aláírás'
        return NextResponse.json({ error: msg }, { status: 400 })
      }
    }

    if (!from_name || !from_email) {
      return NextResponse.json({ error: 'Feladó név és e-mail kötelező' }, { status: 400 })
    }
    if (!EMAIL_RE.test(from_email)) {
      return NextResponse.json({ error: 'Érvénytelen e-mail cím' }, { status: 400 })
    }

    const updatePayload: Record<string, unknown> = {
      from_name,
      from_email,
      is_default,
      updated_at: new Date().toISOString()
    }
    if (signature_html !== undefined) {
      updatePayload.signature_html = signature_html
    }

    const { data: updated, error: uErr } = await supabase
      .from('email_sending_identities')
      .update(updatePayload)
      .eq('id', id)
      .select('id, connection_id, from_name, from_email, signature_html, is_default, sort_order, created_at, updated_at')
      .single()

    if (uErr) {
      if (uErr.code === '23505') {
        return NextResponse.json({ error: 'Ez az e-mail cím már foglalt.' }, { status: 409 })
      }
      console.error(uErr)
      return NextResponse.json({ error: 'Mentés sikertelen' }, { status: 500 })
    }

    return NextResponse.json({ identity: updated })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: row, error: fErr } = await supabase
      .from('email_sending_identities')
      .select('id')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()

    if (fErr || !row) {
      return NextResponse.json({ error: 'Nem található' }, { status: 404 })
    }

    const now = new Date().toISOString()
    const { error: dErr } = await supabase
      .from('email_sending_identities')
      .update({ deleted_at: now, updated_at: now })
      .eq('id', id)

    if (dErr) {
      return NextResponse.json({ error: 'Törlés sikertelen' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
