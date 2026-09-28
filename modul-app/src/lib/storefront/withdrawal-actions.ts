'use server'

import { createHash, randomBytes } from 'node:crypto'

import { headers } from 'next/headers'
import { z } from 'zod'

import { escapeHtml, sendEmail } from '@/lib/email/send'
import { resolveStorefrontTenant } from '@/lib/storefront/resolve-tenant'
import { createServiceClient } from '@/lib/supabase/service'
import { loadLegalContext } from '@/lib/webshop/legal/context'

export type WithdrawalReceipt = {
  reference: string
  submittedAt: string
  customerName: string
  customerEmail: string
  orderReference: string
  items: string | null
  comment: string | null
  refundAccount: string | null
  emailSent: boolean
}

export type WithdrawalResult =
  | { ok: true; receipt: WithdrawalReceipt }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Legfeljebb ${max} karakter.`)
    .optional()
    .transform((v) => (v ? v : null))

const schema = z.object({
  customerName: z.string().trim().min(2, 'Add meg a neved.').max(200),
  customerEmail: z.string().trim().max(200).email('Érvényes e-mail címet adj meg.'),
  orderReference: z.string().trim().min(1, 'Add meg a rendelésszámot.').max(80),
  items: optional(2000),
  comment: optional(2000),
  refundAccount: optional(80),
  website: z.string().optional()
})

export type WithdrawalInput = z.input<typeof schema>

const HOURLY_LIMIT = 5

function newReference(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = randomBytes(8)
  let out = ''
  for (const b of bytes) out += alphabet[b % alphabet.length]
  return `EL-${out}`
}

function formatBudapest(iso: string): string {
  return new Intl.DateTimeFormat('hu-HU', {
    timeZone: 'Europe/Budapest',
    dateStyle: 'long',
    timeStyle: 'medium'
  }).format(new Date(iso))
}

function receiptLines(r: WithdrawalReceipt, when: string, sellerName: string): [string, string][] {
  return [
    ['Azonosító', r.reference],
    ['Beérkezett', when],
    ['Eladó', sellerName],
    ['Név', r.customerName],
    ['E-mail', r.customerEmail],
    ['Rendelésszám', r.orderReference],
    ['Érintett termékek', r.items ?? 'a teljes rendelés'],
    ['Megjegyzés', r.comment ?? '—'],
    ['Visszautalás bankszámlára', r.refundAccount ?? '—']
  ]
}

function emailBody(intro: string, rows: [string, string][], outro: string) {
  const text = [intro, '', ...rows.map(([k, v]) => `${k}: ${v}`), '', outro].join('\n')
  const html =
    `<p>${escapeHtml(intro)}</p><table cellpadding="4" style="border-collapse:collapse;font-size:14px">` +
    rows
      .map(
        ([k, v]) =>
          `<tr><td style="color:#71717a;vertical-align:top">${escapeHtml(k)}</td><td style="white-space:pre-wrap">${escapeHtml(v)}</td></tr>`
      )
      .join('') +
    `</table><p>${escapeHtml(outro)}</p>`
  return { text, html }
}

/** Online elállás (45/2014. Korm. r. 22. § (1a)–(1c)): rögzítés + azonnali visszaigazolás tartós adathordozón. */
export async function submitWithdrawal(input: WithdrawalInput): Promise<WithdrawalResult> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (typeof key === 'string' && !fieldErrors[key]) fieldErrors[key] = issue.message
    }
    return { ok: false, message: 'Ellenőrizd a megjelölt mezőket.', fieldErrors }
  }
  const d = parsed.data
  if (d.website?.trim()) return { ok: false, message: 'Nem sikerült elküldeni. Próbáld újra később.' }

  const admin = createServiceClient()
  if (!admin) return { ok: false, message: 'A bolt most nem elérhető.' }
  const tenant = await resolveStorefrontTenant(admin)
  if (!tenant) return { ok: false, message: 'A bolt most nem elérhető.' }

  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || ''
  const ipHash = ip ? createHash('sha256').update(`${tenant.id}:${ip}`).digest('hex') : null
  const userAgent = h.get('user-agent')?.slice(0, 300) ?? null

  if (ipHash) {
    const since = new Date(Date.now() - 3600_000).toISOString()
    const { count } = await admin
      .from('webshop_withdrawals')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant.id)
      .eq('ip_hash', ipHash)
      .gte('submitted_at', since)
    if ((count ?? 0) >= HOURLY_LIMIT) {
      return { ok: false, message: 'Túl sok beküldés érkezett innen. Kérjük, próbáld újra egy óra múlva, vagy írj e-mailt.' }
    }
  }

  let reference = newReference()
  let submittedAt: string | null = null
  let rowId: string | null = null
  for (let attempt = 0; attempt < 3 && !rowId; attempt++) {
    const { data, error } = await admin
      .from('webshop_withdrawals')
      .insert({
        tenant_id: tenant.id,
        reference,
        customer_name: d.customerName,
        customer_email: d.customerEmail.toLowerCase(),
        order_reference: d.orderReference,
        items: d.items,
        comment: d.comment,
        refund_account: d.refundAccount,
        ip_hash: ipHash,
        user_agent: userAgent
      })
      .select('id, submitted_at')
      .single()
    if (error?.code === '23505') {
      reference = newReference()
      continue
    }
    if (error) {
      console.error('submitWithdrawal', error.message)
      return { ok: false, message: 'Nem sikerült rögzíteni. Próbáld újra, vagy küldd el e-mailben.' }
    }
    rowId = String(data.id)
    submittedAt = String(data.submitted_at)
  }
  if (!rowId || !submittedAt) return { ok: false, message: 'Nem sikerült rögzíteni. Próbáld újra később.' }

  const receipt: WithdrawalReceipt = {
    reference,
    submittedAt,
    customerName: d.customerName,
    customerEmail: d.customerEmail.toLowerCase(),
    orderReference: d.orderReference,
    items: d.items,
    comment: d.comment,
    refundAccount: d.refundAccount,
    emailSent: false
  }

  const { ctx } = await loadLegalContext(admin, tenant.id, { name: tenant.name, url: tenant.base.origin })
  const seller = ctx.seller
  const when = formatBudapest(submittedAt)
  const rows = receiptLines(receipt, when, seller.name)

  const customerMail = emailBody(
    `Tisztelt ${receipt.customerName}! Elállási nyilatkozatát ${when}-kor megkaptuk. A nyilatkozat tartalma:`,
    rows,
    `A vételárat legkésőbb 14 napon belül visszatérítjük; a visszatérítést visszatarthatjuk, amíg a terméket vissza nem kaptuk, ` +
      `vagy igazolja a visszaküldést. Kérdés esetén válaszoljon erre a levélre. – ${seller.name}`
  )
  const sent = await sendEmail({
    to: receipt.customerEmail,
    subject: `Elállás visszaigazolása – ${receipt.reference}`,
    ...customerMail,
    fromName: seller.name,
    replyTo: seller.email
  })
  receipt.emailSent = sent.ok

  let notified = false
  if (seller.email) {
    const merchantMail = emailBody(
      `Új online elállási nyilatkozat érkezett (${when}). Kezelése: Webshop → Elállások.`,
      rows,
      'A vásárló a fenti tartalmú visszaigazolást kapta.'
    )
    const m = await sendEmail({
      to: seller.email,
      subject: `Új elállás – ${receipt.reference} – ${receipt.orderReference}`,
      ...merchantMail,
      fromName: 'Webshop',
      replyTo: receipt.customerEmail
    })
    notified = m.ok
  }

  const now = new Date().toISOString()
  const { error: updError } = await admin
    .from('webshop_withdrawals')
    .update({
      receipt_sent_at: sent.ok ? now : null,
      receipt_error: sent.ok ? null : sent.error,
      merchant_notified_at: notified ? now : null
    })
    .eq('id', rowId)
  if (updError) console.error('submitWithdrawal receipt', updError.message)

  return { ok: true, receipt }
}
