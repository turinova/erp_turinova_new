import { useRouter, type Href } from 'expo-router'
import {
  ChevronDown,
  DoorOpen,
  FileText,
  Gauge,
  RotateCw,
  Scissors,
  TriangleAlert,
  Users
} from 'lucide-react-native'
import { Alert, Pressable, Text, View } from 'react-native'

import { FlagsPending } from '@/components/flags-pending'
import {
  DeltaFooter,
  FooterText,
  Group,
  HeroCard,
  StaleStrip,
  ThinBar,
  Tile
} from '@/components/pulse'
import { useAuth } from '@/features/auth/auth-context'
import { usePeriod } from '@/features/period/period-context'
import { useFlags } from '@/features/tenant/flags-context'
import { getBelepokPeriodGlance, type BelepokPeriodGlance } from '@/lib/belepok'
import { formatClock, formatDelta, formatFt } from '@/lib/format'
import { getBentMost, type BentMost } from '@/lib/kezdolap'
import { PERIOD_OPTIONS, type MobilePulse, type Period } from '@/lib/pulse-types'
import { supabase } from '@/lib/supabase'
import { useCachedResource } from '@/lib/use-cached-resource'
import { useMobileApi } from '@/lib/use-mobile-api'
import { colors } from '@/theme'
import { Card, ListRow, Screen, SegmentedControl, Skeleton } from '@/ui'

const num = (n: number) => new Intl.NumberFormat('hu-HU').format(n)

const STALE_AFTER_MS = 15 * 60_000

const RENDELT_LABEL: Record<Period, string> = {
  ma: 'Ma rendeltek',
  het: 'E héten rendeltek',
  honap: 'E hónapban rendeltek'
}

const PERIOD_WORD: Record<Period, string> = { ma: 'ma', het: 'e héten', honap: 'e hónapban' }

const COMPARE_COUNT_WORD: Record<Period, string> = {
  ma: 'szokásos',
  het: 'múlt héten',
  honap: 'előző hónapban'
}

export default function KezdolapScreen() {
  const { current } = useAuth()
  const { flags, ready: flagsReady } = useFlags()
  const { period, setPeriod } = usePeriod()
  const router = useRouter()
  const tenantId = current?.tenantId ?? null

  const pulse = useMobileApi<MobilePulse>('kezdolap', period, flags.lapszabaszat)
  const belepok = useCachedResource<BelepokPeriodGlance>(
    flags.footcounter && tenantId ? `belepok:${tenantId}:${period}` : null,
    () => getBelepokPeriodGlance(supabase, tenantId ?? '', period)
  )
  const bent = useCachedResource<BentMost | null>(
    flags.jelenlet && tenantId ? `bent:${tenantId}` : null,
    () => getBentMost(supabase, tenantId ?? '')
  )

  if (!current) return null
  if (!flagsReady) return <FlagsPending />

  const lap = pulse.data?.lapszabaszat ?? null
  const refreshing = pulse.refreshing || belepok.refreshing || bent.refreshing
  const refreshAll = () => {
    void pulse.refresh()
    void belepok.refresh()
    void bent.refresh()
  }
  const go = (path: string) => () => router.push(path as Href)

  return (
    <Screen contentStyle={{ gap: 20 }} refreshing={refreshing} onRefresh={refreshAll}>
      <KezdolapHeader
        updatedAt={pulse.updatedAt ?? belepok.updatedAt}
        busy={refreshing}
        onRefresh={refreshAll}
      />

      <SegmentedControl options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />

      {pulse.error && pulse.data ? <StaleStrip updatedAt={pulse.updatedAt} /> : null}

      {flags.lapszabaszat && pulse.loading ? <KezdolapSkeleton /> : null}

      {flags.lapszabaszat && pulse.error && !pulse.data ? (
        <Card tone="danger">
          <Text className="text-[14px] font-semibold text-destructive-foreground">
            Nem sikerült betölteni a számokat.
          </Text>
          <Text className="text-[13px] text-muted-foreground">
            Nézd meg a hálózatot, és húzd le a frissítéshez.
          </Text>
        </Card>
      ) : null}

      {lap ? (
        <HeroCard
          icon={Scissors}
          label={RENDELT_LABEL[period]}
          value={formatFt(lap.rendelt.gross)}
          onPress={go('/rendelt')}
          footer={
            <View className="gap-0.5">
              <DeltaFooter
                delta={formatDelta(lap.rendelt.gross, lap.rendelt.compare?.gross ?? null, formatFt)}
                label={lap.rendelt.compareLabel}
              />
              <FooterText>
                {lap.rendelt.count > 0
                  ? `${num(lap.rendelt.count)} rendelés${
                      lap.rendelt.compare
                        ? ` · ${COMPARE_COUNT_WORD[period]}: ${num(Math.round(lap.rendelt.compare.count))}`
                        : ''
                    }`
                  : `Még nincs rendelés ${PERIOD_WORD[period]}`}
              </FooterText>
            </View>
          }
        />
      ) : null}

      {lap || (flags.footcounter && belepok.data) ? (
        <View className="flex-row gap-3">
          {lap ? (
            <Tile
              icon={FileText}
              label="Ajánlatok"
              value={`${num(lap.ajanlatok.total)} db`}
              onPress={go('/ajanlatok')}
              footer={
                <FooterText>
                  {lap.ajanlatok.partner.count > 0
                    ? `${num(lap.ajanlatok.partner.count)} partnertől`
                    : 'partnertől nem jött'}
                </FooterText>
              }
            />
          ) : null}
          {flags.footcounter && belepok.data ? (
            <BelepokTile glance={belepok.data} onPress={go('/belepok')} />
          ) : null}
        </View>
      ) : null}

      {lap || bent.data ? (
        <Group title="Most">
          {lap ? (
            <View className="flex-row gap-3">
              {lap.szabas ? (
                <Tile
                  icon={Gauge}
                  label="Szabás ma"
                  value={`${lap.szabas.pct}%`}
                  onPress={go('/szabas')}
                  footer={
                    <>
                      <ThinBar pct={lap.szabas.pct} />
                      <FooterText tone={lap.szabas.pct >= 100 ? 'warning' : 'muted'}>
                        {`${lap.szabas.pct >= 100 ? '⚠ ' : ''}${num(lap.szabas.usedM)} / ${num(lap.szabas.limitM)} m`}
                      </FooterText>
                    </>
                  }
                />
              ) : null}
              <Tile
                icon={TriangleAlert}
                label="Elmaradás"
                value={lap.elmaradas.count > 0 ? `${num(lap.elmaradas.count)} rendelés` : 'Nincs'}
                onPress={go('/elmaradas')}
                footer={
                  lap.elmaradas.count > 0 ? (
                    <View className="gap-0.5">
                      <FooterText tone="warning">
                        {lap.elmaradas.notStarted > 0
                          ? `⚠ ${num(lap.elmaradas.notStarted)} el sem indult`
                          : `⚠ ${num(lap.elmaradas.meters)} m csúszik`}
                      </FooterText>
                      {lap.elmaradas.notStarted > 0 ? (
                        <FooterText>{`${num(lap.elmaradas.meters)} m`}</FooterText>
                      ) : null}
                    </View>
                  ) : (
                    <FooterText tone="success">✓ Minden időben</FooterText>
                  )
                }
              />
            </View>
          ) : null}
          {bent.data ? (
            <View className="overflow-hidden rounded-2xl border border-border">
              <ListRow
                leading={<Users size={18} color={colors.inkMuted} />}
                title="Bent most"
                value={`${bent.data.bentCount} / ${bent.data.activeCount}`}
                onPress={go('/jelenlet')}
              />
            </View>
          ) : null}
        </Group>
      ) : null}

      {!flags.lapszabaszat ? (
        <Card>
          <Text className="text-[14px] font-semibold text-foreground">
            A lapszabászat modul nincs bekapcsolva.
          </Text>
          <Text className="text-[13px] text-muted-foreground">
            Itt jelennének meg a rendelések, az ajánlatok, a szabás és az elmaradás.
          </Text>
        </Card>
      ) : null}
    </Screen>
  )
}

function KezdolapHeader({
  updatedAt,
  busy,
  onRefresh
}: {
  updatedAt: number | null
  busy: boolean
  onRefresh: () => void
}) {
  const { current, memberships, selectTenant } = useAuth()
  const multi = memberships.length > 1
  const stale = updatedAt != null && Date.now() - updatedAt > STALE_AFTER_MS

  const pickTenant = () => {
    Alert.alert('Cég váltása', undefined, [
      ...memberships.map((m) => ({
        text: m.tenantId === current?.tenantId ? `✓ ${m.tenantName}` : m.tenantName,
        onPress: () => {
          if (m.tenantId !== current?.tenantId) void selectTenant(m.tenantId)
        }
      })),
      { text: 'Mégse', style: 'cancel' as const }
    ])
  }

  return (
    <View className="flex-row items-center gap-3 px-1">
      <Pressable
        onPress={multi ? pickTenant : undefined}
        disabled={!multi}
        accessibilityRole={multi ? 'button' : 'header'}
        accessibilityLabel={multi ? `Cég: ${current?.tenantName}. Váltás` : current?.tenantName}
        className="min-w-0 flex-1 flex-row items-center gap-1"
        style={({ pressed }) => (pressed ? { opacity: 0.6 } : undefined)}
      >
        <Text
          className="shrink text-[22px] font-bold text-foreground"
          style={{ letterSpacing: -0.4 }}
          numberOfLines={1}
        >
          {current?.tenantName ?? ''}
        </Text>
        {multi ? <ChevronDown size={18} color={colors.inkMuted} strokeWidth={2.25} /> : null}
      </Pressable>
      <Pressable
        onPress={onRefresh}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Frissítés"
        className="flex-row items-center gap-1.5"
        hitSlop={8}
      >
        <Text
          className={
            stale
              ? 'text-[13px] font-medium text-warning-foreground'
              : 'text-[13px] text-muted-foreground'
          }
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {updatedAt ? formatClock(updatedAt) : '—'}
        </Text>
        <RotateCw size={14} color={stale ? colors.warning : colors.inkMuted} />
      </Pressable>
    </View>
  )
}

function BelepokTile({ glance, onPress }: { glance: BelepokPeriodGlance; onPress: () => void }) {
  if (glance.closed) {
    return (
      <Tile
        icon={DoorOpen}
        label="Belépők"
        value="Zárva"
        onPress={onPress}
        footer={<FooterText>ma nincs nyitva</FooterText>}
      />
    )
  }
  return (
    <Tile
      icon={DoorOpen}
      label="Belépők"
      value={`${num(glance.value)} fő`}
      onPress={onPress}
      footer={
        <DeltaFooter delta={formatDelta(glance.value, glance.compare)} label={glance.compareLabel} />
      }
    />
  )
}

function KezdolapSkeleton() {
  return (
    <View className="gap-3">
      <Skeleton className="h-40 w-full rounded-2xl" label="Kezdőlap betöltése" />
      <View className="flex-row gap-3">
        <Skeleton className="h-[128px] flex-1 rounded-2xl" />
        <Skeleton className="h-[128px] flex-1 rounded-2xl" />
      </View>
      <Skeleton className="mt-3 h-4 w-20" />
      <View className="flex-row gap-3">
        <Skeleton className="h-[128px] flex-1 rounded-2xl" />
        <Skeleton className="h-[128px] flex-1 rounded-2xl" />
      </View>
    </View>
  )
}
