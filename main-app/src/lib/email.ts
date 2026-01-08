import nodemailer from 'nodemailer'
import Imap from 'imap'
import { supabaseServer } from './supabase-server'

interface SMTPConfig {
  host: string
  port: number
  secure: boolean
  user: string
  password: string
  fromEmail: string
  fromName: string
  imapHost: string
  imapPort: number
  imapSecure: boolean
}

/**
 * Get SMTP settings from database
 * @param smtpSettingId Optional: specific SMTP setting ID to use. If not provided, returns first active account (backward compatible)
 */
export async function getSMTPConfig(smtpSettingId?: string): Promise<SMTPConfig | null> {
  let query = supabaseServer
    .from('smtp_settings')
    .select('host, port, secure, "user", password, from_email, from_name, imap_host, imap_port, imap_secure')
    .is('deleted_at', null)

  if (smtpSettingId) {
    // Get specific account by ID
    query = query.eq('id', smtpSettingId)
  } else {
    // Get first active account (backward compatible)
    query = query.eq('is_active', true)
  }

  const { data, error } = await query.maybeSingle()

  if (error || !data) {
    return null
  }

  return {
    host: data.host,
    port: data.port,
    secure: data.secure,
    user: data.user,
    password: data.password, // TODO: Decrypt if encrypted
    fromEmail: data.from_email,
    fromName: data.from_name,
    imapHost: data.imap_host,
    imapPort: data.imap_port,
    imapSecure: data.imap_secure,
  }
}

/**
 * Send email using SMTP settings from database
 * @param smtpSettingId Optional: specific SMTP setting ID to use. If not provided, uses first active account (backward compatible)
 */
export async function sendEmail({
  to,
  subject,
  html,
  smtpSettingId,
}: {
  to: string
  subject: string
  html: string
  smtpSettingId?: string
}) {
  const config = await getSMTPConfig(smtpSettingId)

  if (!config) {
    throw new Error('SMTP beállítások nem találhatók. Kérjük, konfigurálja az email beállításokat.')
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.password,
    },
  })

  const mailOptions = {
    from: `"${config.fromName}" <${config.fromEmail}>`,
    to: to,
    subject: subject,
    html: html,
  }

  const info = await transporter.sendMail(mailOptions)

  // Copy email to Sent folder via IMAP
  try {
    await copyEmailToSentFolder({
      config,
      mailOptions,
      messageId: info.messageId || `<${Date.now()}.${Math.random().toString(36)}@${config.host}>`,
    })
  } catch (imapError: any) {
    // Log IMAP error but don't fail the email send
    console.error('Error copying email to Sent folder via IMAP:', imapError)
    // Email was already sent successfully, so we continue
  }

  return { success: true, messageId: info.messageId }
}

/**
 * Copy sent email to Sent folder via IMAP
 */
async function copyEmailToSentFolder({
  config,
  mailOptions,
  messageId,
}: {
  config: SMTPConfig
  mailOptions: { from: string; to: string; subject: string; html: string }
  messageId: string
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: config.user,
      password: config.password,
      host: config.imapHost,
      port: config.imapPort,
      tls: config.imapSecure,
      tlsOptions: { rejectUnauthorized: false }, // Allow self-signed certificates
    })

    let timeout: NodeJS.Timeout | null = null

    imap.once('ready', () => {
      // List all mailboxes to find Sent folder
      imap.getBoxes((err, boxes) => {
        if (err) {
          imap.end()
          reject(err)
          return
        }

        // Find Sent folder (try common names)
        const findSentFolder = (boxList: any, prefix: string = ''): string | null => {
          for (const [name, box] of Object.entries(boxList)) {
            const fullName = prefix ? `${prefix}.${name}` : name
            const lowerName = name.toLowerCase()
            
            if (lowerName === 'sent' || lowerName === 'sent items' || lowerName.includes('sent')) {
              return fullName
            }
            
            if (box.children) {
              const found = findSentFolder(box.children, fullName)
              if (found) return found
            }
          }
          return null
        }

        const sentFolderName = findSentFolder(boxes) || 'Sent'

        // Open Sent folder
        imap.openBox(sentFolderName, true, (openErr, box) => {
          if (openErr) {
            imap.end()
            reject(new Error(`Cannot open Sent folder "${sentFolderName}": ${openErr.message}`))
            return
          }

          // Create proper RFC 822 message format
          const date = new Date()
          const dateStr = date.toUTCString()
          
          // Escape subject and from/to fields
          const escapeHeader = (str: string) => {
            // If contains special chars, encode
            if (/[^\x20-\x7E]/.test(str)) {
              return `=?UTF-8?B?${Buffer.from(str).toString('base64')}?=`
            }
            return str
          }

          // Build proper RFC 822 email message
          // Ensure messageId is properly formatted
          const formattedMessageId = messageId.startsWith('<') ? messageId : `<${messageId}>`
          
          // Encode HTML body in base64 (split into lines for RFC compliance)
          const htmlBase64 = Buffer.from(mailOptions.html, 'utf-8').toString('base64')
          const htmlBody = htmlBase64.match(/.{1,76}/g)?.join('\r\n') || htmlBase64
          
          const message = [
            `From: ${mailOptions.from}`,
            `To: ${mailOptions.to}`,
            `Subject: ${escapeHeader(mailOptions.subject)}`,
            `Message-ID: ${formattedMessageId}`,
            `Date: ${dateStr}`,
            `MIME-Version: 1.0`,
            `Content-Type: text/html; charset=UTF-8`,
            `Content-Transfer-Encoding: base64`,
            ``,
            htmlBody,
          ].join('\r\n')

          // Append message to Sent folder
          imap.append(message, { mailbox: sentFolderName }, (appendErr) => {
            if (timeout) clearTimeout(timeout)
            imap.end()
            if (appendErr) {
              reject(appendErr)
            } else {
              resolve()
            }
          })
        })
      })
    })

    imap.once('error', (err: Error) => {
      if (timeout) clearTimeout(timeout)
      reject(err)
    })

    // Set timeout for connection
    timeout = setTimeout(() => {
      imap.end()
      reject(new Error('IMAP connection timeout'))
    }, 30000) // 30 seconds

    imap.connect()
  })
}

