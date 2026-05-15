import nodemailer from "nodemailer"

export type FormEmailPayload = {
  subject: string
  text: string
  html: string
  replyTo?: string
}

function getSmtpConfig() {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || "465")
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!host || !user || !pass) {
    return null
  }
  return {
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  }
}

export function isMailConfigured(): boolean {
  return getSmtpConfig() !== null && Boolean(process.env.MAIL_TO)
}

export async function sendFormEmail(payload: FormEmailPayload): Promise<void> {
  const smtp = getSmtpConfig()
  const to = process.env.MAIL_TO
  const from = process.env.MAIL_FROM || process.env.SMTP_USER

  if (!smtp || !to || !from) {
    throw new Error("SMTP nincs beállítva (SMTP_HOST, SMTP_USER, SMTP_PASS, MAIL_TO).")
  }

  const transporter = nodemailer.createTransport(smtp)

  await transporter.sendMail({
    from: `"Hírös-Ablak weboldal" <${from}>`,
    to,
    replyTo: payload.replyTo,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
  })
}
