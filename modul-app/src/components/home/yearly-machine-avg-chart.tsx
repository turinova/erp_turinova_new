'use client'

import { useMemo } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'

import type { YearlyMachineAvgData } from '@/lib/home/chart-queries'

const COLORS = ['#18181B', '#525252', '#12A150', '#E08600', '#737373', '#404040']

export function YearlyMachineAvgChart({ data }: { data: YearlyMachineAvgData }) {
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
            Nincs kész (ready) H–P adat erre az évre.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
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
                unit=" m"
              />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 6,
                  border: '1px solid #E5E5E5'
                }}
                formatter={(value: number) => [
                  `${Number(value).toLocaleString('hu-HU', { maximumFractionDigits: 1 })} m/nap`,
                  undefined
                ]}
              />
              <Legend
                verticalAlign="top"
                height={28}
                wrapperStyle={{ fontSize: 12, paddingBottom: 4 }}
              />
              {data.series.map((s, idx) => (
                <Line
                  key={s.machineId}
                  type="monotone"
                  dataKey={s.name}
                  stroke={COLORS[idx % COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
