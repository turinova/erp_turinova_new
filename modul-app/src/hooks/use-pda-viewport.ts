'use client'

import { useEffect, useState } from 'react'

/**
 * A2HS / standalone PDA viewport:
 * - detect display-mode
 * - expose --pda-vv-top / --pda-vv-height from visualViewport (keyboard)
 */
export function usePdaViewport() {
  const [standalone, setStandalone] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(display-mode: standalone)')
    const iosStandalone =
      'standalone' in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone)

    const syncMode = () => setStandalone(mq.matches || iosStandalone)
    syncMode()
    mq.addEventListener('change', syncMode)

    const root = document.documentElement
    root.classList.add('pda-route')

    const applyVv = () => {
      const vv = window.visualViewport
      if (!vv) {
        root.style.setProperty('--pda-vv-top', '0px')
        root.style.setProperty('--pda-vv-height', `${window.innerHeight}px`)
        return
      }
      root.style.setProperty('--pda-vv-top', `${Math.round(vv.offsetTop)}px`)
      root.style.setProperty('--pda-vv-height', `${Math.round(vv.height)}px`)
    }

    applyVv()
    window.visualViewport?.addEventListener('resize', applyVv)
    window.visualViewport?.addEventListener('scroll', applyVv)
    window.addEventListener('resize', applyVv)

    return () => {
      mq.removeEventListener('change', syncMode)
      root.classList.remove('pda-route')
      root.style.removeProperty('--pda-vv-top')
      root.style.removeProperty('--pda-vv-height')
      window.visualViewport?.removeEventListener('resize', applyVv)
      window.visualViewport?.removeEventListener('scroll', applyVv)
      window.removeEventListener('resize', applyVv)
    }
  }, [])

  return { standalone }
}
