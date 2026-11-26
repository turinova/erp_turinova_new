import { Text } from 'react-native'

import { cn } from './cn'

export type StatusTone = 'default' | 'muted' | 'success' | 'warning' | 'danger'

const TONE: Record<StatusTone, string> = {
  default: 'text-foreground',
  muted: 'text-muted-foreground',
  success: 'text-success-foreground',
  warning: 'text-warning-foreground',
  danger: 'text-destructive-foreground'
}

/** Státusz mindig szöveggel — a szín csak megerősít, sosem egyedül hordozza a jelentést. */
export function StatusText({
  children,
  tone = 'default',
  className
}: {
  children: string
  tone?: StatusTone
  className?: string
}) {
  return (
    <Text className={cn('text-[13px] font-medium', TONE[tone], className)}>
      {children}
    </Text>
  )
}
