'use client'

import Link from 'next/link'
import { useMemo } from 'react'

import { BelepokLiveIndicator } from '@/components/footcounter/belepok-live-indicator'
import { MetricCell, MetricRow } from '@/components/home/home-metric-row'
import type { FootcounterHomeSlim } from '@/lib/footcounter/types'
import { cn } from '@/lib/utils'

const HOUR_START = 7
const HOUR_END = 18

function heatOpacity(value: number, max: number): number {
  if (max <= 0 || value <= 0) return 0.06
  const t = Math.min(1, value / max)
  return 0.12 + t * 0.78
}

function budapestCurrentHour(): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Budapest',
    hour: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date())
  return Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
}

export function BelepokHomeCard({ data }: { data: FootcounterHomeSlim }) {
  const slice = data.hourlyIn.slice(HOUR_START, HOUR_END + 1)
  const max = Math.max(1, ...slice)
  const hasData = slice.some((v) => v > 0)
  const currentHour = budapestCurrentHour()

  const peak = useMemo(() => {
    let bestIdx = 0
    let bestVal = -1
    slice.forEach((v, i) => {
      if (v > bestVal) {
        bestVal = v
        bestIdx = i
      }
    })
    return { hour: HOUR_START + bestIdx, count: bestVal }
  }, [slice])

  const netInside = Math.max(0, data.todayIn - data.todayOut)

  return (
    <div className="space-y-2">
      <MetricRow title="Belépők" href="/belepok" hrefLabel="Részletek →" cols={4}>
        <MetricCell
          label="Mai belépő"
          value={data.todayIn.toLocaleString('hu-HU')}
          href="/belepok"
          emphasize={data.todayIn > 0 ? 'success' : null}
        />
        <MetricCell
          label="Mai kilépő"
          value={data.todayOut.toLocaleString('hu-HU')}
          href="/belepok"
        />
        <MetricCell
          label="Csúcs óra"
          value={hasData ? `${String(peak.hour).padStart(2, '0')}:00` : '—'}
          href="/belepok"
          hint={hasData ? `${peak.count} belépő` : undefined}
        />
        <MetricCell
          label="Nettó bent"
          value={String(netInside)}
          href="/belepok"
          hint={
            data.liveStatus === 'live'
              ? 'Élő eszköz'
              : data.liveStatus === 'offline'
                ? 'Eszköz offline'
                : undefined
          }
          emphasize={netInside > 0 ? 'success' : null}
        />
      </MetricRow>

      <div className="rounded-md border border-border bg-surface px-3 py-2.5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-hint text-ink-secondary">Napi eloszlás (7–18)</p>
          <BelepokLiveIndicator
            status={data.liveStatus}
            lastSeenAt={data.deviceLastSeen}
          />
        </div>
        {!hasData && data.todayIn === 0 ? (
          <p className="py-2 text-body text-ink-secondary">Ma még nincs belépő.</p>
        ) : (
          <>
            <div className="flex gap-0.5 overflow-hidden rounded-sm">
              {slice.map((v, i) => {
                const hour = HOUR_START + i
                const isCurrent = hour === currentHour
                return (
                  <div
                    key={hour}
                    title={`${hour}:00 — ${v} belépő`}
                    className={cn(
                      'h-[22px] flex-1 rounded-[3px]',
                      isCurrent && 'ring-1 ring-ink/40 ring-offset-0'
                    )}
                    style={{
                      backgroundColor: `rgba(24, 24, 27, ${heatOpacity(v, max)})`
                    }}
                  />
                )
              })}
            </div>
            <div className="mt-0.5 flex gap-0.5">
              {slice.map((_, i) => {
                const hour = HOUR_START + i
                const show =
                  hour === HOUR_START || hour === 12 || hour === HOUR_END
                return (
                  <div key={hour} className="flex-1 text-center">
                    {show ? (
                      <span className="text-[10px] tabular-nums text-ink-muted">
                        {hour}
                      </span>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </>
        )}
        <p className="mt-2 text-right">
          <Link
            href="/belepok"
            className="text-hint text-ink-secondary no-underline hover:underline"
          >
            Teljes napló →
          </Link>
        </p>
      </div>
    </div>
  )
}
