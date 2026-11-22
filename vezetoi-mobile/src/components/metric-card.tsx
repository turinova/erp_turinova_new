import { StyleSheet, Text, View } from 'react-native'

import { colors, type } from '@/theme'
import { Badge, Card } from '@/ui'

type Props = {
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'warning'
  badge?: string
  badgeTone?: 'default' | 'success' | 'warning' | 'danger'
  onPress?: () => void
  hero?: boolean
}

export function MetricCard({
  label,
  value,
  hint,
  tone = 'default',
  badge,
  badgeTone = 'default',
  onPress,
  hero
}: Props) {
  return (
    <Card
      onPress={onPress}
      tone={tone === 'warning' ? 'danger' : 'default'}
      style={hero ? styles.heroPad : undefined}
    >
      <View style={styles.top}>
        <Text style={styles.label}>{label}</Text>
        {badge ? <Badge label={badge} tone={badgeTone} /> : null}
      </View>
      <Text style={[styles.value, hero && styles.heroValue]}>{value}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </Card>
  )
}

const styles = StyleSheet.create({
  heroPad: { paddingVertical: 20 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
  },
  label: {
    ...type.label,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3
  },
  value: {
    ...type.metric,
    color: colors.ink,
    fontVariant: ['tabular-nums']
  },
  heroValue: {
    ...type.hero,
    fontVariant: ['tabular-nums']
  },
  hint: {
    ...type.bodySm,
    color: colors.inkSecondary,
    marginTop: 2
  }
})
