import { Redirect, Tabs } from 'expo-router'
import { Footprints, Home, Menu, Users } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useAuth } from '@/features/auth/auth-context'
import { colors } from '@/theme'

export default function AppLayout() {
  const { session, current, loading } = useAuth()
  const insets = useSafeAreaInsets()

  if (!loading && (!session || !current)) {
    return <Redirect href="/sign-in" />
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.subtle },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          // Ne fix height — iPhone home indicator / Android gesture inset
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 8),
          minHeight: 49 + Math.max(insets.bottom, 8)
        },
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600'
        },
        tabBarItemStyle: {
          paddingVertical: 2
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Kezdőlap',
          tabBarIcon: ({ color, size, focused }) => (
            <Home
              size={size ?? 22}
              color={color}
              strokeWidth={focused ? 2.25 : 2}
            />
          )
        }}
      />
      <Tabs.Screen
        name="jelenlet"
        options={{
          title: 'Jelenlét',
          tabBarIcon: ({ color, size, focused }) => (
            <Users
              size={size ?? 22}
              color={color}
              strokeWidth={focused ? 2.25 : 2}
            />
          )
        }}
      />
      <Tabs.Screen
        name="belepok"
        options={{
          title: 'Belépők',
          tabBarIcon: ({ color, size, focused }) => (
            <Footprints
              size={size ?? 22}
              color={color}
              strokeWidth={focused ? 2.25 : 2}
            />
          )
        }}
      />
      <Tabs.Screen
        name="tobb"
        options={{
          title: 'Több',
          tabBarIcon: ({ color, size, focused }) => (
            <Menu
              size={size ?? 22}
              color={color}
              strokeWidth={focused ? 2.25 : 2}
            />
          )
        }}
      />
      {/* Gyártás: nem tab — Több listából nyílik */}
      <Tabs.Screen
        name="gyartas"
        options={{
          href: null
        }}
      />
    </Tabs>
  )
}
