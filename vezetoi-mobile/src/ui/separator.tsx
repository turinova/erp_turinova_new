import { StyleSheet, View } from 'react-native'

import { cn } from './cn'

export function Separator({ inset = false }: { inset?: boolean }) {
  return (
    <View
      className={cn('bg-border', inset && 'ml-4')}
      style={{ height: StyleSheet.hairlineWidth }}
    />
  )
}
