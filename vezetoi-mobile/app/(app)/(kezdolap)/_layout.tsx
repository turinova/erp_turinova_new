import { Stack } from 'expo-router'

import { colors } from '@/theme'

/** Kezdőlap + részletezők: natív fejléc, „Kezdőlap” vissza gomb és visszahúzás. */
export default function KezdolapStack() {
  return (
    <Stack
      screenOptions={{
        headerBackTitle: 'Kezdőlap',
        headerTintColor: colors.ink,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { fontSize: 17, fontWeight: '600', color: colors.ink },
        contentStyle: { backgroundColor: colors.surface }
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false, title: 'Kezdőlap' }} />
      <Stack.Screen name="rendelt" options={{ title: 'Rendelt' }} />
      <Stack.Screen name="ajanlatok" options={{ title: 'Ajánlatok' }} />
      <Stack.Screen name="szabas" options={{ title: 'Szabás' }} />
      <Stack.Screen name="elmaradas" options={{ title: 'Elmaradás' }} />
    </Stack>
  )
}
