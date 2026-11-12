'use client'

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'

import type { TenantReportWeekPoint } from '@/lib/platform/tenant-report-queries'
import { formatMoneyFt } from '@/lib/sales/parse'

type Props = {
  data: TenantReportWeekPoint[]
  mode: 'gmv' | 'orders'
  emptyLabel?: string
}

export function TenantReportTrendChart({
  data,
  mode,
  emptyLabel = 'Nincs adat ebben az időszakban.'
}: Props) {
  const empty =
    mode === 'gmv'
      ? data.every((d) => d.gmv === 0)
      : data.every((d) => d.orders === 0)

  if (empty) {
    return (
      <p className="flex h-36 items-center justify-center text-body text-ink-muted">
        {emptyLabel}
      </p>
    )
  }

  if (mode === 'gmv') {
    return (
      <div className="h-36 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="reportGmvFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#18181B" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#18181B" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#E4E4E7"
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#71717A' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              width={44}
              tick={{ fontSize: 10, fill: '#71717A' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) =>
                v >= 1_000_000
                  ? `${Math.round(v / 100_000) / 10}M`
                  : v >= 1000
                    ? `${Math.round(v / 1000)}k`
                    : String(v)
              }
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null
                const row = payload[0].payload as TenantReportWeekPoint
                return (
                  <div className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-hint shadow-sm">
                    <p className="font-medium text-ink">{row.label}</p>
                    <p className="tabular-nums text-ink-secondary">
                      {formatMoneyFt(row.gmv)} Ft · {row.orders} megrendelés
                    </p>
                  </div>
                )
              }}
            />
            <Area
              type="monotone"
              dataKey="gmv"
              stroke="#18181B"
              strokeWidth={1.5}
              fill="url(#reportGmvFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    )
  }

  return (
    <div className="h-36 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="#E4E4E7"
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#71717A' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            width={28}
            tick={{ fontSize: 11, fill: '#71717A' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: '#F4F4F5' }}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null
              const row = payload[0].payload as TenantReportWeekPoint
              return (
                <div className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-hint shadow-sm">
                  <p className="font-medium text-ink">{row.label}</p>
                  <p className="tabular-nums text-ink-secondary">
                    {row.orders} megrendelés · {formatMoneyFt(row.gmv)} Ft
                  </p>
                </div>
              )
            }}
          />
          <Bar
            dataKey="orders"
            fill="#18181B"
            radius={[3, 3, 0, 0]}
            maxBarSize={28}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
