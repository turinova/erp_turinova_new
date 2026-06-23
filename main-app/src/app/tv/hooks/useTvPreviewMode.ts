'use client'

import { useEffect, useState } from 'react'

export type TvPreviewMode = 'kiosk' | 'laptop'
export type TvOrientation = 'landscape' | 'portrait'

export function useTvPreviewMode() {
  const [mode, setMode] = useState<TvPreviewMode>('kiosk')
  const [orientation, setOrientation] = useState<TvOrientation>('portrait')

  useEffect(() => {
    const root = document.querySelector('.tv-root')
    const preview = root?.getAttribute('data-preview')
    const orient = root?.getAttribute('data-orientation')
    setMode(preview === 'laptop' ? 'laptop' : 'kiosk')
    setOrientation(orient === 'landscape' ? 'landscape' : 'portrait')
  }, [])

  return {
    mode,
    orientation,
    isKiosk: mode === 'kiosk',
    isLaptop: mode === 'laptop',
    isPortrait: orientation === 'portrait'
  }
}
