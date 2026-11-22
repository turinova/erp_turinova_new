import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native'
import { Redirect, useRouter } from 'expo-router'
import { ChevronLeft } from 'lucide-react-native'

import { MetricCard } from '@/components/metric-card'
import { useAuth } from '@/features/auth/auth-context'
import { useFlags } from '@/features/tenant/flags-context'
import { getGyartasGlance, type GyartasGlance } from '@/lib/gyartas'
import { supabase } from '@/lib/supabase'
import { colors, space } from '@/theme'
import { Screen } from '@/ui'

export default function GyartasScreen() {
  const { current } = useAuth()
  const { flags, loading: flagsLoading } = useFlags()
  const router = useRouter()
  const [data, setData] = useState<GyartasGlance | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!current) return
    setError(null)
    try {
      setData(await getGyartasGlance(supabase, current.tenantId))
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Nem sikerült betölteni az elmaradást.'
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [current])

  useEffect(() => {
    if (!flags.lapszabaszat) return
    setLoading(true)
    void load()
  }, [flags.lapszabaszat, load])

  if (!flagsLoading && !flags.lapszabaszat) {
    return <Redirect href="/(app)/tobb" />
  }

  if (!current) return null

  const tone =
    data && data.orderCount > 0 ? ('warning' as const) : ('default' as const)

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true)
        void load()
      }}
    >
      <Pressable
        onPress={() => router.back()}
        style={styles.back}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Vissza"
      >
        <ChevronLeft size={18} color={colors.ink} />
        <Text style={styles.backText}>Vissza</Text>
      </Pressable>

      {loading && !data ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={colors.ink} />
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {data ? (
        <MetricCard
          hero
          tone={tone}
          label="Elmaradás"
          value={`${data.orderCount} megrendelés`}
          hint={
            data.staleOrderCount > 0
              ? `+${data.staleOrderCount} régebbi (90 napon túl)`
              : 'Az elmúlt 90 nap ablaka'
          }
        />
      ) : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
    marginBottom: space[1]
  },
  backText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink
  },
  error: { color: colors.danger, fontSize: 14 }
})
