import AsyncStorage from '@react-native-async-storage/async-storage'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import type { Period } from '@/lib/pulse-types'

const KEY = 'vezetoi.period'

type PeriodState = { period: Period; setPeriod: (p: Period) => void }

const PeriodContext = createContext<PeriodState | null>(null)

/** Kezdőlap Ma / Hét / Hónap — a részletezők öröklik, és megmarad újraindítás után is. */
export function PeriodProvider({ children }: { children: ReactNode }) {
  const [period, setPeriodState] = useState<Period>('ma')

  useEffect(() => {
    void AsyncStorage.getItem(KEY).then((v) => {
      if (v === 'ma' || v === 'het' || v === 'honap') setPeriodState(v)
    })
  }, [])

  const setPeriod = useCallback((p: Period) => {
    setPeriodState(p)
    void AsyncStorage.setItem(KEY, p)
  }, [])

  const value = useMemo(() => ({ period, setPeriod }), [period, setPeriod])
  return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>
}

export function usePeriod() {
  const ctx = useContext(PeriodContext)
  if (!ctx) throw new Error('usePeriod csak PeriodProvider-ben.')
  return ctx
}
