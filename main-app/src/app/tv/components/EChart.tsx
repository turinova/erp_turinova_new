'use client'

import type { EChartsOption } from 'echarts'
import ReactECharts from 'echarts-for-react'

type EChartProps = {
  option: EChartsOption
  className?: string
}

export default function EChart({ option, className }: EChartProps) {
  return (
    <ReactECharts
      className={className}
      option={option}
      style={{ width: '100%', height: '100%', minHeight: 0 }}
      opts={{ renderer: 'canvas' }}
      notMerge
      lazyUpdate
    />
  )
}
