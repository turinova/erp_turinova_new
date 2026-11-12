import type { TeyaOnlineCredentials, TeyaOnlineEnv } from '@/lib/teya-online/types'

const API_BASE: Record<TeyaOnlineEnv, string> = {
  production: 'https://api.teya.com',
  staging: 'https://api.teya.xyz'
}

const TOKEN_URL: Record<TeyaOnlineEnv, string> = {
  production: 'https://id.teya.com/oauth/v2/oauth-token',
  staging: 'https://id.teya.xyz/oauth/v2/oauth-token'
}

/** Embedded / Hosted Checkout — nem POSLink scope. */
export const TEYA_ONLINE_SCOPES = [
  'checkout/sessions/create',
  'checkout/sessions/id/get'
].join(' ')

const USER_AGENT = 'Turinova-ModulApp/1.0'

type TokenCache = { accessToken: string; expiresAt: number }
const tokenCache = new Map<string, TokenCache>()

function cacheKey(c: TeyaOnlineCredentials) {
  return `online:${c.env}:${c.clientId}`
}

export function teyaOnlineApiBase(env: TeyaOnlineEnv): string {
  return API_BASE[env]
}

export async function getTeyaOnlineAccessToken(
  creds: TeyaOnlineCredentials
): Promise<string> {
  const key = cacheKey(creds)
  const hit = tokenCache.get(key)
  if (hit && hit.expiresAt > Date.now() + 30_000) {
    return hit.accessToken
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    scope: TEYA_ONLINE_SCOPES
  })

  const res = await fetch(TOKEN_URL[creds.env], {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store'
  })

  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string
    expires_in?: number
    error?: string
    error_description?: string
  }

  if (!res.ok || !json.access_token) {
    const msg =
      json.error_description ||
      json.error ||
      `Teya online token hiba (${res.status})`
    throw new Error(msg)
  }

  const ttlMs = Math.max(60, Number(json.expires_in) || 300) * 1000
  tokenCache.set(key, {
    accessToken: json.access_token,
    expiresAt: Date.now() + ttlMs
  })
  return json.access_token
}

/**
 * API smoke: session get egy nem létező ID-re.
 * 401 → credential/scope hiba; 404 / 400 / más → auth OK, API válaszol.
 */
export async function smokeTeyaOnlineCheckoutApi(
  creds: TeyaOnlineCredentials,
  accessToken: string
): Promise<void> {
  const probeId = '00000000-0000-4000-8000-000000000000'
  const res = await fetch(
    `${API_BASE[creds.env]}/v2/checkout/sessions/${probeId}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': USER_AGENT,
        Accept: 'application/json'
      },
      cache: 'no-store'
    }
  )

  if (res.status === 401 || res.status === 403) {
    const json = (await res.json().catch(() => ({}))) as {
      message?: string
      error?: string
      title?: string
    }
    throw new Error(
      json.message ||
        json.title ||
        json.error ||
        `Teya online API jogosultság hiba (${res.status}). Ellenőrizd, hogy ecommerce (nem POS) credentialt adtál-e meg.`
    )
  }
}

export async function testTeyaOnlineCredentials(
  creds: TeyaOnlineCredentials
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  try {
    const token = await getTeyaOnlineAccessToken(creds)
    await smokeTeyaOnlineCheckoutApi(creds, token)
    return {
      ok: true,
      message:
        'A Teya online OAuth kapcsolat rendben van, az API válaszol.'
    }
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : 'Teya online kapcsolat sikertelen.'
    }
  }
}

/**
 * Online Checkout amount.value = smallest currency unit.
 * Teya ecommerce (SecurePay migráció): HUF = Ft × 100 (nem a POS whole-Ft).
 * @see https://developer.teya.com/partners/online-payments/migration/securepay
 */
export function hufToTeyaOnlineAmount(amountHuf: number): number {
  return Math.round(amountHuf) * 100
}

export type TeyaCheckoutSessionCreated = {
  sessionId: string
  sessionToken: string
  sessionStatus: string
}

function teyaOnlineErrorMessage(
  status: number,
  json: Record<string, unknown>
): string {
  const description =
    typeof json.description === 'string' ? json.description.trim() : ''
  const code = typeof json.code === 'string' ? json.code.trim() : ''
  const message = typeof json.message === 'string' ? json.message.trim() : ''
  const title = typeof json.title === 'string' ? json.title.trim() : ''
  const error = typeof json.error === 'string' ? json.error.trim() : ''
  const detail = typeof json.detail === 'string' ? json.detail.trim() : ''

  const primary =
    description || message || title || detail || error || null
  if (primary && code && code !== primary) {
    return `${primary} (${code}, HTTP ${status})`
  }
  if (primary) return `${primary} (HTTP ${status})`
  if (code) return `Teya checkout session hiba: ${code} (HTTP ${status})`
  return `Teya checkout session hiba (${status})`
}

/** Embedded Checkout session — csak szerveren, secrettel. */
export async function createTeyaCheckoutSession(
  creds: TeyaOnlineCredentials,
  input: {
    amountHuf: number
    merchantReference: string
    idempotencyKey: string
    metadata?: Record<string, string>
  }
): Promise<TeyaCheckoutSessionCreated> {
  const amount = hufToTeyaOnlineAmount(input.amountHuf)
  if (!(amount > 0)) {
    throw new Error('Érvénytelen fizetendő összeg.')
  }

  const token = await getTeyaOnlineAccessToken(creds)
  const res = await fetch(`${API_BASE[creds.env]}/v2/checkout/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
      'Idempotency-Key': input.idempotencyKey
    },
    body: JSON.stringify({
      store_id: creds.storeId,
      type: 'SALE',
      amount: { currency: 'HUF', value: amount },
      merchant_reference: input.merchantReference.slice(0, 128),
      ...(input.metadata && Object.keys(input.metadata).length > 0
        ? { metadata: input.metadata }
        : {})
    }),
    cache: 'no-store'
  })

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>

  const sessionId =
    typeof json.session_id === 'string' ? json.session_id : null
  const sessionToken =
    typeof json.session_token === 'string' ? json.session_token : null
  const sessionStatus =
    typeof json.session_status === 'string' ? json.session_status : 'ACTIVE'

  if (!res.ok || !sessionToken || !sessionId) {
    console.error('createTeyaCheckoutSession failed', {
      status: res.status,
      env: creds.env,
      storeId: creds.storeId,
      amountValue: amount,
      currency: 'HUF',
      body: json
    })
    throw new Error(teyaOnlineErrorMessage(res.status, json))
  }

  return {
    sessionId,
    sessionToken,
    sessionStatus
  }
}
