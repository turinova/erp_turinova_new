import { useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'

import { budapestTodayYmd } from '@/lib/date'

const TICK_MS = 60_000

/** Mai nap (Europe/Budapest, YMD) — éjfélkor és előtérbe kerüléskor frissül. */
export function useBudapestToday(onChange?: (next: string, prev: string) => void): string {
  const [today, setToday] = useState(budapestTodayYmd)
  const todayRef = useRef(today)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    const check = () => {
      const next = budapestTodayYmd()
      const prev = todayRef.current
      if (prev === next) return
      todayRef.current = next
      setToday(next)
      onChangeRef.current?.(next, prev)
    }
    const timer = setInterval(check, TICK_MS)
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') check()
    })
    return () => {
      clearInterval(timer)
      sub.remove()
    }
  }, [])

  return today
}
