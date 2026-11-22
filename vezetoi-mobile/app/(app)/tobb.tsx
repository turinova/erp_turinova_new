import { useCallback, useState } from 'react'
import { StyleSheet, Text } from 'react-native'

import { useAuth } from '@/features/auth/auth-context'
import { useFlags } from '@/features/tenant/flags-context'
import { colors, type } from '@/theme'
import { Button, Card, Screen } from '@/ui'

export default function TobbScreen() {
  const { user, current, signOut, refreshMemberships } = useAuth()
  const { refresh: refreshFlags } = useFlags()
  const [refreshing, setRefreshing] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await refreshMemberships()
      await refreshFlags()
    } finally {
      setRefreshing(false)
    }
  }, [refreshMemberships, refreshFlags])

  if (!current) return null

  return (
    <Screen refreshing={refreshing} onRefresh={() => void onRefresh()}>
      <Text style={styles.email}>{user?.email}</Text>

      <Card>
        <Text style={styles.cardLabel}>Cég</Text>
        <Text style={styles.cardTitle}>{current.tenantName}</Text>
      </Card>

      <Button
        variant="destructive"
        loading={signingOut}
        onPress={() => {
          setSigningOut(true)
          void signOut().finally(() => setSigningOut(false))
        }}
      >
        Kijelentkezés
      </Button>
    </Screen>
  )
}

const styles = StyleSheet.create({
  email: {
    fontSize: 15,
    color: colors.inkSecondary
  },
  cardLabel: {
    ...type.label,
    color: colors.inkMuted
  },
  cardTitle: {
    ...type.title,
    color: colors.ink,
    marginTop: 2
  }
})
