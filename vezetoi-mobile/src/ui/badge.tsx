import { Text, View } from 'react-native'

import { cn } from './cn'

export type Tone = 'default' | 'success' | 'warning' | 'danger'

const BOX: Record<Tone, string> = {
  default: 'border-border bg-secondary',
  success: 'border-success/20 bg-success-soft',
  warning: 'border-warning/20 bg-warning-soft',
  danger: 'border-destructive/20 bg-destructive-soft'
}

const LABEL: Record<Tone, string> = {
  default: 'text-muted-foreground',
  success: 'text-success-foreground',
  warning: 'text-warning-foreground',
  danger: 'text-destructive-foreground'
}

export function Badge({ label, tone = 'default' }: { label: string; tone?: Tone }) {
  return (
    <View className={cn('self-start rounded-md border px-2 py-0.5', BOX[tone])}>
      <Text className={cn('text-[11px] font-semibold', LABEL[tone])}>{label}</Text>
    </View>
  )
}
