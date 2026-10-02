import nodemailer from 'nodemailer'

import type { EmailResult } from '@/lib/email/send'

/**
 * Turinova / Rackhost SMTP (marketing lead, kapcsolat, várólista).
 * Env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
 * Opcionális: SMTP_SECURE (default: port 465 → true), SMTP_FROM
 */

export function smtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim()
  )
}

function smtpPort(): number {
  const raw = process.env.SMTP_PORT?.trim()
  const n = raw ? Number(raw) : 465
  return Number.isFinite(n) && n > 0 ? n : 465
}

function smtpSecure(port: number): boolean {
  const raw = process.env.SMTP_SECURE?.trim().toLowerCase()
  if (raw === '1' || raw === 'true') return true
  if (raw === '0' || raw === 'false') return false
  return port === 465
}

export async function sendSmtpEmail(input: {
  to: string
  subject: string
  text: string
  html: string
  replyTo?: string | null
  fromName?: string
}): Promise<EmailResult> {
  if (!smtpConfigured()) {
    return {
      ok: false,
      error: 'Az SMTP nincs beállítva (SMTP_HOST, SMTP_USER, SMTP_PASS).'
    }
  }

  const host = process.env.SMTP_HOST!.trim()
  const user = process.env.SMTP_USER!.trim()
  const pass = process.env.SMTP_PASS!.trim()
  const port = smtpPort()
  const secure = smtpSecure(port)
  const fromAddr = (process.env.SMTP_FROM?.trim() || user).trim()
  const display = (input.fromName || 'Turinova')
    .replace(/["<>\r\n]/g, '')
    .trim()
    .slice(0, 80)
  const from = display ? `"${display}" <${fromAddr}>` : fromAddr

  try {
    const transport = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000
    })

    const info = await transport.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      ...(input.replyTo ? { replyTo: input.replyTo } : {})
    })

    return { ok: true, id: info.messageId ?? null }
  } catch (e) {
    return {
      ok: false,
      error: (e instanceof Error ? e.message : 'SMTP hiba').slice(0, 500)
    }
  }
}
