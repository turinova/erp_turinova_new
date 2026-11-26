import type { ReactNode } from 'react'
import { Text, View } from 'react-native'
import { BarChart } from 'panelui-native/components/bar-chart'

import { Card } from '@/ui'

export type CountBar = {
  x: string
  /** Tooltip fejléc, pl. „November 20., csütörtök”. */
  title: string
  /** null = még nincs adat (jövő). */
  value: number | null
  highlight: boolean
}

type Props = {
  title: string
  bars: CountBar[]
  color: string
  softColor: string
  unit: string
  orientation?: 'vertical' | 'horizontal'
  ticks?: number
  aspectRatio?: number
  children?: ReactNode
}

/** Darabszám oszlopok: kiemelt oszlop teli szín, a többi halvány; ujjal leolvasható. */
export function CountBarsCard({
  title,
  bars,
  color,
  softColor,
  unit,
  orientation = 'vertical',
  ticks,
  aspectRatio,
  children
}: Props) {
  const data = bars.map((b) => ({
    x: b.x,
    title: b.title,
    tobbi: b.highlight ? null : b.value,
    kiemelt: b.highlight ? b.value : null
  }))
  const horizontal = orientation === 'horizontal'

  return (
    <Card className="gap-3">
      <Text className="text-[14px] font-semibold text-foreground">{title}</Text>
      <BarChart
        data={data}
        xDataKey="x"
        stacked
        orientation={orientation}
        aspectRatio={aspectRatio ?? (horizontal ? 1.5 : 2.1)}
        cornerRadius={4}
        barGap={horizontal ? 0.3 : bars.length > 10 ? 0.22 : 0.35}
        minBarLength={2}
        accessibilityLabel={title}
      >
        <BarChart.Bar dataKey="tobbi" color={softColor} />
        <BarChart.Bar dataKey="kiemelt" color={color} />
        <BarChart.XAxis ticks={ticks} />
        <BarChart.Tooltip
          formatX={(d) => String(d.title)}
          formatValue={(v) => `${new Intl.NumberFormat('hu-HU').format(v)} ${unit}`}
        />
      </BarChart>
      {children ? <View className="gap-0.5">{children}</View> : null}
    </Card>
  )
}
