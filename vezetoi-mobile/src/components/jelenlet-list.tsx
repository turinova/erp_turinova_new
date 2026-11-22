import { StyleSheet, Text, View } from 'react-native'

import type { JelenletDayRow } from '@/lib/jelenlet'
import { colors, radius, space } from '@/theme'
import { Separator } from '@/ui'

type Props = {
  rows: JelenletDayRow[]
  emptyMessage?: string | null
}

const TIME_COL_W = 64

/** Oszlopos jelenlétlista — idő tabular + kiemelt; PanelUI később cserélhető. */
export function JelenletList({ rows, emptyMessage }: Props) {
  if (rows.length === 0) {
    return (
      <View style={styles.emptyBox}>
        <Text style={styles.emptyTitle}>Nincs aktív dolgozó</Text>
        <Text style={styles.emptyBody}>
          {emptyMessage ??
            'Ehhez a céghez még nincs felvett aktív dolgozó a Jelenlét modulban.'}
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.list}>
      <View style={[styles.row, styles.headerRow]}>
        <Text style={[styles.name, styles.headerText]} numberOfLines={1}>
          Név
        </Text>
        <Text style={[styles.timeCol, styles.headerText]}>Érk.</Text>
        <Text style={[styles.timeCol, styles.headerText]}>Táv.</Text>
      </View>
      <Separator />
      {rows.map((row, i) => (
        <View key={row.id}>
          <JelenletTableRow row={row} />
          {i < rows.length - 1 ? <Separator /> : null}
        </View>
      ))}
    </View>
  )
}

function JelenletTableRow({ row }: { row: JelenletDayRow }) {
  if (row.kind === 'vacation' || row.kind === 'sick') {
    const label = row.kind === 'vacation' ? 'Szabadság' : 'Betegszabadság'
    return (
      <View style={styles.row}>
        <Text style={styles.name} numberOfLines={1}>
          {row.name}
        </Text>
        <Text
          style={[
            styles.statusCol,
            row.kind === 'sick' && styles.statusSick
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.row}>
      <Text style={styles.name} numberOfLines={1}>
        {row.name}
      </Text>
      <Text
        style={[
          styles.timeCol,
          styles.timeValue,
          !row.arrival && styles.timeEmpty
        ]}
      >
        {row.arrival ?? '—'}
      </Text>
      <Text
        style={[
          styles.timeCol,
          styles.timeValue,
          !row.departure && styles.timeEmpty
        ]}
      >
        {row.departure ?? '—'}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  list: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[3],
    paddingVertical: space[3],
    gap: space[2],
    minHeight: 48
  },
  headerRow: {
    paddingVertical: space[2],
    backgroundColor: colors.subtle,
    minHeight: 36
  },
  headerText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: colors.ink,
    paddingRight: space[1]
  },
  timeCol: {
    width: TIME_COL_W,
    textAlign: 'right',
    fontVariant: ['tabular-nums']
  },
  timeValue: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.3
  },
  timeEmpty: {
    fontWeight: '500',
    color: colors.inkMuted,
    fontSize: 16
  },
  statusCol: {
    width: TIME_COL_W * 2 + space[2],
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '600',
    color: colors.inkSecondary
  },
  statusSick: {
    color: colors.warning
  },
  emptyBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space[4],
    gap: space[2]
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink
  },
  emptyBody: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.inkSecondary
  }
})
