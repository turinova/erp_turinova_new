import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { sendSmtpMail } from '@/lib/email-smtp-send'
import { sanitizeEmailBodyHtml, sanitizeSignatureHtml } from '@/lib/email-signature-sanitize'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * POST — send PO e-mail to supplier; sets email_sent / email_sent_at (updated each send) and logs outbound row.
 * While status is draft, sending is allowed multiple times.
 */
export async function POST(
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

    const body = await request.json().catch(() => ({}))
    const to = String(body.to || '').trim()
    const subject = String(body.subject || '').trim()
    const htmlBodyRaw = String(body.html_body || '')
    const identityId = typeof body.identity_id === 'string' ? body.identity_id : null

    if (!to || !EMAIL_RE.test(to)) {
      return NextResponse.json({ error: 'Érvényes címzett e-mail szükséges' }, { status: 400 })
    }
    if (!subject || subject.length > 998) {
      return NextResponse.json({ error: 'Érvényes tárgy szükséges' }, { status: 400 })
    }

    let htmlBody: string
    try {
      htmlBody = sanitizeEmailBodyHtml(htmlBodyRaw)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Érvénytelen HTML'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const { data: po, error: poErr } = await supabase
      .from('purchase_orders')
      .select('id, status, supplier_id, po_number')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (poErr || !po) {
      return NextResponse.json({ error: 'Beszerzési rendelés nem található' }, { status: 404 })
    }

    if (po.status !== 'draft') {
      return NextResponse.json(
        { error: 'Csak vázlat státuszú rendelés küldhető e-mailben.' },
        { status: 400 }
      )
    }

    const { data: emailChannels } = await supabase
      .from('supplier_order_channels')
      .select('id')
      .eq('supplier_id', po.supplier_id)
      .eq('channel_type', 'email')
      .is('deleted_at', null)
      .limit(1)

    if (!emailChannels?.length) {
      return NextResponse.json(
        { error: 'A beszállítónak nincs e-mail rendelési csatornája.' },
        { status: 400 }
      )
    }

    const { data: conn, error: cErr } = await supabase
      .from('email_smtp_connections')
      .select('*')
      .is('deleted_at', null)
      .maybeSingle()

    if (cErr || !conn || !conn.password || !conn.host) {
      return NextResponse.json(
        { error: 'Nincs érvényes SMTP beállítás. Állítsa be a levelezést a Beállítások alatt.' },
        { status: 400 }
      )
    }

    let identityQuery = supabase
      .from('email_sending_identities')
      .select('id, from_name, from_email, signature_html')
      .eq('connection_id', conn.id)
      .is('deleted_at', null)

    if (identityId) {
      identityQuery = identityQuery.eq('id', identityId)
    } else {
      identityQuery = identityQuery.eq('is_default', true)
    }

    const { data: identities, error: iErr } = await identityQuery.limit(1)

    if (iErr || !identities?.length) {
      return NextResponse.json(
        { error: 'Nincs választható küldő cím. Vegyen fel identitást a levelezés beállításaiban.' },
        { status: 400 }
      )
    }

    const identityRow = identities[0]
    let signatureSafe: string | null = null
    try {
      signatureSafe = identityRow.signature_html
        ? sanitizeSignatureHtml(identityRow.signature_html)
        : null
    } catch {
      signatureSafe = null
    }

    const identity = {
      from_name: identityRow.from_name,
      from_email: identityRow.from_email,
      signature_html: signatureSafe
    }

    const { data: logRow, error: logInsErr } = await supabase
      .from('email_outbound_messages')
      .insert({
        channel: 'email',
        kind: 'purchase_order',
        status: 'pending',
        to_address: to,
        subject,
        identity_id: identityRow.id,
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
        identity,
        to,
        subject,
        htmlBody
      })

      const now = new Date().toISOString()

      await supabase
        .from('email_outbound_messages')
        .update({
          status: 'sent',
          provider_message_id: messageId || null,
          sent_at: now
        })
        .eq('id', logId)

      await supabase
        .from('purchase_orders')
        .update({
          email_sent: true,
          email_sent_at: now,
          updated_at: now
        })
        .eq('id', id)

      return NextResponse.json({ ok: true, messageId: messageId || null })
    } catch (sendErr: unknown) {
      console.error('[send-email] SMTP failed:', sendErr)
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
          error: 'Küldés sikertelen. Ellenőrizze az SMTP beállításokat.',
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
