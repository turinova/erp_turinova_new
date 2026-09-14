'use client'

import { usePathname } from 'next/navigation'
import { useMemo } from 'react'

import {
  partnerHref,
  partnerHrefModeFromPathname
} from '@/lib/auth/surface'

/** Partner linkek: clean hoston /home, path-mode-ban /partner/home. */
export function usePartnerHref() {
  const pathname = usePathname()
  const mode = partnerHrefModeFromPathname(pathname)
  return useMemo(
    () => (cleanPath: string) => partnerHref(cleanPath, mode),
    [mode]
  )
}
