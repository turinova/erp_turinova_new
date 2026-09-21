'use server'

import { z } from 'zod'

import { SUPPORT_EMAIL } from '@/lib/marketing/pricing'

const leadSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(2, 'A keresztnév legalább 2 karakter.')
    .max(80),
  email: z
    .string()
    .trim()
    .email('Az e-mail cím formátuma: nev@ceg.hu')
    .max(160),
  company: z.string().trim().min(2, 'Írd be a cég nevét.').max(160),
  phone: z
    .string()
    .trim()
    .min(8, 'Telefonszám nélkül nem tudunk visszahívni.')
    .max(40),
  problem: z.string().trim().max(2000).optional()
})

export type ContactLeadInput = z.infer<typeof leadSchema>

export type ContactLeadResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

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
  const payload = {
    source: 'optinova-kapcsolat',
    receivedAt: new Date().toISOString(),
    ...lead,
    problem: lead.problem || null,
    notifyEmail: SUPPORT_EMAIL
  }

  console.info('[contact-lead]', JSON.stringify(payload))

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
