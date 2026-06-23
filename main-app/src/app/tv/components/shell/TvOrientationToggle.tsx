'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

import { useTvPreviewMode } from '../../hooks/useTvPreviewMode'

import styles from './TvOrientationToggle.module.css'

export default function TvOrientationToggle() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { isLandscape } = useTvPreviewMode()

  const toggle = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    if (isLandscape) {
      params.delete('orientation')
    } else {
      params.set('orientation', 'landscape')
    }
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }, [isLandscape, pathname, router, searchParams])

  return (
    <button
      type="button"
      className={styles.btn}
      onClick={toggle}
      aria-label={isLandscape ? 'Álló nézet' : 'Fekvő nézet'}
      title={isLandscape ? 'Álló nézet (portrait)' : 'Fekvő nézet (landscape)'}
    >
      {isLandscape ? 'Álló' : 'Fekvő'}
    </button>
  )
}
