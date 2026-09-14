'use client'

import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'

import type { WeeklyEdgeData } from '@/lib/home/chart-queries'

const COLORS = [
  '#404040',
  '#737373',
  '#18181B',
  '#A3A3A3',
  '#525252',
  '#27272A',
  '#71717A',
  '#D4D4D4'
]

export function WeeklyEdgeChart({ data }: { data: WeeklyEdgeData }) {
  const chartData = useMemo(() => {
    return data.categories.map((label, i) => {
      const row: Record<string, string | number> = { name: label }
      for (const s of data.series) {
        row[s.name] = s.data[i] ?? 0
      }
      return row
    })
  }, [data])

  const empty = data.series.length === 0

  return (
    <div className="min-w-0 w-full">
      <div className="h-[260px] w-full min-w-0">
        {empty ? (
          <p className="flex h-full items-center justify-center text-body text-ink-secondary">
            Nincs élzárás adat erre a hétre.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 12, left: 4, bottom: 8 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#E5E5E5"
                vertical={false}
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: '#737373' }}
                axisLine={{ stroke: '#E5E5E5' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#737373' }}
                axisLine={false}
                tickLine={false}
                width={52}
                tickFormatter={(v) =>
                  Number(v).toLocaleString('hu-HU', {
                    maximumFractionDigits: 0
                  })
                }
                unit={data.unit === 'm' ? ' m' : ''}
                allowDecimals={data.unit === 'm'}
              />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 6,
                  border: '1px solid #E5E5E5'
                }}
                formatter={(value: number) => [
                  data.unit === 'm'
                    ? `${Number(value).toLocaleString('hu-HU', { maximumFractionDigits: 1 })} m`
                    : `${Number(value).toLocaleString('hu-HU')} db`,
                  undefined
                ]}
              />
              <Legend
                verticalAlign="top"
                height={28}
                wrapperStyle={{ fontSize: 12, paddingBottom: 4 }}
              />
              {data.unit === 'm' ? (
                <ReferenceLine
                  y={data.capacityPerDayM}
                  stroke="#E08600"
                  strokeDasharray="4 4"
                />
              ) : null}
              {data.series.map((s, idx) => (
                <Bar
                  key={s.name}
                  dataKey={s.name}
                  stackId="edge"
                  fill={COLORS[idx % COLORS.length]}
                  radius={idx === data.series.length - 1 ? [2, 2, 0, 0] : 0}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {data.unit === 'db' && data.orderCount > 0 ? (
        <p className="mt-2 text-hint text-warning-ink">
          {data.orderCount} megrendelés, élzárás méter 0 — db szerint
          megjelenítve.
        </p>
      ) : null}
    </div>
  )
}
