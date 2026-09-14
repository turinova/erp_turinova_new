'use client'

import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'

import type { WeeklyCuttingData } from '@/lib/home/chart-queries'

const COLORS = [
  '#18181B',
  '#525252',
  '#737373',
  '#A3A3A3',
  '#404040',
  '#27272A',
  '#71717A'
]

type Props = {
  data: WeeklyCuttingData
}

export function WeeklyCuttingChart({ data }: Props) {
  const chartData = useMemo(() => {
    return data.categories.map((label, i) => {
      const row: Record<string, string | number> = {
        name: label,
        Kész: data.doneTotals[i] ?? 0,
        Hátra: data.remainingTotals[i] ?? 0
      }
      for (const s of data.series) {
        row[s.name] = s.data[i] ?? 0
      }
      return row
    })
  }, [data])

  const hasMachineSeries = data.series.length > 0
  const empty =
    !hasMachineSeries && data.dailyTotals.every((v) => v === 0)

  return (
    <div className="min-w-0 w-full">
      <div className="h-[260px] w-full min-w-0">
        {empty ? (
          <p className="flex h-full items-center justify-center text-body text-ink-secondary">
            Nincs gyártási adat erre a hétre.
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
              {hasMachineSeries
                ? data.series.map((s, idx) => (
                    <Bar
                      key={s.name}
                      dataKey={s.name}
                      stackId="machines"
                      fill={COLORS[idx % COLORS.length]}
                      radius={
                        idx === data.series.length - 1 ? [2, 2, 0, 0] : 0
                      }
                    />
                  ))
                : null}
              {!hasMachineSeries ? (
                <>
                  <Bar
                    dataKey="Kész"
                    stackId="status"
                    fill="#12A150"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="Hátra"
                    stackId="status"
                    fill="#18181B"
                    radius={[2, 2, 0, 0]}
                  />
                </>
              ) : null}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {data.unit === 'db' && data.orderCount > 0 ? (
        <p className="mt-2 text-hint text-warning-ink">
          {data.orderCount} megrendelés a héten, de a szabásméter 0 — az ajánlat
          anyagsorain nincs cutting hossz (Opti / mentett árazás). Most db
          szerint látszik.
        </p>
      ) : null}
      {data.machineLimits.length > 0 ? (
        <p className="mt-2 text-hint text-ink-muted">
          Napi limit:{' '}
          {data.machineLimits
            .map((m) => `${m.machineName} ${m.limit} m`)
            .join(' · ')}
        </p>
      ) : null}
      {data.unit === 'm' ? (
        <p className="mt-2 text-hint text-ink-muted">
          Kész{' '}
          {data.doneTotals
            .reduce((a, b) => a + b, 0)
            .toLocaleString('hu-HU', { maximumFractionDigits: 0 })}{' '}
          m · Hátra{' '}
          {data.remainingTotals
            .reduce((a, b) => a + b, 0)
            .toLocaleString('hu-HU', { maximumFractionDigits: 0 })}{' '}
          m
        </p>
      ) : null}
    </div>
  )
}
