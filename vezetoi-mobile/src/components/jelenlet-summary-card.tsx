import { Text, View } from 'react-native'

import type { JelenletDayModel } from '@/lib/jelenlet'
import { colors } from '@/theme'
import { Card } from '@/ui'

type Props = {
  model: JelenletDayModel
}

type LegendItem = { key: string; label: string; count: number; color: string }

function sentence(model: JelenletDayModel): string {
  const { counts, isToday, workingCount, holiday } = model
  const away = counts.szabadsag + counts.beteg
  if (workingCount === 0) {
    return holiday ? 'Munkaszüneti nap, senki nem dolgozik.' : 'Ezen a napon senki nem dolgozik.'
  }
  const parts: string[] = []
  if (isToday) {
    parts.push(
      counts.bent > 0 ? `${counts.bent} ember bent van most` : 'Most senki nincs bent'
    )
    if (counts.elment > 0) parts.push(`${counts.elment} már hazament`)
  } else {
    const worked = model.presentCount
    parts.push(worked > 0 ? `${worked} ember dolgozott` : 'Senki nem dolgozott')
  }
  if (away > 0) parts.push(`${away} ${isToday ? 'távol van' : 'távol volt'}`)
  return `${parts.join(', ')}.`
}

/** Nagy szám: hányan vannak / voltak bent a ma dolgozókból, mellette a bontás. */
export function JelenletSummaryCard({ model }: Props) {
  const { counts, isToday, workingCount } = model
  const value = isToday ? counts.bent : model.presentCount

  const presence: LegendItem[] = isToday
      ? [
          { key: 'bent', label: 'Bent', count: counts.bent, color: colors.presenceIn },
          { key: 'elment', label: 'Elment', count: counts.elment, color: colors.presenceLeft }
        ]
      : [
          {
            key: 'dolgozott',
            label: 'Dolgozott',
            count: model.presentCount,
            color: colors.presenceIn
          }
        ]
  const legend: LegendItem[] = [
    ...presence,
    {
      key: 'szabadsag',
      label: 'Szabadság',
      count: counts.szabadsag,
      color: colors.presenceVacation
    },
    { key: 'beteg', label: 'Beteg', count: counts.beteg, color: colors.presenceSick },
    { key: 'nincs', label: 'Nincs jelölés', count: counts.nincs, color: colors.presenceNone }
  ]

  return (
    <Card className="gap-4">
      <View className="flex-row items-start gap-5">
        <View
          className="gap-0.5"
          accessible
          accessibilityLabel={`${value} a ${workingCount} dolgozóból ${isToday ? 'bent van' : 'dolgozott'}`}
        >
          <Text
            className="font-bold text-foreground"
            style={{ fontSize: 40, lineHeight: 46, letterSpacing: -1, fontVariant: ['tabular-nums'] }}
            numberOfLines={1}
          >
            {value}
            <Text className="text-[22px] font-semibold text-muted-foreground">
              {' '}/ {workingCount}
            </Text>
          </Text>
          <Text className="text-[13px] font-medium text-muted-foreground">
            {isToday ? 'bent most' : 'dolgozott'}
          </Text>
        </View>

        <View className="flex-1 gap-2">
          {legend
            .filter((l) => l.count > 0 || l.key === 'bent' || l.key === 'dolgozott')
            .map((l) => (
              <View key={l.key} className="flex-row items-center gap-2">
                <View
                  style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: l.color }}
                />
                <Text className="flex-1 text-[14px] text-foreground" numberOfLines={1}>
                  {l.label}
                </Text>
                <Text
                  className="text-[15px] font-semibold text-foreground"
                  style={{ fontVariant: ['tabular-nums'] }}
                >
                  {l.count}
                </Text>
              </View>
            ))}
        </View>
      </View>

      <Text className="text-[15px] font-medium leading-[21px] text-foreground">
        {sentence(model)}
      </Text>
    </Card>
  )
}
