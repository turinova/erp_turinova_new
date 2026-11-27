import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Session, User } from '@supabase/supabase-js'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'

import {
  isPartnerOnlyUser,
  listActiveMemberships,
  pickMembership,
  type TenantMembership
} from '@/lib/memberships'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

const PREFERRED_TENANT_KEY = 'vezetoi.preferredTenantId'

type AuthState = {
  loading: boolean
  session: Session | null
  user: User | null
  memberships: TenantMembership[]
  current: TenantMembership | null
  gateError: string | null
  configured: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
  selectTenant: (tenantId: string) => Promise<void>
  refreshMemberships: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

const MEMBERSHIPS_CACHE_KEY = 'vezetoi.memberships.'

type Gate = {
  memberships: TenantMembership[]
  current: TenantMembership | null
  gateError: string | null
}

const OFFLINE_GATE_ERROR = 'Nincs kapcsolat a szerverrel. Nézd meg a hálózatot, és próbáld újra.'

/** Hálózati hibánál nem léptet ki: az utolsó ismert tagságokkal megy tovább. */
async function loadGate(user: User): Promise<Gate> {
  try {
    const gate = await loadGateOnline(user)
    if (gate.memberships.length > 0) {
      await AsyncStorage.setItem(MEMBERSHIPS_CACHE_KEY + user.id, JSON.stringify(gate.memberships))
    } else {
      await AsyncStorage.removeItem(MEMBERSHIPS_CACHE_KEY + user.id)
    }
    return gate
  } catch (e) {
    console.warn('[auth] loadGate', e instanceof Error ? e.message : e)
    const raw = await AsyncStorage.getItem(MEMBERSHIPS_CACHE_KEY + user.id)
    const cached = raw ? (JSON.parse(raw) as TenantMembership[]) : []
    if (cached.length === 0) {
      return { memberships: [], current: null, gateError: OFFLINE_GATE_ERROR }
    }
    const preferred = await AsyncStorage.getItem(PREFERRED_TENANT_KEY)
    return { memberships: cached, current: pickMembership(cached, preferred), gateError: null }
  }
}

async function loadGateOnline(user: User): Promise<Gate> {
  if (await isPartnerOnlyUser(supabase, user.id)) {
    await supabase.auth.signOut()
    return {
      memberships: [],
      current: null,
      gateError:
        'Ez asztalos (partner) fiók. A vezetői app csak céges staff belépést fogad.'
    }
  }

  const memberships = await listActiveMemberships(supabase, user.id)
  if (memberships.length === 0) {
    await supabase.auth.signOut()
    return {
      memberships: [],
      current: null,
      gateError: 'Nincs aktív céges tagság ehhez a fiókhoz.'
    }
  }

  const preferred = await AsyncStorage.getItem(PREFERRED_TENANT_KEY)
  const current = pickMembership(memberships, preferred)
  if (current) {
    await AsyncStorage.setItem(PREFERRED_TENANT_KEY, current.tenantId)
  }

  return { memberships, current, gateError: null }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [memberships, setMemberships] = useState<TenantMembership[]>([])
  const [current, setCurrent] = useState<TenantMembership | null>(null)
  const [gateError, setGateError] = useState<string | null>(null)

  const applySession = useCallback(async (next: Session | null) => {
    setSession(next)
    if (!next?.user) {
      setMemberships([])
      setCurrent(null)
      return
    }
    const gate = await loadGate(next.user)
    setMemberships(gate.memberships)
    setCurrent(gate.current)
    if (gate.gateError) setGateError(gate.gateError)
  }, [])

  useEffect(() => {
    let mounted = true

    void (async () => {
      if (!isSupabaseConfigured) {
        if (mounted) setLoading(false)
        return
      }
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      await applySession(data.session)
      if (mounted) setLoading(false)
    })()

    // Supabase-hívás a callbacken belül holtpontot okozhat → következő tickre halasztva.
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'INITIAL_SESSION') return
      if (event === 'TOKEN_REFRESHED') {
        setSession(next)
        return
      }
      setTimeout(() => {
        void (async () => {
          await applySession(next)
          if (mounted) setLoading(false)
        })()
      }, 0)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [applySession])

  const signIn = useCallback(async (email: string, password: string) => {
    setGateError(null)
    if (!isSupabaseConfigured) {
      return 'A belépés most nem érhető el. Frissítsd az appot.'
    }
    const trimmed = email.trim().toLowerCase()
    if (!trimmed || !password) {
      return 'Add meg az email címet és a jelszót.'
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: trimmed,
      password
    })

    if (error || !data.session) {
      const msg = error?.message?.toLowerCase() ?? ''
      if (msg.includes('invalid login')) return 'Hibás email vagy jelszó.'
      if (msg.includes('email not confirmed')) {
        return 'Az email még nincs megerősítve.'
      }
      if (error?.message) console.warn('[auth] signIn', error.message)
      if (msg.includes('fetch') || msg.includes('network')) {
        return 'Nincs kapcsolat a szerverrel. Nézd meg a hálózatot.'
      }
      return 'A belépés nem sikerült. Próbáld újra.'
    }

    const gate = await loadGate(data.session.user)
    if (gate.gateError) {
      setGateError(gate.gateError)
      return gate.gateError
    }
    setMemberships(gate.memberships)
    setCurrent(gate.current)
    setSession(data.session)
    return null
  }, [])

  const signOut = useCallback(async () => {
    setGateError(null)
    await supabase.auth.signOut()
    setSession(null)
    setMemberships([])
    setCurrent(null)
  }, [])

  const selectTenant = useCallback(
    async (tenantId: string) => {
      const next = pickMembership(memberships, tenantId)
      if (!next) return
      await AsyncStorage.setItem(PREFERRED_TENANT_KEY, next.tenantId)
      setCurrent(next)
    },
    [memberships]
  )

  const refreshMemberships = useCallback(async () => {
    if (!session?.user) return
    const gate = await loadGate(session.user)
    setMemberships(gate.memberships)
    setCurrent(gate.current)
    if (gate.gateError) setGateError(gate.gateError)
  }, [session])

  const value = useMemo<AuthState>(
    () => ({
      loading,
      session,
      user: session?.user ?? null,
      memberships,
      current,
      gateError,
      configured: isSupabaseConfigured,
      signIn,
      signOut,
      selectTenant,
      refreshMemberships
    }),
    [
      loading,
      session,
      memberships,
      current,
      gateError,
      signIn,
      signOut,
      selectTenant,
      refreshMemberships
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth csak AuthProvider-ben használható.')
  return ctx
}
