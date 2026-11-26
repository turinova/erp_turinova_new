import * as Haptics from 'expo-haptics'
import { Pressable, Text, View } from 'react-native'

import { cn } from './cn'

export type SegmentOption<T extends string> = {
  id: T
  label: string
}

type Props<T extends string> = {
  options: SegmentOption<T>[]
  value: T
  onChange: (id: T) => void
}

/** iOS-szerű szegmentált választó: halk sáv, fehér aktív szelet — nem fekete blokk. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange
}: Props<T>) {
  return (
    <View
      className="flex-row gap-0.5 rounded-lg bg-secondary p-0.5"
      accessibilityRole="tablist"
    >
      {options.map((opt) => {
        const active = opt.id === value
        return (
          <Pressable
            key={opt.id}
            onPress={() => {
              if (active) return
              void Haptics.selectionAsync()
              onChange(opt.id)
            }}
            className={cn(
              'h-8 flex-1 items-center justify-center rounded-md',
              active && 'bg-card'
            )}
            style={
              active
                ? {
                    shadowColor: '#18181B',
                    shadowOpacity: 0.08,
                    shadowRadius: 2,
                    shadowOffset: { width: 0, height: 1 },
                    elevation: 1
                  }
                : undefined
            }
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text
              className={cn(
                'text-[13px] font-semibold',
                active ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              {opt.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
