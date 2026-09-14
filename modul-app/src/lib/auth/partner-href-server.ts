import { headers } from 'next/headers'

import {
  partnerHref,
  resolveAuthSurface
} from '@/lib/auth/surface'

/** Server redirect/link partner path — host alapján clean vagy /partner/*. */
export async function partnerServerHref(cleanPath: string): Promise<string> {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? ''
  const mode =
    resolveAuthSurface(host) === 'partner' ? 'clean' : 'prefixed'
  return partnerHref(cleanPath, mode)
}
