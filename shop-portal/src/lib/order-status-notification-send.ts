import type { SupabaseClient } from '@supabase/supabase-js'
import { sendSmtpMail, buildHtmlBody } from '@/lib/email-smtp-send'
import { sanitizeEmailBodyHtml, sanitizeSignatureHtml } from '@/lib/email-signature-sanitize'
import {
  buildOrderStatusNotificationContext,
  renderOrderStatusTemplate,
  type OrderRowForNotification
} from '@/lib/order-status-notification-merge'
import {
  buildOrderItemsTableHtml,
  type OrderItemRowForEmail
} from '@/lib/order-status-notification-items-table'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type SendOrderStatusNotificationParams = {
  orderId: string
  /** Previous DB status; null when first status (e.g. new order from buffer). */
  previousStatus: string | null
  newStatus: string
  actingUserId: string | null
}

/**
 * After a successful order status change: send customer e-mail if template enabled and not duplicate.
 * Never throws; logs errors to console.
 */
export async function sendOrderStatusEmailNotification(
  supabase: SupabaseClient,
  params: SendOrderStatusNotificationParams
): Promise<void> {
  const { orderId, previousStatus, newStatus, actingUserId } = params

  if (previousStatus !== null && previousStatus === newStatus) {
    return
  }

  try {
    const { data: existingLog } = await supabase
      .from('order_status_notification_log')
      .select('id')
      .eq('order_id', orderId)
      .eq('notified_status', newStatus)
      .maybeSingle()

    if (existingLog) {
      return
    }

    const { data: templateRow, error: tplErr } = await supabase
      .from('order_status_email_templates')
      .select('id, enabled, subject_template, body_html')
      .eq('order_status', newStatus)
      .maybeSingle()

    if (tplErr || !templateRow || !templateRow.enabled) {
      return
    }

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select(
        'id, order_number, status, customer_firstname, customer_lastname, customer_email, shipping_method_name, payment_method_name, total_gross, currency_code, tracking_number'
      )
      .eq('id', orderId)
      .is('deleted_at', null)
      .maybeSingle()

    if (orderErr || !order) {
      return
    }

    const to = String(order.customer_email || '').trim()
    if (!to || !EMAIL_RE.test(to)) {
      return
    }

    const { data: conn, error: cErr } = await supabase
      .from('email_smtp_connections')
      .select('*')
      .is('deleted_at', null)
      .maybeSingle()

    if (cErr || !conn || !conn.password || !conn.host) {
      console.warn('[order-status-email] No SMTP connection')
      return
    }

    const { data: channelRow } = await supabase
      .from('email_outbound_channel_settings')
      .select('order_status_notification_identity_id')
      .maybeSingle()

    const preferredIdentityId =
      (channelRow?.order_status_notification_identity_id as string | null) || null

    let identities: {
      id: string
      from_name: string
      from_email: string
      signature_html: string | null
      is_default: boolean
    }[] | null = null
    if (preferredIdentityId) {
      const res = await supabase
        .from('email_sending_identities')
        .select('id, from_name, from_email, signature_html, is_default')
        .eq('connection_id', conn.id)
        .eq('id', preferredIdentityId)
        .is('deleted_at', null)
        .limit(1)
      identities = res.data as typeof identities
    }

    if (!identities?.length) {
      const res = await supabase
        .from('email_sending_identities')
        .select('id, from_name, from_email, signature_html, is_default')
        .eq('connection_id', conn.id)
        .is('deleted_at', null)
        .eq('is_default', true)
        .limit(1)
      identities = res.data as typeof identities
    }

    if (!identities?.length) {
      console.warn('[order-status-email] No sending identity')
      return
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

    const shopDisplayName = String(identityRow.from_name || '').trim()

    const row = order as OrderRowForNotification
    const ctx = buildOrderStatusNotificationContext(row, newStatus, shopDisplayName)

    const { data: itemRows } = await supabase
      .from('order_items')
      .select('product_name, product_sku, quantity, line_total_gross, product_image_url')
      .eq('order_id', orderId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    const itemsForTable: OrderItemRowForEmail[] = (itemRows || []).map((r: Record<string, unknown>) => ({
      product_name: String(r.product_name ?? ''),
      product_sku: String(r.product_sku ?? ''),
      quantity: Number(r.quantity) || 0,
      line_total_gross: r.line_total_gross as number | string | null,
      product_image_url: (r.product_image_url as string | null) ?? null
    }))

    const orderItemsTableHtml = buildOrderItemsTableHtml(
      itemsForTable,
      ctx.order_total_gross,
      ctx.currency_code
    )

    const fullCtx: Record<string, string> = {
      ...ctx,
      order_items_table: orderItemsTableHtml
    }

    const subject = renderOrderStatusTemplate(
      String(templateRow.subject_template || ''),
      fullCtx,
      'subject'
    )
    if (!subject) {
      return
    }

    let bodyMain: string
    try {
      const rawBody = renderOrderStatusTemplate(
        String(templateRow.body_html || ''),
        fullCtx,
        'html'
      )
      bodyMain = sanitizeEmailBodyHtml(rawBody)
    } catch (e) {
      console.error('[order-status-email] Body sanitize failed', e)
      return
    }

    const htmlBody = buildHtmlBody(bodyMain, signatureSafe)

    const { data: logRow, error: logInsErr } = await supabase
      .from('email_outbound_messages')
      .insert({
        channel: 'email',
        kind: 'order_status_notification',
        status: 'pending',
        to_address: to,
        subject,
        identity_id: identityRow.id,
        body_preview: htmlBody.slice(0, 500),
        created_by: actingUserId,
        related_order_id: orderId,
        metadata: { order_status: newStatus, template_id: templateRow.id }
      })
      .select('id')
      .single()

    if (logInsErr || !logRow?.id) {
      console.error('[order-status-email] Outbound log insert failed', logInsErr)
      return
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

      const now = new Date().toISOString()

      await supabase
        .from('email_outbound_messages')
        .update({
          status: 'sent',
          provider_message_id: messageId || null,
          sent_at: now
        })
        .eq('id', logId)

      await supabase.from('order_status_notification_log').insert({
        order_id: orderId,
        notified_status: newStatus,
        email_outbound_message_id: logId,
        sent_at: now
      })
    } catch (sendErr: unknown) {
      console.error('[order-status-email] SMTP failed', sendErr)
      const msg = sendErr instanceof Error ? sendErr.message : 'Send error'
      await supabase
        .from('email_outbound_messages')
        .update({
          status: 'failed',
          error_text: msg.slice(0, 2000)
        })
        .eq('id', logId)
    }
  } catch (e) {
    console.error('[order-status-email] Unexpected', e)
  }
}
