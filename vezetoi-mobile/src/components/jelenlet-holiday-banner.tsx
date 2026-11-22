import { StyleSheet, Text, View } from 'react-native'

import type { JelenletHolidayBanner } from '@/lib/jelenlet'
import { colors, radius, space } from '@/theme'

type Props = {
  holiday: JelenletHolidayBanner
}

/** Nap szintű ünnep / pihenő — text first, nem szín-only. */
export function JelenletHolidayBannerView({ holiday }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{holiday.title}</Text>
      {holiday.name ? <Text style={styles.name}>{holiday.name}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.subtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space[3],
    paddingVertical: space[3],
    gap: 2
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink
  },
  name: {
    fontSize: 12,
    color: colors.inkSecondary
  }
})
