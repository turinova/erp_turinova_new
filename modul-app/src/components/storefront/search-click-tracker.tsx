'use client'

import type { ReactNode } from 'react'

import { slugFromProductHref, trackSearchClick } from '@/lib/storefront/search/track'

/** A találati lista termék-linkjeire kattintást naplózza (rangsor tanulás). */
export function SearchClickTracker({ q, children }: { q: string; children: ReactNode }) {
  return (
    <div
      onClickCapture={(e) => {
        const a = (e.target as HTMLElement).closest('a[href]')
        if (!a) return
        const slug = slugFromProductHref(a.getAttribute('href') ?? '')
        if (slug) trackSearchClick(q, slug)
      }}
    >
      {children}
    </div>
  )
}
