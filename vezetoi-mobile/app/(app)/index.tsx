import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'

import { MetricCard } from '@/components/metric-card'
import { useAuth } from '@/features/auth/auth-context'
import { useFlags } from '@/features/tenant/flags-context'
import {
  deltaBadgeTone,
  formatFt,
  formatVsLastWeekHint,
  formatVsYesterdayBadge
} from '@/lib/format'
import {
  getKezdolapPulse,
  type CompareDelta,
  type KezdolapPulse
} from '@/lib/kezdolap'
import { supabase } from '@/lib/supabase'
import { colors, space, type } from '@/theme'
import { Screen } from '@/ui'

function formatMeters(n: number): string {
  return `${new Intl.NumberFormat('hu-HU', {
    maximumFractionDigits: 1
  }).format(n)} m`
}

function withCompareHint(base: string, compare: CompareDelta): string {
  const week = formatVsLastWeekHint(compare.vsLastWeekPct)
  return week ? `${base} · ${week}` : base
}

export default function KezdolapScreen() {
  const { current } = useAuth()
  const { flags } = useFlags()
  const router = useRouter()
  const [pulse, setPulse] = useState<KezdolapPulse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    if (!current) return
    setError(null)
    try {
      const next = await getKezdolapPulse(supabase, current.tenantId, {
        lapszabaszat: flags.lapszabaszat,
        footcounter: flags.footcounter,
        jelenlet: flags.jelenlet
      })
      setPulse(next)
      if (next.loadError) setError(next.loadError)
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Nem sikerült betölteni a számokat.'
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [current, flags.lapszabaszat, flags.footcounter, flags.jelenlet])

  useEffect(() => {
    setLoading(true)
    void load()
  }, [load])

  if (!current) return null

  const showLapszabHero = Boolean(flags.lapszabaszat && pulse?.lapszab)
  const showBelepokHero = !showLapszabHero && Boolean(pulse?.belepok)
  const showBelepokCard = Boolean(
    flags.footcounter && pulse?.belepok && showLapszabHero
  )
  const showCapacity = Boolean(flags.lapszabaszat && pulse?.capacity)
  const showBent = Boolean(flags.jelenlet && pulse?.jelenlet)
  const dualSecondary = showBelepokCard && showCapacity

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true)
        void load()
      }}
    >
      {loading && !pulse ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.ink} />
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {pulse ? (
        <>
          {showLapszabHero && pulse.lapszab ? (
            <MetricCard
              hero
              label="Mai lapszabászat"
              value={formatFt(pulse.lapszab.todayGross)}
              hint={withCompareHint(
                `${pulse.lapszab.todayCount} megrendelés ma`,
                pulse.lapszab.compare
              )}
              badge={formatVsYesterdayBadge(
                pulse.lapszab.compare.vsYesterdayPct
              )}
              badgeTone={deltaBadgeTone(
                pulse.lapszab.compare.vsYesterdayPct
              )}
            />
          ) : null}

          {showBelepokHero && pulse.belepok ? (
            <MetricCard
              hero
              label="Belépők ma"
              value={
                pulse.belepok.closed
                  ? '—'
                  : pulse.belepok.todayIn.toLocaleString('hu-HU')
              }
              hint={
                pulse.belepok.closed
                  ? 'Ma zárva'
                  : withCompareHint(
                      pulse.belepok.netInside > 0
                        ? `bent ~${pulse.belepok.netInside}`
                        : pulse.belepok.hoursLabel,
                      pulse.belepok.compare
                    )
              }
              badge={
                pulse.belepok.closed
                  ? undefined
                  : formatVsYesterdayBadge(pulse.belepok.compare.vsYesterdayPct)
              }
              badgeTone={deltaBadgeTone(pulse.belepok.compare.vsYesterdayPct)}
              onPress={() => router.push('/(app)/belepok')}
            />
          ) : null}

          {showBent && pulse.jelenlet ? (
            <MetricCard
              label="Bent ma"
              value={`${pulse.jelenlet.bentCount} / ${pulse.jelenlet.activeCount}`}
              hint="Érkezett, még nincs távozás · aktív dolgozók"
              onPress={() => router.push('/(app)/jelenlet')}
            />
          ) : null}

          {showBelepokCard || showCapacity ? (
            <View style={styles.row}>
              {showBelepokCard && pulse.belepok ? (
                <View style={dualSecondary ? styles.half : styles.full}>
                  <MetricCard
                    label="Belépők ma"
                    value={
                      pulse.belepok.closed
                        ? '—'
                        : pulse.belepok.todayIn.toLocaleString('hu-HU')
                    }
                    hint={
                      pulse.belepok.closed
                        ? 'Ma zárva'
                        : withCompareHint(
                            pulse.belepok.netInside > 0
                              ? `bent ~${pulse.belepok.netInside}`
                              : 'vs tegnap',
                            pulse.belepok.compare
                          )
                    }
                    badge={
                      pulse.belepok.closed
                        ? undefined
                        : formatVsYesterdayBadge(
                            pulse.belepok.compare.vsYesterdayPct
                          )
                    }
                    badgeTone={deltaBadgeTone(
                      pulse.belepok.compare.vsYesterdayPct
                    )}
                    onPress={() => router.push('/(app)/belepok')}
                  />
                </View>
              ) : null}
              {showCapacity && pulse.capacity ? (
                <View style={dualSecondary ? styles.half : styles.full}>
                  <MetricCard
                    label="Szabás kapacitás"
                    value={`${pulse.capacity.pct}%`}
                    hint={withCompareHint(
                      `${formatMeters(pulse.capacity.usedM)} / ${formatMeters(pulse.capacity.limitM)}`,
                      pulse.capacity.compare
                    )}
                    badge={formatVsYesterdayBadge(
                      pulse.capacity.compare.vsYesterdayPct
                    )}
                    badgeTone={deltaBadgeTone(
                      pulse.capacity.compare.vsYesterdayPct
                    )}
                    tone={pulse.capacity.pct >= 85 ? 'warning' : 'default'}
                  />
                </View>
              ) : null}
            </View>
          ) : null}

          {!showLapszabHero && flags.lapszabaszat && pulse.lapszab ? (
            <MetricCard
              label="Mai lapszabászat"
              value={formatFt(pulse.lapszab.todayGross)}
              hint={withCompareHint(
                `${pulse.lapszab.todayCount} megrendelés ma`,
                pulse.lapszab.compare
              )}
              badge={formatVsYesterdayBadge(
                pulse.lapszab.compare.vsYesterdayPct
              )}
              badgeTone={deltaBadgeTone(
                pulse.lapszab.compare.vsYesterdayPct
              )}
            />
          ) : null}

          <MetricCard
            label="Ajánlatok ma"
            value={`Partner ${pulse.quotes.partnerCount} · Saját ${pulse.quotes.staffCount}`}
            hint={withCompareHint(
              'Mai beküldés · mai készítés',
              pulse.quotes.comparePartner
            )}
            badge={formatVsYesterdayBadge(
              pulse.quotes.comparePartner.vsYesterdayPct
            )}
            badgeTone={deltaBadgeTone(
              pulse.quotes.comparePartner.vsYesterdayPct
            )}
          />

          {pulse.google ? (
            <MetricCard
              label="Google értékelés"
              value={String(pulse.google.todayClicks)}
              hint={withCompareHint(
                `Link megnyitás ma · 30 nap: ${pulse.google.last30Clicks}`,
                pulse.google.compare
              )}
              badge={formatVsYesterdayBadge(
                pulse.google.compare.vsYesterdayPct
              )}
              badgeTone={deltaBadgeTone(pulse.google.compare.vsYesterdayPct)}
            />
          ) : null}

          {!flags.lapszabaszat &&
          !flags.footcounter &&
          !flags.jelenlet &&
          !pulse.google ? (
            <Text style={styles.emptyHint}>
              Nincs megjeleníthető adat ehhez a céghez.
            </Text>
          ) : null}
        </>
      ) : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: space[2]
  },
  half: { flex: 1 },
  full: { flex: 1 },
  emptyHint: {
    ...type.bodySm,
    color: colors.inkSecondary
  },
  error: {
    color: colors.danger,
    fontSize: 14
  }
})
