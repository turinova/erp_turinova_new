import type { ReactNode } from 'react'
import { Pressable, View, type ViewStyle } from 'react-native'

import { cn } from './cn'

type Props = {
  children: ReactNode
  style?: ViewStyle
  onPress?: () => void
  tone?: 'default' | 'warning' | 'danger'
  padded?: boolean
  className?: string
}

const TONE = {
  default: 'border-border bg-card',
  warning: 'border-warning/25 bg-warning-soft',
  danger: 'border-destructive/25 bg-destructive-soft'
} as const

/** Hairline keret, nincs árnyék — Midday flat felület. */
export function Card({
  children,
  style,
  onPress,
  tone = 'default',
  padded = true,
  className
}: Props) {
  const body = (
    <View
      className={cn(
        'overflow-hidden rounded-xl border',
        TONE[tone],
        padded && 'gap-1 p-4',
        className
      )}
      style={style}
    >
      {children}
    </View>
  )

  if (!onPress) return body
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => (pressed ? { opacity: 0.85 } : undefined)}
    >
      {body}
    </Pressable>
  )
}
