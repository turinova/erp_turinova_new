import type { ReactNode } from 'react'
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native'

import { colors, radius, space } from '@/theme'

type Props = {
  children: ReactNode
  style?: ViewStyle
  onPress?: () => void
  tone?: 'default' | 'warning' | 'danger'
  padded?: boolean
}

export function Card({
  children,
  style,
  onPress,
  tone = 'default',
  padded = true
}: Props) {
  const body = (
    <View
      style={[
        styles.card,
        padded && styles.padded,
        tone === 'warning' && styles.warning,
        tone === 'danger' && styles.danger,
        style
      ]}
    >
      {children}
    </View>
  )

  if (!onPress) return body
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => pressed && { opacity: 0.92 }}
    >
      {body}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden'
  },
  padded: {
    padding: space[4],
    gap: space[1]
  },
  warning: {
    borderColor: '#FDE68A',
    backgroundColor: colors.warningSoft
  },
  danger: {
    borderColor: '#FECACA',
    backgroundColor: colors.dangerSoft
  }
})
