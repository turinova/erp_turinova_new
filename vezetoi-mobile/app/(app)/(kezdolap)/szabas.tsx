import { Text, View } from 'react-native'

import { DetailSkeleton, ExplainCard, FooterText, StaleStrip, ThinBar } from '@/components/pulse'
import type { SzabasDetail } from '@/lib/pulse-types'
import { useMobileApi } from '@/lib/use-mobile-api'
import { Card, Screen } from '@/ui'

const num = (n: number) => new Intl.NumberFormat('hu-HU').format(n)

export default function SzabasScreen() {
  const res = useMobileApi<SzabasDetail>('szabas', null)
  const d = res.data

  return (
    <Screen stacked refreshing={res.refreshing} onRefresh={() => void res.refresh()}>
      {res.error ? <StaleStrip updatedAt={d ? res.updatedAt : null} /> : null}
      {res.loading ? <DetailSkeleton /> : null}

      {d && !d.today ? (
        <Card>
          <Text className="text-[14px] font-semibold text-foreground">Nincs gépkeret beállítva.</Text>
          <Text className="text-[13px] text-muted-foreground">
            A webes Gépek oldalon add meg a napi vágási keretet (m), és itt megjelenik a kihasználtság.
          </Text>
        </Card>
      ) : null}

      {d?.today ? (
        <>
          <View className="gap-1 px-1">
            <Text className="text-[13px] font-medium text-muted-foreground">Mai szabás lefoglalva</Text>
            <Text
              className="text-[34px] font-bold text-foreground"
              style={{ fontVariant: ['tabular-nums'], letterSpacing: -0.8 }}
            >
              {`${d.today.pct}%`}
            </Text>
            <ThinBar pct={d.today.pct} />
            <FooterText tone={d.today.pct >= 100 ? 'warning' : 'muted'}>
              {`${d.today.pct >= 100 ? '⚠ Betelt · ' : ''}${num(d.today.usedM)} / ${num(d.today.limitM)} m · ${num(d.today.orderCount)} rendelés`}
            </FooterText>
          </View>

          {d.byMachine.length > 1 ? (
            <Card className="gap-3">
              <Text className="text-[14px] font-semibold text-foreground">Gépenként ma</Text>
              {d.byMachine.map((m) => (
                <MeterRow
                  key={m.id}
                  title={m.name}
                  pct={m.pct}
                  detail={`${num(m.usedM)} / ${num(m.limitM)} m`}
                />
              ))}
            </Card>
          ) : null}

          <Card className="gap-3">
            <Text className="text-[14px] font-semibold text-foreground">Következő 5 munkanap</Text>
            {d.nextDays.map((day) => {
              const pct = day.limitM > 0 ? Math.round((day.usedM / day.limitM) * 100) : 0
              return (
                <MeterRow
                  key={day.ymd}
                  title={day.label}
                  pct={pct}
                  detail={`${num(day.usedM)} / ${num(day.limitM)} m · ${num(day.orderCount)} rendelés`}
                />
              )
            })}
          </Card>

          <ExplainCard
            lines={[
              'Lefoglalva = az adott napra ütemezett (gyártási dátumú) rendelések vágási hossza.',
              'Keret = az aktív gépek napi vágási kerete összesen — ugyanaz, mint a webes Ütemezőben.',
              'A sztornózott és archivált rendelés nem foglal keretet.'
            ]}
          />
        </>
      ) : null}
    </Screen>
  )
}

function MeterRow({ title, pct, detail }: { title: string; pct: number; detail: string }) {
  const full = pct >= 100
  return (
    <View className="gap-1.5">
      <View className="flex-row items-baseline gap-2">
        <Text className="flex-1 text-[14px] text-foreground" numberOfLines={1}>
          {title}
        </Text>
        <Text
          className={full ? 'text-[14px] font-semibold text-warning-foreground' : 'text-[14px] font-semibold text-foreground'}
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {`${full ? '⚠ ' : ''}${pct}%`}
        </Text>
      </View>
      <ThinBar pct={pct} />
      <Text className="text-[12px] text-muted-foreground" style={{ fontVariant: ['tabular-nums'] }}>
        {detail}
      </Text>
    </View>
  )
}
