import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import {
  AppState,
  Image,
  StyleSheet,
  Text,
  View,
  type AppStateStatus
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useAuth } from '@/features/auth/auth-context'
import {
  authenticateBiometric,
  biometricLabel,
  enableBiometricLockIfAvailable,
  getBiometricLockEnabled
} from '@/lib/biometric'
import { colors, space } from '@/theme'
import { Button } from '@/ui'

type BiometricLockState = {
  /** Session megvan, de még Face ID kell */
  needsUnlock: boolean
  unlocked: boolean
  markUnlocked: () => void
  /** Jelszavas belépés után hívd */
  onPasswordSignInSuccess: () => Promise<void>
}

const BiometricLockContext = createContext<BiometricLockState | null>(null)

export function BiometricLockProvider({ children }: { children: ReactNode }) {
  const { session, current, signOut, loading } = useAuth()
  const [lockEnabled, setLockEnabled] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [ready, setReady] = useState(false)
  const appState = useRef(AppState.currentState)

  useEffect(() => {
    void (async () => {
      setLockEnabled(await getBiometricLockEnabled())
      setReady(true)
    })()
  }, [])

  const hasSession = !!session && !!current
  const needsUnlock = ready && hasSession && lockEnabled && !unlocked

  useEffect(() => {
    const sub = AppState.addEventListener(
      'change',
      (next: AppStateStatus) => {
        const prev = appState.current
        // Csak background → ne zárjon Control Center / multitask pillanatra
        if (prev === 'active' && next === 'background' && lockEnabled) {
          setUnlocked(false)
        }
        appState.current = next
      }
    )
    return () => sub.remove()
  }, [lockEnabled])

  const markUnlocked = useCallback(() => setUnlocked(true), [])

  const onPasswordSignInSuccess = useCallback(async () => {
    const enabled = await enableBiometricLockIfAvailable()
    setLockEnabled(enabled)
    setUnlocked(true)
  }, [])

  const value = useMemo(
    () => ({
      needsUnlock,
      unlocked,
      markUnlocked,
      onPasswordSignInSuccess
    }),
    [needsUnlock, unlocked, markUnlocked, onPasswordSignInSuccess]
  )

  return (
    <BiometricLockContext.Provider value={value}>
      {children}
      {!loading && needsUnlock ? (
        <UnlockOverlay
          onUnlocked={markUnlocked}
          onUsePassword={() => {
            void signOut()
            setUnlocked(false)
          }}
        />
      ) : null}
    </BiometricLockContext.Provider>
  )
}

export function useBiometricLock() {
  const ctx = useContext(BiometricLockContext)
  if (!ctx) throw new Error('useBiometricLock csak BiometricLockProvider-ben.')
  return ctx
}

function UnlockOverlay({
  onUnlocked,
  onUsePassword
}: {
  onUnlocked: () => void
  onUsePassword: () => void
}) {
  const [label, setLabel] = useState('Face ID')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tried = useRef(false)

  useEffect(() => {
    void biometricLabel().then(setLabel)
  }, [])

  const unlock = useCallback(async () => {
    setBusy(true)
    setError(null)
    const ok = await authenticateBiometric()
    setBusy(false)
    if (ok) onUnlocked()
    else setError('Nem sikerült. Próbáld újra, vagy lépj be jelszóval.')
  }, [onUnlocked])

  useEffect(() => {
    if (tried.current) return
    tried.current = true
    void unlock()
  }, [unlock])

  return (
    <View style={styles.overlay} pointerEvents="auto">
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Image
            source={require('../../../assets/brand/turinova-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.product}>Turinova · Admin</Text>
          <Text style={styles.title}>Oldd fel</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button loading={busy} onPress={() => void unlock()} style={styles.btn}>
            {`${label} feloldás`}
          </Button>
          <Button variant="ghost" onPress={onUsePassword}>
            Jelszóval belépés
          </Button>
        </View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 100,
    backgroundColor: colors.app
  },
  safe: { flex: 1 },
  center: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: space[5],
    gap: space[2],
    alignItems: 'center'
  },
  logo: { width: 200, height: 40 },
  product: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.inkMuted,
    marginBottom: space[4]
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.ink,
    marginBottom: space[2]
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: space[2]
  },
  btn: { alignSelf: 'stretch', marginTop: space[2] }
})
