'use client'

import { useEffect, useState } from 'react'

const POLL_INTERVAL_MS = 30000

export function useBufferCount(): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const fetchCount = () => {
      fetch('/api/orders/buffer/count')
        .then(res => (res.ok ? res.json() : null))
        .then(data => {
          const c = data?.count
          if (typeof c === 'number') setCount(c)
        })
        .catch(() => {})
    }
    fetchCount()
    const interval = setInterval(fetchCount, POLL_INTERVAL_MS)
    const onFocus = () => fetchCount()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  return count
}
