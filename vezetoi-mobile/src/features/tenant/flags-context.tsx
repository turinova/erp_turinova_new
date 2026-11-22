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

type FlagsState = {
  flags: TenantFlags
  loading: boolean
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
  const [flags, setFlags] = useState<TenantFlags>(defaultFlags)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!current) {
      setFlags(defaultFlags)
      setLoading(false)
      return
    }
    setLoading(true)
    const next = await loadTenantFlags(supabase, current.tenantId)
    setFlags(next)
    setLoading(false)
  }, [current])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const value = useMemo(
    () => ({ flags, loading, refresh }),
    [flags, loading, refresh]
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
