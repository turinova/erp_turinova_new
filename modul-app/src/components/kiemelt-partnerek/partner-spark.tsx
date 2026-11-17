'use client'

import { useMemo } from 'react'
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts'

import type { KiemeltSparkPoint } from '@/lib/kiemelt-partnerek/queries'

type Props = {
  data: KiemeltSparkPoint[]
  gradientId: string
  height?: number
}

export function PartnerSpark({ data, gradientId, height = 28 }: Props) {
  const chartData = useMemo(
    () => data.map((d) => ({ label: d.label, value: d.gross })),
    [data]
  )
  const empty = chartData.every((d) => d.value === 0)
  if (empty) {
    return <div style={{ height }} aria-hidden className="w-full" />
  }

  return (
    <div style={{ height, width: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 2, right: 0, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#18181B" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#18181B" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#18181B"
            strokeWidth={1.25}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
