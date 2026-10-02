'use server'

import { z } from 'zod'

import { escapeHtml } from '@/lib/email/send'
import { sendSmtpEmail, smtpConfigured } from '@/lib/email/smtp'
import {
  formatPhoneDisplay,
  normalizePhoneE164
} from '@/lib/marketing/phone'
import { SUPPORT_EMAIL } from '@/lib/marketing/pricing'

const leadSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'A név legalább 2 karakter.')
    .max(120),
  email: z
    .string()
    .trim()
    .email('Az e-mail cím formátuma: nev@ceg.hu')
    .max(160)
    .transform((v) => v.toLowerCase()),
  company: z
    .string()
    .trim()
    .min(2, 'Írd be a cég nevét (egyéni vállalkozó vagy magánszemély is megadható).')
    .max(160),
  phone: z.string().trim().min(1, 'Telefonszám nélkül nem tudunk visszahívni.'),
  problem: z.string().trim().max(2000).optional(),
  source: z.string().trim().max(80).optional(),
  /** Honeypot — embereknek üresen kell maradnia. */
  website: z.string().max(200).optional(),
  /** Ügyfél oldali űrlap-nyitás időbélyeg (ms). */
  formOpenedAt: z.number().int().positive().optional()
})

export type ContactLeadInput = z.infer<typeof leadSchema>

export type ContactLeadResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

function sourceLabel(source: string): string {
  if (source.includes('varolista')) return 'Várólista'
  if (source.includes('kapcsolat')) return 'Kapcsolat'
  return source
}

/** Soft dedupe — ugyanaz a lead 60 mp-en belül ne menjen ki kétszer. */
const recentLeads = new Map<string, number>()
const DEDUPE_MS = 60_000

function pruneDedupe(now: number) {
  for (const [k, t] of recentLeads) {
    if (now - t > DEDUPE_MS) recentLeads.delete(k)
  }
}

export async function submitContactLeadAction(
  input: ContactLeadInput
): Promise<ContactLeadResult> {
  const parsed = leadSchema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (typeof key === 'string' && !fieldErrors[key]) {
        fieldErrors[key] = issue.message
      }
    }
    return {
      ok: false,
      message: 'Nézd át a jelölt mezőket, aztán küldd újra.',
      fieldErrors
    }
  }

  const lead = parsed.data

  // Bot honeypot — silent success
  if (lead.website?.trim()) {
    console.info('[contact-lead] honeypot trip')
    return { ok: true }
  }

  // Túl gyors submit (bot)
  if (
    lead.formOpenedAt &&
    Date.now() - lead.formOpenedAt < 1500
  ) {
    console.info('[contact-lead] too-fast submit')
    return { ok: true }
  }

  const phoneE164 = normalizePhoneE164(lead.phone)
  if (!phoneE164) {
    return {
      ok: false,
      message: 'Nézd át a jelölt mezőket, aztán küldd újra.',
      fieldErrors: {
        phone:
          'Érvényes telefonszám kell (pl. +36 30 123 4567 vagy 06 30 123 4567).'
      }
    }
  }

  const source = lead.source || 'optinova-kapcsolat'
  const notifyTo =
    process.env.CONTACT_NOTIFY_TO?.trim() || SUPPORT_EMAIL
  const kind = sourceLabel(source)
  const receivedAt = new Date().toISOString()
  const phoneDisplay = formatPhoneDisplay(phoneE164)

  const dedupeKey = `${lead.email}|${phoneE164}|${source}`
  const now = Date.now()
  pruneDedupe(now)
  if (recentLeads.has(dedupeKey)) {
    console.info('[contact-lead] dedupe', dedupeKey)
    return { ok: true }
  }
  recentLeads.set(dedupeKey, now)

  const payload = {
    source,
    receivedAt,
    fullName: lead.fullName,
    email: lead.email,
    company: lead.company,
    phone: phoneE164,
    phoneDisplay,
    problem: lead.problem || null,
    notifyEmail: notifyTo
  }

  console.info('[contact-lead]', JSON.stringify(payload))

  const lines = [
    `Forrás: ${kind} (${source})`,
    `Időpont: ${receivedAt}`,
    '',
    `Név: ${lead.fullName}`,
    `Cég: ${lead.company}`,
    `E-mail: ${lead.email}`,
    `Telefon: ${phoneDisplay} (${phoneE164})`,
    lead.problem ? `Üzenet:\n${lead.problem}` : null,
    '',
    '— Turinova marketing űrlap'
  ].filter((x): x is string => x != null)

  const text = lines.join('\n')
  const html = `
    <p><strong>${escapeHtml(kind)}</strong> · ${escapeHtml(source)}</p>
    <p style="color:#71717a;font-size:13px">${escapeHtml(receivedAt)}</p>
    <table style="border-collapse:collapse;font-size:14px">
      <tr><td style="padding:4px 12px 4px 0;color:#71717a">Név</td><td>${escapeHtml(lead.fullName)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#71717a">Cég</td><td>${escapeHtml(lead.company)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#71717a">E-mail</td><td><a href="mailto:${escapeHtml(lead.email)}">${escapeHtml(lead.email)}</a></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#71717a">Telefon</td><td><a href="tel:${escapeHtml(phoneE164)}">${escapeHtml(phoneDisplay)}</a></td></tr>
      ${
        lead.problem
          ? `<tr><td style="padding:4px 12px 4px 0;color:#71717a;vertical-align:top">Üzenet</td><td>${escapeHtml(lead.problem).replace(/\n/g, '<br/>')}</td></tr>`
          : ''
      }
    </table>
  `.trim()

  if (smtpConfigured()) {
    const sent = await sendSmtpEmail({
      to: notifyTo,
      subject: `[Turinova] ${kind}: ${lead.fullName} · ${lead.company}`,
      text,
      html,
      replyTo: lead.email,
      fromName: 'Turinova web'
    })
    if (!sent.ok) {
      console.error('[contact-lead] smtp failed', sent.error)
      recentLeads.delete(dedupeKey)
      return {
        ok: false,
        message:
          'Az űrlap elküldése sikertelen. Próbáld újra, vagy írj az info@turinova.hu-ra.'
      }
    }
  } else if (process.env.NODE_ENV === 'production') {
    console.error('[contact-lead] SMTP missing in production')
    recentLeads.delete(dedupeKey)
    return {
      ok: false,
      message:
        'Az űrlap elküldése sikertelen. Próbáld újra, vagy írj az info@turinova.hu-ra.'
    }
  } else {
    console.warn(
      '[contact-lead] SMTP nincs beállítva — lead csak log/webhook. Állítsd be: SMTP_HOST, SMTP_USER, SMTP_PASS.'
    )
  }

  const webhook = process.env.CONTACT_WEBHOOK_URL?.trim()
  if (webhook) {
    try {
      const res = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        console.error(
          '[contact-lead] webhook failed',
          res.status,
          await res.text().catch(() => '')
        )
      }
    } catch (err) {
      console.error('[contact-lead] webhook error', err)
    }
  }

  return { ok: true }
}
