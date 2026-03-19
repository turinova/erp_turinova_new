import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { sanitizeSignatureHtml } from '@/lib/email-signature-sanitize'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function getActiveConnectionId(supabase: Awaited<ReturnType<typeof getTenantSupabase>>) {
  const { data } = await supabase
    .from('email_smtp_connections')
    .select('id')
    .is('deleted_at', null)
    .maybeSingle()
  return data?.id as string | undefined
}

/**
 * GET — list identities for active connection
 */
export async function GET() {
  try {
    const supabase = await getTenantSupabase()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const connectionId = await getActiveConnectionId(supabase)
    if (!connectionId) {
      return NextResponse.json({ identities: [] })
    }

    const { data, error } = await supabase
      .from('email_sending_identities')
      .select('id, connection_id, from_name, from_email, signature_html, is_default, sort_order, created_at, updated_at')
      .eq('connection_id', connectionId)
      .is('deleted_at', null)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true })

    if (error) {
      console.error(error)
      return NextResponse.json({ error: 'Lista betöltése sikertelen' }, { status: 500 })
    }

    return NextResponse.json({ identities: data || [] })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST — create identity
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const connectionId = await getActiveConnectionId(supabase)
    if (!connectionId) {
      return NextResponse.json(
        { error: 'Előbb állítsa be és mentse a levelező szervert.' },
        { status: 400 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const from_name = String(body.from_name || '').trim()
    const from_email = String(body.from_email || '').trim().toLowerCase()
    const is_default = Boolean(body.is_default)
    let signature_html: string | null = null
    try {
      signature_html = body.signature_html != null ? sanitizeSignatureHtml(String(body.signature_html)) : null
    } catch (sigErr: unknown) {
      const msg = sigErr instanceof Error ? sigErr.message : 'Érvénytelen aláírás'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    if (!from_name || !from_email) {
      return NextResponse.json({ error: 'Feladó név és e-mail kötelező' }, { status: 400 })
    }
    if (!EMAIL_RE.test(from_email)) {
      return NextResponse.json({ error: 'Érvénytelen e-mail cím' }, { status: 400 })
    }

    const { data: inserted, error: insErr } = await supabase
      .from('email_sending_identities')
      .insert({
        connection_id: connectionId,
        from_name,
        from_email,
        signature_html,
        is_default
      })
      .select('id, connection_id, from_name, from_email, signature_html, is_default, sort_order, created_at, updated_at')
      .single()

    if (insErr) {
      if (insErr.code === '23505') {
        return NextResponse.json({ error: 'Ez az e-mail cím már szerepel a küldő címek között.' }, { status: 409 })
      }
      console.error(insErr)
      return NextResponse.json({ error: 'Mentés sikertelen' }, { status: 500 })
    }

    return NextResponse.json({ identity: inserted })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
