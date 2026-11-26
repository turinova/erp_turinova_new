import { Text, View } from 'react-native'

import { Card } from '@/ui'

export type SplitPart = {
  key: string
  label: string
  value: number
  /** Jobb oldali szöveg, pl. „12 db”. */
  display: string
  color: string
}

type Props = {
  title: string
  parts: SplitPart[]
  caption?: string | null
}

/**
 * Arány egy pillantásra: egy 100%-os sáv, alatta minden szelet a saját
 * színével, nevével és értékével — jelmagyarázat-keresgélés nélkül.
 */
export function SplitBar({ title, parts, caption }: Props) {
  const total = parts.reduce((s, p) => s + Math.max(0, p.value), 0)

  return (
    <Card className="gap-3">
      <Text className="text-[14px] font-semibold text-foreground">{title}</Text>

      <View className="h-3 flex-row overflow-hidden rounded-full bg-secondary">
        {total > 0
          ? parts.map((p) =>
              p.value > 0 ? (
                <View
                  key={p.key}
                  style={{ flex: p.value, backgroundColor: p.color }}
                />
              ) : null
            )
          : null}
      </View>

      <View className="gap-2">
        {parts.map((p) => {
          const pct = total > 0 ? Math.round((p.value / total) * 100) : 0
          return (
            <View key={p.key} className="flex-row items-center gap-2">
              <View
                style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: p.color }}
              />
              <Text className="flex-1 text-[14px] text-foreground" numberOfLines={1}>
                {p.label}
              </Text>
              <Text
                className="text-[14px] font-semibold text-foreground"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {p.display}
              </Text>
              <Text
                className="w-10 text-right text-[13px] text-muted-foreground"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {pct}%
              </Text>
            </View>
          )
        })}
      </View>

      {caption ? (
        <Text className="text-[12px] leading-[17px] text-muted-foreground">{caption}</Text>
      ) : null}
    </Card>
  )
}
