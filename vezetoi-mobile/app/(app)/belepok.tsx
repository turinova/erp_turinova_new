import { useCallback, useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { ChevronLeft, ChevronRight } from 'lucide-react-native'

import { CountBarsCard } from '@/components/count-bars-card'
import { DeviceStatus } from '@/components/device-status'
import { StatCard } from '@/components/stat-card'
import { useAuth } from '@/features/auth/auth-context'
import { useFlags } from '@/features/tenant/flags-context'
import {
  belepokShiftMonth,
  getBelepokMonth,
  getBelepokToday,
  getBelepokWeek,
  type BelepokMonth,
  type BelepokPeriod,
  type BelepokToday,
  type BelepokWeek
} from '@/lib/belepok'
import { budapestYearMonth } from '@/lib/date'
import { supabase } from '@/lib/supabase'
import { colors } from '@/theme'
import { Card, HeroMetric, Screen, SegmentedControl, Skeleton } from '@/ui'

const PERIODS: { id: BelepokPeriod; label: string }[] = [
  { id: 'today', label: 'Ma' },
  { id: 'week', label: '7 nap' },
  { id: 'month', label: 'Hónap' }
]

const fmt = (n: number) => new Intl.NumberFormat('hu-HU').format(n)

function compareLine(
  current: number,
  prev: number,
  against: string
): { text: string; tone: 'muted' | 'success' | 'warning' } {
  if (prev <= 0) {
    return current > 0
      ? { text: `${against.charAt(0).toUpperCase()}${against.slice(1)} nem volt mért belépő.`, tone: 'muted' }
      : { text: `Nincs mért belépő, ${against} sem volt.`, tone: 'muted' }
  }
  const pct = Math.round(((current - prev) / prev) * 100)
  if (pct === 0) return { text: `Ugyanannyi, mint ${against} (${fmt(prev)} fő)`, tone: 'muted' }
  return pct > 0
    ? { text: `▲ ${pct}%-kal több, mint ${against} (${fmt(prev)} fő)`, tone: 'success' }
    : { text: `▼ ${Math.abs(pct)}%-kal kevesebb, mint ${against} (${fmt(prev)} fő)`, tone: 'warning' }
}

export default function BelepokTab() {
  const { current } = useAuth()
  const { flags } = useFlags()
  const now = budapestYearMonth()

  const [period, setPeriod] = useState<BelepokPeriod>('today')
  const [year, setYear] = useState(now.year)
  const [month, setMonth] = useState(now.month)
  const [today, setToday] = useState<BelepokToday | null>(null)
  const [week, setWeek] = useState<BelepokWeek | null>(null)
  const [monthData, setMonthData] = useState<BelepokMonth | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    if (!current || !flags.footcounter) {
      setLoading(false)
      setRefreshing(false)
      return
    }
    setError(false)
    try {
      if (period === 'today') setToday(await getBelepokToday(supabase, current.tenantId))
      else if (period === 'week') setWeek(await getBelepokWeek(supabase, current.tenantId))
      else setMonthData(await getBelepokMonth(supabase, current.tenantId, year, month))
    } catch {
      setError(true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [current, flags.footcounter, period, year, month])

  useEffect(() => {
    setLoading(true)
    void load()
  }, [load])

  if (!current) return null

  if (!flags.footcounter) {
    return (
      <Screen>
        <Card>
          <Text className="text-[15px] font-semibold text-foreground">Nincs belépőszámláló</Text>
          <Text className="text-[13px] leading-[18px] text-muted-foreground">
            Ehhez a céghez nincs bekapcsolva. Kérj jogosultságot a Turinova
            adminisztrátortól.
          </Text>
        </Card>
      </Screen>
    )
  }

  const device =
    period === 'today' ? today?.device : period === 'week' ? week?.device : monthData?.device

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true)
        void load()
      }}
    >
      {device ? <DeviceStatus device={device} /> : <View className="h-4" />}

      <SegmentedControl options={PERIODS} value={period} onChange={setPeriod} />

      {period === 'month' ? (
        <MonthStepper
          label={monthData?.monthLabel ?? `${year}.`}
          canPrev={monthData?.canGoPrevMonth ?? false}
          canNext={monthData?.canGoNextMonth ?? false}
          onShift={(d) => {
            const next = belepokShiftMonth(year, month, d)
            setYear(next.year)
            setMonth(next.month)
          }}
        />
      ) : null}

      {loading ? <BelepokSkeleton /> : null}

      {!loading && error ? (
        <Card tone="danger">
          <Text className="text-[14px] font-semibold text-destructive-foreground">
            Nem sikerült betölteni a belépőket.
          </Text>
          <Text className="text-[13px] text-muted-foreground">
            Nézd meg a hálózatot, és húzd le a frissítéshez.
          </Text>
        </Card>
      ) : null}

      {!loading && !error && period === 'today' && today ? <TodayView data={today} /> : null}
      {!loading && !error && period === 'week' && week ? <WeekView data={week} /> : null}
      {!loading && !error && period === 'month' && monthData ? (
        <MonthView data={monthData} />
      ) : null}
    </Screen>
  )
}

function TodayView({ data }: { data: BelepokToday }) {
  if (data.closed) {
    return (
      <Card>
        <Text className="text-[15px] font-semibold text-foreground">Ma zárva</Text>
        <Text className="text-[13px] text-muted-foreground">
          A nyitvatartás szerint ma nincs nyitva a bolt.
        </Text>
      </Card>
    )
  }

  return (
    <>
      <View className="px-1">
        <HeroMetric
          align="left"
          label="Ma bejött"
          value={`${fmt(data.todayIn)} fő`}
          delta={data.mood}
          hint={data.mood ? null : data.typicalLine}
        />
      </View>

      <View className="flex-row gap-3">
        <StatCard
          label="Bent most"
          value={`≈ ${fmt(data.insideNow)} fő`}
          hint="becslés: belépők − kilépők"
        />
        <StatCard
          label="Csúcsóra"
          value={data.peakHour != null ? `${data.peakHour}–${data.peakHour + 1} óra` : 'Még nincs'}
          hint={data.peakHour != null ? `${fmt(data.peakCount)} fő jött be` : null}
        />
      </View>

      {data.todayIn > 0 ? (
        <CountBarsCard
          title="Óráról órára"
          unit="belépő"
          color={colors.belepok}
          softColor={colors.belepokSoft}
          bars={data.hours.map((h) => ({
            x: String(h.hour),
            title: `${h.hour}:00–${h.hour + 1}:00`,
            value: h.value,
            highlight: h.isNow
          }))}
          ticks={5}
        >
          <Text className="text-[12px] leading-[17px] text-muted-foreground">
            Az erős oszlop a mostani óra. Nyitvatartás: {data.openLabel} óra. Tartsd rajta
            az ujjad a pontos számért.
          </Text>
        </CountBarsCard>
      ) : (
        <Card>
          <Text className="text-[14px] text-muted-foreground">Ma még senki nem jött be.</Text>
        </Card>
      )}
    </>
  )
}

function WeekView({ data }: { data: BelepokWeek }) {
  return (
    <>
      <View className="px-1">
        <HeroMetric
          align="left"
          label="Az utolsó 7 napban bejött"
          value={`${fmt(data.total)} fő`}
          delta={compareLine(data.total, data.prevTotal, 'az előző 7 napban')}
          hint={data.avgOpenDay > 0 ? `Átlagosan ${fmt(data.avgOpenDay)} fő egy nyitvatartási napon.` : null}
        />
      </View>

      <CountBarsCard
        title="Napról napra"
        unit="belépő"
        color={colors.belepok}
        softColor={colors.belepokSoft}
        bars={data.days.map((d) => ({
          x: d.label,
          title: d.title,
          value: d.value,
          highlight: d.highlight
        }))}
      >
        {data.best ? (
          <Text className="text-[13px] text-foreground">
            Legforgalmasabb nap: {data.best.title.split(', ').pop()},{' '}
            <Text className="font-semibold">{fmt(data.best.value)} fő</Text>
          </Text>
        ) : (
          <Text className="text-[13px] text-muted-foreground">Az elmúlt 7 napban senki.</Text>
        )}
        <Text className="text-[12px] text-muted-foreground">Az erős oszlop a mai nap.</Text>
      </CountBarsCard>
    </>
  )
}

function MonthView({ data }: { data: BelepokMonth }) {
  const ranked = data.weekdays.filter((w) => w.samples > 0)
  const top = ranked.length ? ranked.reduce((a, b) => (b.avg > a.avg ? b : a)) : null
  const low = ranked.length ? ranked.reduce((a, b) => (b.avg < a.avg ? b : a)) : null
  const isCurrent = !data.canGoNextMonth

  return (
    <>
      <View className="px-1">
        <HeroMetric
          align="left"
          label={isCurrent ? 'Ebben a hónapban eddig bejött' : 'Ebben a hónapban bejött'}
          value={`${fmt(data.total)} fő`}
          delta={compareLine(
            data.total,
            data.prevTotal,
            isCurrent ? 'a teljes előző hónapban' : 'az előző hónapban'
          )}
          hint={
            data.openDays > 0
              ? `${data.openDays} nyitvatartási nap · átlagosan ${fmt(data.avgOpenDay)} fő naponta`
              : null
          }
        />
      </View>

      {data.total > 0 ? (
        <CountBarsCard
          title="Napról napra"
          unit="belépő"
          color={colors.belepok}
          softColor={colors.belepokSoft}
          bars={data.days.map((d) => ({
            x: d.label,
            title: d.title,
            value: d.value,
            highlight: d.highlight
          }))}
          ticks={5}
        >
          {data.best ? (
            <Text className="text-[13px] text-foreground">
              Legjobb nap: {data.best.title},{' '}
              <Text className="font-semibold">{fmt(data.best.value)} fő</Text>
            </Text>
          ) : null}
          {data.peakHour != null ? (
            <Text className="text-[12px] text-muted-foreground">
              A hónap legforgalmasabb órája: {data.peakHour}–{data.peakHour + 1} óra.
            </Text>
          ) : null}
        </CountBarsCard>
      ) : (
        <Card>
          <Text className="text-[14px] text-muted-foreground">Ebben a hónapban senki.</Text>
        </Card>
      )}

      {top && low && ranked.length > 1 ? (
        <CountBarsCard
          title="Melyik napon jönnek a legtöbben?"
          unit="fő átlagosan"
          color={colors.belepok}
          softColor={colors.belepokSoft}
          orientation="horizontal"
          bars={data.weekdays.map((w) => ({
            x: w.label,
            title: `${w.name.charAt(0).toUpperCase()}${w.name.slice(1)} (átlag)`,
            value: w.avg,
            highlight: w.weekday === top.weekday
          }))}
        >
          <Text className="text-[13px] leading-[18px] text-foreground">
            <Text className="font-semibold">{top.name.charAt(0).toUpperCase() + top.name.slice(1)}</Text>{' '}
            jön a legtöbb ember (átlag {fmt(top.avg)} fő), {low.name} a legkevesebb (
            {fmt(low.avg)} fő).
          </Text>
        </CountBarsCard>
      ) : null}
    </>
  )
}

function MonthStepper({
  label,
  canPrev,
  canNext,
  onShift
}: {
  label: string
  canPrev: boolean
  canNext: boolean
  onShift: (d: -1 | 1) => void
}) {
  return (
    <View className="flex-row items-center justify-between">
      <Pressable
        disabled={!canPrev}
        onPress={() => onShift(-1)}
        className="h-9 w-9 items-center justify-center"
        style={{ opacity: canPrev ? 1 : 0.3 }}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Előző hónap"
      >
        <ChevronLeft size={20} color={colors.ink} />
      </Pressable>
      <Text className="text-[15px] font-semibold text-foreground">{label}</Text>
      <Pressable
        disabled={!canNext}
        onPress={() => onShift(1)}
        className="h-9 w-9 items-center justify-center"
        style={{ opacity: canNext ? 1 : 0.3 }}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Következő hónap"
      >
        <ChevronRight size={20} color={colors.ink} />
      </Pressable>
    </View>
  )
}

function BelepokSkeleton() {
  return (
    <View className="gap-3">
      <View className="gap-2 px-1">
        <Skeleton className="h-4 w-28" label="Belépők betöltése" />
        <Skeleton className="h-11 w-40" />
        <Skeleton className="h-4 w-64" />
      </View>
      <Skeleton className="h-48 w-full rounded-xl" />
    </View>
  )
}
