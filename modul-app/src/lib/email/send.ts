/**
 * Tranzakciós e-mail (Resend REST, nincs SDK). Env: RESEND_API_KEY, EMAIL_FROM (pl. "bolt@optinova.hu").
 * Csak szerveren; a kulcs soha nem kerül a kliensre.
 */

export type EmailResult = { ok: true; id: string | null } | { ok: false; error: string }

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim())
}

function fromHeader(displayName: string): string {
  const from = process.env.EMAIL_FROM!.trim()
  const safe = displayName.replace(/["<>\r\n]/g, '').trim().slice(0, 80)
  return safe ? `"${safe}" <${from}>` : from
}

export async function sendEmail(input: {
  to: string
  subject: string
  text: string
  html: string
  fromName: string
  replyTo?: string | null
}): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY?.trim()
  if (!key || !process.env.EMAIL_FROM?.trim()) {
    return { ok: false, error: 'Az e-mail küldés nincs beállítva (RESEND_API_KEY, EMAIL_FROM).' }
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromHeader(input.fromName),
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html,
        ...(input.replyTo ? { reply_to: input.replyTo } : {})
      }),
      signal: AbortSignal.timeout(8000)
    })
    const body = (await res.json().catch(() => null)) as { id?: string; message?: string } | null
    if (!res.ok) return { ok: false, error: `${res.status}: ${body?.message ?? 'ismeretlen hiba'}`.slice(0, 500) }
    return { ok: true, id: body?.id ?? null }
  } catch (e) {
    return { ok: false, error: (e instanceof Error ? e.message : 'hálózati hiba').slice(0, 500) }
  }
}

export function escapeHtml(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
