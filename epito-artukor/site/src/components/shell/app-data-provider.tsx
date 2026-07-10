"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { bootstrapAppData } from "@/lib/data/app-data-bootstrap"
import { flushBundlePersist } from "@/lib/data/projects-store"

type AppDataContextValue = {
  ready: boolean
  loading: boolean
  refresh: (force?: boolean) => Promise<void>
}

const AppDataContext = createContext<AppDataContextValue>({
  ready: false,
  loading: true,
  refresh: async () => {},
})

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async (force = false) => {
    setLoading(true)
    try {
      await bootstrapAppData({
        includeBundle: true,
        includeProjectFiles: false,
        includeMasterData: true,
        force,
      })
      setReady(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void bootstrapAppData({
      includeBundle: true,
      includeProjectFiles: false,
      includeMasterData: true,
    })
      .then(() => {
        if (!cancelled) {
          setReady(true)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const onPageHide = () => flushBundlePersist()
    window.addEventListener("pagehide", onPageHide)
    return () => window.removeEventListener("pagehide", onPageHide)
  }, [])

  const value = useMemo(
    () => ({ ready, loading, refresh }),
    [ready, loading, refresh]
  )

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData() {
  return useContext(AppDataContext)
}
