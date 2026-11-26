import '../src/global.css'

import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { PanelUIProvider } from 'panelui-native/provider'
import { ActivityIndicator, View } from 'react-native'
import { Uniwind } from 'uniwind'

import { AuthProvider, useAuth } from '@/features/auth/auth-context'
import { BiometricLockProvider } from '@/features/auth/biometric-lock'
import { PeriodProvider } from '@/features/period/period-context'
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

Uniwind.setTheme('light')

export default function RootLayout() {
  return (
    <PanelUIProvider>
      <AuthProvider>
        <FlagsProvider>
          <PeriodProvider>
            <BiometricLockProvider>
              <RootNavigator />
            </BiometricLockProvider>
          </PeriodProvider>
        </FlagsProvider>
      </AuthProvider>
    </PanelUIProvider>
  )
}
