import { Linking, Text, View } from 'react-native'

import { DetailSkeleton, ExplainCard, FooterText, StaleStrip } from '@/components/pulse'
import { WEB_ORIGIN } from '@/lib/api'
import { shortDateHu } from '@/lib/date'
import type { ElmaradasDetail } from '@/lib/pulse-types'
import { useMobileApi } from '@/lib/use-mobile-api'
import { Button, ListRow, Screen } from '@/ui'

const num = (n: number) => new Intl.NumberFormat('hu-HU').format(n)

export default function ElmaradasScreen() {
  const res = useMobileApi<ElmaradasDetail>('elmaradas', null)
  const d = res.data

  return (
    <Screen stacked refreshing={res.refreshing} onRefresh={() => void res.refresh()}>
      {res.error ? <StaleStrip updatedAt={d ? res.updatedAt : null} /> : null}
      {res.loading ? <DetailSkeleton /> : null}

      {d ? (
        <>
          <View className="gap-1 px-1">
            <Text className="text-[13px] font-medium text-muted-foreground">Csúszó rendelések</Text>
            <Text
              className="text-[34px] font-bold text-foreground"
              style={{ fontVariant: ['tabular-nums'], letterSpacing: -0.8 }}
            >
              {d.summary.count > 0 ? `${num(d.summary.count)} rendelés` : 'Nincs'}
            </Text>
            {d.summary.count > 0 ? (
              <FooterText tone="warning">
                {`⚠ ${num(d.summary.meters)} m · ${num(d.summary.notStarted)} el sem indult`}
              </FooterText>
            ) : (
              <FooterText tone="success">✓ Minden rendelés időben van</FooterText>
            )}
          </View>

          {d.rows.length > 0 ? (
            <View className="gap-2">
              <Text className="px-1 text-[13px] font-medium text-muted-foreground">
                {d.summary.count > d.rows.length
                  ? `A ${d.rows.length} legrégebbi`
                  : 'Legrégebbi elöl'}
              </Text>
              <View className="overflow-hidden rounded-xl border border-border">
                {d.rows.map((r) => (
                  <ListRow
                    key={r.id}
                    title={`${r.orderNumber} · ${r.customerName}`}
                    meta={`Gyártás: ${shortDateHu(r.productionDate)} · ${num(r.meters)} m${r.notStarted ? ' · el sem indult' : ''}`}
                    warning={r.notStarted}
                    value={`${num(r.daysLate)} napja`}
                    valueTone="warning"
                  />
                ))}
              </View>
            </View>
          ) : null}

          {d.summary.count > 0 ? (
            <Button
              variant="secondary"
              onPress={() => void Linking.openURL(`${WEB_ORIGIN}${d.webPath}`)}
            >
              Összes megnyitása a weben
            </Button>
          ) : null}

          <ExplainCard
            lines={[
              'Elmaradás = Megrendelve vagy Gyártásban státuszú rendelés, aminek a gyártási dátuma az előző munkanapnál is korábbi (egy munkanap türelmi idő), és még nincs Kész-nek jelölve.',
              '„El sem indult” = még Megrendelve státuszban van, gyártásba sem került.',
              'Az archivált rendelés nem számít — ugyanez a szám, mint a webes kezdőlapon és a Megrendelések „Csúszásban” szűrőjén.'
            ]}
          />
        </>
      ) : null}
    </Screen>
  )
}
