import { ChevronRight } from 'lucide-react-native'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, space } from '@/theme'

import { Separator } from './separator'

type Props = {
  title: string
  meta?: string
  warning?: boolean
  onPress?: () => void
  showSeparator?: boolean
}

export function ListRow({
  title,
  meta,
  warning,
  onPress,
  showSeparator
}: Props) {
  return (
    <>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
      >
        <View style={styles.textCol}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {meta ? (
            <Text style={[styles.meta, warning && styles.metaWarn]}>
              {meta}
            </Text>
          ) : null}
        </View>
        {onPress ? (
          <ChevronRight size={18} color={colors.inkMuted} strokeWidth={2} />
        ) : null}
      </Pressable>
      {showSeparator ? <Separator /> : null}
    </>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[3],
    paddingVertical: space[3],
    gap: space[2],
    backgroundColor: colors.surface
  },
  textCol: { flex: 1, gap: 2 },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink
  },
  meta: {
    fontSize: 12,
    color: colors.inkSecondary,
    fontVariant: ['tabular-nums']
  },
  metaWarn: { color: colors.warning, fontWeight: '600' }
})
