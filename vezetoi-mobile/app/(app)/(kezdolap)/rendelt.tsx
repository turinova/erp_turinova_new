import { BarChart } from 'panelui-native/components/bar-chart'
import { Leaderboard } from 'panelui-native/components/leaderboard'
import { LineChart } from 'panelui-native/components/line-chart'
import { Text, View } from 'react-native'

import { DeltaFooter, DetailSkeleton, ExplainCard, FooterText, StaleStrip } from '@/components/pulse'
import { SplitBar } from '@/components/split-bar'
import { usePeriod } from '@/features/period/period-context'
import { formatCompactFt, formatCount, formatDelta, formatFt } from '@/lib/format'
import { PERIOD_OPTIONS, type Period, type RendeltDetail } from '@/lib/pulse-types'
import { useMobileApi } from '@/lib/use-mobile-api'
import { colors } from '@/theme'
import { Card, Screen, SegmentedControl } from '@/ui'

const num = (n: number) => new Intl.NumberFormat('hu-HU').format(n)

const TITLE: Record<Period, string> = {
  ma: 'Ma rendeltek',
  het: 'E héten rendeltek',
  honap: 'E hónapban rendeltek'
}

const COMPARE_SERIES: Record<Period, string> = {
  ma: 'Szokásos',
  het: 'Múlt hét',
  honap: 'Előző hónap'
}

export default function RendeltScreen() {
  const { period, setPeriod } = usePeriod()
  const res = useMobileApi<RendeltDetail>('rendelt', period)
  const d = res.data

  return (
    <Screen stacked refreshing={res.refreshing} onRefresh={() => void res.refresh()}>
      <SegmentedControl options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
      {res.error ? <StaleStrip updatedAt={d ? res.updatedAt : null} /> : null}
      {res.loading ? <DetailSkeleton /> : null}

      {d ? (
        <>
          <View className="gap-1 px-1">
            <Text className="text-[13px] font-medium text-muted-foreground">{TITLE[period]}</Text>
            <Text
              className="text-[34px] font-bold text-foreground"
              style={{ fontVariant: ['tabular-nums'], letterSpacing: -0.8 }}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {formatFt(d.summary.gross)}
            </Text>
            <DeltaFooter
              delta={formatDelta(d.summary.gross, d.summary.compare?.gross ?? null, formatFt)}
              label={d.summary.compareLabel}
            />
            <FooterText>
              {`${num(d.summary.count)} rendelés${
                d.summary.compare
                  ? ` · ${COMPARE_SERIES[period].toLowerCase()}: ${num(Math.round(d.summary.compare.count))}`
                  : ''
              }`}
            </FooterText>
          </View>

          <SeriesCard detail={d} period={period} />

          <SplitBar
            title="Honnan jött?"
            parts={[
              {
                key: 'staff',
                label: 'Saját (mi rögzítettük)',
                value: d.split.staff.gross,
                display: `${num(d.split.staff.count)} db · ${formatCompactFt(d.split.staff.gross)}`,
                color: colors.lapszab
              },
              {
                key: 'portal',
                label: 'Partnerportálról',
                value: d.split.portal.gross,
                display: `${num(d.split.portal.count)} db · ${formatCompactFt(d.split.portal.gross)}`,
                color: colors.portal
              }
            ]}
          />

          <Card className="gap-3">
            <Text className="text-[14px] font-semibold text-foreground">Top anyagok</Text>
            <Leaderboard
              podium="none"
              limit={5}
              data={d.topMaterials.map((m) => ({
                id: m.name,
                name: m.name,
                value: m.boards,
                subtitle: formatCompactFt(m.gross)
              }))}
              formatValue={(v) => formatCount(v, 'tábla')}
              unit="tábla"
              emptyText="Még nincs rendelt anyag ebben az időszakban."
            />
          </Card>

          <ExplainCard
            lines={[
              'Megrendelés = rendelésszámot kapott ajánlat, a megrendelés időpontja szerint. A sztornózott nem számít, az archivált igen — ugyanígy, mint a webes kezdőlapon.',
              'Az összeg bruttó, a végösszeg (kedvezmény után).',
              d.summary.compareDetail
            ]}
          />
        </>
      ) : null}
    </Screen>
  )
}

function SeriesCard({ detail, period }: { detail: RendeltDetail; period: Period }) {
  const data = detail.series.map((p) => ({
    x: p.label,
    aktualis: p.value,
    elozo: p.compare
  }))
  const hourly = detail.seriesKind === 'cumulative_hourly'
  const many = data.length > 10

  return (
    <Card className="gap-3">
      <Text className="text-[14px] font-semibold text-foreground">
        {hourly ? 'Óráról órára, halmozva' : 'Napról napra'}
      </Text>
      {hourly ? (
        <LineChart data={data} xDataKey="x" aspectRatio={1.9} accessibilityLabel="Ma óránként halmozva, a szokásos naphoz mérve">
          <LineChart.Grid rows={3} />
          <LineChart.Line dataKey="elozo" color={colors.chartCompare} dashArray="4,4" strokeWidth={2} />
          <LineChart.Line dataKey="aktualis" color={colors.lapszab} />
          <LineChart.XAxis ticks={5} format={(datum) => `${datum.x}`} />
          <LineChart.Tooltip
            formatX={(datum) => `${datum.x}:00-ig`}
            formatValue={(v, key) => `${key === 'elozo' ? 'Szokásos' : 'Ma'}: ${formatCompactFt(v)}`}
          />
        </LineChart>
      ) : (
        <BarChart
          data={data}
          xDataKey="x"
          aspectRatio={2}
          cornerRadius={3}
          barGap={many ? 0.2 : 0.3}
          minBarLength={2}
          accessibilityLabel={`Napi rendelés forintban, ${COMPARE_SERIES[period].toLowerCase()} mellett`}
        >
          <BarChart.Bar dataKey="elozo" color={colors.chartCompare} />
          <BarChart.Bar dataKey="aktualis" color={colors.lapszab} />
          <BarChart.XAxis ticks={many ? 6 : undefined} />
          <BarChart.Tooltip
            formatValue={(v, key) => `${key === 'elozo' ? COMPARE_SERIES[period] : 'Most'}: ${formatCompactFt(v)}`}
          />
        </BarChart>
      )}
      <View className="flex-row gap-4">
        <Legend color={colors.lapszab} label={period === 'ma' ? 'Ma' : period === 'het' ? 'E hét' : 'E hónap'} />
        <Legend color={colors.chartCompare} label={COMPARE_SERIES[period]} />
      </View>
    </Card>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
      <Text className="text-[12px] text-muted-foreground">{label}</Text>
    </View>
  )
}
