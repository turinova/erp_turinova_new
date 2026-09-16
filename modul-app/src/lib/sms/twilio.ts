import { smsSegments } from '@/lib/sms/text'

export type TwilioSendResult =
  | { ok: true; sid: string; segments: number; bodyLength: number }
  | { ok: false; error: string; segments: number; bodyLength: number }

function twilioCredentials(): {
  accountSid: string
  authToken: string
  from: string
} | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
  const from = process.env.TWILIO_PHONE_NUMBER?.trim()
  if (!accountSid || !authToken || !from) return null
  return { accountSid, authToken, from }
}

/** Platform Twilio REST — nincs client-side secret. */
export async function sendTwilioSms(input: {
  toE164: string
  body: string
}): Promise<TwilioSendResult> {
  const bodyLength = input.body.length
  const segments = smsSegments(input.body)

  const creds = twilioCredentials()
  if (!creds) {
    return {
      ok: false,
      error: 'Twilio nincs konfigurálva (TWILIO_* env).',
      segments,
      bodyLength
    }
  }

  if (!input.body.trim()) {
    return {
      ok: false,
      error: 'Üres SMS szöveg.',
      segments,
      bodyLength
    }
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/Messages.json`
  const auth = Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString(
    'base64'
  )
  const form = new URLSearchParams({
    To: input.toE164,
    From: creds.from,
    Body: input.body
  })

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: form.toString()
    })

    const json = (await res.json().catch(() => null)) as {
      sid?: string
      message?: string
      error_message?: string
      code?: number
    } | null

    if (!res.ok) {
      const err =
        json?.message ||
        json?.error_message ||
        `Twilio HTTP ${res.status}`
      console.error('[SMS] Twilio error', err)
      return { ok: false, error: err, segments, bodyLength }
    }

    if (!json?.sid) {
      return {
        ok: false,
        error: 'Twilio nem adott vissza SID-et.',
        segments,
        bodyLength
      }
    }

    return { ok: true, sid: json.sid, segments, bodyLength }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Twilio hálózati hiba'
    console.error('[SMS] Twilio fetch', message)
    return { ok: false, error: message, segments, bodyLength }
  }
}
