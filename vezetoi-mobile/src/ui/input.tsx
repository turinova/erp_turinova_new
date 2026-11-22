import { forwardRef } from 'react'
import { StyleSheet, TextInput, type TextInputProps } from 'react-native'

import { colors, radius, space } from '@/theme'

export const Input = forwardRef<TextInput, TextInputProps>(function Input(
  props,
  ref
) {
  return (
    <TextInput
      ref={ref as never}
      placeholderTextColor={colors.inkMuted}
      {...props}
      style={[styles.input, props.style]}
    />
  )
})

const styles = StyleSheet.create({
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space[3],
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.surface
  }
})
