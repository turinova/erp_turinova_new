import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function getActiveConnectionId(supabase: Awaited<ReturnType<typeof getTenantSupabase>>) {
  const { data: conn, error } = await supabase
    .from('email_smtp_connections')
    .select('id')
    .is('deleted_at', null)
    .maybeSingle()
  if (error) return { error: error.message, connectionId: null as string | null }
  return { error: null, connectionId: conn?.id as string | undefined ?? null }
}

async function validateIdentityForConnection(
  supabase: Awaited<ReturnType<typeof getTenantSupabase>>,
  connectionId: string,
  identityId: string | null
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!identityId) return { ok: true }
  if (!UUID_RE.test(identityId)) {
    return { ok: false, message: 'Érvénytelen küldő cím azonosító' }
  }
  const { data: row, error } = await supabase
    .from('email_sending_identities')
    .select('id')
    .eq('id', identityId)
    .eq('connection_id', connectionId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) {
    return { ok: false, message: 'Ellenőrzés sikertelen' }
  }
  if (!row) {
    return { ok: false, message: 'A kiválasztott küldő cím nem tartozik az aktív kapcsolathoz' }
  }
  return { ok: true }
}

/**
 * GET — channel → identity mapping (single row)
 */
export async function GET() {
  try {
    const supabase = await getTenantSupabase()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase.from('email_outbound_channel_settings').select('*').maybeSingle()

    if (error) {
      console.error('email channels GET:', error)
      return NextResponse.json({ error: 'Nem sikerült betölteni' }, { status: 500 })
    }

    return NextResponse.json({
      settings: {
        purchase_order_identity_id: (data?.purchase_order_identity_id as string | null) ?? null,
        order_status_notification_identity_id:
          (data?.order_status_notification_identity_id as string | null) ?? null
      }
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT — upsert channel settings (validates identity ids belong to active SMTP connection)
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const purchase_order_identity_id =
      body.purchase_order_identity_id === null || body.purchase_order_identity_id === ''
        ? null
        : String(body.purchase_order_identity_id)
    const order_status_notification_identity_id =
      body.order_status_notification_identity_id === null || body.order_status_notification_identity_id === ''
        ? null
        : String(body.order_status_notification_identity_id)

    const { error: cErr, connectionId } = await getActiveConnectionId(supabase)
    if (cErr) {
      return NextResponse.json({ error: cErr }, { status: 500 })
    }
    if (!connectionId) {
      return NextResponse.json(
        { error: 'Előbb állítson be levelező szervert, majd küldő címeket.' },
        { status: 400 }
      )
    }

    const v1 = await validateIdentityForConnection(supabase, connectionId, purchase_order_identity_id)
    if (!v1.ok) {
      return NextResponse.json({ error: v1.message }, { status: 400 })
    }
    const v2 = await validateIdentityForConnection(supabase, connectionId, order_status_notification_identity_id)
    if (!v2.ok) {
      return NextResponse.json({ error: v2.message }, { status: 400 })
    }

    const { data: existing, error: exErr } = await supabase
      .from('email_outbound_channel_settings')
      .select('id')
      .limit(1)
      .maybeSingle()

    if (exErr) {
      console.error(exErr)
      return NextResponse.json({ error: 'Adatbázis hiba' }, { status: 500 })
    }

    const payload = {
      purchase_order_identity_id,
      order_status_notification_identity_id,
      updated_at: new Date().toISOString()
    }

    if (existing?.id) {
      const { error: upErr } = await supabase
        .from('email_outbound_channel_settings')
        .update(payload)
        .eq('id', existing.id as string)
      if (upErr) {
        console.error(upErr)
        return NextResponse.json({ error: 'Mentés sikertelen' }, { status: 500 })
      }
    } else {
      const { error: insErr } = await supabase.from('email_outbound_channel_settings').insert(payload)
      if (insErr) {
        console.error(insErr)
        return NextResponse.json({ error: 'Mentés sikertelen' }, { status: 500 })
      }
    }

    return NextResponse.json({
      settings: {
        purchase_order_identity_id,
        order_status_notification_identity_id
      }
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
