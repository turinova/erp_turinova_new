import { Text, View } from 'react-native'
import { Avatar } from 'panelui-native/components/avatar'

import {
  formatWorked,
  type JelenletDayRow,
  type JelenletRowKind
} from '@/lib/jelenlet'
import { colors } from '@/theme'
import { Card, ListRow, ListSection, type StatusTone } from '@/ui'

type Props = {
  rows: JelenletDayRow[]
  isToday: boolean
}

type Group = {
  key: string
  title: string
  kinds: JelenletRowKind[]
}

const DOT: Record<JelenletRowKind, string> = {
  bent: colors.presenceIn,
  elment: colors.presenceLeft,
  nyitott: colors.presenceLeft,
  szabadsag: colors.presenceVacation,
  beteg: colors.presenceSick,
  nincs: colors.presenceNone,
  szabadnap: colors.presenceNone
}

function groupsFor(isToday: boolean): Group[] {
  return [
    ...(isToday
      ? [
          { key: 'bent', title: 'Bent most', kinds: ['bent'] as JelenletRowKind[] },
          { key: 'elment', title: 'Már elment', kinds: ['elment'] as JelenletRowKind[] }
        ]
      : [
          {
            key: 'dolgozott',
            title: 'Dolgozott',
            kinds: ['elment', 'nyitott'] as JelenletRowKind[]
          }
        ]),
    { key: 'tavol', title: 'Távol', kinds: ['szabadsag', 'beteg'] },
    { key: 'nincs', title: 'Nincs jelölés', kinds: ['nincs'] },
    { key: 'szabadnap', title: 'Szabadnapos', kinds: ['szabadnap'] }
  ]
}

function rowValue(row: JelenletDayRow): { value: string; tone: StatusTone } {
  switch (row.kind) {
    case 'bent':
      return { value: `${row.arrival} óta`, tone: 'success' }
    case 'elment':
      return { value: `${row.arrival} – ${row.departure}`, tone: 'default' }
    case 'nyitott':
      return { value: `${row.arrival} –`, tone: 'default' }
    case 'szabadsag':
      return { value: 'Szabadság', tone: 'muted' }
    case 'beteg':
      return { value: 'Beteg', tone: 'muted' }
    case 'szabadnap':
      return { value: 'Nem dolgozik', tone: 'muted' }
    default:
      return { value: 'Nincs adat', tone: 'muted' }
  }
}

function rowMeta(row: JelenletDayRow): string | null {
  const parts: string[] = []
  if (row.typeLabel) parts.push(row.typeLabel)
  if (row.kind === 'bent' && row.workedMinutes != null) {
    parts.push(`${formatWorked(row.workedMinutes)} bent`)
  } else if (row.kind === 'elment' && row.workedMinutes != null) {
    parts.push(formatWorked(row.workedMinutes))
  } else if (row.kind === 'nyitott') {
    parts.push('távozás nincs rögzítve')
  }
  return parts.length ? parts.join(' · ') : null
}

function PersonAvatar({ row }: { row: JelenletDayRow }) {
  const dim = row.kind === 'szabadnap' || row.kind === 'nincs'
  return (
    <View style={{ opacity: dim ? 0.55 : 1 }}>
      <Avatar size="sm" fallback={row.initials} />
      <View
        style={{
          position: 'absolute',
          right: -1,
          bottom: -1,
          width: 11,
          height: 11,
          borderRadius: 6,
          borderWidth: 2,
          borderColor: colors.surface,
          backgroundColor: DOT[row.kind]
        }}
      />
    </View>
  )
}

/** Csoportos jelenlétlista: Bent most · Már elment · Távol · Nincs jelölés · Szabadnapos. */
export function JelenletList({ rows, isToday }: Props) {
  if (rows.length === 0) {
    return (
      <Card>
        <Text className="text-[15px] font-semibold text-foreground">Nincs aktív dolgozó</Text>
        <Text className="text-[13px] leading-[18px] text-muted-foreground">
          Ehhez a céghez még nincs felvett aktív dolgozó a Jelenlét modulban.
        </Text>
      </Card>
    )
  }

  return (
    <View className="gap-5">
      {groupsFor(isToday).map((g) => {
        const items = rows.filter((r) => g.kinds.includes(r.kind))
        if (items.length === 0) return null
        return (
          <ListSection key={g.key} title={`${g.title} · ${items.length}`}>
            {items.map((row) => {
              const v = rowValue(row)
              return (
                <ListRow
                  key={row.id}
                  leading={<PersonAvatar row={row} />}
                  title={row.name}
                  meta={rowMeta(row)}
                  value={v.value}
                  valueTone={v.tone}
                />
              )
            })}
          </ListSection>
        )
      })}
    </View>
  )
}
