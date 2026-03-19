import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { buildHtmlBody, sendSmtpMail } from '@/lib/email-smtp-send'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * POST — send test email; logs row in email_outbound_messages
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const to = String(body.to || '').trim()
    const identity_id = typeof body.identity_id === 'string' ? body.identity_id : null

    if (!to || !EMAIL_RE.test(to)) {
      return NextResponse.json({ error: 'Érvényes címzett e-mail szükséges' }, { status: 400 })
    }

    const { data: conn, error: cErr } = await supabase
      .from('email_smtp_connections')
      .select('*')
      .is('deleted_at', null)
      .maybeSingle()

    if (cErr || !conn) {
      return NextResponse.json({ error: 'Nincs mentett levelező szerver. Mentse a kapcsolatot előbb.' }, { status: 400 })
    }

    if (!conn.password || !conn.host) {
      return NextResponse.json({ error: 'Hiányos SMTP konfiguráció' }, { status: 400 })
    }

    let identityQuery = supabase
      .from('email_sending_identities')
      .select('id, from_name, from_email, signature_html, is_default')
      .eq('connection_id', conn.id)
      .is('deleted_at', null)

    if (identity_id) {
      identityQuery = identityQuery.eq('id', identity_id)
    } else {
      identityQuery = identityQuery.eq('is_default', true)
    }

    const { data: identities, error: iErr } = await identityQuery.limit(1)

    if (iErr || !identities?.length) {
      return NextResponse.json(
        { error: 'Nincs küldő cím. Vegyen fel legalább egyet, vagy válasszon identitást.' },
        { status: 400 }
      )
    }

    const identity = identities[0]
    const subject = 'Teszt üzenet — ERP levelezés'
    const mainHtml =
      '<p>Ez egy teszt üzenet a levelezés beállításaiból.</p><p>Ha megkapta, az SMTP konfiguráció működik.</p>'
    const htmlBody = buildHtmlBody(mainHtml, identity.signature_html)

    const { data: logRow, error: logInsErr } = await supabase
      .from('email_outbound_messages')
      .insert({
        channel: 'email',
        kind: 'test',
        status: 'pending',
        to_address: to,
        subject,
        identity_id: identity.id,
        body_preview: htmlBody.slice(0, 500),
        created_by: user.id
      })
      .select('id')
      .single()

    if (logInsErr || !logRow?.id) {
      console.error(logInsErr)
      return NextResponse.json({ error: 'Naplózás sikertelen' }, { status: 500 })
    }

    const logId = logRow.id as string

    try {
      const { messageId } = await sendSmtpMail({
        connection: {
          host: conn.host,
          port: conn.port,
          secure: conn.secure,
          smtp_username: conn.smtp_username,
          password: conn.password
        },
        identity: {
          from_name: identity.from_name,
          from_email: identity.from_email,
          signature_html: identity.signature_html
        },
        to,
        subject,
        htmlBody
      })

      await supabase
        .from('email_outbound_messages')
        .update({
          status: 'sent',
          provider_message_id: messageId || null,
          sent_at: new Date().toISOString()
        })
        .eq('id', logId)

      return NextResponse.json({ ok: true, messageId: messageId || null })
    } catch (sendErr: unknown) {
      console.error('[email/test] SMTP send failed:', sendErr)
      const msg = sendErr instanceof Error ? sendErr.message : 'Ismeretlen küldési hiba'
      await supabase
        .from('email_outbound_messages')
        .update({
          status: 'failed',
          error_text: msg.slice(0, 2000)
        })
        .eq('id', logId)

      return NextResponse.json(
        {
          error:
            'Küldés sikertelen. Ellenőrizze a szervert, a portot, a felhasználót és a jelszót.',
          detail: msg
        },
        { status: 502 }
      )
    }
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
