import type { TenantRole } from '@/lib/supabase/database.types'
import {
  SESSION_SNAPSHOT_COOKIE,
  SESSION_SNAPSHOT_TTL_SEC,
  getSessionSnapshotSecret
} from '@/lib/auth/config'
import { PAGE_CATALOG_VERSION } from '@/lib/permissions/pages'

export type SessionSnapshot = {
  v: 1
  /** APP_PAGES katalógus verzió — mismatch → snapshot érvénytelen. */
  pagesV: number
  sub: string
  email: string
  displayName?: string | null
  tenantId: string | null
  tenantSlug: string | null
  tenantName: string
  membershipId: string | null
  role: TenantRole | null
  allowedPages: string[]
  entitledPages: string[]
  canManageUsers: boolean
  isPlatformAdmin: boolean
  hasMembership: boolean
  nonce: string
  iat: number
  exp: number
}

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!)
  const b64 =
    typeof btoa === 'function'
      ? btoa(bin)
      : Buffer.from(bytes).toString('base64')
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlDecode(input: string): Uint8Array {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
  const raw = b64 + pad
  if (typeof atob === 'function') {
    const bin = atob(raw)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  }
  return new Uint8Array(Buffer.from(raw, 'base64'))
}

function utf8Encode(s: string): Uint8Array {
  return new TextEncoder().encode(s)
}

function utf8Decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes)
}

async function hmacSha256(
  secret: string,
  message: string
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    utf8Encode(secret) as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    utf8Encode(message) as BufferSource
  )
  return new Uint8Array(sig)
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!
  return diff === 0
}

export function buildSessionSnapshot(input: {
  userId: string
  email: string
  displayName?: string | null
  tenantId: string | null
  tenantSlug: string | null
  tenantName: string
  membershipId: string | null
  role: TenantRole | null
  allowedPages: string[]
  entitledPages: string[]
  canManageUsers: boolean
  isPlatformAdmin: boolean
  hasMembership: boolean
  nonce: string
  ttlSec?: number
}): SessionSnapshot {
  const now = Math.floor(Date.now() / 1000)
  const ttl = input.ttlSec ?? SESSION_SNAPSHOT_TTL_SEC
  return {
    v: 1,
    pagesV: PAGE_CATALOG_VERSION,
    sub: input.userId,
    email: input.email,
    displayName: input.displayName ?? null,
    tenantId: input.tenantId,
    tenantSlug: input.tenantSlug,
    tenantName: input.tenantName,
    membershipId: input.membershipId,
    role: input.role,
    allowedPages: input.allowedPages,
    entitledPages: input.entitledPages,
    canManageUsers: input.canManageUsers,
    isPlatformAdmin: input.isPlatformAdmin,
    hasMembership: input.hasMembership,
    nonce: input.nonce,
    iat: now,
    exp: now + ttl
  }
}

export async function signSessionSnapshot(
  snapshot: SessionSnapshot
): Promise<string> {
  const payload = base64UrlEncode(utf8Encode(JSON.stringify(snapshot)))
  const sig = await hmacSha256(getSessionSnapshotSecret(), payload)
  return `${payload}.${base64UrlEncode(sig)}`
}

export async function verifySessionSnapshotToken(
  token: string | undefined | null
): Promise<SessionSnapshot | null> {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [payload, sigPart] = parts
  if (!payload || !sigPart) return null

  try {
    const expected = await hmacSha256(getSessionSnapshotSecret(), payload)
    const actual = base64UrlDecode(sigPart)
    if (!timingSafeEqual(expected, actual)) return null

    const json = utf8Decode(base64UrlDecode(payload))
    const data = JSON.parse(json) as SessionSnapshot
    if (data.v !== 1 || typeof data.sub !== 'string') return null
    if (data.pagesV !== PAGE_CATALOG_VERSION) return null
    if (typeof data.exp !== 'number' || data.exp * 1000 < Date.now()) {
      return null
    }
    if (!Array.isArray(data.allowedPages)) return null
    return data
  } catch {
    return null
  }
}

/** Middleware: snapshot érvényes ehhez a userhez + nonce-hoz? */
export async function snapshotMatchesRequest(input: {
  token: string | undefined | null
  userId: string
  nonce: string | undefined | null
}): Promise<SessionSnapshot | null> {
  const snap = await verifySessionSnapshotToken(input.token)
  if (!snap) return null
  if (snap.sub !== input.userId) return null
  if (!input.nonce || snap.nonce !== input.nonce) return null
  return snap
}

export function sessionSnapshotCookieOptions(maxAgeSec = SESSION_SNAPSHOT_TTL_SEC) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: maxAgeSec
  }
}

export { SESSION_SNAPSHOT_COOKIE }
