import type { TenantRole } from '@/lib/supabase/database.types'
import {
  SESSION_SNAPSHOT_COOKIE,
  SESSION_SNAPSHOT_TTL_SEC,
  getSessionSnapshotSecret
} from '@/lib/auth/config'
import {
  SNAPSHOT_COOKIE_MAX_BYTES,
  SNAPSHOT_COOKIE_WARN_BYTES,
  sessionSnapshotCookieOptions
} from '@/lib/auth/session-cookies'
import { ALL_PAGE_KEYS, PAGE_CATALOG_VERSION } from '@/lib/permissions/pages'

/** Logical snapshot (app code). Wire format is compact — see encodeWire. */
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

/**
 * Cookie wire format v2: page path strings → bitset (`*` = full catalog).
 * Full-access ~53 paths ×2 blew past Safari ~4KB; bitset keeps token ≪ 2KB.
 */
type SessionSnapshotWire = {
  v: 2
  pagesV: number
  sub: string
  email: string
  displayName?: string | null
  tenantId: string | null
  tenantSlug: string | null
  tenantName: string
  membershipId: string | null
  role: TenantRole | null
  /** `*` = ALL_PAGE_KEYS; else base64url bitset in catalog order. */
  ap: '*' | string
  ep: '*' | string
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

/** Encode page keys relative to ALL_PAGE_KEYS order. Unknown keys ignored. */
export function encodePageBitset(pages: string[]): '*' | string {
  const set = new Set(pages)
  let matched = 0
  for (const key of ALL_PAGE_KEYS) {
    if (set.has(key)) matched += 1
  }
  if (matched === ALL_PAGE_KEYS.length && ALL_PAGE_KEYS.length > 0) {
    return '*'
  }
  const bytes = new Uint8Array(Math.ceil(ALL_PAGE_KEYS.length / 8) || 1)
  for (let i = 0; i < ALL_PAGE_KEYS.length; i++) {
    if (set.has(ALL_PAGE_KEYS[i]!)) {
      bytes[i >> 3]! |= 1 << (i & 7)
    }
  }
  return base64UrlEncode(bytes)
}

export function decodePageBitset(encoded: '*' | string): string[] {
  if (encoded === '*') return [...ALL_PAGE_KEYS]
  if (!encoded) return []
  try {
    const bytes = base64UrlDecode(encoded)
    const out: string[] = []
    for (let i = 0; i < ALL_PAGE_KEYS.length; i++) {
      const byte = bytes[i >> 3]
      if (byte != null && (byte & (1 << (i & 7))) !== 0) {
        out.push(ALL_PAGE_KEYS[i]!)
      }
    }
    return out
  } catch {
    return []
  }
}

function toWire(snapshot: SessionSnapshot): SessionSnapshotWire {
  return {
    v: 2,
    pagesV: snapshot.pagesV,
    sub: snapshot.sub,
    email: snapshot.email,
    displayName: snapshot.displayName ?? null,
    tenantId: snapshot.tenantId,
    tenantSlug: snapshot.tenantSlug,
    tenantName: snapshot.tenantName,
    membershipId: snapshot.membershipId,
    role: snapshot.role,
    ap: encodePageBitset(snapshot.allowedPages),
    ep: encodePageBitset(snapshot.entitledPages),
    canManageUsers: snapshot.canManageUsers,
    isPlatformAdmin: snapshot.isPlatformAdmin,
    hasMembership: snapshot.hasMembership,
    nonce: snapshot.nonce,
    iat: snapshot.iat,
    exp: snapshot.exp
  }
}

function fromWire(wire: SessionSnapshotWire): SessionSnapshot {
  return {
    v: 1,
    pagesV: wire.pagesV,
    sub: wire.sub,
    email: wire.email,
    displayName: wire.displayName ?? null,
    tenantId: wire.tenantId,
    tenantSlug: wire.tenantSlug,
    tenantName: wire.tenantName,
    membershipId: wire.membershipId,
    role: wire.role,
    allowedPages: decodePageBitset(wire.ap),
    entitledPages: decodePageBitset(wire.ep),
    canManageUsers: wire.canManageUsers,
    isPlatformAdmin: wire.isPlatformAdmin,
    hasMembership: wire.hasMembership,
    nonce: wire.nonce,
    iat: wire.iat,
    exp: wire.exp
  }
}

/** Legacy v1 cookie (path arrays) — read until TTL expires. */
function fromLegacyV1(data: Record<string, unknown>): SessionSnapshot | null {
  if (data.v !== 1 || typeof data.sub !== 'string') return null
  if (data.pagesV !== PAGE_CATALOG_VERSION) return null
  if (typeof data.exp !== 'number' || data.exp * 1000 < Date.now()) return null
  if (!Array.isArray(data.allowedPages)) return null
  return {
    v: 1,
    pagesV: data.pagesV as number,
    sub: data.sub,
    email: String(data.email ?? ''),
    displayName: (data.displayName as string | null) ?? null,
    tenantId: (data.tenantId as string | null) ?? null,
    tenantSlug: (data.tenantSlug as string | null) ?? null,
    tenantName: String(data.tenantName ?? ''),
    membershipId: (data.membershipId as string | null) ?? null,
    role: (data.role as TenantRole | null) ?? null,
    allowedPages: data.allowedPages as string[],
    entitledPages: Array.isArray(data.entitledPages)
      ? (data.entitledPages as string[])
      : [],
    canManageUsers: Boolean(data.canManageUsers),
    isPlatformAdmin: Boolean(data.isPlatformAdmin),
    hasMembership: Boolean(data.hasMembership),
    nonce: String(data.nonce ?? ''),
    iat: Number(data.iat) || 0,
    exp: data.exp as number
  }
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
  const payload = base64UrlEncode(utf8Encode(JSON.stringify(toWire(snapshot))))
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
    const data = JSON.parse(json) as Record<string, unknown>

    if (data.v === 2) {
      const wire = data as unknown as SessionSnapshotWire
      if (typeof wire.sub !== 'string') return null
      if (wire.pagesV !== PAGE_CATALOG_VERSION) return null
      if (typeof wire.exp !== 'number' || wire.exp * 1000 < Date.now()) {
        return null
      }
      if (wire.ap !== '*' && typeof wire.ap !== 'string') return null
      if (wire.ep !== '*' && typeof wire.ep !== 'string') return null
      return fromWire(wire)
    }

    return fromLegacyV1(data)
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

export { SESSION_SNAPSHOT_COOKIE, sessionSnapshotCookieOptions }

/** Byte length of signed token (UTF-8). */
export function sessionSnapshotTokenBytes(token: string): number {
  return new TextEncoder().encode(token).length
}

export function assertSnapshotTokenSize(token: string): {
  ok: boolean
  bytes: number
} {
  const bytes = sessionSnapshotTokenBytes(token)
  if (bytes >= SNAPSHOT_COOKIE_WARN_BYTES) {
    console.warn(
      '[session-snapshot] cookie near Safari limit',
      `${bytes}B (warn@${SNAPSHOT_COOKIE_WARN_BYTES})`
    )
  }
  if (bytes > SNAPSHOT_COOKIE_MAX_BYTES) {
    console.error(
      '[session-snapshot] cookie too large — not setting',
      `${bytes}B (max ${SNAPSHOT_COOKIE_MAX_BYTES})`
    )
    return { ok: false, bytes }
  }
  return { ok: true, bytes }
}
