'use client'

import { useMemo } from 'react'
import { usePathname } from 'next/navigation'

import { getPlatformPublicOrigin, platformHref } from '@/lib/auth/surface'

function isAdminHost(hostname: string) {
  const host = hostname.toLowerCase()
  return (
    host === 'admin.optinova.hu' ||
    host === 'admin.localhost' ||
    host.endsWith('.admin.localhost')
  )
}

/**
 * Platform linkek: admin hoston tiszta (/tenants), app hoston /platform/tenants.
 * Ha NEXT_PUBLIC_PLATFORM_ORIGIN be van állítva és nem admin hoston vagyunk,
 * abszolút admin URL (elkerüli a soft-nav + külső redirect „semmi sem történik” hibát).
 */
export function usePlatformHref() {
  const pathname = usePathname()
  const mode = useMemo(() => {
    if (typeof window !== 'undefined') {
      if (isAdminHost(window.location.hostname)) {
        return 'clean' as const
      }
      const origin = getPlatformPublicOrigin()
      if (origin) return 'absolute' as const
    }
    return pathname.startsWith('/platform')
      ? ('prefixed' as const)
      : ('clean' as const)
  }, [pathname])

  return (cleanPath: string) => {
    if (mode === 'absolute') {
      const origin = getPlatformPublicOrigin()!
      const path = platformHref(cleanPath, 'clean')
      return `${origin}${path === '/' ? '/' : path}`
    }
    return platformHref(cleanPath, mode)
  }
}
