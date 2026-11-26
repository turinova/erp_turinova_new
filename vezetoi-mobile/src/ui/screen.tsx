import * as Haptics from 'expo-haptics'
import type { ReactNode } from 'react'
import {
  RefreshControl,
  ScrollView,
  Text,
  View,
  type StyleProp,
  type ViewStyle
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { colors, space } from '@/theme'

type Props = {
  children: ReactNode
  /** Notion / iOS large title — a képernyő egy kérdése. */
  title?: string
  /** Halk második sor, pl. aktív cég (bizonyosság: melyik cég számai). */
  subtitle?: string | null
  refreshing?: boolean
  onRefresh?: () => void
  contentStyle?: StyleProp<ViewStyle>
  /** Natív Stack fejléc alatt: nincs felső safe-area padding. */
  stacked?: boolean
}

export function Screen({
  children,
  title,
  subtitle,
  refreshing,
  onRefresh,
  contentStyle,
  stacked
}: Props) {
  const insets = useSafeAreaInsets()

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={[
        {
          padding: space[4],
          gap: space[4],
          paddingBottom: space[8],
          paddingTop: stacked ? space[3] : Math.max(insets.top, space[3]) + space[2]
        },
        contentStyle
      ]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={!!refreshing}
            onRefresh={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              onRefresh()
            }}
            tintColor={colors.ink}
          />
        ) : undefined
      }
    >
      {title ? (
        <View className="gap-0.5 px-1">
          <Text
            className="text-[28px] font-bold text-foreground"
            style={{ letterSpacing: -0.6 }}
            accessibilityRole="header"
          >
            {title}
          </Text>
          {subtitle ? (
            <Text className="text-[13px] text-muted-foreground" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : null}
      {children}
    </ScrollView>
  )
}
