import { Text, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'

import { cn } from './cn'
import { StatusText, type StatusTone } from './status-text'

type Props = {
  value: string
  label?: string
  unit?: string
  hint?: string | null
  delta?: { text: string; tone: StatusTone } | null
  align?: 'left' | 'center'
}

/** Keret nélküli hero szám — Jobs: a képernyő egyetlen kérdésére a válasz. */
export function HeroMetric({
  value,
  label,
  unit,
  hint,
  delta,
  align = 'center'
}: Props) {
  const center = align === 'center'
  return (
    <Animated.View
      entering={FadeInDown.duration(280)}
      className={cn('gap-1 py-1', center ? 'items-center' : 'items-start')}
    >
      {label ? (
        <Text className="text-[13px] font-medium text-muted-foreground">{label}</Text>
      ) : null}
      <Text
        className="font-bold text-foreground"
        style={{
          fontSize: 40,
          lineHeight: 46,
          letterSpacing: -1,
          fontVariant: ['tabular-nums']
        }}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        {value}
      </Text>
      {unit ? (
        <Text className="text-[14px] font-medium text-muted-foreground">{unit}</Text>
      ) : null}
      {delta || hint ? (
        <View className={cn('mt-1 gap-0.5', center ? 'items-center' : 'items-start')}>
          {delta ? <StatusText tone={delta.tone}>{delta.text}</StatusText> : null}
          {hint ? (
            <Text
              className={cn(
                'text-[13px] leading-[18px] text-muted-foreground',
                center && 'text-center'
              )}
            >
              {hint}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Animated.View>
  )
}
