'use client'

import { useSearchParams } from 'next/navigation'

export type TvPreviewMode = 'kiosk' | 'laptop'
export type TvOrientation = 'landscape' | 'portrait'

export function useTvPreviewMode() {
  const searchParams = useSearchParams()
  const mode: TvPreviewMode = searchParams.get('preview') === 'laptop' ? 'laptop' : 'kiosk'
  const orientation: TvOrientation =
    searchParams.get('orientation') === 'landscape' ? 'landscape' : 'portrait'

  return {
    mode,
    orientation,
    isKiosk: mode === 'kiosk',
    isLaptop: mode === 'laptop',
    isPortrait: orientation === 'portrait',
    isLandscape: orientation === 'landscape'
  }
}
