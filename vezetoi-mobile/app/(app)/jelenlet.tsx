import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text } from 'react-native'

import { JelenletDayNav } from '@/components/jelenlet-day-nav'
import { JelenletHolidayBannerView } from '@/components/jelenlet-holiday-banner'
import { JelenletList } from '@/components/jelenlet-list'
import { useAuth } from '@/features/auth/auth-context'
import { useFlags } from '@/features/tenant/flags-context'
import { budapestTodayYmd } from '@/lib/date'
import {
  getJelenletDay,
  jelenletClampYmd,
  jelenletShiftDay,
  type JelenletDayModel
} from '@/lib/jelenlet'
import { supabase } from '@/lib/supabase'
import { colors, space, type } from '@/theme'
import { Card, Screen } from '@/ui'

export default function JelenletTab() {
  const { current } = useAuth()
  const { flags } = useFlags()
  const [ymd, setYmd] = useState(budapestTodayYmd)
  const [model, setModel] = useState<JelenletDayModel | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    if (!current || !flags.jelenlet) {
      setModel(null)
      setLoading(false)
      setRefreshing(false)
      return
    }
    try {
      const next = await getJelenletDay(supabase, current.tenantId, ymd)
      setModel(next)
      if (next.ymd !== ymd) setYmd(next.ymd)
    } catch (e) {
      setModel({
        ymd,
        label: ymd === budapestTodayYmd() ? 'Ma' : ymd,
        isToday: ymd === budapestTodayYmd(),
        canGoNext: ymd < budapestTodayYmd(),
        canGoPrev: true,
        holiday: null,
        bentCount: 0,
        vacationCount: 0,
        sickCount: 0,
        summaryLine: null,
        rows: [],
        loadError:
          e instanceof Error
            ? e.message
            : 'Nem sikerült betölteni a jelenlétet.'
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [current, flags.jelenlet, ymd])

  useEffect(() => {
    setLoading(true)
    void load()
  }, [load])

  if (!current) return null

  if (!flags.jelenlet) {
    return (
      <Screen>
        <Card>
          <Text style={styles.emptyTitle}>Nincs Jelenlét modul</Text>
          <Text style={styles.emptyBody}>
            Ehhez a céghez nincs bekapcsolva. Kérj jogosultságot a Turinova
            adminisztrátortól.
          </Text>
        </Card>
      </Screen>
    )
  }

  const shift = (delta: number) => {
    const next = jelenletShiftDay(ymd, delta)
    if (!next.canGo && next.ymd === ymd) return
    setYmd(next.ymd)
  }

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true)
        void load()
      }}
    >
      <JelenletDayNav
        ymd={ymd}
        label={model?.label ?? (ymd === budapestTodayYmd() ? 'Ma' : ymd)}
        isToday={model?.isToday ?? ymd === budapestTodayYmd()}
        canGoPrev={model?.canGoPrev ?? true}
        canGoNext={model?.canGoNext ?? false}
        onPrev={() => shift(-1)}
        onNext={() => shift(1)}
        onSelectYmd={(next) => setYmd(jelenletClampYmd(next))}
        onToday={() => setYmd(budapestTodayYmd())}
      />

      {loading && !model ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={colors.ink} />
      ) : null}

      {model?.loadError ? (
        <Text style={styles.error}>{model.loadError}</Text>
      ) : null}

      {model && !model.loadError ? (
        <>
          {model.holiday ? (
            <JelenletHolidayBannerView holiday={model.holiday} />
          ) : null}

          {model.summaryLine ? (
            <Text style={styles.summary}>{model.summaryLine}</Text>
          ) : model.rows.length > 0 ? (
            <Text style={styles.summaryMuted}>
              Ezen a napon még nincs jelölés
            </Text>
          ) : null}

          <JelenletList rows={model.rows} />
        </>
      ) : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  summary: {
    fontSize: 13,
    color: colors.inkSecondary,
    textAlign: 'center'
  },
  summaryMuted: {
    fontSize: 13,
    color: colors.inkMuted,
    textAlign: 'center'
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink
  },
  emptyBody: {
    marginTop: space[2],
    ...type.bodySm,
    color: colors.inkSecondary
  },
  error: {
    ...type.bodySm,
    color: colors.danger
  }
})
