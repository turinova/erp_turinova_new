'use client'

import { useMemo } from 'react'
import { usePathname } from 'next/navigation'

import { platformHref } from '@/lib/auth/surface'

/**
 * Platform linkek: admin hoston tiszta (/tenants), app hoston /platform/tenants.
 * Clean mode: pathname nem /platform prefix (rewrite után x-pathname clean,
 * de client pathname is clean).
 */
export function usePlatformHref() {
  const pathname = usePathname()
  const mode = useMemo(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname.toLowerCase()
      if (
        host === 'admin.optinova.hu' ||
        host === 'admin.localhost' ||
        host.endsWith('.admin.localhost')
      ) {
        return 'clean' as const
      }
    }
    return pathname.startsWith('/platform') ? ('prefixed' as const) : ('clean' as const)
  }, [pathname])

  return (cleanPath: string) => platformHref(cleanPath, mode)
}
