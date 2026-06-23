'use client'

import { useMemo } from 'react'
import type { EChartsOption } from 'echarts'

import type { TvPosBlock } from '@/types/tv-dashboard'
import { formatTvCount, formatTvFt } from '@/lib/tv-format'
import { TV_CHART, tvChartBase } from '@/lib/tv/echarts-tv-theme'

import EChart from '../EChart'
import styles from './PosGaugeCard.module.css'

type PosGaugeCardProps = {
  pos: TvPosBlock
}

function gaugeOption(value: number, max: number, title: string): EChartsOption {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return {
    ...tvChartBase,
    series: [
      {
        type: 'gauge',
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max: 100,
        radius: '95%',
        center: ['50%', '58%'],
        progress: {
          show: true,
          width: 14,
          itemStyle: { color: pct >= 100 ? TV_CHART.done : TV_CHART.today }
        },
        axisLine: { lineStyle: { width: 14, color: [[1, TV_CHART.grid]] } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        pointer: { show: false },
        anchor: { show: false },
        title: {
          offsetCenter: [0, '72%'],
          fontSize: 12,
          fontWeight: 700,
          color: TV_CHART.textStrong
        },
        detail: {
          valueAnimation: true,
          offsetCenter: [0, '8%'],
          fontSize: 22,
          fontWeight: 800,
          formatter: () => formatTvCount(value),
          color: TV_CHART.textStrong
        },
        data: [{ value: pct, name: title }]
      }
    ]
  }
}

export default function PosGaugeCard({ pos }: PosGaugeCardProps) {
  const dayOption = useMemo(() => gaugeOption(pos.todayCount, pos.goalDay, 'Ma'), [pos])
  const monthOption = useMemo(() => gaugeOption(pos.monthCount, pos.goalMonth, 'Hónap'), [pos])

  return (
    <div className={`tv-panel ${styles.wrap}`}>
      <h2 className={styles.title}>POS rendelések</h2>
      <div className={styles.gauges}>
        <div className={styles.gaugeBox}>
          <EChart option={dayOption} />
        </div>
        <div className={styles.gaugeBox}>
          <EChart option={monthOption} />
        </div>
      </div>
      <div className={styles.ftRow}>
        <div>
          <div className={styles.ftLabel}>Ma bruttó</div>
          {formatTvFt(pos.todayGross)}
        </div>
        <div>
          <div className={styles.ftLabel}>Hónap bruttó</div>
          {formatTvFt(pos.monthGross)}
        </div>
      </div>
    </div>
  )
}
