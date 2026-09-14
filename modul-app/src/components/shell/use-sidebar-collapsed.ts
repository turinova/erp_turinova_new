'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'modul-app.sidebar-collapsed'

export function useSidebarCollapsed() {
  const [collapsed, setCollapsedState] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      setCollapsedState(localStorage.getItem(STORAGE_KEY) === '1')
    } catch {
      // ignore
    }
    setReady(true)
  }, [])

  function setCollapsed(next: boolean | ((prev: boolean) => boolean)) {
    setCollapsedState((prev) => {
      const value = typeof next === 'function' ? next(prev) : next
      try {
        localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
      } catch {
        // ignore
      }
      return value
    })
  }

  return { collapsed, setCollapsed, ready }
}
