import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'

import { useAuth } from '@/features/auth/auth-context'
import {
  loadTenantFlags,
  type TenantFlags
} from '@/lib/entitlements'
import { supabase } from '@/lib/supabase'

const CACHE_KEY = 'vezetoi.flags.'

type FlagsState = {
  flags: TenantFlags
  loading: boolean
  /** Van már ismert érték (hálózatról vagy cache-ből) az aktív céghez. */
  ready: boolean
  /** Az utolsó betöltés hibázott, és nincs cache. */
  failed: boolean
  refresh: () => Promise<void>
}

const defaultFlags: TenantFlags = {
  lapszabaszat: false,
  partnerOrders: false,
  jelenlet: false,
  footcounter: false
}

const FlagsContext = createContext<FlagsState | null>(null)

export function FlagsProvider({ children }: { children: ReactNode }) {
  const { current } = useAuth()
  const tenantId = current?.tenantId ?? null
  const [flags, setFlags] = useState<TenantFlags>(defaultFlags)
  const [loading, setLoading] = useState(true)
  const [readyFor, setReadyFor] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!tenantId) {
      setFlags(defaultFlags)
      setReadyFor(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const next = await loadTenantFlags(supabase, tenantId)
      setFlags(next)
      setReadyFor(tenantId)
      void AsyncStorage.setItem(CACHE_KEY + tenantId, JSON.stringify(next))
    } catch (e) {
      console.warn('[flags]', e instanceof Error ? e.message : e)
      const raw = await AsyncStorage.getItem(CACHE_KEY + tenantId)
      if (raw) {
        setFlags(JSON.parse(raw) as TenantFlags)
        setReadyFor(tenantId)
      }
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const ready = tenantId != null && readyFor === tenantId
  const failed = !ready && !loading

  const value = useMemo(
    () => ({ flags, loading, ready, failed, refresh }),
    [flags, loading, ready, failed, refresh]
  )

  return (
    <FlagsContext.Provider value={value}>{children}</FlagsContext.Provider>
  )
}

export function useFlags() {
  const ctx = useContext(FlagsContext)
  if (!ctx) throw new Error('useFlags csak FlagsProvider-ben.')
  return ctx
}
