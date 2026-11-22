import type { ReactNode } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type ViewStyle
} from 'react-native'

import { colors, radius, space } from '@/theme'

type Variant = 'default' | 'secondary' | 'destructive' | 'ghost'

type Props = {
  children: ReactNode
  onPress?: () => void
  disabled?: boolean
  loading?: boolean
  variant?: Variant
  style?: ViewStyle
}

export function Button({
  children,
  onPress,
  disabled,
  loading,
  variant = 'default',
  style
}: Props) {
  const isDisabled = disabled || loading
  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'default' ? colors.onPrimary : colors.ink}
        />
      ) : typeof children === 'string' ? (
        <Text style={[styles.label, labelStyles[variant]]}>{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[4]
  },
  label: { fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.9 },
  disabled: { opacity: 0.5 }
})

const variantStyles = StyleSheet.create({
  default: { backgroundColor: colors.primary },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border
  },
  destructive: { backgroundColor: colors.dangerSoft },
  ghost: { backgroundColor: 'transparent' }
})

const labelStyles = StyleSheet.create({
  default: { color: colors.onPrimary },
  secondary: { color: colors.ink },
  destructive: { color: colors.danger },
  ghost: { color: colors.ink }
})
