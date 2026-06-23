'use client'

import { useMemo } from 'react'
import type { EChartsOption } from 'echarts'

import type { TvDaySeries, TvEdgeSeries } from '@/types/tv-dashboard'
import { buildWeeklyCuttingOption, buildWeeklyEdgeOption } from '@/lib/tv/echarts-tv-theme'

import { useTvPreviewMode } from '../../hooks/useTvPreviewMode'
import EChart from '../EChart'
import styles from './WeeklyStackedBarChart.module.css'

type WeeklyProductionChartProps = {
  title: string
  variant: 'cutting' | 'edge'
  chart: TvDaySeries | TvEdgeSeries
}

export default function WeeklyProductionChart({ title, variant, chart }: WeeklyProductionChartProps) {
  const { isKiosk } = useTvPreviewMode()
  const density = isKiosk ? 'kiosk' : 'laptop'

  const option = useMemo<EChartsOption>(() => {
    if (variant === 'edge') {
      return buildWeeklyEdgeOption(chart as TvEdgeSeries, density)
    }
    return buildWeeklyCuttingOption(chart, density)
  }, [chart, density, variant])

  return (
    <div className={`tv-panel tv-panel-accent ${styles.wrap}`}>
      <h2 className={styles.title}>{title}</h2>
      <div className={styles.chart}>
        <EChart option={option} />
      </div>
    </div>
  )
}
