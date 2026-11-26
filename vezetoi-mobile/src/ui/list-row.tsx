import { ChevronRight } from 'lucide-react-native'
import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'

import { colors } from '@/theme'

import { cn } from './cn'
import type { StatusTone } from './status-text'

type Props = {
  /** Bal oldali elem, pl. avatar. */
  leading?: ReactNode
  title: string
  meta?: string | null
  /** Jobb oldali tabular érték (Notion / iOS beállítás sor). */
  value?: string | null
  valueTone?: StatusTone
  warning?: boolean
  destructive?: boolean
  onPress?: () => void
}

const VALUE_TONE: Record<StatusTone, string> = {
  default: 'text-foreground',
  muted: 'text-muted-foreground',
  success: 'text-success-foreground',
  warning: 'text-warning-foreground',
  danger: 'text-destructive-foreground'
}

export function ListRow({
  leading,
  title,
  meta,
  value,
  valueTone = 'default',
  warning,
  destructive,
  onPress
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      className="min-h-12 flex-row items-center gap-3 bg-card px-4 py-3"
      style={({ pressed }) => (pressed ? { opacity: 0.6 } : undefined)}
    >
      {leading}
      <View className="min-w-0 flex-1 gap-0.5">
        <Text
          className={cn(
            'text-[15px] font-medium',
            destructive ? 'text-destructive-foreground' : 'text-foreground'
          )}
          numberOfLines={1}
        >
          {title}
        </Text>
        {meta ? (
          <Text
            className={cn(
              'text-[13px]',
              warning ? 'font-semibold text-warning-foreground' : 'text-muted-foreground'
            )}
            style={{ fontVariant: ['tabular-nums'] }}
            numberOfLines={2}
          >
            {meta}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text
          className={cn('text-[15px] font-semibold', VALUE_TONE[valueTone])}
          style={{ fontVariant: ['tabular-nums'] }}
          numberOfLines={1}
        >
          {value}
        </Text>
      ) : null}
      {onPress && !destructive ? (
        <ChevronRight size={16} color={colors.tabInactive} strokeWidth={2.25} />
      ) : null}
    </Pressable>
  )
}
