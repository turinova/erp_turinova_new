import * as Haptics from 'expo-haptics'
import { Redirect } from 'expo-router'
import { useRef, useState } from 'react'
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useBiometricLock } from '@/features/auth/biometric-lock'
import { useAuth } from '@/features/auth/auth-context'
import { colors, space } from '@/theme'
import { Button, Card, Input, PasswordInput } from '@/ui'

export default function SignInScreen() {
  const { session, current, signIn, configured, gateError } = useAuth()
  const { onPasswordSignInSuccess } = useBiometricLock()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const passwordRef = useRef<{ focus: () => void } | null>(null)

  if (session && current) {
    return <Redirect href="/(app)" />
  }

  const canSubmit =
    configured && email.trim().length > 0 && password.length > 0

  async function onSubmit() {
    if (!canSubmit || busy) return
    setBusy(true)
    setError(null)
    const message = await signIn(email, password)
    if (message) {
      setError(message)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      setBusy(false)
      return
    }
    await onPasswordSignInSuccess()
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    setBusy(false)
  }

  const alert = error ?? gateError

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <View style={styles.brandBlock}>
            <Image
              source={require('../assets/brand/turinova-logo.png')}
              style={styles.logo}
              resizeMode="contain"
              accessibilityLabel="Turinova"
            />
            <Text style={styles.product}>Optinova · Vezető</Text>
          </View>

          {!configured ? (
            <Card tone="danger" style={styles.banner}>
              <Text style={styles.bannerText}>
                Hiányzik a .env.local (EXPO_PUBLIC_SUPABASE_URL /
                EXPO_PUBLIC_SUPABASE_ANON_KEY). Másold a modul-app kulcsait.
              </Text>
            </Card>
          ) : null}

          <Text style={styles.label}>Email</Text>
          <Input
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="username"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
            placeholder="nev@ceg.hu"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => passwordRef.current?.focus()}
          />

          <Text style={styles.label}>Jelszó</Text>
          <PasswordInput
            ref={(node) => {
              passwordRef.current = node
                ? { focus: () => (node as unknown as { focus: () => void }).focus() }
                : null
            }}
            textContentType="password"
            autoComplete="password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            returnKeyType="go"
            onSubmitEditing={() => void onSubmit()}
          />

          {alert ? (
            <Card tone="danger" style={styles.banner}>
              <Text style={styles.bannerText} accessibilityRole="alert">
                {alert}
              </Text>
            </Card>
          ) : null}

          <Button
            loading={busy}
            disabled={!canSubmit}
            onPress={() => void onSubmit()}
            style={styles.primary}
          >
            Belépés
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.app },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: space[5],
    paddingVertical: space[6],
    gap: space[2]
  },
  brandBlock: {
    alignItems: 'center',
    marginBottom: space[5],
    gap: space[2]
  },
  logo: {
    width: 220,
    height: 44
  },
  product: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.inkMuted,
    letterSpacing: 0.3
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
    marginTop: space[2]
  },
  primary: { marginTop: space[4] },
  banner: { marginTop: space[2] },
  bannerText: { color: colors.danger, fontSize: 13, lineHeight: 18 }
})
