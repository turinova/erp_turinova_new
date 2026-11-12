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
