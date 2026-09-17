'use client'

import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'

import type { FootcounterMonthDay } from '@/lib/footcounter/types'

const MONTH_SHORT = [
  'jan.',
  'febr.',
  'márc.',
  'ápr.',
  'máj.',
  'jún.',
  'júl.',
  'aug.',
  'szept.',
  'okt.',
  'nov.',
  'dec.'
]

const COLOR = {
  strong: '#12a150',
  mid: '#e08600',
  weak: '#dc2626',
  zero: '#E5E5E5'
} as const

type Band = 'strong' | 'mid' | 'weak' | 'zero'

type Props = {
  year: number
  month: number
  days: FootcounterMonthDay[]
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  if (sorted.length === 1) return sorted[0]
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

function bandFor(count: number, p25: number, median: number, p75: number): Band {
  if (count <= 0) return 'zero'
  if (count <= p25 || count < median * 0.7) return 'weak'
  if (count >= p75 || count > median * 1.15) return 'strong'
  return 'mid'
}

function bandLabel(band: Band): string {
  if (band === 'strong') return 'erős'
  if (band === 'weak') return 'gyenge'
  if (band === 'mid') return 'átlag'
  return 'zárva'
}

export function BelepokMonthChart({ year, month, days }: Props) {
  const { chartData, empty } = useMemo(() => {
    const open = days.map((d) => d.count).filter((c) => c > 0).sort((a, b) => a - b)
    const p25 = percentile(open, 0.25)
    const median = percentile(open, 0.5)
    const p75 = percentile(open, 0.75)

    const chartData = days.map((d) => {
      const band = bandFor(d.count, p25, median, p75)
      return {
        day: d.day,
        label: String(d.day),
        count: d.count,
        band,
        fill: COLOR[band]
      }
    })

    return {
      chartData,
      empty: days.every((d) => d.count === 0)
    }
  }, [days])

  return (
    <div className="min-w-0 w-full">
      <div className="h-[280px] w-full min-w-0 sm:h-[320px]">
        {empty ? (
          <p className="flex h-full items-center justify-center text-body text-ink-secondary">
            Nincs belépő adat erre a hónapra.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#E5E5E5"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: '#737373' }}
                axisLine={{ stroke: '#E5E5E5' }}
                tickLine={false}
                interval={0}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#737373' }}
                axisLine={false}
                tickLine={false}
                width={40}
                allowDecimals={false}
                tickFormatter={(v) =>
                  Number(v).toLocaleString('hu-HU', {
                    maximumFractionDigits: 0
                  })
                }
              />
              <Tooltip
                cursor={{ fill: '#F5F5F5' }}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 6,
                  border: '1px solid #E5E5E5',
                  background: '#fff'
                }}
                labelFormatter={(label) => {
                  const day = Number(label)
                  return `${MONTH_SHORT[month - 1]} ${day}.`
                }}
                formatter={(value: number, _name, item) => {
                  const band = (item?.payload as { band?: Band } | undefined)
                    ?.band
                  const tag = band ? ` · ${bandLabel(band)}` : ''
                  return [
                    `${Number(value).toLocaleString('hu-HU')} belépő${tag}`,
                    ''
                  ]
                }}
              />
              <Bar
                dataKey="count"
                name="Belépők"
                radius={[2, 2, 0, 0]}
                maxBarSize={28}
              >
                {chartData.map((d) => (
                  <Cell key={d.day} fill={d.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {!empty ? (
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-hint text-ink-muted">
          <li className="inline-flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-sm"
              style={{ background: COLOR.strong }}
              aria-hidden
            />
            Erős
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-sm"
              style={{ background: COLOR.mid }}
              aria-hidden
            />
            Átlag
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-sm"
              style={{ background: COLOR.weak }}
              aria-hidden
            />
            Gyenge
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-sm"
              style={{ background: COLOR.zero }}
              aria-hidden
            />
            Zárva
          </li>
        </ul>
      ) : null}

      <p className="sr-only">
        {year}. {MONTH_SHORT[month - 1]} belépők naponta. Színek: erős zöld,
        átlag narancs, gyenge piros, zárva szürke.
      </p>
    </div>
  )
}
