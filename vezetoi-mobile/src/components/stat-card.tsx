import { Text } from 'react-native'

import { Card, StatusText, type StatusTone } from '@/ui'

type Props = {
  label: string
  value: string
  hint?: string | null
  delta?: { text: string; tone: StatusTone } | null
  tone?: 'default' | 'warning'
  onPress?: () => void
}

/** Másodlagos szám: max 3 adatpont (cím, érték, egy sor magyarázat). */
export function StatCard({ label, value, hint, delta, tone = 'default', onPress }: Props) {
  return (
    <Card onPress={onPress} tone={tone} className="flex-1">
      <Text className="text-[13px] font-medium text-muted-foreground" numberOfLines={1}>
        {label}
      </Text>
      <Text
        className="text-[22px] font-bold text-foreground"
        style={{ fontVariant: ['tabular-nums'], letterSpacing: -0.4 }}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {value}
      </Text>
      {delta ? <StatusText tone={delta.tone}>{delta.text}</StatusText> : null}
      {!delta && hint ? (
        <Text className="text-[12px] text-muted-foreground" numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </Card>
  )
}
