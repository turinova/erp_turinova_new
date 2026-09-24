'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'modul-pos-touch'

/**
 * Érintő / tablet sűrűség. Default: `(pointer: coarse)` vagy localStorage `modul-pos-touch=1`.
 * Explicit `0` = kényszerített egér/sűrű desktop.
 */
export function readPosTouchPreference(): boolean {
  if (typeof window === 'undefined') return false
  const forced = window.localStorage.getItem(STORAGE_KEY)
  if (forced === '1') return true
  if (forced === '0') return false
  return window.matchMedia('(pointer: coarse)').matches
}

export function setPosTouchPreference(enabled: boolean | null) {
  if (typeof window === 'undefined') return
  if (enabled == null) {
    window.localStorage.removeItem(STORAGE_KEY)
    return
  }
  window.localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
}

export function usePosTouchMode(): {
  touch: boolean
  setTouch: (next: boolean) => void
} {
  const [touch, setTouchState] = useState(false)

  useEffect(() => {
    setTouchState(readPosTouchPreference())
    const mq = window.matchMedia('(pointer: coarse)')
    function onChange() {
      const forced = window.localStorage.getItem(STORAGE_KEY)
      if (forced === '1' || forced === '0') return
      setTouchState(mq.matches)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  function setTouch(next: boolean) {
    setPosTouchPreference(next)
    setTouchState(next)
  }

  return { touch, setTouch }
}

export function usePosWideLayout(): boolean {
  const [wide, setWide] = useState(true)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    setWide(mq.matches)
    function onChange() {
      setWide(mq.matches)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return wide
}
