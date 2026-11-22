import { useMemo, useState } from 'react'
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native'
import { BarChart } from 'react-native-gifted-charts'

import { colors, radius, space, type } from '@/theme'

export type SparkPoint = {
  ymd: string
  value: number
}

type Props = {
  points: SparkPoint[]
  caption?: string
}

/** Flat Midday 7-napos glance — gifted-charts, nincs gradiens. */
export function SparkChart({ points, caption = 'Elmúlt 7 nap' }: Props) {
  const [width, setWidth] = useState(0)

  const data = useMemo(() => {
    const last = points.length - 1
    return points.map((p, i) => {
      const day = Number(p.ymd.slice(8, 10))
      return {
        value: Math.max(0, p.value),
        label: String(day),
        frontColor: i === last ? colors.chartBar : colors.chartBarMuted,
        labelTextStyle: {
          color: colors.inkMuted,
          fontSize: 10
        }
      }
    })
  }, [points])

  const onLayout = (e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width)
  }

  const barWidth = width > 0 ? Math.max(10, Math.floor((width - 48) / 11)) : 14

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      <Text style={styles.caption}>{caption}</Text>
      {width > 0 ? (
        <BarChart
          data={data}
          width={width - 8}
          height={72}
          barWidth={barWidth}
          spacing={Math.max(6, Math.floor(barWidth * 0.55))}
          initialSpacing={4}
          endSpacing={4}
          hideRules
          hideYAxisText
          yAxisThickness={0}
          xAxisThickness={0}
          xAxisColor={colors.border}
          disableScroll
          isAnimated
          animationDuration={400}
          noOfSections={2}
          maxValue={Math.max(...points.map((p) => p.value), 1) * 1.08}
        />
      ) : (
        <View style={{ height: 72 }} />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingTop: space[3],
    paddingHorizontal: space[2],
    paddingBottom: space[2],
    overflow: 'hidden'
  },
  caption: {
    ...type.label,
    color: colors.inkMuted,
    marginLeft: space[2],
    marginBottom: space[1]
  }
})
