import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native'
import { ChevronLeft, ChevronRight } from 'lucide-react-native'
import { BarChart } from 'react-native-gifted-charts'

import { useAuth } from '@/features/auth/auth-context'
import { useFlags } from '@/features/tenant/flags-context'
import {
  belepokShiftMonth,
  getBelepokPage,
  type BelepokPageModel,
  type BelepokPeriod
} from '@/lib/belepok'
import { budapestYearMonth } from '@/lib/date'
import { supabase } from '@/lib/supabase'
import { colors, space, type } from '@/theme'
import { Card, HeroMetric, Screen, SegmentedControl } from '@/ui'

const PERIODS: { id: BelepokPeriod; label: string }[] = [
  { id: 'today', label: 'Ma' },
  { id: 'week', label: 'Hét' },
  { id: 'month', label: 'Hó' }
]

export default function BelepokTab() {
  const { current } = useAuth()
  const { flags } = useFlags()
  const now = budapestYearMonth()

  const [period, setPeriod] = useState<BelepokPeriod>('today')
  const [year, setYear] = useState(now.year)
  const [month, setMonth] = useState(now.month)
  const [model, setModel] = useState<BelepokPageModel | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [chartWidth, setChartWidth] = useState(0)

  const load = useCallback(async () => {
    if (!current || !flags.footcounter) {
      setModel(null)
      setLoading(false)
      setRefreshing(false)
      return
    }
    try {
      const next = await getBelepokPage(
        supabase,
        current.tenantId,
        period,
        year,
        month
      )
      setModel(next)
    } catch (e) {
      setModel({
        period,
        liveStatus: 'none',
        heroValue: 0,
        heroSuffix: 'belépő',
        heroHint: '',
        detailLine: null,
        bars: [],
        emptyMessage: null,
        year,
        month,
        monthLabel: '',
        canGoNextMonth: false,
        canGoPrevMonth: false,
        loadError:
          e instanceof Error
            ? e.message
            : 'Nem sikerült betölteni a Belépők adatokat.'
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [current, flags.footcounter, period, year, month])

  useEffect(() => {
    setLoading(true)
    void load()
  }, [load])

  const chartData = useMemo(() => {
    if (!model) return []
    return model.bars.map((b) => ({
      value: b.value,
      label: b.label,
      frontColor: b.highlight ? colors.chartBar : colors.chartBarMuted,
      labelTextStyle: {
        color: colors.inkMuted,
        fontSize: 10
      }
    }))
  }, [model])

  if (!current) return null

  if (!flags.footcounter) {
    return (
      <Screen>
        <Card>
          <Text style={styles.emptyTitle}>Nincs belépőszámláló</Text>
          <Text style={styles.emptyBody}>
            Ehhez a céghez nincs bekapcsolva. Kérj jogosultságot a Turinova
            adminisztrátortól.
          </Text>
        </Card>
      </Screen>
    )
  }

  const n = Math.max(model?.bars.length ?? 1, 1)
  const barWidth =
    chartWidth > 0
      ? Math.max(
          period === 'month' ? 4 : 10,
          Math.floor((chartWidth - 16) / (n * (period === 'month' ? 1.15 : 1.4)))
        )
      : 10
  const maxValue =
    Math.max(...(model?.bars.map((b) => b.value) ?? [0]), 1) * 1.15

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true)
        void load()
      }}
      contentStyle={styles.screenPad}
    >
      <View style={styles.padH}>
        <SegmentedControl
          options={PERIODS}
          value={period}
          onChange={(id) => {
            setPeriod(id)
            if (id !== 'month') {
              const cur = budapestYearMonth()
              setYear(cur.year)
              setMonth(cur.month)
            }
          }}
        />

        {period === 'month' && model ? (
          <View style={styles.monthNav}>
            <Pressable
              disabled={!model.canGoPrevMonth}
              onPress={() => {
                const next = belepokShiftMonth(year, month, -1)
                setYear(next.year)
                setMonth(next.month)
              }}
              style={[
                styles.monthHit,
                !model.canGoPrevMonth && styles.monthHitDisabled
              ]}
              hitSlop={10}
            >
              <ChevronLeft size={20} color={colors.ink} />
            </Pressable>
            <Text style={styles.monthLabel}>{model.monthLabel}</Text>
            <Pressable
              disabled={!model.canGoNextMonth}
              onPress={() => {
                const next = belepokShiftMonth(year, month, 1)
                setYear(next.year)
                setMonth(next.month)
              }}
              style={[
                styles.monthHit,
                !model.canGoNextMonth && styles.monthHitDisabled
              ]}
              hitSlop={10}
            >
              <ChevronRight size={20} color={colors.ink} />
            </Pressable>
          </View>
        ) : null}
      </View>

      {loading && !model ? (
        <ActivityIndicator style={{ marginTop: 48 }} color={colors.ink} />
      ) : null}

      {model?.loadError ? (
        <Text style={[styles.error, styles.padH]}>{model.loadError}</Text>
      ) : null}

      {model && !model.loadError ? (
        <>
          <View style={styles.padH}>
            <HeroMetric
              value={model.heroValue.toLocaleString('hu-HU')}
              unit={model.heroSuffix}
              hint={model.heroHint || null}
            />
          </View>

          <View style={styles.chartBlock}>
            <View
              style={styles.chartWrap}
              onLayout={(e: LayoutChangeEvent) =>
                setChartWidth(e.nativeEvent.layout.width)
              }
            >
              {model.emptyMessage ? (
                <Text style={styles.emptyChart}>{model.emptyMessage}</Text>
              ) : chartWidth > 0 ? (
                <BarChart
                  data={chartData}
                  width={chartWidth}
                  height={168}
                  barWidth={barWidth}
                  spacing={Math.max(
                    period === 'month' ? 2 : 4,
                    Math.floor(barWidth * (period === 'month' ? 0.12 : 0.32))
                  )}
                  initialSpacing={6}
                  endSpacing={6}
                  hideRules
                  hideYAxisText
                  yAxisThickness={0}
                  xAxisThickness={0}
                  disableScroll
                  isAnimated
                  animationDuration={320}
                  noOfSections={3}
                  maxValue={maxValue}
                />
              ) : (
                <View style={{ height: 168 }} />
              )}
            </View>

            {model.detailLine && !model.emptyMessage ? (
              <Text style={styles.detail}>{model.detailLine}</Text>
            ) : null}

            {model.liveStatus === 'live' ? (
              <Text style={styles.liveNote}>Eszköz élő</Text>
            ) : null}
          </View>
        </>
      ) : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  screenPad: {
    paddingHorizontal: 0,
    gap: space[4]
  },
  padH: {
    paddingHorizontal: space[4],
    gap: space[3]
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  monthHit: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center'
  },
  monthHitDisabled: {
    opacity: 0.3
  },
  monthLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink
  },
  chartBlock: {
    gap: space[2]
  },
  chartWrap: {
    paddingHorizontal: space[2],
    minHeight: 168
  },
  emptyChart: {
    ...type.body,
    color: colors.inkSecondary,
    textAlign: 'center',
    paddingVertical: space[8],
    paddingHorizontal: space[4]
  },
  detail: {
    paddingHorizontal: space[4],
    fontSize: 13,
    color: colors.inkSecondary,
    textAlign: 'center'
  },
  liveNote: {
    paddingHorizontal: space[4],
    fontSize: 11,
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
