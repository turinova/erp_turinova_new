/**
 * IndexNow (Bing, Copilot, Yandex, Seznam…): új / módosított URL azonnali jelzése.
 * A kulcs boltonként HMAC-ből származik — nincs tárolt titok, a /indexnow.txt ugyanezt adja vissza.
 */

import { createHmac } from 'node:crypto'

import type { StorefrontTenant } from '@/lib/storefront/resolve-tenant'
import { siteUrl } from '@/lib/storefront/url'

const ENDPOINT = 'https://api.indexnow.org/indexnow'
const MAX_URLS = 100

export function indexNowKey(tenantId: string): string | null {
  const secret = process.env.INDEXNOW_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) return null
  return createHmac('sha256', secret).update(`indexnow:${tenantId}`).digest('hex').slice(0, 32)
}

export function isPublicHost(host: string | null): host is string {
  return Boolean(host && host !== 'localhost' && !host.endsWith('.localhost'))
}

export async function pingIndexNow(tenant: StorefrontTenant, paths: string[]): Promise<void> {
  const host = tenant.primaryHost
  const key = indexNowKey(tenant.id)
  if (!isPublicHost(host) || !key || paths.length === 0) return
  const urlList = [...new Set(paths)].slice(0, MAX_URLS).map((p) => siteUrl(tenant.base, p))
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host,
        key,
        keyLocation: siteUrl(tenant.base, '/indexnow.txt'),
        urlList
      }),
      signal: AbortSignal.timeout(5000)
    })
    if (!res.ok && res.status !== 202) {
      console.error('pingIndexNow', res.status, await res.text().catch(() => ''))
    }
  } catch (e) {
    console.error('pingIndexNow', e instanceof Error ? e.message : e)
  }
}
