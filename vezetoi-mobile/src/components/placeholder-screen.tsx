import type { LucideIcon } from 'lucide-react-native'
import { StyleSheet, Text, View } from 'react-native'

import { colors, space, type } from '@/theme'
import { Card, Screen } from '@/ui'

type Props = {
  title: string
  description: string
  icon: LucideIcon
}

/** Tab shell — tartalom később; Midday empty glance. */
export function PlaceholderScreen({ title, description, icon: Icon }: Props) {
  return (
    <Screen>
      <Text style={styles.kicker}>{title}</Text>
      <Card style={styles.card}>
        <View style={styles.iconWrap}>
          <Icon size={28} color={colors.inkMuted} strokeWidth={1.75} />
        </View>
        <Text style={styles.title}>Hamarosan</Text>
        <Text style={styles.body}>{description}</Text>
      </Card>
    </Screen>
  )
}

const styles = StyleSheet.create({
  kicker: {
    ...type.kicker,
    color: colors.inkMuted,
    textTransform: 'uppercase'
  },
  card: {
    alignItems: 'center',
    paddingVertical: space[6],
    gap: space[2]
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space[2]
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.ink
  },
  body: {
    ...type.body,
    color: colors.inkSecondary,
    textAlign: 'center',
    maxWidth: 280
  }
})
