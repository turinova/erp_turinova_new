import { BarChart } from 'panelui-native/components/bar-chart'
import { Text, View } from 'react-native'

import { DetailSkeleton, ExplainCard, FooterText, StaleStrip } from '@/components/pulse'
import { SplitBar } from '@/components/split-bar'
import { usePeriod } from '@/features/period/period-context'
import { formatCompactFt } from '@/lib/format'
import { PERIOD_OPTIONS, type AjanlatokDetail, type Period } from '@/lib/pulse-types'
import { useMobileApi } from '@/lib/use-mobile-api'
import { colors } from '@/theme'
import { Card, ListRow, Screen, SegmentedControl } from '@/ui'

const num = (n: number) => new Intl.NumberFormat('hu-HU').format(n)

const TITLE: Record<Period, string> = {
  ma: 'Ma készült ajánlat',
  het: 'E héten készült ajánlat',
  honap: 'E hónapban készült ajánlat'
}

export default function AjanlatokScreen() {
  const { period, setPeriod } = usePeriod()
  const res = useMobileApi<AjanlatokDetail>('ajanlatok', period)
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
            >
              {`${num(d.summary.total)} db`}
            </Text>
            <FooterText>
              {`Saját ${num(d.summary.staff.count)} · partnertől ${num(d.summary.partner.count)} · összesen ${formatCompactFt(d.summary.staff.gross + d.summary.partner.gross)}`}
            </FooterText>
          </View>

          {period !== 'ma' ? (
            <Card className="gap-3">
              <Text className="text-[14px] font-semibold text-foreground">Napról napra</Text>
              <BarChart
                data={d.series.map((p) => ({ x: p.label, sajat: p.staff, partner: p.partner }))}
                xDataKey="x"
                stacked
                aspectRatio={2.1}
                cornerRadius={3}
                barGap={d.series.length > 10 ? 0.2 : 0.3}
                minBarLength={2}
                accessibilityLabel="Napi ajánlatszám: saját és partnertől"
              >
                <BarChart.Bar dataKey="sajat" color={colors.lapszab} />
                <BarChart.Bar dataKey="partner" color={colors.portal} />
                <BarChart.XAxis ticks={d.series.length > 10 ? 6 : undefined} />
                <BarChart.Tooltip
                  formatValue={(v, key) => `${key === 'partner' ? 'Partnertől' : 'Saját'}: ${num(v)} db`}
                />
              </BarChart>
            </Card>
          ) : null}

          <SplitBar
            title="Ki készítette?"
            parts={[
              {
                key: 'staff',
                label: 'Saját (mi készítettük)',
                value: d.summary.staff.count,
                display: `${num(d.summary.staff.count)} db · ${formatCompactFt(d.summary.staff.gross)}`,
                color: colors.lapszab
              },
              {
                key: 'partner',
                label: 'Partner küldte be',
                value: d.summary.partner.count,
                display: `${num(d.summary.partner.count)} db · ${formatCompactFt(d.summary.partner.gross)}`,
                color: colors.portal
              }
            ]}
          />

          <View className="gap-2">
            <Text className="px-1 text-[13px] font-medium text-muted-foreground">
              Legaktívabb partnerek
            </Text>
            <View className="overflow-hidden rounded-xl border border-border">
              {d.topPartners.length === 0 ? (
                <ListRow title="Ebben az időszakban partner nem küldött ajánlatot." />
              ) : (
                d.topPartners.map((p) => (
                  <ListRow
                    key={p.name}
                    title={p.name}
                    meta={formatCompactFt(p.gross)}
                    value={`${num(p.count)} db`}
                  />
                ))
              )}
            </View>
          </View>

          <ExplainCard
            lines={[
              'Saját ajánlat = a csapat készítette (nem partnerportálról), a létrehozás napja szerint.',
              'Partnertől = a partnerportálon beküldött ajánlat, a beküldés napja szerint.',
              'Az összeg bruttó végösszeg. Ajánlatnál nincs összevetés: a szám a rendelésekben számít igazán.'
            ]}
          />
        </>
      ) : null}
    </Screen>
  )
}
