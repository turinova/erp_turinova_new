import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { ActivityIndicator, View } from 'react-native'

import { AuthProvider, useAuth } from '@/features/auth/auth-context'
import { BiometricLockProvider } from '@/features/auth/biometric-lock'
import { FlagsProvider } from '@/features/tenant/flags-context'
import { colors } from '@/theme'

function RootNavigator() {
  const { loading } = useAuth()

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.app
        }}
      >
        <ActivityIndicator color={colors.ink} />
      </View>
    )
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.app }
        }}
      >
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="(app)" />
      </Stack>
    </>
  )
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <FlagsProvider>
        <BiometricLockProvider>
          <RootNavigator />
        </BiometricLockProvider>
      </FlagsProvider>
    </AuthProvider>
  )
}
