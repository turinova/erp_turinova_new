'use client'

import { useEffect, useState } from 'react'

const TZ = 'Europe/Budapest'
const weekdayFmt = new Intl.DateTimeFormat('hu-HU', { timeZone: TZ, weekday: 'long' })
const dateFmt = new Intl.DateTimeFormat('hu-HU', { timeZone: TZ, month: 'long', day: 'numeric' })

function parts(d: Date) {
  const w = weekdayFmt.format(d)
  return { weekday: `${w.charAt(0).toUpperCase()}${w.slice(1)}`, date: dateFmt.format(d) }
}

function msUntilNextBudapestMidnight(d: Date): number {
  const [h, m, s] = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  })
    .format(d)
    .split(':')
    .map(Number)
  const elapsed = ((h ?? 0) * 3600 + (m ?? 0) * 60 + (s ?? 0)) * 1000
  return Math.max(1_000, 86_400_000 - elapsed + 1_000)
}

export function TopbarDate() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setTimeout(() => setNow(new Date()), msUntilNextBudapestMidnight(now))
    return () => window.clearTimeout(id)
  }, [now])

  const { weekday, date } = parts(now)
  return (
    <p className="flex items-baseline gap-1.5 whitespace-nowrap" suppressHydrationWarning>
      <span className="text-[15px] font-semibold text-ink">{weekday}</span>
      <span className="hidden text-[12.5px] text-ink-secondary sm:inline">{date}</span>
    </p>
  )
}
