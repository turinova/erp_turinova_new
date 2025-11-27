import nodemailer from 'nodemailer'
import { supabaseServer } from './supabase-server'

interface SMTPConfig {
  host: string
  port: number
  secure: boolean
  user: string
  password: string
  fromEmail: string
  fromName: string
}

/**
 * Get active SMTP settings from database
 */
export async function getSMTPConfig(): Promise<SMTPConfig | null> {
  const { data, error } = await supabaseServer
    .from('smtp_settings')
    .select('host, port, secure, "user", password, from_email, from_name')
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle()

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
  }
}

/**
 * Send email using SMTP settings from database
 */
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}) {
  const config = await getSMTPConfig()

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

  const info = await transporter.sendMail({
    from: `"${config.fromName}" <${config.fromEmail}>`,
    to: to,
    subject: subject,
    html: html,
  })

  return { success: true, messageId: info.messageId }
}

