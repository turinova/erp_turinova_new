import 'server-only'
import nodemailer from 'nodemailer'

export type SmtpConnectionRow = {
  host: string
  port: number
  secure: boolean
  smtp_username: string
  password: string
}

export type SendMailIdentity = {
  from_name: string
  from_email: string
  signature_html: string | null
}

export function buildHtmlBody(mainHtml: string, signatureHtml: string | null): string {
  const sig = (signatureHtml || '').trim()
  if (!sig) return mainHtml
  return `${mainHtml}<br/><br/>${sig}`
}

/** Domain part for EHLO / SNI (some providers reject localhost) */
function domainFromEmail(email: string): string | undefined {
  const at = email.lastIndexOf('@')
  if (at < 0) return undefined
  const d = email.slice(at + 1).trim().toLowerCase()
  return d || undefined
}

/**
 * Map stored UI flags to what nodemailer expects.
 * - 465 = implicit TLS (SMTPS) → must use secure: true regardless of checkbox
 * - 587 / 2525 = STARTTLS → secure: false + requireTLS
 * - 25 = often no TLS initially; do not force requireTLS
 */
function buildTransportConfig(
  connection: SmtpConnectionRow,
  ehloName: string | undefined,
  authMethod?: 'PLAIN' | 'LOGIN'
): nodemailer.TransportOptions {
  const host = connection.host.trim()
  const port = Number(connection.port)
  let secure = Boolean(connection.secure)

  if (port === 465) {
    secure = true
  } else if (port === 587 || port === 2525) {
    secure = false
  }

  const requireTLS = !secure && (port === 587 || port === 2525)

  return {
    host,
    port,
    secure,
    requireTLS,
    ...(authMethod ? { authMethod } : {}),
    auth: {
      user: connection.smtp_username.trim(),
      pass: connection.password
    },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
    name: ehloName,
    tls: {
      servername: host,
      minVersion: 'TLSv1.2'
    }
  }
}

function isNodemailerAuthError(err: unknown): err is { code: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === 'EAUTH'
  )
}

export async function sendSmtpMail(params: {
  connection: SmtpConnectionRow
  identity: SendMailIdentity
  to: string
  subject: string
  htmlBody: string
}): Promise<{ messageId?: string }> {
  const { connection, identity, to, subject, htmlBody } = params

  const ehlo =
    domainFromEmail(identity.from_email) ||
    domainFromEmail(connection.smtp_username) ||
    undefined

  const from = `"${identity.from_name.replace(/"/g, '\\"')}" <${identity.from_email}>`
  const mailOpts = { from, to, subject, html: htmlBody }

  const transporter = nodemailer.createTransport(buildTransportConfig(connection, ehlo))
  try {
    const info = await transporter.sendMail(mailOpts)
    return { messageId: info.messageId }
  } catch (err) {
    if (isNodemailerAuthError(err)) {
      const transporterLogin = nodemailer.createTransport(
        buildTransportConfig(connection, ehlo, 'LOGIN')
      )
      const info = await transporterLogin.sendMail(mailOpts)
      return { messageId: info.messageId }
    }
    throw err
  }
}
