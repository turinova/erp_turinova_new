import type { EChartsOption } from 'echarts'

import type { TvDaySeries, TvEdgeSeries } from '@/types/tv-dashboard'

export const TV_CHART = {
  done: '#0F7B6C',
  remaining: '#E9A23B',
  capacity: '#9B9A97',
  today: '#2383E2',
  danger: '#E03E3E',
  info: '#0B6E99',
  grid: '#E8E7E4',
  text: '#787774',
  textStrong: '#37352F',
  surface: '#FFFFFF',
  labelOnDark: '#FFFFFF',
  labelOnLight: '#37352F'
} as const

/** Same palette as /home WeeklyCuttingChart */
export const TV_MACHINE_COLORS = [
  '#2196F3',
  '#4CAF50',
  '#FF9800',
  '#E91E63',
  '#9C27B0',
  '#00BCD4',
  '#FFEB3B',
  '#FF5722'
] as const

export type TvChartDensity = 'kiosk' | 'laptop'

export function getTvChartSizes(density: TvChartDensity) {
  if (density === 'kiosk') {
    return {
      barMaxWidth: 52,
      barGap: '16%',
      axis: 17,
      axisStrong: 19,
      barLabel: 20,
      topTotal: 20,
      legend: 15,
      capacity: 17,
      trafficLabel: 20,
      trafficSymbol: 12,
      lineWidth: 3
    }
  }
  return {
    barMaxWidth: 36,
    barGap: '20%',
    axis: 11,
    axisStrong: 12,
    barLabel: 11,
    topTotal: 13,
    legend: 11,
    capacity: 11,
    trafficLabel: 14,
    trafficSymbol: 10,
    lineWidth: 2
  }
}

export function formatTvChartMeters(value: number, decimals = 0): string {
  const n = decimals > 0 ? value.toFixed(decimals) : String(Math.round(value))
  if (value >= 1000 && decimals === 0) return `${Math.round(value / 100) / 10}k`
  return n
}

export const tvChartBase: Pick<EChartsOption, 'textStyle' | 'animation' | 'animationDuration' | 'animationEasing'> = {
  textStyle: {
    fontFamily: 'var(--font-data), Inter, system-ui, sans-serif',
    color: TV_CHART.text
  },
  animation: true,
  animationDuration: 800,
  animationEasing: 'cubicOut'
}

export function tvGrid(partial?: object) {
  return {
    left: 8,
    right: 8,
    top: 40,
    bottom: 2,
    containLabel: true,
    ...partial
  }
}

function shortDayLabel(day: string, density: TvChartDensity): string {
  if (density !== 'kiosk') return day
  const map: Record<string, string> = {
    Hétfő: 'H',
    Kedd: 'K',
    Szerda: 'Sze',
    Csütörtök: 'Cs',
    Péntek: 'P'
  }
  return map[day] ?? day
}

function dayCategories(chart: TvDaySeries, density: TvChartDensity): string[] {
  return chart.categories.map((day, i) => {
    const total = chart.totals[i] ?? 0
    const label = shortDayLabel(day, density)
    if (total <= 0) return label
    const m = formatTvChartMeters(total, total < 100 ? 1 : 0)
    return density === 'kiosk' ? `${label}\n${m} m` : `${day}\n(${m}m)`
  })
}

function showBarLabel(density: TvChartDensity, todayIndex: number | null, dataIndex: number, value: number): boolean {
  if (value <= 0) return false
  if (density === 'kiosk' && todayIndex != null) return dataIndex === todayIndex
  return true
}

function isOverdueRemaining(todayIndex: number | null, dataIndex: number, value: number): boolean {
  return todayIndex != null && dataIndex < todayIndex && value > 0
}

function showRemainingLabel(
  density: TvChartDensity,
  todayIndex: number | null,
  dataIndex: number,
  value: number
): boolean {
  if (value <= 0) return false
  if (density !== 'kiosk') return true
  if (todayIndex != null && dataIndex === todayIndex) return true
  return isOverdueRemaining(todayIndex, dataIndex, value)
}

function baseAxes(chart: TvDaySeries, density: TvChartDensity, gridTop?: number): Pick<EChartsOption, 'grid' | 'xAxis' | 'yAxis' | 'tooltip' | 'legend'> {
  const s = getTvChartSizes(density)
  return {
    grid: tvGrid({ top: gridTop ?? (density === 'kiosk' ? 44 : 48), bottom: density === 'kiosk' ? 2 : 12 }),
    tooltip: { show: false },
    legend: {
      type: 'scroll',
      top: 0,
      right: 0,
      itemWidth: 12,
      itemHeight: 12,
      textStyle: { fontSize: s.legend, fontWeight: 700, color: TV_CHART.textStrong }
    },
    xAxis: {
      type: 'category',
      data: dayCategories(chart, density),
      axisLine: { lineStyle: { color: TV_CHART.grid } },
      axisLabel: {
        color: TV_CHART.textStrong,
        fontSize: s.axisStrong,
        fontWeight: 700,
        margin: 10,
        lineHeight: density === 'kiosk' ? 22 : 16
      }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: TV_CHART.text,
        fontSize: s.axis,
        fontWeight: 600,
        formatter: (v: number) => `${formatTvChartMeters(v)} m`
      },
      splitLine: { lineStyle: { color: TV_CHART.grid, type: 'dashed' } }
    }
  }
}

/** Grouped bars per machine + hátralévő vonal — mirrors /home WeeklyCuttingChart */
export function buildWeeklyCuttingOption(chart: TvDaySeries, density: TvChartDensity): EChartsOption {
  const s = getTvChartSizes(density)
  const machineSeries = chart.series.length > 0 ? chart.series : [{ name: 'Összesen', data: chart.totals }]

  const barSeries = machineSeries.map((ms, idx) => {
    const defaultColor = TV_MACHINE_COLORS[idx % TV_MACHINE_COLORS.length]
    const limitM = chart.machineLimits?.[idx]?.limitM ?? 0
    return {
      name: ms.name,
      type: 'bar' as const,
      color: defaultColor,
      data: ms.data.map((v, i) => {
        const overLimit = limitM > 0 && v > limitM
        const color = overLimit ? TV_CHART.danger : defaultColor
        return {
          value: v,
          itemStyle:
            chart.todayIndex === i
              ? { color, borderColor: TV_CHART.today, borderWidth: 3 }
              : { color }
        }
      }),
      barMaxWidth: s.barMaxWidth,
      barGap: s.barGap,
      label: {
        show: true,
        position: 'top' as const,
        distance: 4,
        fontSize: s.barLabel,
        fontWeight: 700,
        color: TV_CHART.textStrong,
        formatter: (p: { value: number; dataIndex: number }) =>
          showBarLabel(density, chart.todayIndex, p.dataIndex, p.value)
            ? `${formatTvChartMeters(p.value, p.value < 50 ? 1 : 0)}`
            : ''
      }
    }
  })

  const remainingLineData = chart.remaining.map((v, i) => {
    const overdue = isOverdueRemaining(chart.todayIndex, i, v)
    const pointColor = overdue ? TV_CHART.danger : TV_CHART.remaining
    return {
      value: v,
      itemStyle: { color: pointColor, borderColor: pointColor, borderWidth: overdue ? 2 : 0 }
    }
  })

  return {
    ...tvChartBase,
    ...baseAxes(chart, density, density === 'kiosk' ? 48 : 52),
    color: [...TV_MACHINE_COLORS, TV_CHART.remaining],
    series: [
      ...barSeries,
      {
        name: 'Hátralévő',
        type: 'line' as const,
        color: TV_CHART.remaining,
        data: remainingLineData,
        symbol: 'circle',
        symbolSize: density === 'kiosk' ? 10 : 8,
        lineStyle: { color: TV_CHART.remaining, width: s.lineWidth },
        label: {
          show: true,
          position: 'top' as const,
          fontSize: s.barLabel,
          fontWeight: 700,
          formatter: (p: { value: number; dataIndex: number }) => {
            const v = Number(p.value) || 0
            return showRemainingLabel(density, chart.todayIndex, p.dataIndex, v)
              ? `${formatTvChartMeters(v)}`
              : ''
          },
          color: (p: { value: number; dataIndex: number }) =>
            isOverdueRemaining(chart.todayIndex, p.dataIndex, Number(p.value) || 0)
              ? TV_CHART.danger
              : TV_CHART.remaining
        }
      }
    ]
  }
}

/** Stacked bars per material + hátralévő & kapacitás vonal — mirrors /home WeeklyEdgeBandingChart */
export function buildWeeklyEdgeOption(chart: TvEdgeSeries, density: TvChartDensity): EChartsOption {
  const s = getTvChartSizes(density)
  const materialSeries =
    chart.series.length > 0 ? chart.series : [{ name: 'Élzárás', data: chart.totals }]

  const barSeries = materialSeries.map((ms, idx) => {
    const color = TV_MACHINE_COLORS[idx % TV_MACHINE_COLORS.length]
    return {
      name: ms.name,
      type: 'bar' as const,
      stack: 'edge',
      color,
      data: ms.data.map((v, i) => ({
        value: v,
        itemStyle:
          chart.todayIndex === i
            ? { color, borderColor: TV_CHART.today, borderWidth: 2 }
            : { color }
      })),
      barMaxWidth: s.barMaxWidth,
      label: {
        show: true,
        position: 'inside' as const,
        fontSize: s.barLabel - 2,
        fontWeight: 700,
        color: TV_CHART.labelOnDark,
        formatter: (p: { value: number; dataIndex: number }) => {
          if (p.value < 30) return ''
          if (density === 'kiosk' && chart.todayIndex != null && p.dataIndex !== chart.todayIndex) return ''
          return `${formatTvChartMeters(p.value)}`
        }
      }
    }
  })

  const capacity = chart.capacityPerDay?.[0] ?? 700

  return {
    ...tvChartBase,
    ...baseAxes(chart, density, density === 'kiosk' ? 48 : 52),
    color: [...TV_MACHINE_COLORS, TV_CHART.remaining, TV_CHART.capacity],
    series: [
      ...barSeries,
      {
        name: 'Hátralévő',
        type: 'line' as const,
        color: TV_CHART.remaining,
        data: chart.remaining,
        symbol: 'circle',
        symbolSize: density === 'kiosk' ? 10 : 8,
        lineStyle: { color: TV_CHART.remaining, width: s.lineWidth },
        itemStyle: { color: TV_CHART.remaining },
        label: {
          show: true,
          position: 'top',
          fontSize: s.barLabel,
          fontWeight: 700,
          color: TV_CHART.remaining,
          formatter: (p: { value: number; dataIndex: number }) =>
            showBarLabel(density, chart.todayIndex, p.dataIndex, p.value)
              ? `${formatTvChartMeters(p.value)}`
              : ''
        }
      },
      {
        name: 'Kapacitás',
        type: 'line' as const,
        color: TV_CHART.capacity,
        data: chart.capacityPerDay?.length
          ? chart.capacityPerDay
          : Array(chart.categories.length).fill(capacity),
        symbol: 'none',
        lineStyle: { color: TV_CHART.capacity, width: s.lineWidth, type: 'dashed' },
        label: {
          show: density !== 'kiosk',
          position: 'end',
          fontSize: s.capacity,
          fontWeight: 700,
          color: TV_CHART.capacity,
          formatter: '700 m'
        }
      }
    ]
  }
}

export function buildTrafficAreaOption(
  hourLabels: number[],
  hourlyOpen: number[],
  density: TvChartDensity
): EChartsOption {
  const s = getTvChartSizes(density)
  return {
    ...tvChartBase,
    grid: tvGrid({
      top: density === 'kiosk' ? 32 : 40,
      bottom: density === 'kiosk' ? 8 : 16,
      left: 12,
      right: 12
    }),
    tooltip: { show: false },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: hourLabels.map(h => `${h}:00`),
      axisLabel: { fontSize: s.axis, fontWeight: 700, color: TV_CHART.textStrong, margin: 10 }
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: { lineStyle: { color: TV_CHART.grid, type: 'dashed' } },
      axisLabel: { fontSize: s.axis - 2, fontWeight: 600, color: TV_CHART.text },
      show: density !== 'kiosk'
    },
    series: [
      {
        name: 'Belépők',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: s.trafficSymbol,
        areaStyle: { color: 'rgba(35, 131, 226, 0.22)' },
        lineStyle: { color: TV_CHART.today, width: s.lineWidth },
        itemStyle: { color: TV_CHART.today, borderWidth: 2, borderColor: '#fff' },
        data: hourlyOpen,
        label: {
          show: true,
          position: 'top',
          distance: 6,
          fontSize: s.trafficLabel,
          fontWeight: 700,
          color: TV_CHART.textStrong,
          formatter: (p: { value: number }) => (p.value > 0 ? String(p.value) : '')
        }
      }
    ]
  }
}
