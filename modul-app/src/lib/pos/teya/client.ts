import type { TeyaEnv } from '@/lib/pos/settings-types'

const API_BASE: Record<TeyaEnv, string> = {
  production: 'https://api.teya.com',
  staging: 'https://api.teya.xyz'
}

const TOKEN_URL: Record<TeyaEnv, string> = {
  production: 'https://id.teya.com/oauth/v2/oauth-token',
  staging: 'https://id.teya.xyz/oauth/v2/oauth-token'
}

/** POSLink M2M scopes a register válaszból tipikusan. */
const DEFAULT_SCOPES = [
  'payment_requests',
  'payment_requests/id',
  'stores/id/terminals'
].join(' ')

export type TeyaPaymentStatus =
  | 'NEW'
  | 'IN_PROGRESS'
  | 'SUCCESSFUL'
  | 'CANCELLING'
  | 'CANCELLED'
  | 'FAILED'

export type TeyaCredentials = {
  env: TeyaEnv
  clientId: string
  clientSecret: string
  storeId: string
  terminalId: string
  eposInstanceId: string
}

export type TeyaPaymentRequest = {
  payment_request_id: string
  status: TeyaPaymentStatus
  merchant_reference?: string | null
  gateway_payment_id?: string | null
  source_reference_id?: string | null
}

type TokenCache = { accessToken: string; expiresAt: number }
const tokenCache = new Map<string, TokenCache>()

function cacheKey(c: TeyaCredentials) {
  return `${c.env}:${c.clientId}`
}

export async function getTeyaAccessToken(
  creds: TeyaCredentials
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
    scope: DEFAULT_SCOPES
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
      `Teya token hiba (${res.status})`
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
 * HUF: ISO 4217 exponent 2, de a fillér nincs forgalomban.
 * A Teya „smallest currency unit” HUF-nál jellemzően forint (1 Ft = 1).
 */
export function hufToTeyaAmount(amountHuf: number): number {
  return Math.round(amountHuf)
}

export async function createTeyaPaymentRequest(
  creds: TeyaCredentials,
  input: {
    amountHuf: number
    merchantReference: string
    idempotencyKey: string
  }
): Promise<TeyaPaymentRequest> {
  const token = await getTeyaAccessToken(creds)
  const amount = hufToTeyaAmount(input.amountHuf)
  if (!(amount > 0)) {
    throw new Error('Érvénytelen kártyaösszeg.')
  }

  const res = await fetch(
    `${API_BASE[creds.env]}/poslink/v3/payment-requests`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': input.idempotencyKey.slice(0, 64)
      },
      body: JSON.stringify({
        store_id: creds.storeId,
        terminal_id: creds.terminalId,
        requested_amount: {
          amount,
          currency: 'HUF',
          tip: 0
        },
        transaction_type: 'SALE',
        merchant_reference: input.merchantReference.slice(0, 100),
        epos_instance_id: creds.eposInstanceId.slice(0, 100)
      }),
      cache: 'no-store'
    }
  )

  const json = (await res.json().catch(() => ({}))) as TeyaPaymentRequest & {
    code?: string
    description?: string
    message?: string
  }

  if (!res.ok || !json.payment_request_id) {
    throw new Error(
      json.description ||
        json.message ||
        json.code ||
        `Teya fizetés indítás sikertelen (${res.status})`
    )
  }

  return {
    payment_request_id: json.payment_request_id,
    status: (json.status as TeyaPaymentStatus) || 'NEW',
    merchant_reference: json.merchant_reference,
    gateway_payment_id: json.gateway_payment_id,
    source_reference_id: json.source_reference_id
  }
}

export async function getTeyaPaymentRequestStatus(
  creds: TeyaCredentials,
  paymentRequestId: string
): Promise<TeyaPaymentRequest> {
  const token = await getTeyaAccessToken(creds)

  // Lista szűréssel: a v3 GET by-id SSE streames — pollinghoz a v2 lista megbízhatóbb.
  const url = new URL(
    `${API_BASE[creds.env]}/poslink/v2/payment-requests`
  )
  url.searchParams.set('store_id', creds.storeId)
  url.searchParams.set('terminal_id', creds.terminalId)
  url.searchParams.set('limit', '20')
  url.searchParams.set('sort', 'DESC')

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store'
  })

  const json = (await res.json().catch(() => ({}))) as {
    payment_requests?: TeyaPaymentRequest[]
    code?: string
    description?: string
  }

  if (!res.ok) {
    throw new Error(
      json.description ||
        json.code ||
        `Teya státusz lekérés sikertelen (${res.status})`
    )
  }

  const found = (json.payment_requests ?? []).find(
    (p) => p.payment_request_id === paymentRequestId
  )
  if (!found) {
    return {
      payment_request_id: paymentRequestId,
      status: 'IN_PROGRESS'
    }
  }
  return found
}

export async function cancelTeyaPaymentRequest(
  creds: TeyaCredentials,
  paymentRequestId: string
): Promise<void> {
  const token = await getTeyaAccessToken(creds)
  await fetch(
    `${API_BASE[creds.env]}/poslink/v2/payment-requests/${paymentRequestId}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: 'CANCELLING' }),
      cache: 'no-store'
    }
  )
}

export async function testTeyaCredentials(
  creds: TeyaCredentials
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await getTeyaAccessToken(creds)
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Teya kapcsolat sikertelen.'
    }
  }
}

export function isTerminalStatus(status: TeyaPaymentStatus): boolean {
  return (
    status === 'SUCCESSFUL' ||
    status === 'FAILED' ||
    status === 'CANCELLED'
  )
}
