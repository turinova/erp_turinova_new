import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, radius } from '@/theme'

export type SegmentOption<T extends string> = {
  id: T
  label: string
}

type Props<T extends string> = {
  options: SegmentOption<T>[]
  value: T
  onChange: (id: T) => void
}

/** iOS-szerű period switcher — Square / Shopify analytics mintára. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange
}: Props<T>) {
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {options.map((opt) => {
        const active = opt.id === value
        return (
          <Pressable
            key={opt.id}
            onPress={() => onChange(opt.id)}
            style={[styles.seg, active && styles.segActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
              {opt.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.border,
    borderRadius: radius.md,
    padding: 2,
    gap: 2
  },
  seg: {
    flex: 1,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center'
  },
  segActive: {
    backgroundColor: colors.ink
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.inkSecondary
  },
  labelActive: {
    color: colors.onPrimary
  }
})
