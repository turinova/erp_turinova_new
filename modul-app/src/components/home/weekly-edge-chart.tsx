'use client'

import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'

import { homeEdgeColor } from '@/lib/home/chart-colors'
import type { WeeklyEdgeData } from '@/lib/home/chart-queries'
import { addDaysYmd, budapestTodayYmd } from '@/lib/home/date'
import { cn } from '@/lib/utils'

export function WeeklyEdgeChart({ data }: { data: WeeklyEdgeData }) {
  const todayYmd = budapestTodayYmd()
  const todayIndex = useMemo(() => {
    for (let i = 0; i < data.categories.length; i++) {
      if (addDaysYmd(data.weekStart, i) === todayYmd) return i
    }
    return null
  }, [data.categories.length, data.weekStart, todayYmd])

  const chartData = useMemo(() => {
    return data.categories.map((label, i) => {
      const row: Record<string, string | number | boolean> = {
        name: label,
        isToday: todayIndex === i
      }
      for (const s of data.series) {
        row[s.name] = s.data[i] ?? 0
      }
      return row
    })
  }, [data, todayIndex])

  const empty = data.series.length === 0
  const todayLoad = todayIndex != null ? (data.dailyTotals[todayIndex] ?? 0) : 0
  const todayPct =
    data.unit === 'm' && data.capacityPerDayM > 0 && todayIndex != null
      ? Math.round((todayLoad / data.capacityPerDayM) * 100)
      : null

  return (
    <div className="min-w-0 w-full">
      {!empty && data.unit === 'm' && todayPct != null ? (
        <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <p className="text-body font-semibold tabular-nums text-ink">
            Mai élzárás{' '}
            <span
              className={cn(
                todayPct > 100
                  ? 'text-danger-ink'
                  : todayPct >= 85
                    ? 'text-warning-ink'
                    : 'text-ink'
              )}
            >
              {todayLoad.toLocaleString('hu-HU', { maximumFractionDigits: 0 })} /{' '}
              {data.capacityPerDayM} m
            </span>
            <span className="ml-1.5 text-hint font-medium text-ink-secondary">
              ({todayPct}%)
            </span>
          </p>
        </div>
      ) : null}

      <div className="h-[280px] w-full min-w-0">
        {empty ? (
          <p className="flex h-full items-center justify-center text-body text-ink-secondary">
            Nincs élzárás adat erre a hétre (H–P).
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
                tick={{ fontSize: 12, fill: '#525252' }}
                axisLine={{ stroke: '#E5E5E5' }}
                tickLine={false}
                tickFormatter={(label: string, index: number) =>
                  todayIndex === index ? `→ ${label}` : label
                }
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
                formatter={(value: number, name: string) => [
                  data.unit === 'm'
                    ? `${Number(value).toLocaleString('hu-HU', { maximumFractionDigits: 1 })} m`
                    : `${Number(value).toLocaleString('hu-HU')} db`,
                  name
                ]}
              />
              <Legend
                verticalAlign="top"
                height={32}
                wrapperStyle={{ fontSize: 12, paddingBottom: 4 }}
              />
              {data.unit === 'm' ? (
                <ReferenceLine
                  y={data.capacityPerDayM}
                  stroke="#E08600"
                  strokeDasharray="4 4"
                  label={{
                    value: `${data.capacityPerDayM} m`,
                    position: 'insideTopRight',
                    fill: '#A16207',
                    fontSize: 10
                  }}
                />
              ) : null}
              {data.series.map((s, idx) => (
                <Bar
                  key={s.name}
                  dataKey={s.name}
                  stackId="edge"
                  fill={homeEdgeColor(s.name, idx)}
                  radius={idx === data.series.length - 1 ? [3, 3, 0, 0] : 0}
                >
                  {chartData.map((row, i) => (
                    <Cell
                      key={`${s.name}-${i}`}
                      fill={homeEdgeColor(s.name, idx)}
                      stroke={row.isToday ? '#18181B' : undefined}
                      strokeWidth={row.isToday ? 1 : 0}
                    />
                  ))}
                </Bar>
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
