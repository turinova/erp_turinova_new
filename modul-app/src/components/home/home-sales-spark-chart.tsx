'use client'

import { useMemo } from 'react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts'

import type { SalesDayPoint } from '@/lib/home/kpi-queries'
import { formatMoneyFt } from '@/lib/sales/parse'

type Props = {
  data: SalesDayPoint[]
  /** 'gross' | 'count' */
  metric?: 'gross' | 'count'
  className?: string
  /** Chart height px (hero 56, mini cell 28). */
  height?: number
  /** Unique gradient id when multiple sparks on one page. */
  gradientId?: string
  strokeWidth?: number
  showTooltip?: boolean
}

export function HomeSalesSparkChart({
  data,
  metric = 'gross',
  className,
  height = 56,
  gradientId = 'salesSparkFill',
  strokeWidth = 1.5,
  showTooltip = true
}: Props) {
  const chartData = useMemo(
    () =>
      data.map((d) => ({
        label: d.label,
        value: metric === 'gross' ? d.gross : d.count
      })),
    [data, metric]
  )

  const empty = chartData.every((d) => d.value === 0)

  if (empty) {
    return (
      <div
        className={className}
        style={{ height }}
        aria-hidden
      />
    )
  }

  return (
    <div className={className} style={{ height, width: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#18181B" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#18181B" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          {showTooltip ? (
            <Tooltip
              cursor={{ stroke: '#A3A3A3', strokeWidth: 1 }}
              contentStyle={{
                borderRadius: 6,
                border: '1px solid #E4E4E7',
                fontSize: 12,
                padding: '6px 8px'
              }}
              formatter={(value) => {
                const n = typeof value === 'number' ? value : Number(value) || 0
                if (metric === 'gross')
                  return [`${formatMoneyFt(n)} Ft`, 'Forgalom']
                return [`${n} db`, 'Eladás']
              }}
              labelFormatter={(label) => String(label)}
            />
          ) : null}
          <Area
            type="monotone"
            dataKey="value"
            stroke="#18181B"
            strokeWidth={strokeWidth}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
