import nodemailer from "nodemailer"

/**
 * Form mail: prefer SMTP when configured (Gmail / M365 / Rackhost).
 * Fallback: Resend API if only RESEND_API_KEY is set.
 */

export type FormEmailPayload = {
  subject: string
  text: string
  html: string
  replyTo?: string
  /** Override MAIL_TO */
  to?: string
}

const RESEND_ENDPOINT = "https://api.resend.com/emails"

function getSmtpConfig() {
  const host = process.env.SMTP_HOST?.trim()
  const port = Number(process.env.SMTP_PORT || "587")
  const user = process.env.SMTP_USER?.trim()
  // Gmail app passwords are often shown as "xxxx xxxx xxxx xxxx" — strip spaces
  const pass = process.env.SMTP_PASS?.trim().replace(/^["']|["']$/g, "").replace(/\s+/g, "")
  if (!host || !user || !pass) {
    return null
  }
  if (host.includes("gmail.com") && pass.length !== 16) {
    console.warn(
      `[mail] Gmail SMTP_PASS length is ${pass.length}; Google App Passwords are 16 characters (not your normal login password). See https://myaccount.google.com/apppasswords`,
    )
  }
  const secure = port === 465
  return {
    host,
    port,
    secure,
    requireTLS: !secure && port === 587,
    auth: { user, pass },
  }
}

export function isMailConfigured(): boolean {
  const to = Boolean(process.env.MAIL_TO)
  if (!to) return false
  if (process.env.RESEND_API_KEY) return true
  return getSmtpConfig() !== null
}

async function sendViaResend(payload: FormEmailPayload): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const to = payload.to || process.env.MAIL_TO
  // Testing: onboarding@resend.dev (only to your Resend account email).
  // Production: verify baugeneral.hu in Resend, then MAIL_FROM=@baugeneral.hu
  const from =
    process.env.MAIL_FROM || "BauGenerál weboldal <onboarding@resend.dev>"

  if (!apiKey || !to) {
    throw new Error("Resend nincs beállítva (RESEND_API_KEY, MAIL_TO).")
  }

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
      reply_to: payload.replyTo || undefined,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Resend ${res.status}: ${text.slice(0, 300)}`)
  }
}

async function sendViaSmtp(payload: FormEmailPayload): Promise<void> {
  const smtp = getSmtpConfig()
  const to = payload.to || process.env.MAIL_TO
  const from = process.env.MAIL_FROM || process.env.SMTP_USER

  if (!smtp || !to || !from) {
    throw new Error(
      "SMTP nincs beállítva (SMTP_HOST, SMTP_USER, SMTP_PASS, MAIL_TO).",
    )
  }

  const transporter = nodemailer.createTransport(smtp)

  await transporter.sendMail({
    from: `"BauGenerál weboldal" <${from}>`,
    to,
    replyTo: payload.replyTo,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
  })
}

export async function sendFormEmail(payload: FormEmailPayload): Promise<void> {
  if (getSmtpConfig()) {
    await sendViaSmtp(payload)
    return
  }
  if (process.env.RESEND_API_KEY) {
    await sendViaResend(payload)
    return
  }
  throw new Error(
    "Nincs e-mail küldő (SMTP_* vagy RESEND_API_KEY + MAIL_TO).",
  )
}
