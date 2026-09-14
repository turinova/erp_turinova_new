import { headers } from 'next/headers'

import {
  isPlatformPath,
  platformHref,
  resolveAuthSurface
} from '@/lib/auth/surface'

export async function getPlatformHrefMode(): Promise<'clean' | 'prefixed'> {
  const h = await headers()
  const host = h.get('host') ?? ''
  const pathname = h.get('x-pathname') ?? ''
  if (resolveAuthSurface(host) === 'platform') return 'clean'
  if (isPlatformPath(pathname) && !pathname.startsWith('/platform')) {
    return 'clean'
  }
  // Clean path on admin after rewrite still has x-pathname as clean
  if (resolveAuthSurface(host) === 'platform') return 'clean'
  return 'prefixed'
}

export async function ph(cleanPath: string): Promise<string> {
  const mode = await getPlatformHrefMode()
  return platformHref(cleanPath, mode)
}
