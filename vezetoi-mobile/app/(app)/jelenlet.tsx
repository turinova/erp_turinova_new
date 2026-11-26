import { useCallback, useEffect, useState } from 'react'
import { Text, View } from 'react-native'

import { JelenletHolidayBannerView } from '@/components/jelenlet-holiday-banner'
import { JelenletList } from '@/components/jelenlet-list'
import { JelenletSummaryCard } from '@/components/jelenlet-summary-card'
import { JelenletWeekNav, mondayOf } from '@/components/jelenlet-week-nav'
import { useAuth } from '@/features/auth/auth-context'
import { useFlags } from '@/features/tenant/flags-context'
import { addDaysYmd, budapestTodayYmd } from '@/lib/date'
import {
  EMPLOYEE_LIMIT,
  emptyJelenletCounts,
  getJelenletDay,
  getJelenletPresentByDay,
  jelenletDayLabel,
  type JelenletDayModel
} from '@/lib/jelenlet'
import { supabase } from '@/lib/supabase'
import { Card, Screen, Skeleton } from '@/ui'

export default function JelenletTab() {
  const { current } = useAuth()
  const { flags } = useFlags()
  const [ymd, setYmd] = useState(budapestTodayYmd)
  const [model, setModel] = useState<JelenletDayModel | null>(null)
  const [presentByDay, setPresentByDay] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const monday = mondayOf(ymd)

  const loadWeek = useCallback(async () => {
    if (!current || !flags.jelenlet) return
    setPresentByDay(
      await getJelenletPresentByDay(
        supabase,
        current.tenantId,
        monday,
        addDaysYmd(monday, 6)
      )
    )
  }, [current, flags.jelenlet, monday])

  const loadDay = useCallback(async () => {
    if (!current || !flags.jelenlet) {
      setModel(null)
      setLoading(false)
      setRefreshing(false)
      return
    }
    const today = budapestTodayYmd()
    try {
      const next = await getJelenletDay(supabase, current.tenantId, ymd)
      setModel(next)
      if (next.ymd !== ymd) setYmd(next.ymd)
    } catch (e) {
      setModel({
        ymd,
        label: jelenletDayLabel(ymd, today),
        isToday: ymd === today,
        canGoNext: ymd < today,
        canGoPrev: true,
        holiday: null,
        counts: emptyJelenletCounts(),
        workingCount: 0,
        presentCount: 0,
        truncated: false,
        rows: [],
        loadError:
          e instanceof Error ? e.message : 'Nem sikerült betölteni a jelenlétet.'
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [current, flags.jelenlet, ymd])

  useEffect(() => {
    setLoading(true)
    void loadDay()
  }, [loadDay])

  useEffect(() => {
    void loadWeek()
  }, [loadWeek])

  if (!current) return null

  if (!flags.jelenlet) {
    return (
      <Screen>
        <Card>
          <Text className="text-[15px] font-semibold text-foreground">
            Nincs Jelenlét modul
          </Text>
          <Text className="text-[13px] leading-[18px] text-muted-foreground">
            Ehhez a céghez nincs bekapcsolva. Kérj jogosultságot a Turinova
            adminisztrátortól.
          </Text>
        </Card>
      </Screen>
    )
  }

  const dayTitle = model?.label ?? jelenletDayLabel(ymd, budapestTodayYmd())

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true)
        void loadDay()
        void loadWeek()
      }}
    >
      <JelenletWeekNav ymd={ymd} presentByDay={presentByDay} onSelectYmd={setYmd} />

      <Text className="px-1 text-[20px] font-bold text-foreground" style={{ letterSpacing: -0.4 }}>
        {dayTitle}
      </Text>

      {loading ? (
        <View className="gap-3">
          <Skeleton className="h-48 w-full rounded-xl" label="Jelenlét betöltése" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </View>
      ) : null}

      {!loading && model?.loadError ? (
        <Card tone="danger">
          <Text className="text-[14px] font-semibold text-destructive-foreground">
            Nem sikerült betölteni a jelenlétet.
          </Text>
          <Text className="text-[13px] text-muted-foreground">
            Nézd meg a hálózatot, és húzd le a frissítéshez.
          </Text>
        </Card>
      ) : null}

      {!loading && model && !model.loadError ? (
        <>
          {model.holiday ? <JelenletHolidayBannerView holiday={model.holiday} /> : null}
          {model.rows.length > 0 ? <JelenletSummaryCard model={model} /> : null}
          <JelenletList rows={model.rows} isToday={model.isToday} />
          {model.truncated ? (
            <Text className="px-1 text-[12px] text-muted-foreground">
              Az első {EMPLOYEE_LIMIT} dolgozó látszik. A teljes lista a webes Jelenlét
              oldalon van.
            </Text>
          ) : null}
        </>
      ) : null}
    </Screen>
  )
}
