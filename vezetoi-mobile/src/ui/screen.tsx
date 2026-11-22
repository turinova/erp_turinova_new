import type { ReactNode } from 'react'
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  type StyleProp,
  type ViewStyle
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { colors, space } from '@/theme'

type Props = {
  children: ReactNode
  refreshing?: boolean
  onRefresh?: () => void
  contentStyle?: StyleProp<ViewStyle>
}

export function Screen({
  children,
  refreshing,
  onRefresh,
  contentStyle
}: Props) {
  const insets = useSafeAreaInsets()

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        { paddingTop: Math.max(insets.top, space[3]) + space[2] },
        contentStyle
      ]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={!!refreshing}
            onRefresh={onRefresh}
            tintColor={colors.ink}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.subtle },
  content: {
    padding: space[4],
    gap: space[3],
    paddingBottom: space[8]
  }
})
