import { StyleSheet, Text, View } from 'react-native'

import { colors, radius, space } from '@/theme'

type Tone = 'default' | 'success' | 'warning' | 'danger'

export function Badge({
  label,
  tone = 'default'
}: {
  label: string
  tone?: Tone
}) {
  return (
    <View style={[styles.base, toneStyles[tone]]}>
      <Text style={[styles.text, textStyles[tone]]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    paddingHorizontal: space[2],
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1
  },
  text: { fontSize: 11, fontWeight: '600' }
})

const toneStyles = StyleSheet.create({
  default: {
    backgroundColor: colors.subtle,
    borderColor: colors.border
  },
  success: {
    backgroundColor: colors.successSoft,
    borderColor: '#BBF7D0'
  },
  warning: {
    backgroundColor: colors.warningSoft,
    borderColor: '#FDE68A'
  },
  danger: {
    backgroundColor: colors.dangerSoft,
    borderColor: '#FECACA'
  }
})

const textStyles = StyleSheet.create({
  default: { color: colors.inkSecondary },
  success: { color: colors.success },
  warning: { color: colors.warning },
  danger: { color: colors.danger }
})
