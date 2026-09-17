'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { UsersRound } from 'lucide-react'

import { BelepokLiveIndicator } from '@/components/footcounter/belepok-live-indicator'
import type { FootcounterHomeSlim } from '@/lib/footcounter/types'
import { cn } from '@/lib/utils'

const HOUR_START = 7
const HOUR_END = 18

function heatOpacity(value: number, max: number): number {
  if (max <= 0 || value <= 0) return 0.06
  const t = Math.min(1, value / max)
  return 0.12 + t * 0.78
}

function formatShortTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('hu-HU', {
    timeZone: 'Europe/Budapest',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
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

  const activeHours = slice.filter((v) => v > 0).length

  return (
    <section className="rounded-md border border-border bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <UsersRound className="size-4 text-ink-muted" aria-hidden />
          <h2 className="text-body font-semibold text-ink">Mai forgalom</h2>
          <Link
            href="/belepok"
            className="text-hint text-ink-secondary no-underline hover:underline"
          >
            Belépők →
          </Link>
        </div>
        <BelepokLiveIndicator
          status={data.liveStatus}
          lastSeenAt={data.deviceLastSeen}
        />
      </div>

      {!hasData && data.todayIn === 0 ? (
        <p className="py-4 text-center text-body text-ink-secondary">
          Ma még nincs belépő.
        </p>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-hint text-ink-secondary">Napi eloszlás</p>
            {hasData ? (
              <p className="text-hint tabular-nums text-ink-secondary">
                Csúcs:{' '}
                <span className="font-semibold text-ink">
                  {String(peak.hour).padStart(2, '0')}:00
                </span>{' '}
                ({peak.count}) · Aktív: {activeHours}h
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <div className="min-w-[3.25rem] shrink-0 text-center">
              <p className="text-xl font-semibold tabular-nums leading-none text-success-ink">
                {data.todayIn.toLocaleString('hu-HU')}
              </p>
              <p className="mt-0.5 text-[11px] text-ink-muted">belépő</p>
            </div>

            <div className="min-w-0 flex-1">
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
            </div>

            <div className="min-w-[3.25rem] shrink-0 text-center">
              <p className="text-xl font-semibold tabular-nums leading-none text-warning-ink">
                {data.todayOut.toLocaleString('hu-HU')}
              </p>
              <p className="mt-0.5 text-[11px] text-ink-muted">kilépő</p>
            </div>
          </div>
        </>
      )}

      <p className="mt-3 border-t border-border pt-2 text-hint text-ink-secondary">
        Utolsó észlelés:{' '}
        <span className="font-medium text-ink">
          {formatShortTime(data.lastEventAt ?? data.deviceLastSeen)}
        </span>
      </p>
    </section>
  )
}
