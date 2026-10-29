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

import { homeMachineColor } from '@/lib/home/chart-colors'
import type { WeeklyCuttingData } from '@/lib/home/chart-queries'
import { addDaysYmd, budapestTodayYmd } from '@/lib/home/date'
import { cn } from '@/lib/utils'

type Props = {
  data: WeeklyCuttingData
}

function formatM(n: number, digits = 0) {
  return n.toLocaleString('hu-HU', { maximumFractionDigits: digits })
}

export function WeeklyCuttingChart({ data }: Props) {
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

  const hasMachineSeries = data.series.length > 0
  const empty =
    !hasMachineSeries && data.dailyTotals.every((v) => v === 0)

  const remainingSum = data.remainingTotals.reduce((a, b) => a + b, 0)
  const doneSum = data.doneTotals.reduce((a, b) => a + b, 0)

  const todayLoad = todayIndex != null ? (data.dailyTotals[todayIndex] ?? 0) : 0
  const limitSum = data.machineLimits.reduce((s, m) => s + (m.limit || 0), 0)
  const todayPct =
    data.unit === 'm' && limitSum > 0 && todayIndex != null
      ? Math.round((todayLoad / limitSum) * 100)
      : null

  const maxLimit = Math.max(0, ...data.machineLimits.map((m) => m.limit || 0))

  let statusTone: 'ok' | 'warn' | 'danger' | null = null
  let statusText: string | null = null
  if (data.unit === 'm' && !empty) {
    if (todayPct != null && todayPct > 100) {
      statusTone = 'danger'
      statusText = `Ma túlfoglalt: ${todayPct}%`
    } else if (todayPct != null && todayPct >= 85) {
      statusTone = 'warn'
      statusText = `Ma közel a limithez: ${todayPct}%`
    } else if (todayPct != null) {
      statusTone = 'ok'
      statusText = `Ma rendben — ${todayPct}%`
    } else if (remainingSum > 0) {
      statusTone = 'warn'
      statusText = `Hátra ${formatM(remainingSum)} m a héten`
    }
  }

  return (
    <div className="min-w-0 w-full">
      {!empty && data.unit === 'm' ? (
        <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          {todayPct != null ? (
            <p className="text-body font-semibold tabular-nums text-ink">
              Mai terhelés{' '}
              <span
                className={cn(
                  todayPct > 100
                    ? 'text-danger-ink'
                    : todayPct >= 85
                      ? 'text-warning-ink'
                      : 'text-ink'
                )}
              >
                {todayPct}%
              </span>
            </p>
          ) : null}
          <p className="text-body tabular-nums text-ink-secondary">
            Hátra{' '}
            <span className="font-semibold text-ink">
              {formatM(remainingSum)} m
            </span>
          </p>
          <p className="text-hint tabular-nums text-ink-muted">
            Kész {formatM(doneSum)} m
          </p>
          {statusText ? (
            <p
              className={cn(
                'text-hint font-medium',
                statusTone === 'danger' && 'text-danger-ink',
                statusTone === 'warn' && 'text-warning-ink',
                statusTone === 'ok' && 'text-success-ink'
              )}
            >
              {statusText}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="h-[280px] w-full min-w-0">
        {empty ? (
          <p className="flex h-full items-center justify-center text-body text-ink-secondary">
            Nincs gyártási adat erre a hétre (H–P).
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 12, left: 4, bottom: 8 }}
              barCategoryGap="18%"
              barGap={2}
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
                formatter={(value: number, name: string) => {
                  const lim = data.machineLimits.find(
                    (m) => m.machineName === name
                  )?.limit
                  const base =
                    data.unit === 'm'
                      ? `${formatM(Number(value), 1)} m`
                      : `${formatM(Number(value))} db`
                  if (lim && data.unit === 'm' && lim > 0) {
                    const pct = Math.round((Number(value) / lim) * 100)
                    return [`${base} (${pct}% / ${lim} m)`, name]
                  }
                  return [base, name]
                }}
              />
              <Legend
                verticalAlign="top"
                height={32}
                wrapperStyle={{ fontSize: 12, paddingBottom: 4 }}
                formatter={(value: string) => {
                  const lim = data.machineLimits.find(
                    (m) => m.machineName === value
                  )?.limit
                  if (lim && data.unit === 'm') {
                    return `${value} · ${lim} m`
                  }
                  return value
                }}
              />
              {data.unit === 'm' && maxLimit > 0 ? (
                <ReferenceLine
                  y={maxLimit}
                  stroke="#E08600"
                  strokeDasharray="4 4"
                  label={{
                    value: `Limit ${maxLimit} m`,
                    position: 'insideTopRight',
                    fill: '#A16207',
                    fontSize: 10
                  }}
                />
              ) : null}
              {hasMachineSeries
                ? data.series.map((s, idx) => (
                    <Bar
                      key={s.name}
                      dataKey={s.name}
                      fill={homeMachineColor(idx)}
                      radius={[3, 3, 0, 0]}
                      maxBarSize={36}
                    >
                      {chartData.map((row, i) => (
                        <Cell
                          key={`${s.name}-${i}`}
                          fill={homeMachineColor(idx)}
                          stroke={row.isToday ? '#18181B' : undefined}
                          strokeWidth={row.isToday ? 1.5 : 0}
                        />
                      ))}
                    </Bar>
                  ))
                : null}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {data.unit === 'db' && data.orderCount > 0 ? (
        <p className="mt-2 text-hint text-warning-ink">
          {data.orderCount} megrendelés a héten, de a szabásméter 0 — az ajánlat
          anyagsorain nincs cutting hossz. Most db szerint látszik.
        </p>
      ) : null}
      {data.machineLimits.length > 1 ? (
        <p className="mt-2 text-hint text-ink-muted">
          A sárga vonal a legmagasabb géplimit ({maxLimit} m). Tooltipben gépenkénti
          %.
        </p>
      ) : null}
    </div>
  )
}
