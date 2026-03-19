import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { buildHtmlBody, sendSmtpMail } from '@/lib/email-smtp-send'
import { sanitizeEmailBodyHtml, sanitizeSignatureHtml } from '@/lib/email-signature-sanitize'
import {
  orderStatusLabelHu,
  renderOrderStatusTemplate,
  sampleOrderStatusNotificationContext
} from '@/lib/order-status-notification-merge'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const ALLOWED = new Set([
  'pending_review',
  'new',
  'picking',
  'picked',
  'verifying',
  'packing',
  'awaiting_carrier',
  'shipped',
  'ready_for_pickup',
  'delivered',
  'cancelled',
  'refunded'
])

/**
 * POST — test send for one status template (sample merge data). Body: { order_status, to? }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await getTenantSupabase()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const order_status = typeof body.order_status === 'string' ? body.order_status : ''
    let to = typeof body.to === 'string' ? body.to.trim() : ''

    if (!ALLOWED.has(order_status)) {
      return NextResponse.json({ error: 'Érvénytelen order_status' }, { status: 400 })
    }

    if (!to) {
      const u = user as { email?: string }
      to = (u.email || '').trim()
    }
    if (!to || !EMAIL_RE.test(to)) {
      return NextResponse.json({ error: 'Érvényes címzett e-mail szükséges (to vagy bejelentkezett user e-mail)' }, { status: 400 })
    }

    const { data: tpl, error: tplErr } = await supabase
      .from('order_status_email_templates')
      .select('id, subject_template, body_html')
      .eq('order_status', order_status)
      .maybeSingle()

    if (tplErr || !tpl) {
      return NextResponse.json({ error: 'Sablon nem található' }, { status: 404 })
    }

    const { data: conn, error: cErr } = await supabase
      .from('email_smtp_connections')
      .select('*')
      .is('deleted_at', null)
      .maybeSingle()

    if (cErr || !conn?.password || !conn?.host) {
      return NextResponse.json({ error: 'Nincs érvényes SMTP beállítás' }, { status: 400 })
    }

    const { data: channelRow } = await supabase
      .from('email_outbound_channel_settings')
      .select('order_status_notification_identity_id')
      .maybeSingle()

    const preferredId = (channelRow?.order_status_notification_identity_id as string | null) || null

    let identities:
      | { id: string; from_name: string; from_email: string; signature_html: string | null }[]
      | null = null

    if (preferredId) {
      const res = await supabase
        .from('email_sending_identities')
        .select('id, from_name, from_email, signature_html')
        .eq('connection_id', conn.id)
        .eq('id', preferredId)
        .is('deleted_at', null)
        .limit(1)
      identities = res.data as typeof identities
    }

    if (!identities?.length) {
      const res = await supabase
        .from('email_sending_identities')
        .select('id, from_name, from_email, signature_html')
        .eq('connection_id', conn.id)
        .is('deleted_at', null)
        .eq('is_default', true)
        .limit(1)
      identities = res.data as typeof identities
    }

    if (!identities?.length) {
      return NextResponse.json({ error: 'Nincs küldő cím' }, { status: 400 })
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

    const sample = sampleOrderStatusNotificationContext()
    sample.status_label = orderStatusLabelHu(order_status)

    const subject =
      '[TESZT] ' +
      renderOrderStatusTemplate(String(tpl.subject_template), sample as Record<string, string>, 'subject')

    let bodyMain: string
    try {
      const raw = renderOrderStatusTemplate(String(tpl.body_html), sample as Record<string, string>, 'html')
      bodyMain = sanitizeEmailBodyHtml(raw)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'HTML hiba'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const htmlBody = buildHtmlBody(bodyMain, signatureSafe)

    const { data: logRow, error: logInsErr } = await supabase
      .from('email_outbound_messages')
      .insert({
        channel: 'email',
        kind: 'order_status_notification_test',
        status: 'pending',
        to_address: to,
        subject,
        identity_id: identityRow.id,
        body_preview: htmlBody.slice(0, 500),
        created_by: user.id,
        metadata: { order_status, test: true }
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
          from_name: identityRow.from_name,
          from_email: identityRow.from_email,
          signature_html: signatureSafe
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
      console.error(sendErr)
      const msg = sendErr instanceof Error ? sendErr.message : 'Küldési hiba'
      await supabase
        .from('email_outbound_messages')
        .update({ status: 'failed', error_text: msg.slice(0, 2000) })
        .eq('id', logId)
      return NextResponse.json({ error: 'Küldés sikertelen', detail: msg }, { status: 502 })
    }
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
