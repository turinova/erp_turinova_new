import { StyleSheet, Text, View } from 'react-native'

import { colors, space, type } from '@/theme'

type Props = {
  value: string
  unit?: string
  hint?: string | null
  align?: 'left' | 'center'
}

/** Keret nélküli hero szám — Square / Jobs: a szám a fókusz. */
export function HeroMetric({
  value,
  unit,
  hint,
  align = 'center'
}: Props) {
  return (
    <View style={[styles.wrap, align === 'left' && styles.left]}>
      <Text style={[styles.value, align === 'left' && styles.valueLeft]}>
        {value}
      </Text>
      {unit ? (
        <Text style={[styles.unit, align === 'left' && styles.unitLeft]}>
          {unit}
        </Text>
      ) : null}
      {hint ? (
        <Text style={[styles.hint, align === 'left' && styles.hintLeft]}>
          {hint}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: space[2]
  },
  left: {
    alignItems: 'flex-start'
  },
  value: {
    fontSize: 44,
    fontWeight: '700',
    letterSpacing: -0.8,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
    lineHeight: 48
  },
  valueLeft: {
    fontSize: 40,
    lineHeight: 44
  },
  unit: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: '500',
    color: colors.inkMuted
  },
  unitLeft: {
    ...type.bodySm,
    color: colors.inkMuted
  },
  hint: {
    marginTop: space[2],
    fontSize: 14,
    lineHeight: 20,
    color: colors.inkSecondary,
    textAlign: 'center'
  },
  hintLeft: {
    textAlign: 'left'
  }
})
