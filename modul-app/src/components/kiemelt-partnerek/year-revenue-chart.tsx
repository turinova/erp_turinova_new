'use client'

import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'

import { Select } from '@/components/ui/select'
import { KIEMELT_COPY } from '@/lib/kiemelt-partnerek/copy'
import type { KiemeltYearMonth } from '@/lib/kiemelt-partnerek/queries'
import { formatCompactFt } from '@/lib/kiemelt-partnerek/queries'
import { formatMoneyFt } from '@/lib/sales/parse'

type Props = {
  months: KiemeltYearMonth[]
  ytdGross: number
  priorYtdGross: number | null
  year: number
  availableYears: number[]
  onYearChange: (year: number) => void
}

export function YearRevenueChart({
  months,
  ytdGross,
  priorYtdGross,
  year,
  availableYears,
  onYearChange
}: Props) {
  const chartData = useMemo(
    () => months.map((m) => ({ name: m.label, gross: m.gross })),
    [months]
  )
  const empty = chartData.every((d) => d.gross === 0)

  let deltaLabel: string | null = null
  if (priorYtdGross != null && priorYtdGross > 0) {
    const pct = Math.round(((ytdGross - priorYtdGross) / priorYtdGross) * 100)
    deltaLabel = KIEMELT_COPY.chartPriorDelta(pct, year - 1)
  } else if (priorYtdGross === 0 && ytdGross > 0) {
    deltaLabel = KIEMELT_COPY.chartPriorNew(year - 1)
  } else if (priorYtdGross == null) {
    deltaLabel = KIEMELT_COPY.chartNoPrior
  }

  return (
    <div className="w-full rounded-md border border-border bg-surface px-3 py-2.5">
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="text-hint font-semibold uppercase tracking-wide text-ink-secondary">
          {KIEMELT_COPY.chartTitle}
        </p>
        <Select
          id="kiemelt-year"
          className="h-7 w-[4.75rem] px-1.5 text-hint"
          value={String(year)}
          aria-label="Év"
          onChange={(e) => onYearChange(Number(e.target.value))}
        >
          {availableYears.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
      </div>
      <p className="mb-2 text-[1.25rem] font-semibold tabular-nums text-ink">
        {KIEMELT_COPY.chartYtd}: {formatCompactFt(ytdGross)}
      </p>
      {deltaLabel ? (
        <p className="mb-2 text-hint tabular-nums text-ink-secondary">
          {deltaLabel}
        </p>
      ) : null}
      {empty ? (
        <p className="py-8 text-center text-body text-ink-secondary">
          {KIEMELT_COPY.chartEmpty}
        </p>
      ) : (
        <div className="h-[180px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                vertical={false}
                stroke="#E4E4E7"
                strokeDasharray="3 3"
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: '#71717A' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                width={44}
                tick={{ fontSize: 10, fill: '#71717A' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => {
                  const n = Number(v) || 0
                  if (n >= 1_000_000) return `${Math.round(n / 1_000_000)}M`
                  if (n >= 1000) return `${Math.round(n / 1000)}E`
                  return String(n)
                }}
              />
              <Tooltip
                cursor={{ fill: '#F4F4F5' }}
                contentStyle={{
                  borderRadius: 6,
                  border: '1px solid #E4E4E7',
                  fontSize: 12,
                  padding: '6px 8px'
                }}
                formatter={(value) => {
                  const n = typeof value === 'number' ? value : Number(value) || 0
                  return [`${formatMoneyFt(n)} Ft`, KIEMELT_COPY.chartTooltip]
                }}
              />
              <Bar
                dataKey="gross"
                fill="#18181B"
                radius={[2, 2, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
