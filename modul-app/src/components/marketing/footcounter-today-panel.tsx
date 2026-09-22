'use client'

import { useEffect, useRef, useState } from 'react'

import {
  AppFrame,
  TodayHourlyChart
} from '@/components/marketing/beleposzamlalo-mockups'
import { BELEPOSZAMLALO_TODAY } from '@/lib/marketing/beleposzamlalo'
import {
  LIVE_CLOCK_LABEL,
  RUNNING_HOUR_FULL_IN,
  RUNNING_HOUR_FULL_OUT,
  TODAY,
  TODAY_HOURLY,
  TODAY_PEAK_HOUR,
  TODAY_WEEKDAY_AVG,
  type TodayHour
} from '@/lib/marketing/beleposzamlalo-demo-data'
import { cn } from '@/lib/utils'

const TICK_MS = 6_000

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** JS-vezérelt felszámolás — a CSS-animációk rendszerszinten tilthatók. */
function useCountUp(target: number, enabled: boolean): number {
  const [value, setValue] = useState(enabled ? 0 : target)
  const doneRef = useRef(false)

  useEffect(() => {
    if (!enabled || doneRef.current) {
      setValue(target)
      return
    }
    doneRef.current = true

    const duration = prefersReducedMotion() ? 400 : 900
    const start = performance.now()
    let frame = 0

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - (1 - t) * (1 - t)
      setValue(Math.round(target * eased))
      if (t < 1) frame = requestAnimationFrame(step)
    }

    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [target, enabled])

  return value
}

export function FootcounterTodayPanel({ className }: { className?: string }) {
  const [hourly, setHourly] = useState<TodayHour[]>(TODAY_HOURLY)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  // Élő tick: a futó óra tölt tovább, amíg el nem éri a teljes óra értékét.
  useEffect(() => {
    const id = window.setInterval(() => {
      setHourly((prev) => {
        const running = prev.find((h) => h.running)
        if (!running) return prev
        if (
          running.inCount >= RUNNING_HOUR_FULL_IN &&
          running.outCount >= RUNNING_HOUR_FULL_OUT
        ) {
          return prev
        }
        return prev.map((h) =>
          h.running
            ? {
                ...h,
                inCount: Math.min(
                  RUNNING_HOUR_FULL_IN,
                  h.inCount + 1 + Math.floor(Math.random() * 2)
                ),
                outCount: Math.min(
                  RUNNING_HOUR_FULL_OUT,
                  h.outCount + Math.floor(Math.random() * 2)
                )
              }
            : h
        )
      })
    }, TICK_MS)

    return () => window.clearInterval(id)
  }, [])

  const inSoFar = hourly.reduce((s, h) => s + h.inCount, 0)
  const outSoFar = hourly.reduce((s, h) => s + h.outCount, 0)
  const occupancy = Math.max(0, inSoFar - outSoFar)

  const shownIn = useCountUp(inSoFar, mounted)
  const shownOccupancy = useCountUp(occupancy, mounted)
  const pace = Math.round((inSoFar / TODAY_WEEKDAY_AVG) * 100)

  return (
    <AppFrame
      path="optinova.hu / belépők"
      className={className}
      badge="Mintaadat"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[13px] font-semibold text-ink">
            {BELEPOSZAMLALO_TODAY.title}
          </p>
          <p className="mt-0.5 text-[11.5px] text-ink-muted">{TODAY.label}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded border border-border bg-surface px-2 py-0.5 text-[11px] font-medium text-ink">
          <span
            className="size-1.5 animate-pulse rounded-full bg-danger"
            aria-hidden
          />
          Folyamatban · {LIVE_CLOCK_LABEL}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border-strong bg-subtle px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-wide text-ink-muted">
            Belépések ma
          </p>
          <p className="mt-1 text-[26px] font-semibold leading-none tabular-nums text-ink">
            {shownIn}
          </p>
          <p className="mt-1.5 text-[11.5px] text-ink-secondary">
            {outSoFar} kilépés
          </p>
        </div>

        <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-wide text-ink-muted">
            Becsült létszám
          </p>
          <p className="mt-1 text-[26px] font-semibold leading-none tabular-nums text-ink">
            ~{shownOccupancy}
          </p>
          <p className="mt-1.5 text-[11.5px] text-ink-secondary">
            a be- és kilépések különbsége
          </p>
        </div>

        <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-wide text-ink-muted">
            Csúcsóra
          </p>
          <p className="mt-1 text-[26px] font-semibold leading-none tabular-nums text-ink">
            {TODAY_PEAK_HOUR.hour}:00
          </p>
          <p className="mt-1.5 text-[11.5px] text-ink-secondary">
            {TODAY_PEAK_HOUR.inCount} belépés ebben az órában
          </p>
        </div>

        <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-wide text-ink-muted">
            Csütörtöki napi átlag
          </p>
          <p className="mt-1 text-[26px] font-semibold leading-none tabular-nums text-ink">
            {TODAY_WEEKDAY_AVG}
          </p>
          <p
            className={cn(
              'mt-1.5 text-[11.5px]',
              pace >= 100 ? 'text-ink' : 'text-ink-secondary'
            )}
          >
            A mai belépésszám eddig az átlag {pace}%-a
          </p>
        </div>
      </div>

      <div className="mt-4">
        <TodayHourlyChart hourly={hourly} />
      </div>
    </AppFrame>
  )
}
